alter table public.students
drop constraint if exists students_status_check;

update public.students
set status = 'pending_login'
where status = 'invited';

alter table public.students
alter column joined_at set default current_date;

alter table public.students
add constraint students_status_check
check (status in ('pending_login', 'active', 'inactive', 'disabled', 'removed'));

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  primary_coach_id uuid references public.coaches(id) on delete set null,
  name text not null,
  level text,
  status text not null default 'active',
  description text,
  location text,
  schedule_label text,
  start_date date,
  end_date date,
  max_students integer,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_status_check check (status in ('active', 'paused', 'completed', 'disabled', 'archived')),
  constraint batches_level_check check (level is null or level in ('absolute_beginner', 'beginner', 'intermediate', 'advanced', 'tournament'))
);

create table if not exists public.batch_students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'active',
  joined_at date default current_date,
  removed_at date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch_students_status_check check (status in ('active', 'paused', 'removed', 'completed'))
);

create index if not exists batches_academy_id_idx on public.batches (academy_id);
create index if not exists batches_primary_coach_id_idx on public.batches (primary_coach_id);
create index if not exists batches_status_idx on public.batches (status);
create index if not exists batches_level_idx on public.batches (level);

create unique index if not exists batches_unique_academy_name
on public.batches (academy_id, lower(name));

create index if not exists batch_students_academy_id_idx on public.batch_students (academy_id);
create index if not exists batch_students_batch_id_idx on public.batch_students (batch_id);
create index if not exists batch_students_student_id_idx on public.batch_students (student_id);
create index if not exists batch_students_status_idx on public.batch_students (status);

create unique index if not exists batch_students_unique_batch_student
on public.batch_students (batch_id, student_id);

drop trigger if exists set_batches_updated_at on public.batches;
create trigger set_batches_updated_at
before update on public.batches
for each row
execute function public.set_updated_at();

drop trigger if exists set_batch_students_updated_at on public.batch_students;
create trigger set_batch_students_updated_at
before update on public.batch_students
for each row
execute function public.set_updated_at();

alter table public.batches enable row level security;
alter table public.batch_students enable row level security;

drop policy if exists "Super admins can manage all batches" on public.batches;
create policy "Super admins can manage all batches"
on public.batches
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Academy admins can manage academy batches" on public.batches;
create policy "Academy admins can manage academy batches"
on public.batches
for all
to authenticated
using (public.has_academy_role(academy_id, 'academy_admin'))
with check (public.has_academy_role(academy_id, 'academy_admin'));

drop policy if exists "Academy members can read academy batches" on public.batches;
create policy "Academy members can read academy batches"
on public.batches
for select
to authenticated
using (public.is_active_academy_member(academy_id));

drop policy if exists "Super admins can manage all batch students" on public.batch_students;
create policy "Super admins can manage all batch students"
on public.batch_students
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Academy admins can manage batch students" on public.batch_students;
create policy "Academy admins can manage batch students"
on public.batch_students
for all
to authenticated
using (public.has_academy_role(academy_id, 'academy_admin'))
with check (public.has_academy_role(academy_id, 'academy_admin'));

drop policy if exists "Academy members can read batch students" on public.batch_students;
create policy "Academy members can read batch students"
on public.batch_students
for select
to authenticated
using (public.is_active_academy_member(academy_id));

