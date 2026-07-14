-- Kairoyr Direct homework Phase 1. Rollback: drop RPCs/policies first, then the seven
-- homework tables in reverse dependency order. Published history should be exported first.
create table if not exists public.homeworks (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id),
  batch_id uuid not null references public.batches(id), class_report_id text, created_by uuid not null references public.profiles(id),
  created_by_role text not null check (created_by_role in ('academy_admin','coach','super_admin')),
  title text not null check (char_length(trim(title)) between 1 and 160), instructions text, parent_note text,
  assigned_date date not null default current_date, due_date timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  public_code uuid not null default gen_random_uuid() unique, excluded_student_ids uuid[] not null default '{}',
  published_at timestamptz, cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (due_date >= assigned_date::timestamptz)
);
create table if not exists public.homework_tasks (
  id uuid primary key default gen_random_uuid(), homework_id uuid not null references public.homeworks(id) on delete cascade,
  task_order integer not null check (task_order > 0), task_type text not null check (task_type in ('custom','external_link','written_answer','game_submission','offline_practice')),
  title text not null check (char_length(trim(title)) between 1 and 200), instructions text, external_url text,
  submission_type text not null check (submission_type in ('self_confirm','written_text','external_url','pgn_text','file_upload','none')),
  requires_review boolean not null default true, is_required boolean not null default true, completion_config jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(homework_id, task_order),
  check ((task_type = 'external_link' and external_url ~* '^https?://') or (task_type <> 'external_link' and external_url is null)),
  check (not (submission_type = 'self_confirm' and requires_review))
);
create table if not exists public.student_homework_assignments (
  id uuid primary key default gen_random_uuid(), homework_id uuid not null references public.homeworks(id), academy_id uuid not null references public.academies(id),
  batch_id uuid not null references public.batches(id), student_id uuid not null references public.students(id),
  status text not null default 'assigned' check (status in ('assigned','opened','in_progress','submitted','needs_review','completed','needs_correction','overdue','completed_late','excused','cancelled')),
  assigned_at timestamptz not null default now(), first_opened_at timestamptz, started_at timestamptz, submitted_at timestamptz,
  completed_at timestamptz, last_activity_at timestamptz, is_late boolean not null default false,
  excused_at timestamptz, excused_by uuid references public.profiles(id), excuse_reason text, coach_feedback text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(homework_id, student_id)
);
create table if not exists public.student_homework_task_progress (
  id uuid primary key default gen_random_uuid(), student_homework_assignment_id uuid not null references public.student_homework_assignments(id) on delete cascade,
  homework_task_id uuid not null references public.homework_tasks(id), status text not null default 'assigned' check (status in ('assigned','opened','in_progress','submitted','needs_review','completed','needs_correction','excused','cancelled')),
  opened_at timestamptz, started_at timestamptz, submitted_at timestamptz, completed_at timestamptz, self_confirmed_at timestamptz,
  submission_text text check (char_length(submission_text) <= 12000), submission_url text check (submission_url is null or submission_url ~* '^https?://'),
  submission_pgn text check (char_length(submission_pgn) <= 100000), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
  review_status text check (review_status is null or review_status in ('approved','needs_correction')), coach_feedback text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(student_homework_assignment_id, homework_task_id)
);
create table if not exists public.homework_submission_files (
  id uuid primary key default gen_random_uuid(), task_progress_id uuid not null references public.student_homework_task_progress(id) on delete cascade,
  storage_bucket text not null, storage_path text not null, original_file_name text, mime_type text check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  file_size bigint check (file_size between 1 and 10485760), uploaded_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(storage_bucket, storage_path)
);
create table if not exists public.homework_events (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id), homework_id uuid not null references public.homeworks(id),
  student_homework_assignment_id uuid references public.student_homework_assignments(id), homework_task_id uuid references public.homework_tasks(id),
  actor_user_id uuid references public.profiles(id), actor_type text not null, event_type text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.homework_reminders (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id), homework_id uuid not null references public.homeworks(id),
  student_homework_assignment_id uuid references public.student_homework_assignments(id), reminder_type text not null check (reminder_type in ('batch_group','individual_parent','due_soon','overdue','needs_correction')),
  message_text text not null, generated_by uuid not null references public.profiles(id), copied_at timestamptz, marked_sent_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists homeworks_scope_idx on public.homeworks(academy_id,batch_id,status); create index if not exists homeworks_due_idx on public.homeworks(due_date);
