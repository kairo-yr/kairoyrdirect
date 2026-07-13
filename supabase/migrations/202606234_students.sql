create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  membership_id uuid references public.academy_memberships(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  avatar_url text,
  date_of_birth date,
  gender text,
  school_name text,
  grade text,
  parent_name text,
  parent_email text,
  parent_phone text,
  secondary_parent_name text,
  secondary_parent_email text,
  secondary_parent_phone text,
  level text default 'beginner',
  status text not null default 'active',
  joined_at date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_status_check check (status in ('invited', 'active', 'inactive', 'disabled', 'removed')),
  constraint students_level_check check (level in ('absolute_beginner', 'beginner', 'intermediate', 'advanced', 'tournament'))
);

create index if not exists students_academy_id_idx on public.students (academy_id);
create index if not exists students_user_id_idx on public.students (user_id);
create index if not exists students_status_idx on public.students (status);
create index if not exists students_level_idx on public.students (level);
create index if not exists students_email_idx on public.students (email);
create index if not exists students_parent_email_idx on public.students (parent_email);
create index if not exists students_parent_phone_idx on public.students (parent_phone);

create unique index if not exists students_unique_academy_email
on public.students (academy_id, lower(email))
where email is not null;

create unique index if not exists students_unique_academy_parent_email_name
on public.students (academy_id, lower(parent_email), lower(full_name))
where parent_email is not null;

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at
before update on public.students
for each row
execute function public.set_updated_at();

alter table public.students enable row level security;

drop policy if exists "Super admins can manage all students" on public.students;
create policy "Super admins can manage all students"
on public.students
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Active academy members can read academy students" on public.students;
create policy "Active academy members can read academy students"
on public.students
for select
to authenticated
using (public.is_active_academy_member(academy_id));

drop policy if exists "Academy admins can insert academy students" on public.students;
create policy "Academy admins can insert academy students"
on public.students
for insert
to authenticated
with check (public.has_academy_role(academy_id, 'academy_admin'));

drop policy if exists "Academy admins can update academy students" on public.students;
create policy "Academy admins can update academy students"
on public.students
for update
to authenticated
using (public.has_academy_role(academy_id, 'academy_admin'))
with check (public.has_academy_role(academy_id, 'academy_admin'));

drop policy if exists "Student users can read own student row" on public.students;
create policy "Student users can read own student row"
on public.students
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Academy admins can insert student memberships" on public.academy_memberships;
create policy "Academy admins can insert student memberships"
on public.academy_memberships
for insert
to authenticated
with check (
  role = 'student'
  and public.has_academy_role(academy_id, 'academy_admin')
);

drop policy if exists "Academy admins can update student memberships" on public.academy_memberships;
create policy "Academy admins can update student memberships"
on public.academy_memberships
for update
to authenticated
using (
  role = 'student'
  and public.has_academy_role(academy_id, 'academy_admin')
)
with check (
  role = 'student'
  and public.has_academy_role(academy_id, 'academy_admin')
);

create or replace function public.find_profile_by_email_for_student(target_academy_id uuid, target_email text)
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