create or replace function public.create_student_for_academy(
  target_academy_id uuid,
  student_full_name text,
  student_email text default null,
  student_phone text default null,
  student_school_name text default null,
  student_grade text default null,
  parent_name text default null,
  parent_email text default null,
  parent_phone text default null,
  level text default 'beginner',
  notes text default null
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := nullif(lower(trim(coalesce(student_email, ''))), '');
  normalized_parent_email text := nullif(lower(trim(coalesce(parent_email, ''))), '');
  matched_profile public.profiles%rowtype;
  membership_row public.academy_memberships%rowtype;
  student_row public.students%rowtype;
  old_membership jsonb;
  old_profile jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_super_admin() and not public.has_academy_role(target_academy_id, 'academy_admin') then
    raise exception 'Only academy admins can add students for this academy.';
  end if;

  if nullif(trim(student_full_name), '') is null then
    raise exception 'Student name is required.';
  end if;

  if level is not null and level not in ('absolute_beginner', 'beginner', 'intermediate', 'advanced', 'tournament') then
    raise exception 'Invalid student level.';
  end if;

  if normalized_email is not null then
    select *
    into matched_profile
    from public.profiles
    where lower(email) = normalized_email
    order by created_at asc
    limit 1;
  end if;

  if matched_profile.id is not null then
    select *
    into membership_row
    from public.academy_memberships
    where academy_id = target_academy_id
      and role = 'student'
      and (user_id = matched_profile.id or lower(email) = normalized_email)
    order by case when user_id = matched_profile.id then 0 else 1 end, created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, invited_by, joined_at
      ) values (
        target_academy_id, matched_profile.id, normalized_email, 'student', 'active', actor_id, now()
      )
      returning * into membership_row;
    else
      old_membership := to_jsonb(membership_row);
      update public.academy_memberships
      set user_id = matched_profile.id,
          email = normalized_email,
          role = 'student',
          status = 'active',
          invited_by = actor_id,
          joined_at = coalesce(joined_at, now())
      where id = membership_row.id
      returning * into membership_row;
    end if;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      case when old_membership is null then 'membership.created' else 'membership.updated' end,
      'academy_membership',
      membership_row.id,
      old_membership,
      to_jsonb(membership_row)
    );

    old_profile := to_jsonb(matched_profile);
    update public.profiles
    set app_role = case
          when platform_role = 'super_admin' then app_role
          when app_role in ('academy_admin', 'coach') then app_role
          else 'student'
        end,
        status = 'active'
    where id = matched_profile.id
    returning * into matched_profile;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id, target_academy_id, 'profile.role_updated', 'profile', matched_profile.id, old_profile, to_jsonb(matched_profile)
    );
  elsif normalized_email is not null then
    select *
    into membership_row
    from public.academy_memberships
    where academy_id = target_academy_id
      and role = 'student'
      and lower(email) = normalized_email
    order by created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, invited_by, joined_at
      ) values (
        target_academy_id, null, normalized_email, 'student', 'pending_login', actor_id, null
      )
      returning * into membership_row;
    else
      old_membership := to_jsonb(membership_row);
      update public.academy_memberships
      set user_id = null,
          email = normalized_email,
          role = 'student',
          status = 'pending_login',
          invited_by = actor_id,
          joined_at = null
      where id = membership_row.id
      returning * into membership_row;
    end if;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      case when old_membership is null then 'membership.created' else 'membership.updated' end,
      'academy_membership',
      membership_row.id,
      old_membership,
      to_jsonb(membership_row)
    );
  end if;

  insert into public.students (
    academy_id, user_id, membership_id, full_name, email, phone, avatar_url,
    school_name, grade, parent_name, parent_email, parent_phone, level, status, joined_at, notes, created_by
  ) values (
    target_academy_id,
    matched_profile.id,
    membership_row.id,
    trim(student_full_name),
    normalized_email,
    nullif(trim(coalesce(student_phone, '')), ''),
    matched_profile.avatar_url,
    nullif(trim(coalesce(student_school_name, '')), ''),
    nullif(trim(coalesce(student_grade, '')), ''),
    nullif(trim(coalesce(parent_name, '')), ''),
    normalized_parent_email,
    nullif(trim(coalesce(parent_phone, '')), ''),
    coalesce(level, 'beginner'),
    case when matched_profile.id is not null then 'active' when normalized_email is not null then 'pending_login' else 'active' end,
    case when matched_profile.id is not null or normalized_email is null then current_date else null end,
    nullif(trim(coalesce(notes, '')), ''),
    actor_id
  )
  returning * into student_row;

  insert into public.audit_logs (
    actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    actor_id, target_academy_id, 'student.created', 'student', student_row.id, null, to_jsonb(student_row)
  );

  return student_row;
end;
$$;

