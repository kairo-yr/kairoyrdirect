-- Recreate the canonical users RPC with its current return contract.
-- DROP is required because PostgreSQL cannot rename an OUT/return-table column
-- through CREATE OR REPLACE. The migration is transactional and rerunnable.

drop function if exists public.list_application_users();

create function public.list_application_users()
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
  coach_id uuid,
  student_id uuid,
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
    where row.user_id = profile.id
      and row.status <> 'removed'
    order by row.updated_at desc
    limit 1
  ) as coach on true
  left join lateral (
    select row.id
    from public.students as row
    where row.user_id = profile.id
      and row.status <> 'removed'
    order by row.updated_at desc
    limit 1
  ) as student on true
  order by profile.created_at desc;
end;
$$;

revoke all on function public.list_application_users() from public;
revoke all on function public.list_application_users() from anon;
grant execute on function public.list_application_users() to authenticated;

comment on function public.list_application_users() is
  'Super-admin-only canonical application users joined to existing auth.users identities.';
