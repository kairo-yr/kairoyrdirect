-- Flexible class sessions, mixed batches, student schedule overrides, and compensation.
-- This migration is additive and keeps the legacy attendance/report/homework columns populated.
-- Rollback: drop the RPCs/policies first, remove the four foreign-key columns added to legacy
-- tables, then drop session_participants, session_source_batches, class_sessions,
-- student_class_schedules, batch_class_slots, and recurring_class_slots in that order.

alter table public.students add column if not exists home_batch_id uuid references public.batches(id) on delete set null;
alter table public.students add column if not exists expected_weekly_frequency text not null default '2';
alter table public.students add column if not exists schedule_mode text not null default 'inherited';

do $$ begin
  alter table public.students add constraint students_expected_weekly_frequency_check
    check (expected_weekly_frequency in ('1','2','3','4','flexible'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.students add constraint students_schedule_mode_check
    check (schedule_mode in ('inherited','custom','flexible'));
exception when duplicate_object then null; end $$;

create table if not exists public.recurring_class_slots (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  location text,
  room_name text,
  name text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create unique index if not exists recurring_class_slots_identity_uidx
  on public.recurring_class_slots (academy_id, coach_id, weekday, start_time, end_time, coalesce(location,''));
create index if not exists recurring_class_slots_academy_day_idx
  on public.recurring_class_slots (academy_id, weekday, status, start_time);
create index if not exists recurring_class_slots_coach_idx
  on public.recurring_class_slots (coach_id, status);

create table if not exists public.batch_class_slots (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  class_slot_id uuid not null references public.recurring_class_slots(id) on delete cascade,
  effective_start_date date not null default current_date,
  effective_end_date date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, class_slot_id, effective_start_date),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);
create index if not exists batch_class_slots_slot_dates_idx on public.batch_class_slots(class_slot_id,status,effective_start_date,effective_end_date);
create index if not exists batch_class_slots_batch_idx on public.batch_class_slots(batch_id,status);

create table if not exists public.student_class_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_slot_id uuid not null references public.recurring_class_slots(id) on delete cascade,
  effective_start_date date not null default current_date,
  effective_end_date date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_slot_id, effective_start_date),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);
create index if not exists student_class_schedules_slot_dates_idx on public.student_class_schedules(class_slot_id,status,effective_start_date,effective_end_date);
create index if not exists student_class_schedules_student_idx on public.student_class_schedules(student_id,status);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_slot_id uuid references public.recurring_class_slots(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  room_name text,
  status text not null default 'draft' check (status in ('draft','open','completed','cancelled')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id),
  legacy_attendance_record_id uuid unique references public.attendance_records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create unique index if not exists class_sessions_slot_date_uidx on public.class_sessions(academy_id,class_slot_id,session_date) where class_slot_id is not null;
create index if not exists class_sessions_academy_date_idx on public.class_sessions(academy_id,session_date,status,start_time);
create index if not exists class_sessions_coach_date_idx on public.class_sessions(coach_id,session_date,status);

create table if not exists public.session_source_batches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete restrict,
  source_type text not null check (source_type in ('automatic','manual')),
  added_by uuid not null default auth.uid() references public.profiles(id),
  added_at timestamptz not null default now(),
  unique(session_id,batch_id)
);
create index if not exists session_source_batches_session_idx on public.session_source_batches(session_id,source_type);
create index if not exists session_source_batches_batch_idx on public.session_source_batches(batch_id,session_id);

create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  source_type text not null check (source_type in ('batch','individual_schedule','compensation','extra_class','rescheduled','trial','temporary_transfer','manual_other')),
  source_batch_id uuid references public.batches(id) on delete set null,
  added_reason text,
  added_note text,
  compensation_for_session_id uuid references public.class_sessions(id) on delete set null,
  compensation_status text not null default 'not_applicable' check (compensation_status in ('not_applicable','pending','completed')),
  attendance_status text not null default 'unmarked' check (attendance_status in ('unmarked','present','late','absent','excused')),
  attendance_note text,
  added_by uuid not null default auth.uid() references public.profiles(id),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,student_id),
  check (source_type <> 'compensation' or added_reason = 'compensation'),
  check (compensation_for_session_id is null or compensation_for_session_id <> session_id)
);
create index if not exists session_participants_session_idx on public.session_participants(session_id,attendance_status);
create index if not exists session_participants_student_idx on public.session_participants(student_id,session_id);
create index if not exists session_participants_compensation_idx on public.session_participants(compensation_for_session_id,student_id) where compensation_for_session_id is not null;