insert into public.students (
  academy_id, full_name, email, phone, school_name, grade, parent_name, parent_email, parent_phone, level, status, joined_at, notes
)
select academy.id, student.full_name, student.email, student.phone, student.school_name, student.grade, student.parent_name, student.parent_email, student.parent_phone, student.level, student.status, student.joined_at, student.notes
from (
  values
    ('kairoyr-chess-academy', 'Aarav Sharma', 'aarav.sharma@example.com', '+91 98451 31001', 'Greenwood High', '5', 'Rohit Sharma', 'rohit.sharma@example.com', '+91 98451 41001', 'beginner', 'active', date '2026-01-10', 'Seed student.'),
    ('kairoyr-chess-academy', 'Vivaan Rao', 'vivaan.rao@example.com', '+91 98451 31002', 'NPS Whitefield', '4', 'Meera Rao', 'meera.rao.parent@example.com', '+91 98451 41002', 'intermediate', 'active', date '2026-01-12', 'Seed student.'),
    ('kairoyr-chess-academy', 'Aditya Reddy', 'aditya.reddy@example.com', '+91 98451 31003', 'Chrysalis High', '6', 'Kiran Reddy', 'kiran.reddy@example.com', '+91 98451 41003', 'advanced', 'inactive', date '2026-01-20', 'Seed inactive student.'),
    ('check-n-mate-academy', 'Ananya Iyer', 'ananya.iyer.student@example.com', '+91 98451 31004', 'DPS East', '5', 'Lakshmi Iyer', 'lakshmi.iyer@example.com', '+91 98451 41004', 'beginner', 'active', date '2026-02-01', 'Seed student.'),
    ('check-n-mate-academy', 'Diya Menon', 'diya.menon@example.com', '+91 98451 31005', 'VIBGYOR High', '3', 'Suresh Menon', 'suresh.menon@example.com', '+91 98451 41005', 'absolute_beginner', 'active', date '2026-02-03', 'Seed student.'),
    ('check-n-mate-academy', 'Reya Kapoor', 'reya.kapoor@example.com', '+91 98451 31006', 'Inventure Academy', '7', 'Nisha Kapoor', 'nisha.kapoor@example.com', '+91 98451 41006', 'tournament', 'disabled', date '2026-02-08', 'Seed disabled student.'),
    ('durga-petals-chess-program', 'Arjun Nair', 'arjun.nair.student@example.com', '+91 98451 31007', 'Presidency School', '4', 'Ravi Nair', 'ravi.nair@example.com', '+91 98451 41007', 'intermediate', 'active', date '2026-02-14', 'Seed student.'),
    ('durga-petals-chess-program', 'Manay Gupta', 'manay.gupta@example.com', '+91 98451 31008', 'EuroSchool', '5', 'Pooja Gupta', 'pooja.gupta@example.com', '+91 98451 41008', 'beginner', 'active', date '2026-02-15', 'Seed student.'),
    ('durga-petals-chess-program', 'Ethan Thomas', 'ethan.thomas@example.com', '+91 98451 31009', 'Ryan International', '6', 'Anita Thomas', 'anita.thomas@example.com', '+91 98451 41009', 'advanced', 'active', date '2026-02-16', 'Seed student.'),
    ('brigade-metropolis-chess-club', 'Jaksh Mehta', 'jaksh.mehta@example.com', '+91 98451 31010', 'Brigade School', '3', 'Rakesh Mehta', 'rakesh.mehta@example.com', '+91 98451 41010', 'absolute_beginner', 'active', date '2026-03-01', 'Seed student.'),
    ('brigade-metropolis-chess-club', 'Shriyaan Kulkarni', 'shriyaan.kulkarni@example.com', '+91 98451 31011', 'Brigade School', '4', 'Sneha Kulkarni', 'sneha.parent@example.com', '+91 98451 41011', 'beginner', 'active', date '2026-03-03', 'Seed student.'),
    ('brigade-metropolis-chess-club', 'Devansh Jain', 'devansh.jain@example.com', '+91 98451 31012', 'Global Indian International', '7', 'Amit Jain', 'amit.jain@example.com', '+91 98451 41012', 'tournament', 'inactive', date '2026-03-07', 'Seed inactive student.'),
    ('godrej-united-chess-academy', 'Ruthvik Rao', 'ruthvik.rao@example.com', '+91 98451 31013', 'Gopalan International', '5', 'Deepa Rao', 'deepa.rao@example.com', '+91 98451 41013', 'intermediate', 'active', date '2026-03-10', 'Seed student.'),
    ('godrej-united-chess-academy', 'Arundhati Sen', 'arundhati.sen@example.com', '+91 98451 31014', 'New Horizon Gurukul', '6', 'Pritha Sen', 'pritha.sen@example.com', '+91 98451 41014', 'advanced', 'active', date '2026-03-11', 'Seed student.'),
    ('whitefield-chess-centre', 'Viraj Kumar', 'viraj.kumar@example.com', '+91 98451 31015', 'Whitefield Global School', '4', 'Manish Kumar', 'manish.kumar@example.com', '+91 98451 41015', 'beginner', 'active', date '2026-03-20', 'Seed student.'),
    ('whitefield-chess-centre', 'Maanvik Shetty', 'maanvik.shetty@example.com', '+91 98451 31016', 'Deens Academy', '5', 'Rupa Shetty', 'rupa.shetty@example.com', '+91 98451 41016', 'intermediate', 'active', date '2026-03-22', 'Seed student.'),
    ('whitefield-chess-centre', 'Aadriti Prasad', 'aadriti.prasad@example.com', '+91 98451 31017', 'Vydehi School', '3', 'Naveen Prasad', 'naveen.prasad@example.com', '+91 98451 41017', 'absolute_beginner', 'disabled', date '2026-03-23', 'Seed disabled student.'),
    ('bengaluru-junior-chess-lab', 'Arpita Das', 'arpita.das@example.com', '+91 98451 31018', 'CMR National Public School', '6', 'Mousumi Das', 'mousumi.das@example.com', '+91 98451 41018', 'advanced', 'active', date '2026-04-01', 'Seed student.'),
    ('bengaluru-junior-chess-lab', 'Snehdeep Singh', 'snehdeep.singh@example.com', '+91 98451 31019', 'Orchids International', '7', 'Harpreet Singh', 'harpreet.singh@example.com', '+91 98451 41019', 'tournament', 'active', date '2026-04-03', 'Seed student.'),
    ('bengaluru-junior-chess-lab', 'Lavith Gowda', 'lavith.gowda@example.com', '+91 98451 31020', 'Cambridge Public School', '5', 'Prakash Gowda', 'prakash.gowda@example.com', '+91 98451 41020', 'beginner', 'active', date '2026-04-05', 'Seed student.'),
    ('knight-minds-academy', 'Sibani Roy', 'sibani.roy@example.com', '+91 98451 31021', 'Indus International', '4', 'Suman Roy', 'suman.roy@example.com', '+91 98451 41021', 'intermediate', 'active', date '2026-04-10', 'Seed student.'),
    ('knight-minds-academy', 'Rudra Patil', 'rudra.patil@example.com', '+91 98451 31022', 'Harvest International', '6', 'Madhav Patil', 'madhav.patil@example.com', '+91 98451 41022', 'advanced', 'inactive', date '2026-04-11', 'Seed inactive student.'),
    ('endgame-elite-chess-school', 'Nishit Bhat', 'nishit.bhat@example.com', '+91 98451 31023', 'Oakridge International', '8', 'Ganesh Bhat', 'ganesh.bhat@example.com', '+91 98451 41023', 'tournament', 'active', date '2026-04-16', 'Seed student.'),
    ('endgame-elite-chess-school', 'Aneesh Rao', 'aneesh.rao@example.com', '+91 98451 31024', 'TISB', '5', 'Kavitha Rao', 'kavitha.rao@example.com', '+91 98451 41024', 'beginner', 'active', date '2026-04-18', 'Seed student.'),
    ('global-art-chess-program', 'Dheeran Kumar', 'dheeran.kumar@example.com', '+91 98451 31025', 'Delhi Public School North', '4', 'Uma Kumar', 'uma.kumar@example.com', '+91 98451 41025', 'absolute_beginner', 'active', date '2026-04-20', 'Seed student.')
) as student(academy_slug, full_name, email, phone, school_name, grade, parent_name, parent_email, parent_phone, level, status, joined_at, notes)
join public.academies academy on academy.slug = student.academy_slug
on conflict do nothing;
