-- Canonical Supabase replacements for the last Firestore-backed Direct features.

create or replace function public.is_assigned_coach(target_academy uuid, target_batch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.coaches c
    join public.batches b on b.primary_coach_id = c.id
    join public.academy_memberships m on m.id = c.membership_id
    join public.academies a on a.id = c.academy_id
    where c.user_id = auth.uid() and c.academy_id = target_academy and b.id = target_batch
      and c.status = 'active' and b.status = 'active' and m.status = 'active' and a.status = 'active'
  );
$$;

create or replace function public.is_own_student(target_academy uuid, target_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students s
    join public.academies a on a.id = s.academy_id
    where s.id = target_student and s.academy_id = target_academy
      and s.user_id = auth.uid() and s.status = 'active' and a.status = 'active'
  );
$$;

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade, coach_id uuid references public.coaches(id) on delete set null,
  attendance_date date not null, student_ids uuid[] not null default '{}', payload jsonb not null default '{}',
  created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (batch_id, attendance_date)
);

create table if not exists public.class_reports (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade, coach_id uuid references public.coaches(id) on delete set null,
  report_date date not null, student_ids uuid[] not null default '{}', payload jsonb not null default '{}',
  created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (batch_id, report_date)
);

create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, batch_id uuid references public.batches(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null, report_date date not null, payload jsonb not null default '{}',
  created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade, fee_month text not null, payload jsonb not null default '{}',
  created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (student_id, fee_month)
);