alter table public.attendance_records add column if not exists class_session_id uuid references public.class_sessions(id) on delete set null;
alter table public.class_reports add column if not exists class_session_id uuid references public.class_sessions(id) on delete set null;
alter table public.homeworks add column if not exists class_session_id uuid references public.class_sessions(id) on delete set null;
alter table public.homeworks add column if not exists recipient_mode text not null default 'batch';
do $$ begin
  alter table public.homeworks add constraint homeworks_recipient_mode_check check (recipient_mode in ('batch','present_late','all_participants','custom'));
exception when duplicate_object then null; end $$;
create index if not exists attendance_records_session_idx on public.attendance_records(class_session_id);
create index if not exists class_reports_session_idx on public.class_reports(class_session_id);
create unique index if not exists class_reports_one_per_session_uidx on public.class_reports(class_session_id) where class_session_id is not null;
create index if not exists homeworks_session_idx on public.homeworks(class_session_id);

do $$ declare table_name text; begin
  foreach table_name in array array['recurring_class_slots','batch_class_slots','student_class_schedules','class_sessions','session_participants'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Home batch is administrative and is deliberately independent from temporary session participation.
update public.students s set home_batch_id = (
  select bs.batch_id from public.batch_students bs where bs.student_id=s.id and bs.status='active'
  order by bs.joined_at nulls last,bs.created_at limit 1
) where s.home_batch_id is null and exists(select 1 from public.batch_students bs where bs.student_id=s.id and bs.status='active');

-- Convert recognizable legacy schedule labels. Unparseable free-form labels remain untouched.
do $$
declare b record; day_info record; times text[]; slot_id uuid; starts time; ends time;
begin
  for b in select * from public.batches where status in ('active','paused') and primary_coach_id is not null and schedule_label is not null loop
    times := regexp_match(b.schedule_label,'([0-9]{1,2}:[0-9]{2}\s*(?:am|pm))', 'i');
    if times is null then continue; end if;
    begin starts := to_timestamp(times[1],'HH12:MI AM')::time; exception when others then continue; end;
    times := regexp_match(b.schedule_label,'[0-9]{1,2}:[0-9]{2}\s*(?:am|pm).*?([0-9]{1,2}:[0-9]{2}\s*(?:am|pm))', 'i');
    begin ends := case when times is null then starts + interval '1 hour' else to_timestamp(times[1],'HH12:MI AM')::time end; exception when others then ends := starts + interval '1 hour'; end;
    if ends <= starts then ends := starts + interval '1 hour'; end if;
    for day_info in select * from (values (1,'mon'),(2,'tue'),(3,'wed'),(4,'thu'),(5,'fri'),(6,'sat'),(7,'sun')) v(day_number,token) loop
      if position(day_info.token in lower(b.schedule_label))=0 then continue; end if;
      select id into slot_id from public.recurring_class_slots r where r.academy_id=b.academy_id and r.coach_id=b.primary_coach_id
        and r.weekday=day_info.day_number and r.start_time=starts and r.end_time=ends and coalesce(r.location,'')=coalesce(b.location,'') limit 1;
      if slot_id is null then
        insert into public.recurring_class_slots(academy_id,coach_id,weekday,start_time,end_time,location,name,created_by)
        values(b.academy_id,b.primary_coach_id,day_info.day_number,starts,ends,b.location,b.name,b.created_by)
        returning id into slot_id;
      end if;
      insert into public.batch_class_slots(academy_id,batch_id,class_slot_id,effective_start_date,created_by)
      values(b.academy_id,b.id,slot_id,coalesce(b.start_date,current_date),coalesce(b.created_by,(select id from public.profiles limit 1))) on conflict do nothing;
    end loop;
  end loop;
end $$;

-- Historical attendance becomes immutable session/participant snapshots without deleting legacy rows.
insert into public.class_sessions(academy_id,coach_id,session_date,start_time,end_time,status,created_by,completed_at,legacy_attendance_record_id,created_at,updated_at)
select ar.academy_id,ar.coach_id,ar.attendance_date,time '00:00',time '01:00',case when ar.payload->>'status'='draft' then 'draft' else 'completed' end,
  ar.created_by,case when ar.payload->>'status'='draft' then null else ar.updated_at end,ar.id,ar.created_at,ar.updated_at
from public.attendance_records ar on conflict(legacy_attendance_record_id) do nothing;

update public.attendance_records ar set class_session_id=cs.id from public.class_sessions cs
where cs.legacy_attendance_record_id=ar.id and ar.class_session_id is null;

insert into public.session_source_batches(academy_id,session_id,batch_id,source_type,added_by,added_at)
select ar.academy_id,cs.id,ar.batch_id,'automatic',ar.created_by,ar.created_at
from public.attendance_records ar join public.class_sessions cs on cs.legacy_attendance_record_id=ar.id on conflict do nothing;

insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,attendance_status,attendance_note,added_by,added_at,updated_at)
select ar.academy_id,cs.id,(item->>'studentId')::uuid,'batch',ar.batch_id,
  case when item->>'status' in ('present','late','absent','excused') then item->>'status' else 'unmarked' end,
  nullif(item->>'note',''),ar.created_by,ar.created_at,ar.updated_at