create or replace function public.create_batch_for_academy(
  target_academy_id uuid,
  batch_name text,
  batch_level text default null,
  primary_coach_id uuid default null,
  schedule_label text default null,
  location text default null,
  max_students integer default null,
  notes text default null
)
returns public.batches
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  batch_row public.batches%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_super_admin() and not public.has_academy_role(target_academy_id, 'academy_admin') then
    raise exception 'Only academy admins can create batches for this academy.';
  end if;

  if nullif(trim(batch_name), '') is null then
    raise exception 'Batch name is required.';
  end if;

  if batch_level is not null and batch_level not in ('absolute_beginner', 'beginner', 'intermediate', 'advanced', 'tournament') then
    raise exception 'Invalid batch level.';
  end if;

  if primary_coach_id is not null and not exists (
    select 1 from public.coaches
    where id = primary_coach_id
      and academy_id = target_academy_id
      and status = 'active'
  ) then
    raise exception 'Primary coach must belong to this academy.';
  end if;

  insert into public.batches (
    academy_id, primary_coach_id, name, level, status, schedule_label, location, max_students, notes, created_by
  ) values (
    target_academy_id,
    primary_coach_id,
    trim(batch_name),
    batch_level,
    'active',
    nullif(trim(coalesce(schedule_label, '')), ''),
    nullif(trim(coalesce(location, '')), ''),
    max_students,
    nullif(trim(coalesce(notes, '')), ''),
    actor_id
  )
  returning * into batch_row;

  insert into public.audit_logs (
    actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    actor_id, target_academy_id, 'batch.created', 'batch', batch_row.id, null, to_jsonb(batch_row)
  );

  return batch_row;
end;
$$;

create or replace function public.assign_student_to_batch(
  target_batch_id uuid,
  target_student_id uuid
)
returns public.batch_students
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  batch_row public.batches%rowtype;
  student_row public.students%rowtype;
  assignment_row public.batch_students%rowtype;
  old_assignment jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into batch_row from public.batches where id = target_batch_id;
  select * into student_row from public.students where id = target_student_id;

  if batch_row.id is null or student_row.id is null then
    raise exception 'Batch or student not found.';
  end if;

  if batch_row.academy_id <> student_row.academy_id then
    raise exception 'Batch and student must belong to the same academy.';
  end if;

  if not public.is_super_admin() and not public.has_academy_role(batch_row.academy_id, 'academy_admin') then
    raise exception 'Only academy admins can assign students to batches.';
  end if;

  select *
  into assignment_row
  from public.batch_students
  where batch_id = target_batch_id
    and student_id = target_student_id
  limit 1
  for update;

  if assignment_row.id is null then
    insert into public.batch_students (
      academy_id, batch_id, student_id, status, joined_at, removed_at, created_by
    ) values (
      batch_row.academy_id, target_batch_id, target_student_id, 'active', current_date, null, actor_id
    )
    returning * into assignment_row;
  else
    old_assignment := to_jsonb(assignment_row);
    update public.batch_students
    set academy_id = batch_row.academy_id,
        status = 'active',
        joined_at = coalesce(joined_at, current_date),
        removed_at = null
    where id = assignment_row.id
    returning * into assignment_row;
  end if;

  insert into public.audit_logs (
    actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    actor_id, batch_row.academy_id, 'batch_student.assigned', 'batch_student', assignment_row.id, old_assignment, to_jsonb(assignment_row)
  );

  return assignment_row;
end;
$$;

create or replace function public.remove_student_from_batch(
  target_batch_id uuid,
  target_student_id uuid
)
returns public.batch_students
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  assignment_row public.batch_students%rowtype;
  old_assignment jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into assignment_row
  from public.batch_students
  where batch_id = target_batch_id
    and student_id = target_student_id
  limit 1
  for update;

  if assignment_row.id is null then
    raise exception 'Batch assignment not found.';
  end if;

  if not public.is_super_admin() and not public.has_academy_role(assignment_row.academy_id, 'academy_admin') then
    raise exception 'Only academy admins can remove students from batches.';
  end if;

  old_assignment := to_jsonb(assignment_row);

  update public.batch_students
  set status = 'removed',
      removed_at = current_date
  where id = assignment_row.id
  returning * into assignment_row;

  insert into public.audit_logs (
    actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    actor_id, assignment_row.academy_id, 'batch_student.removed', 'batch_student', assignment_row.id, old_assignment, to_jsonb(assignment_row)
  );

  return assignment_row;
end;
$$;

revoke all on function public.create_student_for_academy(uuid, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.create_batch_for_academy(uuid, text, text, uuid, text, text, integer, text) from public;
revoke all on function public.assign_student_to_batch(uuid, uuid) from public;
revoke all on function public.remove_student_from_batch(uuid, uuid) from public;

grant execute on function public.create_student_for_academy(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_batch_for_academy(uuid, text, text, uuid, text, text, integer, text) to authenticated;
grant execute on function public.assign_student_to_batch(uuid, uuid) to authenticated;
grant execute on function public.remove_student_from_batch(uuid, uuid) to authenticated;
