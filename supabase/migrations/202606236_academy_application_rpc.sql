drop policy if exists "Authenticated users can submit pending academy registrations" on public.academies;

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
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if normalized_name is null then
    raise exception using errcode = '22023', message = 'Academy name is required.';
  end if;

  if normalized_city is null then
    raise exception using errcode = '22023', message = 'City is required.';
  end if;

  select * into actor_profile
  from public.profiles
  where profiles.id = actor_id;

  if actor_profile.id is null then
    raise exception using errcode = '42501', message = 'Authenticated profile not found.';
  end if;

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
    id, name, slug, status, owner_name, owner_email, owner_phone,
    primary_email, primary_phone, city, country, timezone, plan_type,
    created_by, approved_by, approved_at, disabled_at
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