from public.attendance_records ar join public.class_sessions cs on cs.legacy_attendance_record_id=ar.id
cross join lateral jsonb_array_elements(case when jsonb_typeof(ar.payload->'students')='array' then ar.payload->'students' else '[]'::jsonb end) item
where item->>'studentId' is not null on conflict(session_id,student_id) do nothing;

insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,attendance_status,added_by,added_at,updated_at)
select ar.academy_id,cs.id,sid,'batch',ar.batch_id,'unmarked',ar.created_by,ar.created_at,ar.updated_at
from public.attendance_records ar join public.class_sessions cs on cs.legacy_attendance_record_id=ar.id cross join lateral unnest(ar.student_ids) sid
on conflict(session_id,student_id) do nothing;

update public.class_reports cr set class_session_id=ar.class_session_id from public.attendance_records ar
where cr.class_session_id is null and cr.academy_id=ar.academy_id and cr.batch_id=ar.batch_id and cr.report_date=ar.attendance_date;
update public.homeworks h set class_session_id=cr.class_session_id from public.class_reports cr
where h.class_session_id is null and h.class_report_id=cr.id::text and cr.class_session_id is not null;

create or replace function public.can_manage_class_session(target_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_super_admin() or exists(
    select 1 from public.class_sessions cs where cs.id=target_session and (
      public.has_academy_role(cs.academy_id,'academy_admin') or exists(
        select 1 from public.coaches c where c.id=cs.coach_id and c.user_id=auth.uid() and c.status='active'
      ) or exists(
        select 1 from public.session_source_batches ssb where ssb.session_id=cs.id and public.is_assigned_coach(cs.academy_id,ssb.batch_id)
      )
    )
  );
$$;

create or replace function public.find_or_create_class_session(target_slot uuid,target_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare slot public.recurring_class_slots%rowtype; session_id uuid;
begin
  select * into slot from public.recurring_class_slots where id=target_slot and status='active';
  if slot.id is null then raise exception 'Class slot not found.'; end if;
  if not (public.is_super_admin() or public.has_academy_role(slot.academy_id,'academy_admin') or exists(select 1 from public.coaches c where c.id=slot.coach_id and c.user_id=auth.uid() and c.status='active')) then raise exception 'Permission denied.'; end if;
  insert into public.class_sessions(academy_id,class_slot_id,coach_id,session_date,start_time,end_time,location,room_name,status,created_by)
  values(slot.academy_id,slot.id,slot.coach_id,target_date,slot.start_time,slot.end_time,slot.location,slot.room_name,'open',auth.uid())
  on conflict(academy_id,class_slot_id,session_date) where class_slot_id is not null do update set updated_at=public.class_sessions.updated_at returning id into session_id;

  insert into public.session_source_batches(academy_id,session_id,batch_id,source_type,added_by)
  select slot.academy_id,session_id,bcs.batch_id,'automatic',auth.uid() from public.batch_class_slots bcs
  where bcs.class_slot_id=slot.id and bcs.status='active' and bcs.effective_start_date<=target_date and (bcs.effective_end_date is null or bcs.effective_end_date>=target_date)
  on conflict(session_id,batch_id) do nothing;

  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_by)
  select slot.academy_id,session_id,s.id,'batch',bs.batch_id,auth.uid()
  from public.session_source_batches ssb join public.batch_students bs on bs.batch_id=ssb.batch_id join public.students s on s.id=bs.student_id
  where ssb.session_id=session_id and bs.status='active' and s.status='active' and coalesce(bs.joined_at,target_date)<=target_date and (bs.removed_at is null or bs.removed_at>=target_date)
    and s.schedule_mode='inherited'
  on conflict(session_id,student_id) do nothing;

  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_by)
  select slot.academy_id,session_id,s.id,'individual_schedule',s.home_batch_id,auth.uid()
  from public.student_class_schedules scs join public.students s on s.id=scs.student_id
  where scs.class_slot_id=slot.id and scs.status='active' and scs.effective_start_date<=target_date and (scs.effective_end_date is null or scs.effective_end_date>=target_date) and s.status='active'
  on conflict(session_id,student_id) do nothing;
  return session_id;
