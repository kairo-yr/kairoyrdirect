-- Academy applications are submitted through a narrowly scoped RPC.  The RPC
-- derives the submitter from the verified JWT and never creates a membership.
drop policy if exists "Authenticated users can submit pending academy registrations" on public.academies;

drop function if exists public.submit_academy_application(text, text, text, text, text, text, text);

create or replace function public.submit_academy_application(
  academy_name text,
  city text,
  owner_phone text default null
)
returns table (
  id uuid,
  name text,
  status text,
  slug text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  inserted_academy public.academies%rowtype;
  normalized_name text := nullif(btrim(academy_name), '');
  normalized_city text := nullif(btrim(city), '');
  application_id uuid := gen_random_uuid();
  base_slug text;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required.';
  end if;

  if normalized_name is null then
    raise exception using
      errcode = '22023',
      message = 'Academy name is required.';
  end if;

  if normalized_city is null then
    raise exception using
      errcode = '22023',
      message = 'City is required.';
  end if;

  select *
  into actor_profile
  from public.profiles
  where profiles.id = actor_id;

  if actor_profile.id is null then
    raise exception using
      errcode = '42501',
      message = 'Authenticated profile not found.';
  end if;

  -- Serialize applications per submitter so concurrent double-clicks cannot
  -- both pass the equivalent-pending check.
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));

  if exists (
    select 1
    from public.academies existing
    where existing.created_by = actor_id
      and existing.status = 'pending'
      and lower(btrim(existing.name)) = lower(normalized_name)
      and lower(btrim(coalesce(existing.city, ''))) = lower(normalized_city)
  ) then
    raise exception using
      errcode = '23505',
      message = 'An equivalent academy application is already pending.',
      detail = 'The same user, academy name, and city already have a pending application.';
  end if;

  base_slug := regexp_replace(lower(normalized_name), '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
  if base_slug = '' then base_slug := 'academy'; end if;

  insert into public.academies (
    id,
    name,
    slug,
    status,
    owner_name,
    owner_email,
    owner_phone,
    primary_email,
    primary_phone,
    city,
    country,
    timezone,
    plan_type,
    created_by,
    approved_by,
    approved_at,
    disabled_at
  ) values (
    application_id,
    normalized_name,
    left(base_slug, 71) || '-' || left(replace(application_id::text, '-', ''), 8),
    'pending',
    coalesce(nullif(btrim(actor_profile.full_name), ''), actor_profile.email),
    lower(btrim(actor_profile.email)),
    nullif(btrim(owner_phone), ''),
    lower(btrim(actor_profile.email)),
    nullif(btrim(owner_phone), ''),
    normalized_city,
    'India',
    'Asia/Kolkata',
    'trial',
    actor_id,
    null,
    null,
    null
  )
  returning * into inserted_academy;

  insert into public.audit_logs (
    actor_user_id, academy_id, action, entity_type, entity_id, new_values
  ) values (
    actor_id,
    inserted_academy.id,
    'academy.application_submitted',
    'academy',
    inserted_academy.id,
    to_jsonb(inserted_academy)
  );

  return query
    select inserted_academy.id, inserted_academy.name, inserted_academy.status, inserted_academy.slug;
end;
$$;

revoke all on function public.submit_academy_application(text, text, text) from public;
revoke all on function public.submit_academy_application(text, text, text) from anon;
grant execute on function public.submit_academy_application(text, text, text) to authenticated;

-- Approval is atomic: only a super admin can activate the academy, and the
-- authenticated submitter recorded in created_by receives the membership.
create or replace function public.approve_academy_application(target_academy_id uuid)
returns public.academies
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  previous_academy public.academies%rowtype;
  approved_academy public.academies%rowtype;
  submitter_profile public.profiles%rowtype;
  membership_row public.academy_memberships%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'Only super admins can approve academies.';
  end if;

  select * into previous_academy
  from public.academies
  where academies.id = target_academy_id
  for update;

  if previous_academy.id is null then
    raise exception using errcode = '22023', message = 'Academy application not found.';
  end if;

  if previous_academy.status <> 'pending' then
    raise exception using
      errcode = '23505',
      message = 'Only pending academy applications can be approved.';
  end if;

  if previous_academy.created_by is null then
    raise exception using errcode = '22023', message = 'Academy application has no submitter.';
  end if;

  select * into submitter_profile
  from public.profiles
  where profiles.id = previous_academy.created_by;

  if submitter_profile.id is null then
    raise exception using errcode = '22023', message = 'Academy submitter profile not found.';
  end if;

  update public.academies
  set status = 'active', approved_by = actor_id, approved_at = now(), disabled_at = null
  where academies.id = target_academy_id
  returning * into approved_academy;

  select * into membership_row
  from public.academy_memberships
  where academy_memberships.academy_id = target_academy_id
    and academy_memberships.user_id = previous_academy.created_by
    and academy_memberships.role = 'academy_admin'
  limit 1
  for update;

  if membership_row.id is null then
    insert into public.academy_memberships (
      academy_id, user_id, email, role, status, joined_at, invited_by
    ) values (
      target_academy_id,
      previous_academy.created_by,
      submitter_profile.email,
      'academy_admin',
      'active',
      now(),
      actor_id
    );
  else
    update public.academy_memberships
    set email = submitter_profile.email,
        status = 'active',
        joined_at = coalesce(joined_at, now()),
        invited_by = actor_id
    where academy_memberships.id = membership_row.id;
  end if;

  update public.profiles
  set app_role = case
        when platform_role = 'super_admin' then app_role
        else 'academy_admin'
      end,
      status = 'active'
  where profiles.id = previous_academy.created_by;

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
revoke all on function public.approve_academy_application(uuid) from anon;
grant execute on function public.approve_academy_application(uuid) to authenticated;
