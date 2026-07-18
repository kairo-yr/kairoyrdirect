import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const originalMigration = readFileSync(new URL('../supabase/migrations/202607180_flexible_class_sessions.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/202607181_simple_batch_attendance_sessions.sql', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/classSessionApi.ts', import.meta.url), 'utf8');
const attendance = readFileSync(new URL('../src/pages/ClassSessionAttendancePage.tsx', import.meta.url), 'utf8');
const reports = readFileSync(new URL('../src/pages/AcademyClassReportsPage.tsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/routes/AppRoutes.tsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');

test('slot architecture is removed from the application without destructive database cleanup', () => {
  assert.doesNotMatch(routes, /class-schedules|AcademyClassSlotsPage/);
  assert.doesNotMatch(sidebar, /Class Schedules|CalendarClock/);
  assert.doesNotMatch(api, /recurring_class_slots|batch_class_slots|student_class_schedules/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from public\.(recurring_class_slots|batch_class_slots|student_class_schedules)/i);
});

test('batch and date identify one simple class session', () => {
  assert.match(migration, /class_sessions_batch_date_uidx/);
  assert.match(migration, /academy_id, primary_batch_id, session_date/);
  assert.match(migration, /find_or_create_batch_class_session/);
  assert.match(api, /rpc\('find_or_create_batch_class_session'/);
});

test('scheduled roster comes directly from permanent active batch membership', () => {
  const body = migration.slice(migration.indexOf('create or replace function public.find_or_create_batch_class_session'), migration.indexOf('create or replace function public.add_student_to_class_session'));
  assert.match(body, /from public\.batch_students bs/);
  assert.match(body, /bs\.status='active'/);
  assert.match(body, /s\.status='active'/);
  assert.doesNotMatch(body, /recurring_class_slots|batch_class_slots|student_class_schedules|schedule_mode/);
});

test('one student can occur only once in a session', () => {
  assert.match(originalMigration, /unique\(session_id,student_id\)/);
  assert.match(migration, /on conflict\(session_id,student_id\) do nothing/);
});

test('added students are academy-scoped and never change batch membership', () => {
  const body = migration.slice(migration.indexOf('create or replace function public.add_student_to_class_session'), migration.indexOf('create or replace function public.refresh_class_session_roster'));
  assert.match(body, /s\.academy_id=cs\.academy_id and s\.status='active'/);
  assert.match(body, /reason not in \('makeup','extra_class','temporary','trial','other'\)/);
  assert.match(body, /reason='other'.*note/is);
  assert.doesNotMatch(body, /insert into public\.batch_students|update public\.batch_students|update public\.students/);
});

test('academy admins and assigned coaches are checked server-side', () => {
  assert.match(migration, /has_academy_role\(selected_batch\.academy_id,'academy_admin'\)/);
  assert.match(migration, /is_assigned_coach\(selected_batch\.academy_id,selected_batch\.id\)/);
  assert.match(originalMigration, /alter table public\.session_participants enable row level security/);
  assert.match(originalMigration, /public\.can_manage_class_session/);
});

test('attendance UI supports search, reasons, removal, and responsive rows', () => {
  assert.match(attendance, /SearchInput/);
  assert.match(attendance, /Makeup class/);
  assert.match(attendance, /Temporary schedule change/);
  assert.match(attendance, /removeStudentFromSession/);
  assert.match(attendance, /lg:grid-cols-\[minmax/);
  assert.doesNotMatch(attendance, /<table/);
});

test('draft reports reconcile session participants while preserving saved notes', () => {
  assert.match(reports, /getClassSession\(requestedSessionId\)/);
  assert.match(reports, /existingReport\.status === 'draft'/);
  assert.match(reports, /reconcileStudentNotes/);
  assert.match(reports, /Removed from session/);
  assert.match(reports, /participationLabel/);
  assert.match(reports, /classSessionId: requestedSessionId/);
});