end $$;

create or replace function public.add_batch_to_class_session(target_session uuid,target_batch uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; student_count integer;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  if not exists(select 1 from public.batches b where b.id=target_batch and b.academy_id=cs.academy_id and b.status='active') then raise exception 'Batch belongs to another academy or is inactive.'; end if;
  insert into public.session_source_batches(academy_id,session_id,batch_id,source_type,added_by) values(cs.academy_id,cs.id,target_batch,'manual',auth.uid()) on conflict(session_id,batch_id) do nothing;
  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_by)
  select cs.academy_id,cs.id,s.id,'batch',target_batch,auth.uid() from public.batch_students bs join public.students s on s.id=bs.student_id
  where bs.batch_id=target_batch and bs.status='active' and s.status='active' and coalesce(bs.joined_at,cs.session_date)<=cs.session_date and (bs.removed_at is null or bs.removed_at>=cs.session_date)
  on conflict(session_id,student_id) do nothing;
  get diagnostics student_count=row_count;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values) values(auth.uid(),cs.academy_id,'session.batch_added','class_session',cs.id,jsonb_build_object('batch_id',target_batch,'students_added',student_count));
  return student_count;
end $$;

create or replace function public.add_student_to_class_session(target_session uuid,target_student uuid,reason text,note text default null,missed_session uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; participant_id uuid; source text;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  if not exists(select 1 from public.students s where s.id=target_student and s.academy_id=cs.academy_id and s.status='active') then raise exception 'Student belongs to another academy or is inactive.'; end if;
  if reason not in ('compensation','rescheduled','extra_class','trial','temporary_transfer','manual_other') then raise exception 'Choose a valid attendance reason.'; end if;
  if reason='manual_other' and nullif(trim(coalesce(note,'')),'') is null then raise exception 'A note is required for Other.'; end if;
  if reason='compensation' and missed_session is null and nullif(trim(coalesce(note,'')),'') is null then raise exception 'Explain why this compensation is not linked to a missed session.'; end if;
  if missed_session is not null and not exists(select 1 from public.session_participants p join public.class_sessions m on m.id=p.session_id where p.session_id=missed_session and p.student_id=target_student and p.attendance_status='absent' and m.academy_id=cs.academy_id and m.session_date<cs.session_date) then raise exception 'Missed session does not belong to the selected student.'; end if;
  source:=case reason when 'compensation' then 'compensation' when 'rescheduled' then 'rescheduled' when 'extra_class' then 'extra_class' when 'trial' then 'trial' when 'temporary_transfer' then 'temporary_transfer' else 'manual_other' end;
  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_reason,added_note,compensation_for_session_id,compensation_status,added_by)
  select cs.academy_id,cs.id,target_student,source,s.home_batch_id,reason,nullif(trim(note),''),missed_session,case when reason='compensation' then 'pending' else 'not_applicable' end,auth.uid() from public.students s where s.id=target_student
  on conflict(session_id,student_id) do nothing returning id into participant_id;
  if participant_id is null then raise exception 'Student already exists in session.'; end if;
  if missed_session is not null then update public.session_participants set compensation_status='pending' where session_id=missed_session and student_id=target_student; end if;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values) values(auth.uid(),cs.academy_id,'session.student_added','session_participant',participant_id,jsonb_build_object('session_id',cs.id,'student_id',target_student,'reason',reason,'missed_session_id',missed_session));
  return participant_id;
