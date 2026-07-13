alter table public.academy_memberships
alter column user_id drop not null;

alter table public.academy_memberships
add column if not exists email text;

alter table public.academy_memberships
drop constraint if exists academy_memberships_academy_id_user_id_role_key;

create index if not exists academy_memberships_academy_id_idx on public.academy_memberships (academy_id);
create index if not exists academy_memberships_user_id_idx on public.academy_memberships (user_id);
create index if not exists academy_memberships_email_idx on public.academy_memberships (email);
create index if not exists academy_memberships_role_idx on public.academy_memberships (role);
create index if not exists academy_memberships_status_idx on public.academy_memberships (status);

create unique index if not exists academy_memberships_unique_active_user_role
on public.academy_memberships (academy_id, user_id, role)
where user_id is not null;

create unique index if not exists academy_memberships_unique_pending_email_role
on public.academy_memberships (academy_id, lower(email), role)
where email is not null and status = 'pending_login';

alter table public.coaches
drop constraint if exists coaches_status_check;

update public.coaches
set status = 'pending_login'
where status = 'invited';

alter table public.coaches
add constraint coaches_status_check check (status in ('pending_login', 'active', 'disabled', 'removed'));

update public.academy_memberships
set email = profiles.email
from public.profiles
where public.academy_memberships.user_id = profiles.id
  and public.academy_memberships.email is null;

create or replace function public.resolve_app_role_for_user(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.academy_memberships
      where user_id = target_user_id
        and role = 'academy_admin'
        and status = 'active'
    ) then 'academy_admin'
    when exists (
      select 1
      from public.academy_memberships
      where user_id = target_user_id
        and role = 'coach'
        and status = 'active'
    ) then 'coach'
    when exists (
      select 1
      from public.academy_memberships
      where user_id = target_user_id
        and role = 'student'
        and status = 'active'
    ) then 'student'
    else 'user'
  end;
$$;

create or replace function public.refresh_profile_role_from_memberships(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
  actor_can_update boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select public.is_super_admin()
    or exists (
      select 1
      from public.academy_memberships actor_membership
      join public.academy_memberships target_membership
        on target_membership.academy_id = actor_membership.academy_id
      where actor_membership.user_id = auth.uid()
        and actor_membership.role = 'academy_admin'
        and actor_membership.status = 'active'
        and target_membership.user_id = target_user_id
    )
  into actor_can_update;

  if not actor_can_update and auth.uid() <> target_user_id then
    raise exception 'Not allowed to refresh this profile role.';
  end if;

  select public.resolve_app_role_for_user(target_user_id) into next_role;

  update public.profiles
  set app_role = case
      when platform_role = 'super_admin' then app_role
      when app_role = 'academy_admin' and next_role <> 'academy_admin' then app_role
      else next_role
    end
  where id = target_user_id
    and platform_role <> 'super_admin';

  return next_role;
end;
$$;

create or replace function public.claim_pending_memberships()
returns table (
  membership_id uuid,
  academy_id uuid,
  role text,
  final_app_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  membership_row public.academy_memberships%rowtype;
  linked_coach public.coaches%rowtype;
  next_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Profile not found.';
  end if;

  if current_profile.email is null or trim(current_profile.email) = '' then
    return;
  end if;

  for membership_row in
    update public.academy_memberships
    set user_id = auth.uid(),
        status = 'active',
        joined_at = coalesce(joined_at, now())
    where lower(email) = lower(current_profile.email)
      and user_id is null
      and status = 'pending_login'
    returning *
  loop
    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      auth.uid(),
      membership_row.academy_id,
      'membership.claimed',
      'academy_membership',
      membership_row.id,
      jsonb_build_object('email', membership_row.email, 'status', 'pending_login'),
      to_jsonb(membership_row)
    );

    if membership_row.role = 'coach' then
      update public.coaches
      set user_id = auth.uid(),
          membership_id = membership_row.id,
          status = 'active'
      where academy_id = membership_row.academy_id
        and lower(email) = lower(current_profile.email)
        and user_id is null
      returning * into linked_coach;

      if linked_coach.id is not null then
        insert into public.audit_logs (
          actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
        ) values (
          auth.uid(),
          membership_row.academy_id,
          'coach.linked_to_profile',
          'coach',
          linked_coach.id,
          jsonb_build_object('email', linked_coach.email, 'status', 'pending_login'),
          to_jsonb(linked_coach)
        );
      end if;
    end if;
  end loop;

  select public.resolve_app_role_for_user(auth.uid()) into next_role;

  update public.profiles
  set app_role = case
      when platform_role = 'super_admin' then app_role
      else next_role
    end
  where id = auth.uid()
    and platform_role <> 'super_admin';

  return query
    select memberships.id, memberships.academy_id, memberships.role, next_role
    from public.academy_memberships memberships
    where memberships.user_id = auth.uid()
      and memberships.status = 'active';
end;
$$;
