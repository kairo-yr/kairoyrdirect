/*
TODO: Firestore security rules must enforce server-side access.

Frontend protected routes are not enough for production security.
Rules must ensure:
- super_admin can manage platform-level data.
- academy_admin can access and manage only documents with their academyId.
- coach can access only assigned batches/students.
- parent can access only linked children.
- student can access only their own profile/homework.
- unassigned users can create/read only their own onboarding registration request.
*/

export {};
