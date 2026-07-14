-- Resolve the authenticated coach from canonical coach/membership records.
-- This wrapper invokes the idempotent email-verified claim first, then returns
-- only a coach row that is linked to auth.uid() and has active academy access.

-- Remove the obsolete pointer in environments created from an older schema.
-- Production environments where it never existed are unaffected.
alter table public.profiles drop column if exists linked_coach_id;

do $$
declare
  missing_columns text;
begin
  select pg_catalog.string_agg(required.column_name, ', ' order by required.column_name)
  into missing_columns
  from (values ('app_role'), ('platform_role'), ('status'), ('updated_at')) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns as existing
    where existing.table_schema = 'public'
      and existing.table_name = 'profiles'
      and existing.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'public.profiles is missing required columns: %', missing_columns;
  end if;
end;
$$;

create or replace function public.resolve_my_coach_profile(target_academy_id uuid default null)
returns setof public.coaches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  verified_email text;
  candidate_coach public.coaches%rowtype;
  resolved_coach public.coaches%rowtype;
  membership_row public.academy_memberships%rowtype;
  old_coach jsonb;
  old_membership jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into verified_email
  from auth.users as auth_user
  where auth_user.id = actor_id;

  if verified_email is null or verified_email = '' then
    raise exception using errcode = '42501', message = 'Authenticated email could not be verified.';
  end if;

  if not exists (select 1 from public.profiles as profile where profile.id = actor_id) then
    raise exception using errcode = '42501', message = 'Authenticated profile not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text, 0));

  select coach.*
  into candidate_coach
  from public.coaches as coach
  where pg_catalog.lower(pg_catalog.btrim(coach.email)) = verified_email
    and coach.status in ('pending_login', 'active')
    and (coach.user_id is null or coach.user_id = actor_id)
    and (target_academy_id is null or coach.academy_id = target_academy_id)
  order by case when coach.user_id = actor_id then 0 else 1 end, coach.created_at
  limit 1
  for update;

  if candidate_coach.id is not null then
    select membership.*
    into membership_row
    from public.academy_memberships as membership
    where membership.academy_id = candidate_coach.academy_id
      and membership.role = 'coach'
      and (
        membership.user_id = actor_id
        or pg_catalog.lower(pg_catalog.btrim(membership.email)) = verified_email
      )
    order by case when membership.user_id = actor_id then 0 else 1 end, membership.created_at
    limit 1
    for update;

    if candidate_coach.user_id is distinct from actor_id
      or candidate_coach.membership_id is distinct from membership_row.id
      or candidate_coach.status <> 'active'
      or membership_row.id is null
      or membership_row.user_id is distinct from actor_id
      or membership_row.status <> 'active'
    then
      old_coach := pg_catalog.to_jsonb(candidate_coach);
      old_membership := case when membership_row.id is null then null else pg_catalog.to_jsonb(membership_row) end;

      if membership_row.id is null then
        insert into public.academy_memberships (
          academy_id, user_id, email, role, status, joined_at
        ) values (
          candidate_coach.academy_id, actor_id, verified_email, 'coach', 'active', pg_catalog.now()
        )
        returning * into membership_row;
      else
        update public.academy_memberships
        set user_id = actor_id,
            email = verified_email,
            status = 'active',
            joined_at = coalesce(joined_at, pg_catalog.now()),
            updated_at = pg_catalog.now()
        where id = membership_row.id
        returning * into membership_row;
      end if;

      update public.coaches
      set user_id = actor_id,
          membership_id = membership_row.id,
          email = verified_email,
          status = 'active',
          joined_at = coalesce(joined_at, current_date),
          updated_at = pg_catalog.now()
      where id = candidate_coach.id
      returning * into candidate_coach;

      insert into public.audit_logs (
        actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
      ) values (
        actor_id,
        candidate_coach.academy_id,
        'coach.account_claimed',
        'coach',
        candidate_coach.id,
        old_coach,
        pg_catalog.jsonb_build_object(
          'coach', pg_catalog.to_jsonb(candidate_coach),
          'membership', pg_catalog.to_jsonb(membership_row),
          'previous_membership', old_membership
        )
      );
    end if;
  end if;

  select coach.*
  into resolved_coach
  from public.coaches as coach
  inner join public.academy_memberships as membership
    on membership.id = coach.membership_id
   and membership.academy_id = coach.academy_id
   and membership.user_id = actor_id
   and membership.role = 'coach'
   and membership.status = 'active'
  inner join public.academies as academy
    on academy.id = coach.academy_id
   and academy.status = 'active'
  inner join public.profiles as profile
    on profile.id = actor_id
   and profile.status = 'active'
  where coach.user_id = actor_id
    and coach.status = 'active'
    and (target_academy_id is null or coach.academy_id = target_academy_id)
  order by membership.joined_at desc nulls last, coach.updated_at desc
  limit 1;

  if resolved_coach.id is null then
    return;
  end if;

  update public.profiles
  set app_role = case
        when platform_role = 'super_admin' then app_role
        when app_role = 'academy_admin' then app_role
        else 'coach'
      end,
      status = 'active',
      updated_at = pg_catalog.now()
  where id = actor_id;

  return next resolved_coach;
  return;
end;
$$;

revoke all on function public.resolve_my_coach_profile(uuid) from public;
revoke all on function public.resolve_my_coach_profile(uuid) from anon;
grant execute on function public.resolve_my_coach_profile(uuid) to authenticated;
