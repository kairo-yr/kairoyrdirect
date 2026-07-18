# Kairoyr Direct Security Checklist

## Current Rule Assumptions

- Supabase Auth is used for Direct login, logout, session state, and role-based routing.
- Super admin access for Direct auth comes from `public.profiles.platform_role = 'super_admin'`.
- User role, status, academy assignment, and linked profile fields are protected from normal self-editing.
- Academy registration uses a database-authorized RPC and starts as `pending`.
- Student invite acceptance is atomic inside a Supabase security-definer RPC.
- V1 does not include separate parent accounts or a parent dashboard. A parent or guardian may operate the student role account created through a student invite.

## Protected Now

- Supabase RLS is enabled on all application tables.
- Super admins can manage platform data: users, academies, invites, audit logs, and academy subcollections.
- Users can read their own Supabase profile.
- Users can only update safe profile/login fields on their own profile.
- Normal users cannot update identity, role, status, academy, or linked-profile fields directly.
- Academy admins can read and manage only their own academy-scoped collections.
- Students can read their own linked student profile.
- Student role accounts remain linked to one student profile through `linkedStudentId`, even when a parent or guardian uses the Google account.
- Audit logs are readable only by super admins.

## Known Limitations

- Academy and operational data use Supabase PostgreSQL exclusively.
- Student invite lookup is token-scoped; acceptance requires the matching confirmed Supabase Auth email.
- Coach onboarding uses confirmed-email matching and does not use invitation tokens.
- Coach operational access is restricted to assigned active batches.
- Student operational access is restricted to the linked student record.
- Parent-specific accounts, dashboards, and multi-child linking are intentionally left for a later phase.

## Future TODO

- Move remaining client-originated audit events into transactional RPCs or triggers.
- Add V2 parent account support with multiple linked children and parent-child access rules.
- Add database integration tests for role escalation, academy isolation, verified-email claiming, student invite acceptance, and audit-log access.
