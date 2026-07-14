# Backend source-of-truth audit

## Confirmed Users-page defect

`SuperAdminUsersPage` previously queried the Firestore `users` collection. Account creation, profile loading, role claiming, and account deletion use Supabase Auth plus `public.profiles`. A Firestore user document therefore survived deletion of the Supabase identity and appeared as a duplicate/stale user. Disable/reactivate actions on that page also wrote only to Firestore, so they did not change the authoritative profile.

The page now calls `public.list_application_users()`. This restricted RPC inner-joins `public.profiles` to `auth.users`, derives the active role/academy from `public.academy_memberships`, and derives coach/student links from their actual tables. Deleted Auth identities cannot appear. Status mutations use the atomic, audited `public.set_application_user_status()` RPC.

Legacy invite acceptance and student profile editing no longer create or update Firestore `users` documents. Account fields are written to `public.profiles`; the remaining Firestore writes in those flows concern the still-unmigrated invitation/student business records described below.

## Client persistence and cache inventory

No business data is stored in `localStorage`, `sessionStorage`, IndexedDB, Redux, Zustand, React Query, or another persisted client cache. Supabase's own Auth session persistence is the only browser persistence found and is required for login. Page arrays are temporary React state populated from backend reads; they are replaced rather than appended.

Logout calls `supabase.auth.signOut()` and clears the in-memory Auth session, user, and profile. There is no business-data query cache or persisted business key to clear. Blanket-clearing browser storage was intentionally avoided because it could remove unrelated application or Auth state.

## Domain inventory

| Area | Current authoritative source | Refresh/mutation behavior | Status |
|---|---|---|---|
| Platform users | Supabase Auth + `profiles`, `academy_memberships`, `coaches`, `students` | Canonical RPC on mount/focus/visibility; mutations are RPC-backed and followed by refetch | Fixed |
| Academies and approvals | Supabase `academies` and approval RPCs | Backend read on mount/focus; mutations refetch | Supabase-backed |
| Coaches | Supabase `coaches` + `academy_memberships` | Backend read on mount/focus; mutations refetch | Supabase-backed |
| Students | Supabase `students` + `academy_memberships` | Backend read on mount/focus; mutations refetch | Supabase-backed |
| Batches and assignments | Supabase `batches` + `batch_students` | Backend read on mount/focus; mutations refetch | Supabase-backed |
| Supabase audit log | Supabase `audit_logs` | Backend read on mount/focus | Supabase-backed |
| Attendance | Firestore academy subcollections | Component reads/writes Firestore | Legacy migration required |
| Class reports | Firestore academy subcollections | Component reads/writes Firestore | Legacy migration required |
| Progress tracking | Firestore academy subcollections | Component reads/writes Firestore | Legacy migration required |
| Fees | Firestore academy subcollections | Component reads/writes Firestore | Legacy migration required |
| Homework | Firestore | Component reads/writes Firestore | Legacy migration required |
| Academy invitations | Firestore `academyInvites` and related documents | Auth/onboarding pages read/write Firestore | Legacy migration required |
| Academy settings | Firestore-backed settings documents | Component reads/writes Firestore | Legacy migration required |
| Student dashboard/profile sections | Mixed Supabase identity with Firestore business records | Refetch behavior is page-specific | Consolidation required |
| Legacy audit/invite utilities | Firestore | Still used by legacy invite flows | Remove after those flows migrate |

This change removes Firestore from the platform Users page only. It does not claim that the remaining Firestore business domains have been migrated; treating them as Supabase data without schema and data migration would risk data loss.

## Identity lifecycle and integrity

- `profiles.id` references `auth.users(id) ON DELETE CASCADE`, so the Auth identity owns the application profile lifecycle.
- `academy_memberships.user_id` cascades on profile deletion, preventing live permissions for a deleted identity.
- RLS membership helpers require an active membership, active profile, and active academy; disabling a profile now immediately revokes academy access.
- `coaches.user_id` and `students.user_id` use `ON DELETE SET NULL`, preserving academy history while removing access linkage.
- Historical provenance fields (`created_by`, `approved_by`, `invited_by`, and audit actor) now use `ON DELETE SET NULL`, so they cannot block account deletion.
- The canonical user RPC exposes only application fields needed by the page and is executable only by authenticated users; it independently verifies super-admin status.
- RLS remains enabled. No frontend service-role key is used.

## Read-only diagnostics

Run `supabase/diagnostics/user_data_integrity.sql` with an administrative SQL role before cleanup. It reports missing Auth identities, duplicate active memberships, duplicate coach/student links and normalized coach emails, and disconnected active/pending domain records. It intentionally performs no deletes or automatic merges.

Existing uniqueness protections cover academy/user/role memberships and the normalized coach/member protections added by the coach-claim migration. Diagnostic output must be reviewed before any destructive cleanup because two similarly named rows can represent legitimate separate people.