create index if not exists homeworks_creator_idx on public.homeworks(created_by); create index if not exists homeworks_report_idx on public.homeworks(class_report_id);
create index if not exists homework_tasks_homework_idx on public.homework_tasks(homework_id,task_order); create index if not exists assignments_scope_idx on public.student_homework_assignments(academy_id,batch_id,status);
create index if not exists assignments_student_idx on public.student_homework_assignments(student_id,status); create index if not exists task_progress_review_idx on public.student_homework_task_progress(status,submitted_at);
create index if not exists events_homework_idx on public.homework_events(homework_id,created_at desc); create index if not exists reminders_homework_idx on public.homework_reminders(homework_id,created_at desc);
do $$ declare i text; begin
  foreach i in array array['homeworks','homework_tasks','student_homework_assignments','student_homework_task_progress'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', i, i);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', i, i);
  end loop;
end $$;

create or replace function public.can_manage_homework_batch(target_academy uuid, target_batch uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_super_admin() or public.has_academy_role(target_academy,'academy_admin') or exists(
  select 1 from public.batches b join public.coaches c on c.id=b.primary_coach_id
  where b.id=target_batch and b.academy_id=target_academy and b.status='active' and c.user_id=auth.uid() and c.status='active'); $$;
create or replace function public.is_own_homework_assignment(target_assignment uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_homework_assignments a join public.students s on s.id=a.student_id where a.id=target_assignment and s.user_id=auth.uid()); $$;

alter table public.homeworks enable row level security; alter table public.homework_tasks enable row level security; alter table public.student_homework_assignments enable row level security;
alter table public.student_homework_task_progress enable row level security; alter table public.homework_submission_files enable row level security; alter table public.homework_events enable row level security; alter table public.homework_reminders enable row level security;
drop policy if exists "Managers read scoped homework" on public.homeworks;
create policy "Managers read scoped homework"
on public.homeworks
for select
to authenticated
using (
  public.can_manage_homework_batch(homeworks.academy_id, homeworks.batch_id)
  or exists (
    select 1
    from public.student_homework_assignments as assignment
    join public.students as student
      on student.id = assignment.student_id
    where assignment.homework_id = homeworks.id
      and student.user_id = auth.uid()
  )
);
drop policy if exists "Managers create scoped homework" on public.homeworks;
create policy "Managers create scoped homework" on public.homeworks for insert to authenticated with check (homeworks.created_by=auth.uid() and public.can_manage_homework_batch(homeworks.academy_id,homeworks.batch_id));
drop policy if exists "Managers update scoped homework" on public.homeworks;
create policy "Managers update scoped homework" on public.homeworks for update to authenticated using (public.can_manage_homework_batch(homeworks.academy_id,homeworks.batch_id)) with check (public.can_manage_homework_batch(homeworks.academy_id,homeworks.batch_id));
drop policy if exists "Users read visible tasks" on public.homework_tasks;
create policy "Users read visible tasks" on public.homework_tasks for select to authenticated using (exists(select 1 from public.homeworks as homework where homework.id=homework_tasks.homework_id));
drop policy if exists "Managers manage draft tasks" on public.homework_tasks;
create policy "Managers manage draft tasks" on public.homework_tasks for all to authenticated using (exists(select 1 from public.homeworks as homework where homework.id=homework_tasks.homework_id and homework.status='draft' and public.can_manage_homework_batch(homework.academy_id,homework.batch_id))) with check (exists(select 1 from public.homeworks as homework where homework.id=homework_tasks.homework_id and homework.status='draft' and public.can_manage_homework_batch(homework.academy_id,homework.batch_id)));
drop policy if exists "Managers read assignments" on public.student_homework_assignments;
create policy "Managers read assignments" on public.student_homework_assignments for select to authenticated using (public.can_manage_homework_batch(student_homework_assignments.academy_id,student_homework_assignments.batch_id) or public.is_own_homework_assignment(student_homework_assignments.id));
drop policy if exists "Users read visible task progress" on public.student_homework_task_progress;
create policy "Users read visible task progress" on public.student_homework_task_progress for select to authenticated using (public.is_own_homework_assignment(student_homework_task_progress.student_homework_assignment_id) or exists(select 1 from public.student_homework_assignments as assignment where assignment.id=student_homework_task_progress.student_homework_assignment_id and public.can_manage_homework_batch(assignment.academy_id,assignment.batch_id)));
drop policy if exists "Users read own files" on public.homework_submission_files;
create policy "Users read own files" on public.homework_submission_files for select to authenticated using (exists(select 1 from public.student_homework_task_progress as progress where progress.id=homework_submission_files.task_progress_id and public.is_own_homework_assignment(progress.student_homework_assignment_id)) or exists(select 1 from public.student_homework_task_progress as progress join public.student_homework_assignments as assignment on assignment.id=progress.student_homework_assignment_id where progress.id=homework_submission_files.task_progress_id and public.can_manage_homework_batch(assignment.academy_id,assignment.batch_id)));
drop policy if exists "Managers read events" on public.homework_events;
create policy "Managers read events" on public.homework_events for select to authenticated using (exists(select 1 from public.homeworks as homework where homework.id=homework_events.homework_id and public.can_manage_homework_batch(homework.academy_id,homework.batch_id)));
drop policy if exists "Managers read reminders" on public.homework_reminders;
create policy "Managers read reminders" on public.homework_reminders for select to authenticated using (public.can_manage_homework_batch(homework_reminders.academy_id,(select homework.batch_id from public.homeworks as homework where homework.id=homework_reminders.homework_id)));

create or replace function public.recalculate_homework_assignment(target_assignment uuid) returns text language plpgsql security definer set search_path=public as $$
declare a public.student_homework_assignments%rowtype; due_at timestamptz; next_status text; incomplete int; corrections int; reviews int;
begin select * into a from public.student_homework_assignments where id=target_assignment for update; if a.id is null then raise exception 'Assignment not found.'; end if;
 select due_date into due_at from public.homeworks where id=a.homework_id;
 select count(*) filter(where t.is_required and p.status not in ('completed','excused')), count(*) filter(where t.is_required and p.status='needs_correction'), count(*) filter(where t.is_required and p.status in ('submitted','needs_review')) into incomplete,corrections,reviews from public.student_homework_task_progress p join public.homework_tasks t on t.id=p.homework_task_id where p.student_homework_assignment_id=a.id;
 next_status:=case when a.status in ('excused','cancelled') then a.status when incomplete=0 then case when now()>due_at then 'completed_late' else 'completed' end when corrections>0 then 'needs_correction' when now()>due_at then 'overdue' when reviews>0 then 'needs_review' when a.started_at is not null then 'in_progress' when a.first_opened_at is not null then 'opened' else 'assigned' end;
 update public.student_homework_assignments set status=next_status,is_late=(next_status='completed_late'),completed_at=case when next_status in ('completed','completed_late') then coalesce(completed_at,now()) else completed_at end,last_activity_at=now() where id=a.id; return next_status; end $$;

create or replace function public.publish_homework(target_homework uuid) returns integer language plpgsql security definer set search_path=public as $$
declare h public.homeworks%rowtype; assignment_count int;
begin select * into h from public.homeworks where id=target_homework for update; if h.id is null or not public.can_manage_homework_batch(h.academy_id,h.batch_id) then raise exception 'Homework not found or access denied.'; end if;
 if h.status not in ('draft','published') then raise exception 'Only draft homework can be published.'; end if;
 if not exists(select 1 from public.homework_tasks where homework_id=h.id) then raise exception 'Add at least one task before publishing.'; end if;
 if not exists(select 1 from public.batch_students bs join public.students s on s.id=bs.student_id where bs.batch_id=h.batch_id and bs.status='active' and s.status='active' and not(s.id=any(h.excluded_student_ids))) then raise exception 'This batch has no active students. Add students before publishing homework.'; end if;
 insert into public.student_homework_assignments(homework_id,academy_id,batch_id,student_id) select h.id,h.academy_id,h.batch_id,s.id from public.batch_students bs join public.students s on s.id=bs.student_id where bs.batch_id=h.batch_id and bs.status='active' and s.status='active' and not(s.id=any(h.excluded_student_ids)) on conflict(homework_id,student_id) do nothing;
 insert into public.student_homework_task_progress(student_homework_assignment_id,homework_task_id) select a.id,t.id from public.student_homework_assignments a join public.homework_tasks t on t.homework_id=a.homework_id where a.homework_id=h.id on conflict do nothing;
 update public.homeworks set status='published',published_at=coalesce(published_at,now()) where id=h.id;
 insert into public.homework_events(academy_id,homework_id,actor_user_id,actor_type,event_type) select h.academy_id,h.id,auth.uid(),'user','homework_published' where not exists(select 1 from public.homework_events as event where event.homework_id=h.id and event.event_type='homework_published');
 select count(*) into assignment_count from public.student_homework_assignments where homework_id=h.id; return assignment_count; end $$;

create or replace function public.open_homework_assignment(target_assignment uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_own_homework_assignment(target_assignment) then raise exception 'Access denied.'; end if;
 update public.student_homework_assignments set first_opened_at=coalesce(first_opened_at,now()),status=case when status='assigned' then 'opened' else status end,last_activity_at=now() where id=target_assignment and status not in ('cancelled','excused');
 insert into public.homework_events(academy_id,homework_id,student_homework_assignment_id,actor_user_id,actor_type,event_type) select assignment.academy_id,assignment.homework_id,assignment.id,auth.uid(),'student','assignment_opened' from public.student_homework_assignments as assignment where assignment.id=target_assignment and not exists(select 1 from public.homework_events as event where event.student_homework_assignment_id=target_assignment and event.event_type='assignment_opened'); end $$;

create or replace function public.submit_homework_task(target_progress uuid, answer_text text default null, answer_url text default null, answer_pgn text default null, self_confirm boolean default false) returns text language plpgsql security definer set search_path=public as $$
declare p public.student_homework_task_progress%rowtype; t public.homework_tasks%rowtype; a public.student_homework_assignments%rowtype; next_task text;
begin select * into p from public.student_homework_task_progress where id=target_progress for update; if p.id is null or not public.is_own_homework_assignment(p.student_homework_assignment_id) then raise exception 'Access denied.'; end if; select * into t from public.homework_tasks where id=p.homework_task_id; select * into a from public.student_homework_assignments where id=p.student_homework_assignment_id;
 if a.status in ('cancelled','excused','completed','completed_late') then raise exception 'This assignment cannot be submitted.'; end if;
 if answer_url is not null and answer_url !~* '^https?://' then raise exception 'Only HTTP or HTTPS links are allowed.'; end if; if char_length(coalesce(answer_text,''))>12000 or char_length(coalesce(answer_pgn,''))>100000 then raise exception 'Submission is too long.'; end if;
 if self_confirm and (t.submission_type<>'self_confirm' or t.requires_review) then raise exception 'This task cannot be self-confirmed.'; end if;
 next_task:=case when self_confirm then 'completed' when t.requires_review then 'needs_review' else 'completed' end;
 update public.student_homework_task_progress set status=next_task,submission_text=answer_text,submission_url=answer_url,submission_pgn=answer_pgn,started_at=coalesce(started_at,now()),submitted_at=now(),self_confirmed_at=case when self_confirm then now() else self_confirmed_at end,completed_at=case when next_task='completed' then now() else null end,review_status=null where id=p.id;
 update public.student_homework_assignments set started_at=coalesce(started_at,now()),submitted_at=now(),last_activity_at=now() where id=a.id;
 insert into public.homework_events(academy_id,homework_id,student_homework_assignment_id,homework_task_id,actor_user_id,actor_type,event_type) values(a.academy_id,a.homework_id,a.id,t.id,auth.uid(),'student',case when self_confirm then 'task_self_confirmed' else 'task_submitted' end);
 perform public.recalculate_homework_assignment(a.id); return next_task; end $$;

create or replace function public.review_homework_task(target_progress uuid, decision text, feedback text default null) returns text language plpgsql security definer set search_path=public as $$
declare p public.student_homework_task_progress%rowtype; a public.student_homework_assignments%rowtype; next_task text;
begin select * into p from public.student_homework_task_progress where id=target_progress for update; select * into a from public.student_homework_assignments where id=p.student_homework_assignment_id; if p.id is null or not public.can_manage_homework_batch(a.academy_id,a.batch_id) then raise exception 'Access denied.'; end if;
 if p.status not in ('submitted','needs_review') or decision not in ('approve','return') then raise exception 'Invalid review transition.'; end if; if decision='return' and nullif(trim(coalesce(feedback,'')),'') is null then raise exception 'Feedback is required when returning work.'; end if;
 next_task:=case when decision='approve' then 'completed' else 'needs_correction' end; update public.student_homework_task_progress set status=next_task,reviewed_at=now(),reviewed_by=auth.uid(),review_status=case when decision='approve' then 'approved' else 'needs_correction' end,coach_feedback=feedback,completed_at=case when decision='approve' then now() else null end where id=p.id;
 insert into public.homework_events(academy_id,homework_id,student_homework_assignment_id,homework_task_id,actor_user_id,actor_type,event_type,metadata) values(a.academy_id,a.homework_id,a.id,p.homework_task_id,auth.uid(),'coach',case when decision='approve' then 'task_approved' else 'task_returned' end,jsonb_build_object('feedback',feedback)); perform public.recalculate_homework_assignment(a.id); return next_task; end $$;

create or replace function public.cancel_homework(target_homework uuid) returns void language plpgsql security definer set search_path=public as $$ declare h public.homeworks%rowtype; begin select * into h from public.homeworks where id=target_homework for update; if h.id is null or not public.can_manage_homework_batch(h.academy_id,h.batch_id) then raise exception 'Access denied.'; end if; update public.homeworks set status='cancelled',cancelled_at=now() where id=h.id and status='published'; update public.student_homework_assignments set status='cancelled' where homework_id=h.id and status not in ('completed','completed_late','excused'); update public.student_homework_task_progress set status='cancelled' where student_homework_assignment_id in(select assignment.id from public.student_homework_assignments as assignment where assignment.homework_id=h.id and assignment.status='cancelled') and status not in ('completed','excused'); insert into public.homework_events(academy_id,homework_id,actor_user_id,actor_type,event_type) values(h.academy_id,h.id,auth.uid(),'user','homework_cancelled'); end $$;

create or replace function public.set_homework_excused(target_assignment uuid, should_excuse boolean, reason text default null) returns text language plpgsql security definer set search_path=public as $$ declare a public.student_homework_assignments%rowtype; begin select * into a from public.student_homework_assignments where id=target_assignment for update; if a.id is null or not public.can_manage_homework_batch(a.academy_id,a.batch_id) then raise exception 'Access denied.'; end if; if should_excuse then update public.student_homework_assignments set status='excused',excused_at=now(),excused_by=auth.uid(),excuse_reason=reason where id=a.id; else update public.student_homework_assignments set status='assigned',excused_at=null,excused_by=null,excuse_reason=null where id=a.id; perform public.recalculate_homework_assignment(a.id); end if; insert into public.homework_events(academy_id,homework_id,student_homework_assignment_id,actor_user_id,actor_type,event_type,metadata) values(a.academy_id,a.homework_id,a.id,auth.uid(),'user',case when should_excuse then 'student_excused' else 'student_unexcused' end,jsonb_build_object('reason',reason)); return (select status from public.student_homework_assignments where id=a.id); end $$;

create or replace function public.record_homework_reminder(target_homework uuid,target_assignment uuid,kind text,message text,was_copied boolean default true) returns uuid language plpgsql security definer set search_path=public as $$ declare h public.homeworks%rowtype; reminder_id uuid; begin select * into h from public.homeworks where id=target_homework; if h.id is null or not public.can_manage_homework_batch(h.academy_id,h.batch_id) then raise exception 'Access denied.'; end if; insert into public.homework_reminders(academy_id,homework_id,student_homework_assignment_id,reminder_type,message_text,generated_by,copied_at) values(h.academy_id,h.id,target_assignment,kind,message,auth.uid(),case when was_copied then now() end) returning id into reminder_id; insert into public.homework_events(academy_id,homework_id,student_homework_assignment_id,actor_user_id,actor_type,event_type) values(h.academy_id,h.id,target_assignment,auth.uid(),'user',case when kind='batch_group' then 'homework_message_copied' else 'reminder_copied' end); return reminder_id; end $$;

revoke all on function public.recalculate_homework_assignment(uuid), public.publish_homework(uuid), public.open_homework_assignment(uuid), public.submit_homework_task(uuid,text,text,text,boolean), public.review_homework_task(uuid,text,text), public.cancel_homework(uuid), public.set_homework_excused(uuid,boolean,text), public.record_homework_reminder(uuid,uuid,text,text,boolean) from public, anon;
grant execute on function public.publish_homework(uuid), public.open_homework_assignment(uuid), public.submit_homework_task(uuid,text,text,text,boolean), public.review_homework_task(uuid,text,text), public.cancel_homework(uuid), public.set_homework_excused(uuid,boolean,text), public.record_homework_reminder(uuid,uuid,text,text,boolean) to authenticated;
revoke all on public.homework_events from authenticated; grant select on public.homework_events to authenticated;