end $$;

create or replace function public.remove_student_from_class_session(target_session uuid,target_student uuid)
returns void language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; participant public.session_participants%rowtype;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  select * into participant from public.session_participants where session_id=cs.id and student_id=target_student;
  if participant.id is null or participant.source_type in ('batch','individual_schedule') then raise exception 'Only manually added students can be removed.'; end if;
  delete from public.session_participants where id=participant.id;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,old_values) values(auth.uid(),cs.academy_id,'session.student_removed','session_participant',participant.id,to_jsonb(participant));
end $$;

create or replace function public.remove_batch_from_class_session(target_session uuid,target_batch uuid)
returns void language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; source public.session_source_batches%rowtype;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  select * into source from public.session_source_batches where session_id=cs.id and batch_id=target_batch;
  if source.id is null or source.source_type<>'manual' then raise exception 'Only manually added batches can be removed.'; end if;
  delete from public.session_participants p where p.session_id=cs.id and p.source_batch_id=target_batch and p.source_type='batch';
  delete from public.session_source_batches where id=source.id;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,old_values) values(auth.uid(),cs.academy_id,'session.batch_removed','session_source_batch',source.id,to_jsonb(source));
end $$;

create or replace function public.search_students_for_class_session(target_session uuid,search_text text default '',result_limit integer default 30)
returns table(id uuid,full_name text,parent_name text,parent_phone text,home_batch_id uuid,home_batch_name text)
language sql stable security definer set search_path='' as $$
  select s.id,s.full_name,s.parent_name,s.parent_phone,s.home_batch_id,b.name
  from public.class_sessions cs join public.students s on s.academy_id=cs.academy_id left join public.batches b on b.id=s.home_batch_id
  where cs.id=target_session and public.can_manage_class_session(cs.id) and s.status='active'
    and not exists(select 1 from public.session_participants p where p.session_id=cs.id and p.student_id=s.id)
    and (nullif(trim(search_text),'') is null or s.full_name ilike '%'||trim(search_text)||'%' or s.parent_name ilike '%'||trim(search_text)||'%' or s.parent_phone ilike '%'||trim(search_text)||'%')
  order by s.full_name limit least(greatest(result_limit,1),50);
$$;

create or replace function public.get_compensation_candidates(target_session uuid,target_student uuid)
returns table(session_id uuid,session_date date,start_time time,end_time time,batch_name text,attendance_status text,compensation_status text)
language sql stable security definer set search_path='' as $$
  select missed.id,missed.session_date,missed.start_time,missed.end_time,b.name,p.attendance_status,p.compensation_status
  from public.class_sessions current_session join public.class_sessions missed on missed.academy_id=current_session.academy_id and missed.session_date<current_session.session_date
  join public.session_participants p on p.session_id=missed.id and p.student_id=target_student
  left join public.batches b on b.id=p.source_batch_id
  where current_session.id=target_session and public.can_manage_class_session(current_session.id) and p.attendance_status='absent' and p.compensation_status<>'completed'
  order by missed.session_date desc,missed.start_time desc limit 20;
$$;

