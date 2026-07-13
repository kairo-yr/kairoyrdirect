-- Normalize uniqueness so whitespace/casing cannot create duplicate coach
-- identities within the same academy.
drop index if exists public.coaches_unique_academy_email;

create unique index if not exists coaches_unique_academy_normalized_email
on public.coaches (academy_id, lower(btrim(email)))
where email is not null and btrim(email) <> '';

create unique index if not exists coaches_unique_academy_user
on public.coaches (academy_id, user_id)
where user_id is not null;

drop index if exists public.academy_memberships_unique_pending_email_role;

create unique index if not exists academy_memberships_unique_academy_normalized_email_role
on public.academy_memberships (academy_id, lower(btrim(email)), role)
where email is not null and btrim(email) <> '';

create or replace function public.claim_my_coach_account()
returns setof public.coaches
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  verified_email text;
  coach_row public.coaches%rowtype;
  linked_coach public.coaches%rowtype;
  membership_row public.academy_memberships%rowtype;
  old_coach jsonb;
  old_membership jsonb;
  claimed_count integer := 0;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into verified_email
  from auth.users auth_user
  where auth_user.id = actor_id;

  if verified_email is null or verified_email = '' then
    raise exception using errcode = '42501', message = 'Authenticated email could not be verified.';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = actor_id) then
    raise exception using errcode = '42501', message = 'Authenticated profile not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text, 0));

  for coach_row in
    select coach.*
    from public.coaches coach
    where pg_catalog.lower(pg_catalog.btrim(coach.email)) = verified_email
      and (
        coach.user_id = actor_id
        or (coach.user_id is null and coach.status in ('pending_login', 'active'))
      )
    order by coach.created_at asc
    for update
  loop
    membership_row := null;
    old_membership := null;

    select membership.*
    into membership_row
    from public.academy_memberships membership
    where membership.academy_id = coach_row.academy_id
      and membership.role = 'coach'
      and (
        membership.user_id = actor_id
        or pg_catalog.lower(pg_catalog.btrim(membership.email)) = verified_email
      )
    order by case when membership.user_id = actor_id then 0 else 1 end, membership.created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, joined_at
      ) values (
        coach_row.academy_id, actor_id, verified_email, 'coach', 'active', pg_catalog.now()
      )
      returning * into membership_row;
    else
      old_membership := pg_catalog.to_jsonb(membership_row);

      update public.academy_memberships membership
      set user_id = actor_id,
          email = verified_email,
          role = 'coach',
          status = 'active',
          joined_at = coalesce(membership.joined_at, pg_catalog.now()),
          updated_at = pg_catalog.now()
      where membership.id = membership_row.id
      returning * into membership_row;
    end if;

    old_coach := pg_catalog.to_jsonb(coach_row);

    update public.coaches coach
    set user_id = actor_id,
        membership_id = membership_row.id,
        email = verified_email,
        status = 'active',
        joined_at = coalesce(coach.joined_at, current_date),
        updated_at = pg_catalog.now()
    where coach.id = coach_row.id
    returning * into linked_coach;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      linked_coach.academy_id,
      'coach.account_claimed',
      'coach',
      linked_coach.id,
      old_coach,
      pg_catalog.jsonb_build_object(
        'coach', pg_catalog.to_jsonb(linked_coach),
        'membership', pg_catalog.to_jsonb(membership_row),
        'previous_membership', old_membership
      )
    );

    claimed_count := claimed_count + 1;
    return next linked_coach;
  end loop;

  if claimed_count > 0 then
    update public.profiles profile
    set app_role = case
          when profile.platform_role = 'super_admin' then profile.app_role
          when profile.app_role = 'academy_admin' then profile.app_role
          else 'coach'
        end,
        status = 'active',
        updated_at = pg_catalog.now()
    where profile.id = actor_id;
  end if;

  return;
end;
$$;

revoke all on function public.claim_my_coach_account() from public;
revoke all on function public.claim_my_coach_account() from anon;
grant execute on function public.claim_my_coach_account() to authenticated;
