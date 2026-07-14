-- Make Supabase Auth + public.profiles the canonical application-user registry.
-- The inner join to auth.users deliberately excludes deleted Auth identities.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    inner join auth.users as auth_user on auth_user.id = profile.id
    where profile.id = auth.uid()
      and profile.platform_role = 'super_admin'
      and profile.status = 'active'
  );
$$;

create or replace function public.is_active_academy_member(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_memberships as membership
    inner join public.profiles as profile on profile.id = membership.user_id
    inner join public.academies as academy on academy.id = membership.academy_id
    where membership.academy_id = target_academy_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and profile.status = 'active'
      and academy.status = 'active'
  );
$$;

create or replace function public.has_academy_role(target_academy_id uuid, target_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_memberships as membership
    inner join public.profiles as profile on profile.id = membership.user_id
    inner join public.academies as academy on academy.id = membership.academy_id
    where membership.academy_id = target_academy_id
      and membership.user_id = auth.uid()
      and membership.role = target_role
      and membership.status = 'active'
      and profile.status = 'active'
      and academy.status = 'active'
  );
$$;

create or replace function public.list_application_users()
returns table (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  platform_role text,
  app_role text,
  status text,
  academy_id uuid,
  linked_coach_id uuid,
  linked_student_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'Super admin access required.';
  end if;

  return query
  select
    profile.id,
    profile.full_name,
    pg_catalog.lower(pg_catalog.btrim(coalesce(auth_user.email, profile.email))),
    profile.avatar_url,
    profile.phone,
    profile.platform_role,
    case
      when profile.platform_role = 'super_admin' then 'super_admin'
      else coalesce(membership.role, 'unassigned')
    end,
    profile.status,
    membership.academy_id,
    coach.id,
    student.id,
    profile.created_at,
    profile.updated_at,
    auth_user.last_sign_in_at
  from public.profiles as profile
  inner join auth.users as auth_user on auth_user.id = profile.id
  left join lateral (
    select member.academy_id, member.role
    from public.academy_memberships as member
    inner join public.academies as academy on academy.id = member.academy_id
    where member.user_id = profile.id
      and member.status = 'active'
      and academy.status = 'active'
    order by
      case member.role
        when 'academy_admin' then 1
        when 'coach' then 2
        when 'student' then 3
        else 4
      end,
      member.created_at
    limit 1
  ) as membership on true
  left join lateral (
    select row.id
    from public.coaches as row
    where row.user_id = profile.id and row.status <> 'removed'
    order by row.updated_at desc
    limit 1
  ) as coach on true
  left join lateral (
    select row.id
    from public.students as row
    where row.user_id = profile.id and row.status <> 'removed'
    order by row.updated_at desc
    limit 1
  ) as student on true
  order by profile.created_at desc;
end;
$$;

revoke all on function public.list_application_users() from public;
revoke all on function public.list_application_users() from anon;
grant execute on function public.list_application_users() to authenticated;

create or replace function public.set_application_user_status(
  target_user_id uuid,
  target_status text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  previous_profile public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'Super admin access required.';
  end if;

  if target_status not in ('active', 'disabled') then
    raise exception using errcode = '22023', message = 'Status must be active or disabled.';
  end if;

  if target_user_id = actor_id then
    raise exception using errcode = '42501', message = 'You cannot change your own super admin status.';
  end if;

  select profile.*
  into previous_profile
  from public.profiles as profile
  inner join auth.users as auth_user on auth_user.id = profile.id
  where profile.id = target_user_id
  for update of profile;

  if not found then
    raise exception using errcode = 'P0002', message = 'Application user not found.';
  end if;

  if previous_profile.platform_role = 'super_admin' then
    raise exception using errcode = '42501', message = 'Protected super admin accounts cannot be changed.';
  end if;

  update public.profiles
  set status = target_status
  where id = target_user_id
  returning * into updated_profile;

  insert into public.audit_logs (
    actor_user_id,
    academy_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) values (
    actor_id,
    null,
    case when target_status = 'disabled' then 'user.disabled' else 'user.reactivated' end,
    'user',
    target_user_id,
    pg_catalog.to_jsonb(previous_profile),
    pg_catalog.to_jsonb(updated_profile)
  );

  return updated_profile;
end;
$$;

revoke all on function public.set_application_user_status(uuid, text) from public;
revoke all on function public.set_application_user_status(uuid, text) from anon;
grant execute on function public.set_application_user_status(uuid, text) to authenticated;

-- Retain historical business records when an Auth identity is deleted, while
-- removing references to the deleted profile. Membership ownership remains
-- ON DELETE CASCADE; coach/student user links remain ON DELETE SET NULL.
alter table public.academies drop constraint if exists academies_created_by_fkey;
alter table public.academies add constraint academies_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
alter table public.academies drop constraint if exists academies_approved_by_fkey;
alter table public.academies add constraint academies_approved_by_fkey
  foreign key (approved_by) references public.profiles(id) on delete set null;

alter table public.academy_memberships drop constraint if exists academy_memberships_invited_by_fkey;
alter table public.academy_memberships add constraint academy_memberships_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete set null;

alter table public.audit_logs drop constraint if exists audit_logs_actor_user_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_user_id_fkey
  foreign key (actor_user_id) references public.profiles(id) on delete set null;

alter table public.coaches drop constraint if exists coaches_created_by_fkey;
alter table public.coaches add constraint coaches_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.students drop constraint if exists students_created_by_fkey;
alter table public.students add constraint students_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.batches drop constraint if exists batches_created_by_fkey;
alter table public.batches add constraint batches_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.batch_students drop constraint if exists batch_students_created_by_fkey;
alter table public.batch_students add constraint batch_students_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