create or replace function public.save_class_session_attendance(target_session uuid,attendance_rows jsonb,complete_session boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; item jsonb; participant public.session_participants%rowtype; primary_batch uuid; compatibility_payload jsonb; compatibility_students uuid[];
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  if jsonb_typeof(attendance_rows)<>'array' then raise exception 'Invalid attendance rows.'; end if;
  for item in select * from jsonb_array_elements(attendance_rows) loop
    if item->>'status' not in ('unmarked','present','late','absent','excused') then raise exception 'Invalid attendance status.'; end if;
    update public.session_participants set attendance_status=item->>'status',attendance_note=nullif(trim(item->>'note'),'')
      where session_id=cs.id and student_id=(item->>'studentId')::uuid returning * into participant;
    if participant.id is null then raise exception 'Roster refresh conflict.'; end if;
    if participant.compensation_for_session_id is not null then
      update public.session_participants set compensation_status=case when participant.attendance_status in ('present','late') then 'completed' else 'pending' end
      where session_id=participant.compensation_for_session_id and student_id=participant.student_id;
      update public.session_participants set compensation_status=case when participant.attendance_status in ('present','late') then 'completed' else 'pending' end where id=participant.id;
    end if;
  end loop;
  select batch_id into primary_batch from public.session_source_batches where session_id=cs.id order by case when source_type='automatic' then 0 else 1 end,added_at limit 1;
  if primary_batch is not null then
    select coalesce(array_agg(p.student_id order by s.full_name),'{}'),jsonb_build_object(
      'academyId',cs.academy_id,'batchId',primary_batch,'batchName',(select name from public.batches where id=primary_batch),
      'coachId',cs.coach_id,'coachName',(select full_name from public.coaches where id=cs.coach_id),'date',cs.session_date,
      'status',case when complete_session then 'submitted' else 'draft' end,'classSessionId',cs.id,
      'studentIds',coalesce(jsonb_agg(p.student_id order by s.full_name),'[]'::jsonb),
      'students',coalesce(jsonb_agg(jsonb_build_object('studentId',p.student_id,'studentName',s.full_name,'status',case when p.attendance_status='late' then 'present' else p.attendance_status end,'note',coalesce(p.attendance_note,'')) order by s.full_name),'[]'::jsonb),
      'presentCount',count(*) filter(where p.attendance_status in ('present','late')),'absentCount',count(*) filter(where p.attendance_status='absent'),'totalCount',count(*)
    ) into compatibility_students,compatibility_payload
    from public.session_participants p join public.students s on s.id=p.student_id where p.session_id=cs.id;
    insert into public.attendance_records(academy_id,batch_id,coach_id,attendance_date,student_ids,payload,created_by,class_session_id)
    values(cs.academy_id,primary_batch,cs.coach_id,cs.session_date,compatibility_students,compatibility_payload,auth.uid(),cs.id)
    on conflict(batch_id,attendance_date) do nothing;
    update public.attendance_records set coach_id=cs.coach_id,student_ids=compatibility_students,payload=compatibility_payload,class_session_id=cs.id
    where class_session_id=cs.id;
  end if;
  if complete_session then
    if exists(select 1 from public.session_participants where session_id=cs.id and attendance_status='unmarked') then raise exception 'Mark every student before completing the session.'; end if;
    update public.class_sessions set status='completed',completed_at=now(),completed_by=auth.uid() where id=cs.id;
    insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values) values(auth.uid(),cs.academy_id,'session.completed','class_session',cs.id,jsonb_build_object('participant_count',(select count(*) from public.session_participants where session_id=cs.id)));
  end if;
end $$;

create or replace function public.reopen_class_session(target_session uuid)
returns void language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not (public.is_super_admin() or public.has_academy_role(cs.academy_id,'academy_admin')) then raise exception 'Only an academy admin can reopen this session.'; end if;
  update public.class_sessions set status='open',reopened_at=now(),reopened_by=auth.uid(),completed_at=null,completed_by=null where id=cs.id and status='completed';
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),cs.academy_id,'session.reopened','class_session',cs.id,to_jsonb(cs),jsonb_build_object('status','open'));
end $$;

create or replace function public.refresh_class_session_roster(target_session uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; inserted_count integer;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_by)
  select cs.academy_id,cs.id,s.id,'batch',bs.batch_id,auth.uid() from public.session_source_batches ssb join public.batch_students bs on bs.batch_id=ssb.batch_id join public.students s on s.id=bs.student_id
  where ssb.session_id=cs.id and bs.status='active' and s.status='active' and s.schedule_mode='inherited' and coalesce(bs.joined_at,cs.session_date)<=cs.session_date and (bs.removed_at is null or bs.removed_at>=cs.session_date)
  on conflict(session_id,student_id) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

