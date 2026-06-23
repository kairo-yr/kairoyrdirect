create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  status text not null default 'pending',
  logo_url text,
  description text,
  primary_email text,
  primary_phone text,
  website_url text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  country text default 'India',
  postal_code text,
  timezone text default 'Asia/Kolkata',
  owner_name text,
  owner_email text,
  owner_phone text,
  plan_type text default 'trial',
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_locations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  country text default 'India',
  postal_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id, role)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  academy_id uuid references public.academies(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

alter table public.academies enable row level security;
alter table public.academy_locations enable row level security;
alter table public.academy_memberships enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_academies_updated_at on public.academies;
create trigger set_academies_updated_at
before update on public.academies
for each row
execute function public.set_updated_at();

drop trigger if exists set_academy_locations_updated_at on public.academy_locations;
create trigger set_academy_locations_updated_at
before update on public.academy_locations
for each row
execute function public.set_updated_at();

drop trigger if exists set_academy_memberships_updated_at on public.academy_memberships;
create trigger set_academy_memberships_updated_at
before update on public.academy_memberships
for each row
execute function public.set_updated_at();

create or replace function public.is_active_academy_member(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_memberships
    where academy_id = target_academy_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_academy_role(target_academy_id uuid, target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_memberships
    where academy_id = target_academy_id
      and user_id = auth.uid()
      and role = target_role
      and status = 'active'
  );
$$;

create policy "Super admins can select all academies"
on public.academies
for select
to authenticated
using (public.is_super_admin());

create policy "Super admins can insert academies"
on public.academies
for insert
to authenticated
with check (public.is_super_admin());

create policy "Authenticated users can submit pending academy registrations"
on public.academies
for insert
to authenticated
with check (
  created_by = auth.uid()
  and status = 'pending'
);

create policy "Super admins can update academies"
on public.academies
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Super admins can delete academies"
on public.academies
for delete
to authenticated
using (public.is_super_admin());

create policy "Active academy members can select own academy"
on public.academies
for select
to authenticated
using (public.is_active_academy_member(id));

create policy "Super admins can select all memberships"
on public.academy_memberships
for select
to authenticated
using (public.is_super_admin());

create policy "Users can select own memberships"
on public.academy_memberships
for select
to authenticated
using (user_id = auth.uid());

create policy "Active academy admins can select academy memberships"
on public.academy_memberships
for select
to authenticated
using (public.has_academy_role(academy_id, 'academy_admin'));

create policy "Super admins can insert memberships"
on public.academy_memberships
for insert
to authenticated
with check (public.is_super_admin());

create policy "Super admins can update memberships"
on public.academy_memberships
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Super admins can select all locations"
on public.academy_locations
for select
to authenticated
using (public.is_super_admin());

create policy "Active academy members can select academy locations"
on public.academy_locations
for select
to authenticated
using (public.is_active_academy_member(academy_id));

create policy "Super admins can insert locations"
on public.academy_locations
for insert
to authenticated
with check (public.is_super_admin());

create policy "Super admins can update locations"
on public.academy_locations
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Super admins can delete locations"
on public.academy_locations
for delete
to authenticated
using (public.is_super_admin());

create policy "Super admins can select all audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_super_admin());

create policy "Super admins can insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (public.is_super_admin());

create policy "Users can insert own audit logs"
on public.audit_logs
for insert
to authenticated
with check (actor_user_id = auth.uid());

insert into public.academies (
  name, slug, status, description, primary_email, primary_phone, city, state, country,
  owner_name, owner_email, owner_phone, plan_type, notes, approved_at, disabled_at
) values
  ('Kairoyr Chess Academy', 'kairoyr-chess-academy', 'active', 'Flagship academy for structured junior chess training.', 'hello@kairoyrchess.com', '+91 94487 26256', 'Bengaluru', 'Karnataka', 'India', 'Yogendra Reddy', 'kairoyrchess@gmail.com', '+91 94487 26256', 'trial', 'Seed academy.', now(), null),
  ('Check N Mate Academy', 'check-n-mate-academy', 'active', 'Weekend and after-school chess coaching.', 'admin@checknmate.example', '+91 98450 11001', 'Bengaluru', 'Karnataka', 'India', 'Priya Nair', 'priya@checknmate.example', '+91 98450 11001', 'trial', 'Seed academy.', now(), null),
  ('Durga Petals Chess Program', 'durga-petals-chess-program', 'active', 'Residential community chess program.', 'chess@durgapetals.example', '+91 98450 11002', 'Bengaluru', 'Karnataka', 'India', 'Arun Kumar', 'arun@durgapetals.example', '+91 98450 11002', 'trial', 'Seed academy.', now(), null),
  ('Brigade Metropolis Chess Club', 'brigade-metropolis-chess-club', 'active', 'Club sessions for beginners and tournament players.', 'club@brigademetropolis.example', '+91 98450 11003', 'Bengaluru', 'Karnataka', 'India', 'Meera Rao', 'meera@brigademetropolis.example', '+91 98450 11003', 'trial', 'Seed academy.', now(), null),
  ('Godrej United Chess Academy', 'godrej-united-chess-academy', 'pending', 'Academy registration awaiting platform review.', 'chess@godrejunited.example', '+91 98450 11004', 'Bengaluru', 'Karnataka', 'India', 'Sanjay Iyer', 'sanjay@godrejunited.example', '+91 98450 11004', 'trial', 'Seed pending academy.', null, null),
  ('Whitefield Chess Centre', 'whitefield-chess-centre', 'pending', 'Whitefield training centre awaiting approval.', 'info@whitefieldchess.example', '+91 98450 11005', 'Bengaluru', 'Karnataka', 'India', 'Neha Shah', 'neha@whitefieldchess.example', '+91 98450 11005', 'trial', 'Seed pending academy.', null, null),
  ('Bengaluru Junior Chess Lab', 'bengaluru-junior-chess-lab', 'pending', 'Junior-focused chess lab awaiting review.', 'hello@bjcl.example', '+91 98450 11006', 'Bengaluru', 'Karnataka', 'India', 'Ravi Menon', 'ravi@bjcl.example', '+91 98450 11006', 'trial', 'Seed pending academy.', null, null),
  ('Knight Minds Academy', 'knight-minds-academy', 'rejected', 'Rejected sample academy.', 'admin@knightminds.example', '+91 98450 11007', 'Bengaluru', 'Karnataka', 'India', 'Anita Desai', 'anita@knightminds.example', '+91 98450 11007', 'trial', 'Rejected: incomplete verification documents.', null, null),
  ('Endgame Elite Chess School', 'endgame-elite-chess-school', 'disabled', 'Disabled sample academy.', 'contact@endgameelite.example', '+91 98450 11008', 'Bengaluru', 'Karnataka', 'India', 'Vikram Bhat', 'vikram@endgameelite.example', '+91 98450 11008', 'trial', 'Disabled seed academy.', now(), now()),
  ('Global Art Chess Program', 'global-art-chess-program', 'disabled', 'Disabled art-school chess program.', 'chess@globalart.example', '+91 98450 11009', 'Bengaluru', 'Karnataka', 'India', 'Lakshmi Prasad', 'lakshmi@globalart.example', '+91 98450 11009', 'trial', 'Disabled seed academy.', now(), now())
on conflict (slug) do nothing;
