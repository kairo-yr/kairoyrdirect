-- Read-only diagnostics. Run with an administrative SQL role before cleanup.

-- Profiles whose Auth identity no longer exists. Expected: zero because of the FK.
select profile.id, profile.email, profile.created_at
from public.profiles as profile
left join auth.users as auth_user on auth_user.id = profile.id
where auth_user.id is null;

-- Duplicate active memberships for the same academy/user/role. Expected: zero.
select academy_id, user_id, role, count(*) as row_count, array_agg(id) as membership_ids
from public.academy_memberships
where user_id is not null and status = 'active'
group by academy_id, user_id, role
having count(*) > 1;

-- Duplicate linked coach identities. Expected: zero.
select academy_id, user_id, count(*) as row_count, array_agg(id) as coach_ids
from public.coaches
where user_id is not null and status <> 'removed'
group by academy_id, user_id
having count(*) > 1;

-- Duplicate normalized coach emails. Expected: zero.
select academy_id, lower(trim(email)) as normalized_email, count(*) as row_count, array_agg(id) as coach_ids
from public.coaches
where nullif(trim(email), '') is not null and status <> 'removed'
group by academy_id, lower(trim(email))
having count(*) > 1;

-- Duplicate linked student identities. Expected: zero.
select academy_id, user_id, count(*) as row_count, array_agg(id) as student_ids
from public.students
where user_id is not null and status <> 'removed'
group by academy_id, user_id
having count(*) > 1;

-- Active/pending domain rows with no Auth link. Review; do not delete blindly.
select 'coach' as entity_type, id, academy_id, email, status, updated_at
from public.coaches
where user_id is null and status in ('pending_login', 'active')
union all
select 'student', id, academy_id, email, status, updated_at
from public.students
where user_id is null and status in ('invited', 'active')
order by entity_type, academy_id, email;
