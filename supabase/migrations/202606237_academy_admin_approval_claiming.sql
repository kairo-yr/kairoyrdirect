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
    end,
    status = 'active'
  where id = auth.uid()
    and platform_role <> 'super_admin';

  return query
    select memberships.id, memberships.academy_id, memberships.role, next_role
    from public.academy_memberships memberships
    where memberships.user_id = auth.uid()
      and memberships.status = 'active';
end;
$$;
