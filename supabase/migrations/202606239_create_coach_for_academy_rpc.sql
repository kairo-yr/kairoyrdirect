create or replace function public.create_coach_for_academy(
  target_academy_id uuid,
  coach_full_name text,
  coach_email text,
  coach_phone text default null,
  coach_specialization text default null
)
returns public.coaches
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text;
  matched_profile public.profiles%rowtype;
  membership_row public.academy_memberships%rowtype;
  old_membership jsonb;
  coach_row public.coaches%rowtype;
  old_coach jsonb;
  old_profile jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_super_admin() and not public.has_academy_role(target_academy_id, 'academy_admin') then
    raise exception 'Only academy admins can add coaches for this academy.';
  end if;

  if not exists (
    select 1 from public.academies where id = target_academy_id and status = 'active'
  ) then
    raise exception 'Academy is not active.';
  end if;

  if nullif(trim(coach_full_name), '') is null then
    raise exception 'Coach name is required.';
  end if;

  normalized_email := lower(trim(coach_email));
  if normalized_email is null or normalized_email = '' then
    raise exception 'Coach email is required.';
  end if;

  select *
  into matched_profile
  from public.profiles
  where lower(email) = normalized_email
  order by created_at asc
  limit 1;

  if matched_profile.id is not null then
    select *
    into membership_row
    from public.academy_memberships
    where academy_id = target_academy_id
      and role = 'coach'
      and (
        user_id = matched_profile.id
        or lower(email) = normalized_email
      )
    order by case when user_id = matched_profile.id then 0 else 1 end, created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, invited_by, joined_at
      ) values (
        target_academy_id,
        matched_profile.id,
        normalized_email,
        'coach',
        'active',
        actor_id,
        now()
      )
      returning * into membership_row;

      insert into public.audit_logs (
        actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
      ) values (
        actor_id,
        target_academy_id,
        'membership.created',
        'academy_membership',
        membership_row.id,
        null,
        to_jsonb(membership_row)
      );
    else
      old_membership := to_jsonb(membership_row);

      update public.academy_memberships
      set user_id = matched_profile.id,
          email = normalized_email,
          role = 'coach',
          status = 'active',
          invited_by = actor_id,
          joined_at = coalesce(joined_at, now())
      where id = membership_row.id
      returning * into membership_row;

      insert into public.audit_logs (
        actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
      ) values (
        actor_id,
        target_academy_id,
        'membership.updated',
        'academy_membership',
        membership_row.id,
        old_membership,
        to_jsonb(membership_row)
      );
    end if;

    old_profile := to_jsonb(matched_profile);

    update public.profiles
    set app_role = case
          when platform_role = 'super_admin' then app_role
          when app_role = 'academy_admin' then app_role
          else 'coach'
        end,
        status = 'active'
    where id = matched_profile.id
    returning * into matched_profile;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      'profile.role_updated',
      'profile',
      matched_profile.id,
      old_profile,
      to_jsonb(matched_profile)
    );
  else
    select *
    into membership_row
    from public.academy_memberships
    where academy_id = target_academy_id
      and role = 'coach'
      and lower(email) = normalized_email
    order by created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, invited_by, joined_at
      ) values (
        target_academy_id,
        null,
        normalized_email,
        'coach',
        'pending_login',
        actor_id,
        null
      )
      returning * into membership_row;

      insert into public.audit_logs (
        actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
      ) values (
        actor_id,
        target_academy_id,
        'membership.created',
        'academy_membership',
        membership_row.id,
        null,
        to_jsonb(membership_row)
      );
    else
      old_membership := to_jsonb(membership_row);

      update public.academy_memberships
      set user_id = null,
          email = normalized_email,
          role = 'coach',
          status = 'pending_login',
          invited_by = actor_id,
          joined_at = null
      where id = membership_row.id
      returning * into membership_row;

      insert into public.audit_logs (
        actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
      ) values (
        actor_id,
        target_academy_id,
        'membership.updated',
        'academy_membership',
        membership_row.id,
        old_membership,
        to_jsonb(membership_row)
      );
    end if;
  end if;

  select *
  into coach_row
  from public.coaches
  where academy_id = target_academy_id
    and lower(email) = normalized_email
  order by created_at asc
  limit 1
  for update;

  if coach_row.id is null then
    insert into public.coaches (
      academy_id,
      user_id,
      membership_id,
      full_name,
      email,
      phone,
      avatar_url,
      specialization,
      status,
      employment_type,
      joined_at,
      created_by
    ) values (
      target_academy_id,
      matched_profile.id,
      membership_row.id,
      trim(coach_full_name),
      normalized_email,
      nullif(trim(coach_phone), ''),
      matched_profile.avatar_url,
      nullif(trim(coach_specialization), ''),
      case when matched_profile.id is not null then 'active' else 'pending_login' end,
      'part_time',
      case when matched_profile.id is not null then now()::date else null end,
      actor_id
    )
    returning * into coach_row;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      'coach.created',
      'coach',
      coach_row.id,
      null,
      to_jsonb(coach_row)
    );
  else
    old_coach := to_jsonb(coach_row);

    update public.coaches
    set user_id = matched_profile.id,
        membership_id = membership_row.id,
        full_name = trim(coach_full_name),
        email = normalized_email,
        phone = nullif(trim(coach_phone), ''),
        avatar_url = coalesce(coach_row.avatar_url, matched_profile.avatar_url),
        specialization = nullif(trim(coach_specialization), ''),
        status = case when matched_profile.id is not null then 'active' else 'pending_login' end,
        joined_at = case when matched_profile.id is not null then coalesce(joined_at, now()::date) else null end
    where id = coach_row.id
    returning * into coach_row;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      'coach.updated',
      'coach',
      coach_row.id,
      old_coach,
      to_jsonb(coach_row)
    );
  end if;

  if matched_profile.id is not null then
    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      'coach.linked_to_profile',
      'coach',
      coach_row.id,
      null,
      jsonb_build_object('coach_id', coach_row.id, 'profile_id', matched_profile.id, 'membership_id', membership_row.id)
    );
  end if;

  return coach_row;
end;
$$;

revoke all on function public.create_coach_for_academy(uuid, text, text, text, text) from public;
grant execute on function public.create_coach_for_academy(uuid, text, text, text, text) to authenticated;
