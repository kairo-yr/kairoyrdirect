create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  avatar_url text,
  phone text,
  academy_id text,
  linked_student_id text,
  linked_parent_id text,
  platform_role text not null default 'user',
  app_role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'super_admin'
      and status = 'active'
  );
$$;

create policy "Super admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_super_admin());

create policy "Super admins can update all profiles"
on public.profiles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
