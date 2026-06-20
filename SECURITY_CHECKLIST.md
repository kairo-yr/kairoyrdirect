# Kairoyr Direct Security Checklist

## Current Rule Assumptions

- Firebase Auth is required for application data access.
- Super admin access is currently bootstrapped by the email allowlist in `firestore.rules` and `src/constants/superAdmin.ts`.
- User role, status, academy assignment, and linked profile fields are protected from normal self-editing.
- Academy registration is still created from the client as a `pending` academy.
- Invite acceptance is still client-driven and has a narrow rules exception.

## Protected Now

- Firestore denies reads and writes by default.
- Super admins can manage platform data: users, academies, invites, audit logs, and academy subcollections.
- Users can read their own `users/{uid}` profile.
- Users can only update safe profile/login fields on their own profile.
- Normal users cannot update their own `role`, `status`, `academyId`, or linked profile IDs outside the invite acceptance exception.
- Academy admins can read and manage only their own academy-scoped collections.
- Students can read their own linked student profile.
- Audit logs are readable only by super admins.

## Known Limitations

- Super admin status is not yet enforced with Firebase custom claims.
- Approval, rejection, disable/reactivate, and invite acceptance are still performed from the client.
- Invite reads are limited to signed-in users whose Google email matches the pending invite email; invite links may need users to sign in before details are shown.
- Coach access is currently academy-scoped, not assigned-batch scoped.
- Student access to attendance and class reports is academy-scoped until student-specific query rules are finalized.
- Parent-child access rules are intentionally left for a later phase.

## Future TODO

- Move academy approval/rejection/status actions to Cloud Functions.
- Move invite acceptance to Cloud Functions.
- Add Firebase custom claims for `super_admin`.
- Add strict coach assigned-batch rules.
- Add strict student attendance/report filtering.
- Add parent-child access rules.
- Add emulator tests for role escalation, academy isolation, invite acceptance, and audit log access.
