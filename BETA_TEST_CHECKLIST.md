# Kairoyr Direct Beta Test Checklist

## 1. Super Admin Tests
- Log in as a configured super admin.
- Confirm `/dashboard` redirects to `/super-admin`.
- View dashboard KPIs without dummy values.
- View academies, academy detail, approvals, users, invites, audit logs, and platform settings.
- Search and filter academies, users, invites, and audit logs.
- Approve and reject a pending academy.
- Disable and reactivate an academy.
- Disable and reactivate a normal user.
- Confirm a super admin cannot disable their own account.
- Confirm super admin routes are blocked for academy admin, coach, and student users.

## 2. Academy Admin Tests
- Log in as an academy admin.
- Confirm `/dashboard` redirects to `/academy`.
- Confirm sidebar contains only academy admin links.
- Confirm dashboard KPIs are scoped to the current academy.
- Add, view, edit, disable, and reactivate a student.
- Add, view, edit, disable, and reactivate a coach.
- Create, view, edit, disable, and reactivate a batch.
- Confirm student batch display is derived from batch `studentIds`.
- Mark, view, and edit attendance.
- Create, view, edit, and submit class reports.
- Add, view, and edit progress reports.
- Generate, view, edit, mark paid, mark partial, and waive fee records.
- Create, view, edit, and archive homework.
- Copy pending invite links.
- Update academy settings safe fields only.

## 3. Coach Tests
- Log in as a coach.
- Confirm `/dashboard` redirects to `/coach`.
- Confirm sidebar contains only coach links.
- Confirm My Batches shows only assigned batches.
- Confirm My Students shows only students from assigned batches.
- Mark attendance only for assigned batches.
- Create and edit class reports only for assigned batches.
- Add and edit progress only for assigned students.
- Create homework for assigned batches or assigned students.
- Edit/archive only homework created by the coach.
- Confirm `/academy/students`, `/academy/batches`, and `/academy/fees` redirect to `/coach`.
- Edit safe profile fields only.

## 4. Student Tests
- Log in as a student.
- Confirm `/dashboard` redirects to `/student`.
- Confirm sidebar contains only student links.
- Confirm assigned batch display is derived from batches containing `linkedStudentId`.
- View own attendance records only.
- View own class reports only.
- View own progress only.
- View own fee records only.
- View own homework only.
- Edit safe profile/contact fields only.
- Confirm academy, coach, and super admin routes redirect to `/student`.

## 5. Invite Flow Tests
- Register a new academy.
- Confirm new academy remains pending until super admin approval.
- Approve academy as super admin and verify owner becomes academy admin.
- Create coach invite and accept with the invited email.
- Create student invite and accept with the invited email.
- Confirm wrong email cannot accept an invite.
- Confirm accepted invite cannot be reused.
- Confirm revoked invite cannot be accepted.
- Confirm random new users remain unassigned.
- Confirm no user joins a default academy automatically.

## 6. Security Tests
- Confirm wrong-role protected routes redirect before rendering protected content.
- Confirm disabled users redirect to unauthorized.
- Confirm users cannot update their own role, status, academyId, or linkedStudentId; coach identity must resolve from the authenticated Supabase coach row.
- Confirm academy admin queries stay under their own academy.
- Confirm coach views show assigned batch/student data only.
- Confirm student views show linked student data only.

## 7. Firestore Rules Tests
- Deploy or emulate the current `firestore.rules`.
- Verify non-admin users cannot read global `users`, `academies`, or cross-academy records.
- Verify students cannot write attendance, class reports, progress, fees, homework, batches, coaches, or academy records.
- Verify homework delete is denied.
- Verify audit log creates are limited to expected actions.
- Check browser console for missing/insufficient permission errors during each role flow.

## 8. Mobile Tests
- Open each role dashboard on a mobile viewport.
- Confirm mobile menu opens, closes, and only shows correct role links.
- Confirm tables scroll horizontally without breaking layout.
- Confirm modals fit within viewport height.
- Confirm form buttons do not overlap on small screens.
- Confirm primary actions remain reachable by touch.

## 9. Known Limitations For V1
- Parent dashboard is not built.
- Parent/guardian may use the student account.
- Kairoyr Play integration is placeholder/link-based.
- Advanced subscription billing is not built.
- Fine-grained Firestore rules may need Cloud Functions later for stronger security.