create or replace function public.set_student_class_schedule(target_student uuid,target_home_batch uuid,weekly_frequency text,schedule_source text,target_slots uuid[] default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare s public.students%rowtype; slot_id uuid;
begin
  select * into s from public.students where id=target_student for update;
  if s.id is null or not (public.is_super_admin() or public.has_academy_role(s.academy_id,'academy_admin')) then raise exception 'Permission denied.'; end if;
  if weekly_frequency not in ('1','2','3','4','flexible') or schedule_source not in ('inherited','custom','flexible') then raise exception 'Invalid student schedule.'; end if;
  if target_home_batch is not null and not exists(select 1 from public.batches b where b.id=target_home_batch and b.academy_id=s.academy_id) then raise exception 'Batch belongs to another academy.'; end if;
  if schedule_source='custom' and cardinality(target_slots)=0 then raise exception 'Choose at least one regular class slot.'; end if;
  if schedule_source='custom' and exists(select 1 from unnest(target_slots) chosen where not exists(select 1 from public.recurring_class_slots r where r.id=chosen and r.academy_id=s.academy_id and r.status='active')) then raise exception 'Class slot belongs to another academy.'; end if;
  update public.students set home_batch_id=target_home_batch,expected_weekly_frequency=weekly_frequency,schedule_mode=schedule_source where id=s.id;
  update public.student_class_schedules set status='inactive',effective_end_date=current_date where student_id=s.id and status='active';
  if schedule_source='custom' then
    foreach slot_id in array target_slots loop
      insert into public.student_class_schedules(academy_id,student_id,class_slot_id,effective_start_date,status,created_by)
      values(s.academy_id,s.id,slot_id,current_date,'active',auth.uid())
      on conflict(student_id,class_slot_id,effective_start_date) do update set status='active',effective_end_date=null,updated_at=now();
    end loop;
  end if;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values) values(auth.uid(),s.academy_id,'student.schedule_updated','student',s.id,jsonb_build_object('home_batch_id',target_home_batch,'frequency',weekly_frequency,'schedule_mode',schedule_source,'class_slot_ids',target_slots));
end $$;

-- Session-aware publishing retains each recipient's real home batch when available.
create or replace function public.publish_homework(target_homework uuid) returns integer language plpgsql security definer set search_path=public as $$
declare h public.homeworks%rowtype; assignment_count int;
begin select * into h from public.homeworks where id=target_homework for update; if h.id is null or not public.can_manage_homework_batch(h.academy_id,h.batch_id) then raise exception 'Homework not found or access denied.'; end if;
 if h.status not in ('draft','published') then raise exception 'Only draft homework can be published.'; end if;
 if not exists(select 1 from public.homework_tasks where homework_id=h.id) then raise exception 'Add at least one task before publishing.'; end if;
 if h.class_session_id is not null then
   insert into public.student_homework_assignments(homework_id,academy_id,batch_id,student_id)
   select h.id,h.academy_id,coalesce(s.home_batch_id,h.batch_id),p.student_id from public.session_participants p join public.students s on s.id=p.student_id
   where p.session_id=h.class_session_id and (h.recipient_mode='all_participants' or h.recipient_mode='custom' or p.attendance_status in ('present','late')) and not(p.student_id=any(h.excluded_student_ids))
   on conflict(homework_id,student_id) do nothing;
 else
   insert into public.student_homework_assignments(homework_id,academy_id,batch_id,student_id) select h.id,h.academy_id,h.batch_id,s.id from public.batch_students bs join public.students s on s.id=bs.student_id where bs.batch_id=h.batch_id and bs.status='active' and s.status='active' and not(s.id=any(h.excluded_student_ids)) on conflict(homework_id,student_id) do nothing;
 end if;
 if not exists(select 1 from public.student_homework_assignments where homework_id=h.id) then raise exception 'No eligible students were selected.'; end if;
 insert into public.student_homework_task_progress(student_homework_assignment_id,homework_task_id) select a.id,t.id from public.student_homework_assignments a join public.homework_tasks t on t.homework_id=a.homework_id where a.homework_id=h.id on conflict do nothing;
 update public.homeworks set status='published',published_at=coalesce(published_at,now()) where id=h.id;
 insert into public.homework_events(academy_id,homework_id,actor_user_id,actor_type,event_type) select h.academy_id,h.id,auth.uid(),'user','homework_published' where not exists(select 1 from public.homework_events e where e.homework_id=h.id and e.event_type='homework_published');
 select count(*) into assignment_count from public.student_homework_assignments where homework_id=h.id; return assignment_count; end $$;

alter table public.recurring_class_slots enable row level security;
alter table public.batch_class_slots enable row level security;
alter table public.student_class_schedules enable row level security;
alter table public.class_sessions enable row level security;
alter table public.session_source_batches enable row level security;
alter table public.session_participants enable row level security;

