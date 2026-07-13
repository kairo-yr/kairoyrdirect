create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  membership_id uuid references public.academy_memberships(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  avatar_url text,
  bio text,
  specialization text,
  status text not null default 'active',
  employment_type text default 'part_time',
  joined_at date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coaches_status_check check (status in ('pending_login', 'active', 'disabled', 'removed')),
  constraint coaches_employment_type_check check (employment_type in ('full_time', 'part_time', 'freelance', 'trial'))
);

create index if not exists coaches_academy_id_idx on public.coaches (academy_id);
create index if not exists coaches_user_id_idx on public.coaches (user_id);
create index if not exists coaches_status_idx on public.coaches (status);
create index if not exists coaches_email_idx on public.coaches (email);

create unique index if not exists coaches_unique_academy_email
on public.coaches (academy_id, lower(email))
where email is not null;

drop trigger if exists set_coaches_updated_at on public.coaches;
create trigger set_coaches_updated_at
before update on public.coaches
for each row
execute function public.set_updated_at();

alter table public.coaches enable row level security;

drop policy if exists "Super admins can manage all coaches" on public.coaches;
create policy "Super admins can manage all coaches"
on public.coaches
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Active academy members can read academy coaches" on public.coaches;
create policy "Active academy members can read academy coaches"
on public.coaches
for select
to authenticated
using (public.is_active_academy_member(academy_id));

drop policy if exists "Academy admins can insert academy coaches" on public.coaches;
create policy "Academy admins can insert academy coaches"
on public.coaches
for insert
to authenticated
with check (public.has_academy_role(academy_id, 'academy_admin'));

drop policy if exists "Academy admins can update academy coaches" on public.coaches;
create policy "Academy admins can update academy coaches"
on public.coaches
for update
to authenticated
using (public.has_academy_role(academy_id, 'academy_admin'))
with check (public.has_academy_role(academy_id, 'academy_admin'));

drop policy if exists "Coach users can read own coach row" on public.coaches;
create policy "Coach users can read own coach row"
on public.coaches
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Academy admins can insert coach memberships" on public.academy_memberships;
create policy "Academy admins can insert coach memberships"
on public.academy_memberships
for insert
to authenticated
with check (
  role = 'coach'
  and public.has_academy_role(academy_id, 'academy_admin')
);

drop policy if exists "Academy admins can update coach memberships" on public.academy_memberships;
create policy "Academy admins can update coach memberships"
on public.academy_memberships
for update
to authenticated
using (
  role = 'coach'
  and public.has_academy_role(academy_id, 'academy_admin')
)
with check (
  role = 'coach'
  and public.has_academy_role(academy_id, 'academy_admin')
);

create or replace function public.find_profile_by_email_for_coach(target_academy_id uuid, target_email text)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  status text,
  app_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.avatar_url, p.phone, p.status, p.app_role
  from public.profiles p
  where lower(p.email) = lower(trim(target_email))
    and (
      public.is_super_admin()
      or public.has_academy_role(target_academy_id, 'academy_admin')
    )
  limit 1;
$$;

insert into public.coaches (
  academy_id, full_name, email, phone, specialization, status, employment_type, joined_at, notes
)
select academy.id, coach.full_name, coach.email, coach.phone, coach.specialization, coach.status, coach.employment_type, coach.joined_at, coach.notes
from (
  values
    ('kairoyr-chess-academy', 'Yogendra Reddy', 'yogendra@kairoyrchess.com', '+91 94487 26256', 'Tournament training', 'active', 'full_time', date '2026-01-05', 'Seed coach.'),
    ('kairoyr-chess-academy', 'Arjun Mehta', 'arjun.mehta@example.com', '+91 98450 22001', 'Beginner chess', 'active', 'part_time', date '2026-02-10', 'Seed coach.'),
    ('check-n-mate-academy', 'Priya Sharma', 'priya.sharma@example.com', '+91 98450 22002', 'Intermediate tactics', 'active', 'part_time', date '2026-02-18', 'Seed coach.'),
    ('check-n-mate-academy', 'Karthik Rao', 'karthik.rao@example.com', '+91 98450 22003', 'Opening preparation', 'pending_login', 'freelance', null, 'Seed pending-login coach.'),
    ('durga-petals-chess-program', 'Neha Iyer', 'neha.iyer@example.com', '+91 98450 22004', 'Kids group coaching', 'active', 'part_time', date '2026-03-01', 'Seed coach.'),
    ('durga-petals-chess-program', 'Rohan Gupta', 'rohan.gupta@example.com', '+91 98450 22005', 'Endgame fundamentals', 'disabled', 'trial', date '2026-03-08', 'Seed disabled coach.'),
    ('brigade-metropolis-chess-club', 'Sneha Kulkarni', 'sneha.kulkarni@example.com', '+91 98450 22006', 'Beginner chess', 'active', 'part_time', date '2026-03-12', 'Seed coach.'),
    ('brigade-metropolis-chess-club', 'Vikram Nair', 'vikram.nair@example.com', '+91 98450 22007', 'Tournament training', 'active', 'freelance', date '2026-04-01', 'Seed coach.'),
    ('whitefield-chess-centre', 'Ananya Rao', 'ananya.rao@example.com', '+91 98450 22008', 'Kids group coaching', 'pending_login', 'part_time', null, 'Seed pending-login coach.'),
    ('bengaluru-junior-chess-lab', 'Deepak Kumar', 'deepak.kumar@example.com', '+91 98450 22009', 'Intermediate tactics', 'active', 'part_time', date '2026-04-15', 'Seed coach.')
) as coach(academy_slug, full_name, email, phone, specialization, status, employment_type, joined_at, notes)
join public.academies academy on academy.slug = coach.academy_slug
on conflict do nothing;
