import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/202607180_flexible_class_sessions.sql', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/classSessionApi.ts', import.meta.url), 'utf8');
const attendance = readFileSync(new URL('../src/pages/ClassSessionAttendancePage.tsx', import.meta.url), 'utf8');
const reports = readFileSync(new URL('../src/pages/AcademyClassReportsPage.tsx', import.meta.url), 'utf8');
const homework = readFileSync(new URL('../src/pages/HomeworkPage.tsx', import.meta.url), 'utf8');

test('overlapping batches resolve to one slot/date session and a deduplicated roster', () => {
  assert.match(migration, /class_sessions_slot_date_uidx[\s\S]*academy_id,class_slot_id,session_date/);
  assert.match(migration, /unique\(session_id,student_id\)/);
  assert.match(migration, /on conflict\(session_id,student_id\) do nothing/g);
});

test('one-batch days and mixed-batch days use effective slot links', () => {
  assert.match(migration, /batch_class_slots_slot_dates_idx/);
  assert.match(migration, /effective_start_date<=target_date/);
  assert.match(migration, /effective_end_date is null or bcs\.effective_end_date>=target_date/);
});

test('successful and unsuccessful compensation preserve the original absence', () => {
  assert.match(migration, /compensation_for_session_id/);
  assert.match(migration, /participant\.attendance_status in \('present','late'\) then 'completed' else 'pending'/);
  assert.doesNotMatch(migration, /attendance_status='present'[^;]+compensation_for_session_id/);
});

test('manual batches add eligible students without changing membership', () => {
  assert.match(migration, /add_batch_to_class_session/);
  assert.match(migration, /session\.batch_added/);
  const functionBody = migration.slice(migration.indexOf('create or replace function public.add_batch_to_class_session'), migration.indexOf('create or replace function public.add_student_to_class_session'));
  assert.doesNotMatch(functionBody, /update public\.batch_students|insert into public\.batch_students/);
});

test('one-to-four-class and flexible schedules are constrained and session-aware', () => {
  assert.match(migration, /expected_weekly_frequency in \('1','2','3','4','flexible'\)/);
  assert.match(migration, /schedule_mode in \('inherited','custom','flexible'\)/);
  assert.match(migration, /student_class_schedules[\s\S]*class_slot_id/);
});

test('completed historical rosters remain snapshots', () => {
  assert.match(migration, /if cs\.status='completed' then raise exception 'Session already completed\.'/);
  assert.match(migration, /legacy_attendance_record_id uuid unique/);
  assert.match(migration, /Historical attendance becomes immutable session\/participant snapshots/);
});

test('reports and homework reuse the class session roster', () => {
  assert.match(reports, /getClassSession\(requestedSessionId\)/);
  assert.match(reports, /classSessionId: requestedSessionId/);
  assert.match(homework, /getClassSession\(sessionId\)/);
  assert.match(homework, /Present and late students/);
  assert.match(migration, /from public\.session_participants p join public\.students s/);
});

test('academy isolation and coach assignment checks are server enforced', () => {
  assert.match(migration, /public\.can_manage_class_session/);
  assert.match(migration, /s\.academy_id=cs\.academy_id/);
  assert.match(migration, /public\.is_assigned_coach\(cs\.academy_id,ssb\.batch_id\)/);
  assert.match(migration, /alter table public\.session_participants enable row level security/);
});

test('attendance changes and roster mutations persist through RPCs', () => {
  for (const rpc of ['find_or_create_class_session', 'add_batch_to_class_session', 'add_student_to_class_session', 'save_class_session_attendance', 'refresh_class_session_roster']) {
    assert.match(api, new RegExp(`rpc\\('${rpc}'`));
  }
  assert.match(attendance, /await reloadSession\(session\.id\)/);
});

test('responsive controls avoid a page-width roster table', () => {
  assert.match(attendance, /lg:grid-cols-\[minmax/);
  assert.match(attendance, /min-w-0/);
  assert.match(attendance, /max-h-\[65vh\].*overflow-y-auto/);
});
