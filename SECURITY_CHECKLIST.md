# Kairoyr Direct Security Checklist

## Current Rule Assumptions

- Supabase Auth is used for Direct login, logout, session state, and role-based routing.
- Super admin access for Direct auth comes from `public.profiles.platform_role = 'super_admin'`.
- User role, status, academy assignment, and linked profile fields are protected from normal self-editing.
- Academy registration is still created from the client as a `pending` academy.
- Invite acceptance is still client-driven and has a narrow rules exception.
- V1 does not include separate parent accounts or a parent dashboard. A parent or guardian may operate the student role account created through a student invite.

## Protected Now

- Firestore denies reads and writes by default.
- Super admins can manage platform data: users, academies, invites, audit logs, and academy subcollections.
- Users can read their own `users/{uid}` profile.
- Users can only update safe profile/login fields on their own profile.
- Normal users cannot update their own `role`, `status`, `academyId`, or linked profile IDs outside the invite acceptance exception.
- Academy admins can read and manage only their own academy-scoped collections.
- Students can read their own linked student profile.
- Student role accounts remain linked to one student profile through `linkedStudentId`, even when a parent or guardian uses the Google account.
- Audit logs are readable only by super admins.

## Known Limitations

- Firestore-backed academy data is still legacy Firebase data and has not been migrated to Supabase yet.
- Approval, rejection, disable/reactivate, and invite acceptance are still performed from the client.
- Invite reads are limited to signed-in users whose Google email matches the pending invite email; invite links may need users to sign in before details are shown.
- Coach access is currently academy-scoped, not assigned-batch scoped.
- Student access to attendance and class reports is academy-scoped until student-specific query rules are finalized.
- Parent-specific accounts, dashboards, and multi-child linking are intentionally left for a later phase.

## Future TODO

- Move academy approval/rejection/status actions to Cloud Functions.
- Move invite acceptance to Cloud Functions.
- Migrate academy, coach, student, invite, and audit data access to Supabase policies.
- Add strict coach assigned-batch rules.
- Add strict student attendance/report filtering.
- Add V2 parent account support with multiple linked children and parent-child access rules.
- Add emulator tests for role escalation, academy isolation, invite acceptance, and audit log access.