create table if not exists public.academy_invites (
  id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
  role text not null check (role in ('coach','student')), email text not null, linked_profile_id uuid not null,
  invite_token text not null unique, status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  created_by uuid not null default auth.uid() references public.profiles(id), expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references public.profiles(id), accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists attendance_records_scope_idx on public.attendance_records(academy_id,batch_id,attendance_date);
create index if not exists class_reports_scope_idx on public.class_reports(academy_id,batch_id,report_date);
create index if not exists progress_reports_scope_idx on public.progress_reports(academy_id,student_id,report_date);
create index if not exists fee_records_scope_idx on public.fee_records(academy_id,student_id,fee_month);
create index if not exists academy_invites_scope_idx on public.academy_invites(academy_id,status);

do $$ declare t text; begin foreach t in array array['attendance_records','class_reports','progress_reports','fee_records','academy_invites'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
  execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
end loop; end $$;

create policy "Academy admins manage attendance" on public.attendance_records for all to authenticated
 using (public.has_academy_role(academy_id,'academy_admin')) with check (public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches manage assigned attendance" on public.attendance_records for all to authenticated
 using (public.is_assigned_coach(academy_id,batch_id)) with check (public.is_assigned_coach(academy_id,batch_id));
create policy "Students read own attendance" on public.attendance_records for select to authenticated
 using (exists(select 1 from unnest(student_ids) sid where public.is_own_student(academy_id,sid)));

create policy "Academy admins manage class reports" on public.class_reports for all to authenticated
 using (public.has_academy_role(academy_id,'academy_admin')) with check (public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches manage assigned class reports" on public.class_reports for all to authenticated
 using (public.is_assigned_coach(academy_id,batch_id)) with check (public.is_assigned_coach(academy_id,batch_id));
create policy "Students read own class reports" on public.class_reports for select to authenticated
 using (exists(select 1 from unnest(student_ids) sid where public.is_own_student(academy_id,sid)));

create policy "Academy admins manage progress" on public.progress_reports for all to authenticated
 using (public.has_academy_role(academy_id,'academy_admin')) with check (public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches manage assigned progress" on public.progress_reports for all to authenticated
 using (batch_id is not null and public.is_assigned_coach(academy_id,batch_id)) with check (batch_id is not null and public.is_assigned_coach(academy_id,batch_id));
create policy "Students read own progress" on public.progress_reports for select to authenticated using (public.is_own_student(academy_id,student_id));

create policy "Academy admins manage fees" on public.fee_records for all to authenticated
 using (public.has_academy_role(academy_id,'academy_admin')) with check (public.has_academy_role(academy_id,'academy_admin'));
create policy "Students read own fees" on public.fee_records for select to authenticated using (public.is_own_student(academy_id,student_id));

create policy "Super admins read invites" on public.academy_invites for select to authenticated using (public.is_super_admin());
create policy "Academy admins manage invites" on public.academy_invites for all to authenticated
 using (public.has_academy_role(academy_id,'academy_admin')) with check (public.has_academy_role(academy_id,'academy_admin'));
create policy "Recipients read pending invite" on public.academy_invites for select to authenticated
 using (lower(email) = lower(coalesce(auth.jwt()->>'email','')) and status='pending' and expires_at > now());

create or replace function public.accept_academy_invite(target_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.academy_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into i from public.academy_invites where id=target_invite for update;
  if i.id is null or i.status <> 'pending' or i.expires_at <= now() then raise exception 'Invite is invalid or expired.'; end if;
  if lower(i.email) <> lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Sign in with the invited email.'; end if;
  if i.role = 'student' then
    update public.students set user_id=auth.uid(),status='active' where id=i.linked_profile_id and academy_id=i.academy_id;
  elsif i.role = 'coach' then
    update public.coaches set user_id=auth.uid(),status='active' where id=i.linked_profile_id and academy_id=i.academy_id;
  end if;
  update public.academy_memberships set user_id=auth.uid(),status='active',joined_at=coalesce(joined_at,now())
    where academy_id=i.academy_id and role=i.role and lower(invited_email)=lower(i.email);
  update public.profiles set app_role=i.role,status='active',academy_id=i.academy_id::text,
    linked_student_id=case when i.role='student' then i.linked_profile_id::text else null end where id=auth.uid();
  update public.academy_invites set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values)
    values(auth.uid(),i.academy_id,'invite.accepted','academy_invite',i.id,jsonb_build_object('role',i.role,'linked_profile_id',i.linked_profile_id));
end $$;

revoke all on function public.accept_academy_invite(uuid) from public, anon;
grant execute on function public.accept_academy_invite(uuid) to authenticated;

create or replace function public.lookup_academy_invite(target_token text)
returns table(id uuid, academy_id uuid, role text, email text, linked_profile_id uuid, invite_token text, status text, created_by uuid, created_at timestamptz, expires_at timestamptz, accepted_by uuid, accepted_at timestamptz, academy_name text, profile_name text)
language sql stable security definer set search_path = '' as $$
  select i.id,i.academy_id,i.role,i.email,i.linked_profile_id,i.invite_token,i.status,i.created_by,i.created_at,i.expires_at,i.accepted_by,i.accepted_at,a.name,
    case when i.role='student' then (select s.full_name from public.students s where s.id=i.linked_profile_id)
         else (select c.full_name from public.coaches c where c.id=i.linked_profile_id) end
  from public.academy_invites i join public.academies a on a.id=i.academy_id
  where i.invite_token=target_token limit 1;
$$;
revoke all on function public.lookup_academy_invite(text) from public;
grant execute on function public.lookup_academy_invite(text) to anon, authenticated;

-- Remove broad academy-member reads: coaches see assigned rosters; students see only themselves/their batches.
drop policy if exists "Active academy members can read academy students" on public.students;
create policy "Academy admins read academy students" on public.students for select to authenticated using (public.has_academy_role(academy_id,'academy_admin'));
create policy "Coaches read assigned students" on public.students for select to authenticated using (
  exists(select 1 from public.batch_students bs join public.batches b on b.id=bs.batch_id where bs.student_id=students.id and bs.status='active' and public.is_assigned_coach(students.academy_id,b.id))
);
create policy "Students update own contact profile" on public.students for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and academy_id=students.academy_id);

drop policy if exists "Academy members can read academy batches" on public.batches;
create policy "Coaches read assigned batches" on public.batches for select to authenticated using (public.is_assigned_coach(academy_id,id));
create policy "Students read enrolled batches" on public.batches for select to authenticated using (
  exists(select 1 from public.batch_students bs join public.students s on s.id=bs.student_id where bs.batch_id=batches.id and bs.status='active' and s.user_id=auth.uid() and s.status='active')
);

drop policy if exists "Academy members can read batch students" on public.batch_students;
create policy "Coaches read assigned batch students" on public.batch_students for select to authenticated using (public.is_assigned_coach(academy_id,batch_id));
create policy "Students read own batch enrollment" on public.batch_students for select to authenticated using (
  exists(select 1 from public.students s where s.id=batch_students.student_id and s.user_id=auth.uid() and s.status='active')
);

drop policy if exists "Active academy members can read academy coaches" on public.coaches;
create policy "Academy admins read academy coaches" on public.coaches for select to authenticated using (public.has_academy_role(academy_id,'academy_admin'));