drop policy if exists "Platform manages recurring slots" on public.recurring_class_slots;
drop policy if exists "Academy admins manage recurring slots" on public.recurring_class_slots;
drop policy if exists "Coaches read own recurring slots" on public.recurring_class_slots;
drop policy if exists "Platform manages batch slots" on public.batch_class_slots;
drop policy if exists "Academy admins manage batch slots" on public.batch_class_slots;
drop policy if exists "Coaches read assigned batch slots" on public.batch_class_slots;
drop policy if exists "Platform manages student schedules" on public.student_class_schedules;
drop policy if exists "Academy admins manage student schedules" on public.student_class_schedules;
drop policy if exists "Coaches read assigned student schedules" on public.student_class_schedules;
drop policy if exists "Platform manages class sessions" on public.class_sessions;
drop policy if exists "Academy admins manage class sessions" on public.class_sessions;
drop policy if exists "Coaches read assigned class sessions" on public.class_sessions;
drop policy if exists "Students read own class sessions" on public.class_sessions;
drop policy if exists "Managers read session batches" on public.session_source_batches;
drop policy if exists "Managers read session participants" on public.session_participants;
drop policy if exists "Students read own session participation" on public.session_participants;
create policy "Platform manages recurring slots" on public.recurring_class_slots for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy "Academy admins manage recurring slots" on public.recurring_class_slots for all to authenticated using(public.has_academy_role(academy_id,'academy_admin')) with check(public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches read own recurring slots" on public.recurring_class_slots for select to authenticated using(exists(select 1 from public.coaches c where c.id=coach_id and c.user_id=auth.uid() and c.status='active'));
create policy "Platform manages batch slots" on public.batch_class_slots for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy "Academy admins manage batch slots" on public.batch_class_slots for all to authenticated using(public.has_academy_role(academy_id,'academy_admin')) with check(public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches read assigned batch slots" on public.batch_class_slots for select to authenticated using(public.is_assigned_coach(academy_id,batch_id));
create policy "Platform manages student schedules" on public.student_class_schedules for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy "Academy admins manage student schedules" on public.student_class_schedules for all to authenticated using(public.has_academy_role(academy_id,'academy_admin')) with check(public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches read assigned student schedules" on public.student_class_schedules for select to authenticated using(exists(select 1 from public.students s join public.batch_students bs on bs.student_id=s.id where s.id=student_class_schedules.student_id and public.is_assigned_coach(student_class_schedules.academy_id,bs.batch_id)));
create policy "Platform manages class sessions" on public.class_sessions for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy "Academy admins manage class sessions" on public.class_sessions for all to authenticated using(public.has_academy_role(academy_id,'academy_admin')) with check(public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches read assigned class sessions" on public.class_sessions for select to authenticated using(public.can_manage_class_session(id));
create policy "Students read own class sessions" on public.class_sessions for select to authenticated using(exists(select 1 from public.session_participants p join public.students s on s.id=p.student_id where p.session_id=class_sessions.id and s.user_id=auth.uid()));
create policy "Managers read session batches" on public.session_source_batches for select to authenticated using(public.can_manage_class_session(session_id));
create policy "Managers read session participants" on public.session_participants for select to authenticated using(public.can_manage_class_session(session_id));
create policy "Students read own session participation" on public.session_participants for select to authenticated using(exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid()));

revoke all on function public.find_or_create_class_session(uuid,date),public.add_batch_to_class_session(uuid,uuid),public.add_student_to_class_session(uuid,uuid,text,text,uuid),public.remove_student_from_class_session(uuid,uuid),public.remove_batch_from_class_session(uuid,uuid),public.search_students_for_class_session(uuid,text,integer),public.get_compensation_candidates(uuid,uuid),public.save_class_session_attendance(uuid,jsonb,boolean),public.reopen_class_session(uuid),public.refresh_class_session_roster(uuid),public.set_student_class_schedule(uuid,uuid,text,text,uuid[]) from public,anon;
grant execute on function public.find_or_create_class_session(uuid,date),public.add_batch_to_class_session(uuid,uuid),public.add_student_to_class_session(uuid,uuid,text,text,uuid),public.remove_student_from_class_session(uuid,uuid),public.remove_batch_from_class_session(uuid,uuid),public.search_students_for_class_session(uuid,text,integer),public.get_compensation_candidates(uuid,uuid),public.save_class_session_attendance(uuid,jsonb,boolean),public.reopen_class_session(uuid),public.refresh_class_session_roster(uuid),public.set_student_class_schedule(uuid,uuid,text,text,uuid[]) to authenticated;
