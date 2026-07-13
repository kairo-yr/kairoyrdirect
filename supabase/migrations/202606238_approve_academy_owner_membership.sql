create or replace function public.approve_academy_application(target_academy_id uuid)
returns public.academies
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  previous_academy public.academies%rowtype;
  approved_academy public.academies%rowtype;
  owner_email_normalized text;
  owner_profile public.profiles%rowtype;
  old_profile jsonb;
  membership_row public.academy_memberships%rowtype;
  old_membership jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_super_admin() then
    raise exception 'Only super admins can approve academies.';
  end if;

  select *
  into previous_academy
  from public.academies
  where id = target_academy_id
  for update;

  if previous_academy.id is null then
    raise exception 'Academy not found.';
  end if;

  owner_email_normalized := lower(trim(coalesce(previous_academy.owner_email, '')));
  if owner_email_normalized = '' then
    raise exception 'Academy owner email is required before approval.';
  end if;

  update public.academies
  set status = 'active',
      approved_by = actor_id,
      approved_at = now(),
      disabled_at = null
  where id = target_academy_id
  returning * into approved_academy;

  select *
  into owner_profile
  from public.profiles
  where lower(email) = owner_email_normalized
  order by created_at asc
  limit 1;

  if owner_profile.id is not null then
    select *
    into membership_row
    from public.academy_memberships
    where academy_id = target_academy_id
      and role = 'academy_admin'
      and (
        user_id = owner_profile.id
        or lower(email) = owner_email_normalized
      )
    order by case when user_id = owner_profile.id then 0 else 1 end, created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, joined_at
      ) values (
        target_academy_id,
        owner_profile.id,
        previous_academy.owner_email,
        'academy_admin',
        'active',
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
      set user_id = owner_profile.id,
          email = previous_academy.owner_email,
          role = 'academy_admin',
          status = 'active',
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

    old_profile := to_jsonb(owner_profile);

    update public.profiles
    set app_role = case
          when platform_role = 'super_admin' then app_role
          else 'academy_admin'
        end,
        status = 'active'
    where id = owner_profile.id
    returning * into owner_profile;

    insert into public.audit_logs (
      actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
    ) values (
      actor_id,
      target_academy_id,
      'profile.role_updated',
      'profile',
      owner_profile.id,
      old_profile,
      to_jsonb(owner_profile)
    );
  else
    select *
    into membership_row
    from public.academy_memberships
    where academy_id = target_academy_id
      and role = 'academy_admin'
      and lower(email) = owner_email_normalized
    order by created_at asc
    limit 1
    for update;

    if membership_row.id is null then
      insert into public.academy_memberships (
        academy_id, user_id, email, role, status, joined_at
      ) values (
        target_academy_id,
        null,
        previous_academy.owner_email,
        'academy_admin',
        'pending_login',
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
          email = previous_academy.owner_email,
          role = 'academy_admin',
          status = 'pending_login',
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

  insert into public.audit_logs (
    actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    actor_id,
    target_academy_id,
    'academy.approved',
    'academy',
    target_academy_id,
    to_jsonb(previous_academy),
    to_jsonb(approved_academy)
  );

  return approved_academy;
end;
$$;

revoke all on function public.approve_academy_application(uuid) from public;
grant execute on function public.approve_academy_application(uuid) to authenticated;

update public.academy_memberships
set status = 'pending_login'
where status = 'invited';

alter table public.academy_memberships
drop constraint if exists academy_memberships_status_check;

alter table public.academy_memberships
add constraint academy_memberships_status_check
check (status in ('pending_login', 'active', 'disabled', 'removed'));

do $$
declare
  academy_row public.academies%rowtype;
  owner_profile public.profiles%rowtype;
  membership_row public.academy_memberships%rowtype;
  old_profile jsonb;
  old_membership jsonb;
begin
  for academy_row in
    select *
    from public.academies
    where status = 'active'
      and owner_email is not null
      and trim(owner_email) <> ''
  loop
    select *
    into owner_profile
    from public.profiles
    where lower(email) = lower(trim(academy_row.owner_email))
    order by created_at asc
    limit 1;

    if owner_profile.id is not null then
      select *
      into membership_row
      from public.academy_memberships
      where academy_id = academy_row.id
        and role = 'academy_admin'
        and (
          user_id = owner_profile.id
          or lower(email) = lower(trim(academy_row.owner_email))
        )
      order by case when user_id = owner_profile.id then 0 else 1 end, created_at asc
      limit 1
      for update;

      if membership_row.id is null then
        insert into public.academy_memberships (
          academy_id, user_id, email, role, status, joined_at
        ) values (
          academy_row.id,
          owner_profile.id,
          academy_row.owner_email,
          'academy_admin',
          'active',
          now()
        )
        returning * into membership_row;

        insert into public.audit_logs (
          actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
        ) values (
          null,
          academy_row.id,
          'membership.created',
          'academy_membership',
          membership_row.id,
          null,
          to_jsonb(membership_row)
        );
      else
        old_membership := to_jsonb(membership_row);

        update public.academy_memberships
        set user_id = owner_profile.id,
            email = academy_row.owner_email,
            role = 'academy_admin',
            status = 'active',
            joined_at = coalesce(joined_at, now())
        where id = membership_row.id
        returning * into membership_row;

        insert into public.audit_logs (
          actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
        ) values (
          null,
          academy_row.id,
          'membership.updated',
          'academy_membership',
          membership_row.id,
          old_membership,
          to_jsonb(membership_row)
        );
      end if;

      old_profile := to_jsonb(owner_profile);

      update public.profiles
      set app_role = case
            when platform_role = 'super_admin' then app_role
            else 'academy_admin'
          end,
          status = 'active'
      where id = owner_profile.id
      returning * into owner_profile;

      insert into public.audit_logs (
        actor_user_id, academy_id, action, entity_type, entity_id, old_values, new_values
      ) values (
        null,
        academy_row.id,
        'profile.role_updated',
        'profile',
        owner_profile.id,
        old_profile,
        to_jsonb(owner_profile)
      );
    end if;
  end loop;
end;
$$;
