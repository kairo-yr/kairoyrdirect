-- Read-only verification for the reported coach. Run with an administrative
-- SQL role before and after deploying migrations 244 and 246.

with target as (
  select
    'f5ce99bb-5a8a-463c-a0e0-3c563b6fa738'::uuid as coach_id,
    '936bb597-cb82-4e88-92b5-9143142846cf'::uuid as academy_id,
    lower(trim('vyrm2002@gmail.com')) as email
)
select
  coach.id,
  coach.academy_id,
  coach.user_id,
  coach.membership_id,
  coach.full_name,
  coach.email,
  coach.status,
  coach.updated_at,
  auth_user.id as auth_user_id,
  auth_user.email as auth_email,
  profile.app_role,
  membership.role as membership_role,
  membership.status as membership_status
from target
inner join public.coaches as coach on coach.id = target.coach_id
left join auth.users as auth_user on lower(trim(auth_user.email)) = target.email
left join public.profiles as profile on profile.id = auth_user.id
left join public.academy_memberships as membership on membership.id = coach.membership_id;

with target as (
  select 'f5ce99bb-5a8a-463c-a0e0-3c563b6fa738'::uuid as coach_id
)
select
  batch.id as batch_id,
  batch.name as batch_name,
  batch.status as batch_status,
  batch.primary_coach_id,
  assignment.student_id,
  assignment.status as assignment_status,
  student.full_name as student_name,
  student.status as student_status
from target
inner join public.batches as batch on batch.primary_coach_id = target.coach_id
left join public.batch_students as assignment
  on assignment.batch_id = batch.id and assignment.status = 'active'
left join public.students as student on student.id = assignment.student_id
order by batch.name, student.full_name;
