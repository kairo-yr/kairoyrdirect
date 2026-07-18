import { supabase } from './supabaseClient';

export type SessionStatus = 'draft' | 'open' | 'completed' | 'cancelled';
export type ParticipantStatus = 'unmarked' | 'present' | 'late' | 'absent' | 'excused';
export type ParticipantSource = 'batch' | 'individual_schedule' | 'compensation' | 'extra_class' | 'rescheduled' | 'trial' | 'temporary_transfer' | 'manual_other';

export type ClassSlot = {
  id: string; academy_id: string; coach_id: string; weekday: number; start_time: string; end_time: string;
  location: string | null; room_name: string | null; name: string | null; status: 'active' | 'inactive' | 'archived';
  coach?: { id: string; full_name: string } | null;
};

export type SessionBatch = {
  id: string; batch_id: string; source_type: 'automatic' | 'manual';
  batch?: { id: string; name: string } | null;
};

export type SessionParticipant = {
  id: string; session_id: string; student_id: string; source_type: ParticipantSource; source_batch_id: string | null;
  added_reason: string | null; added_note: string | null; compensation_for_session_id: string | null;
  compensation_status: 'not_applicable' | 'pending' | 'completed'; attendance_status: ParticipantStatus; attendance_note: string | null;
  student?: { id: string; full_name: string; home_batch_id: string | null; parent_name: string | null; parent_phone: string | null; home_batch?: { id: string; name: string } | null } | null;
  source_batch?: { id: string; name: string } | null;
};

export type ClassSession = {
  id: string; academy_id: string; class_slot_id: string | null; coach_id: string | null; session_date: string;
  start_time: string; end_time: string; location: string | null; room_name: string | null; status: SessionStatus;
  completed_at: string | null; coach?: { id: string; full_name: string } | null;
  session_source_batches?: SessionBatch[]; session_participants?: SessionParticipant[];
};

export type SessionStudentSearchResult = {
  id: string; full_name: string; parent_name: string | null; parent_phone: string | null;
  home_batch_id: string | null; home_batch_name: string | null;
};

export type CompensationCandidate = {
  session_id: string; session_date: string; start_time: string; end_time: string; batch_name: string | null;
  attendance_status: string; compensation_status: string;
};

const sessionSelect = `*,coach:coaches(id,full_name),session_source_batches(*,batch:batches(id,name)),session_participants(*,student:students(id,full_name,home_batch_id,parent_name,parent_phone,home_batch:batches!students_home_batch_id_fkey(id,name)),source_batch:batches!session_participants_source_batch_id_fkey(id,name))`;

function friendlyError(error: { message?: string; code?: string } | null, fallback: string) {
  const message = error?.message ?? '';
  const known = [
    'Student already exists in session.', 'Batch belongs to another academy or is inactive.',
    'Student belongs to another academy or is inactive.', 'Session already completed.',
    'Missed session does not belong to the selected student.', 'Permission denied.',
    'Roster refresh conflict.', 'Only an academy admin can reopen this session.',
    'Mark every student before completing the session.',
  ];
  const match = known.find((item) => message.includes(item));
  if (match) return new Error(match);
  if (error?.code === '42501') return new Error('Permission denied.');
  if (error?.code === '23505') return new Error('This student or batch is already included.');
  if (import.meta.env.DEV) console.error(fallback, error);
  return new Error(fallback);
}

export async function listClassSlots(academyId: string) {
  const { data, error } = await supabase.from('recurring_class_slots').select('*,coach:coaches(id,full_name)').eq('academy_id', academyId).eq('status', 'active').order('weekday').order('start_time');
  if (error) throw friendlyError(error, 'Could not load recurring class slots.');
  return (data ?? []) as ClassSlot[];
}

export async function createClassSlot(input: Omit<ClassSlot, 'id' | 'status' | 'coach'>) {
  const { data, error } = await supabase.from('recurring_class_slots').insert({ ...input, status: 'active' }).select('*,coach:coaches(id,full_name)').single();
  if (error) throw friendlyError(error, 'Could not create the recurring class slot.');
  return data as ClassSlot;
}

export async function linkBatchToClassSlot(input: { academyId: string; batchId: string; classSlotId: string; effectiveStartDate?: string }) {
  const { error } = await supabase.from('batch_class_slots').insert({ academy_id: input.academyId, batch_id: input.batchId, class_slot_id: input.classSlotId, effective_start_date: input.effectiveStartDate ?? new Date().toISOString().slice(0, 10) });
  if (error) throw friendlyError(error, 'Could not link the batch to this class slot.');
}

export async function listBatchSlotLinks(academyId: string) {
  const { data, error } = await supabase.from('batch_class_slots').select('*,batch:batches(id,name),class_slot:recurring_class_slots(*,coach:coaches(id,full_name))').eq('academy_id', academyId).eq('status', 'active');
  if (error) throw friendlyError(error, 'Could not load batch schedules.');
  return data ?? [];
}

export async function listClassSessions(academyId: string, from?: string, to?: string) {
  let query = supabase.from('class_sessions').select(sessionSelect).eq('academy_id', academyId).order('session_date', { ascending: false }).order('start_time', { ascending: false }).limit(100);
  if (from) query = query.gte('session_date', from);
  if (to) query = query.lte('session_date', to);
  const { data, error } = await query;
  if (error) throw friendlyError(error, 'Could not load class sessions.');
  return (data ?? []) as unknown as ClassSession[];
}

export async function getClassSession(id: string) {
  const { data, error } = await supabase.from('class_sessions').select(sessionSelect).eq('id', id).single();
  if (error) throw friendlyError(error, 'Could not load this class session.');
  return data as unknown as ClassSession;
}

export async function findOrCreateClassSession(slotId: string, date: string) {
  const { data, error } = await supabase.rpc('find_or_create_class_session', { target_slot: slotId, target_date: date });
  if (error) throw friendlyError(error, 'Could not open attendance for this class.');
  return getClassSession(data as string);
}

export async function addBatchToSession(sessionId: string, batchId: string) {
  const { data, error } = await supabase.rpc('add_batch_to_class_session', { target_session: sessionId, target_batch: batchId });
  if (error) throw friendlyError(error, 'Could not add this batch.');
  return data as number;
}

export async function removeBatchFromSession(sessionId: string, batchId: string) {
  const { error } = await supabase.rpc('remove_batch_from_class_session', { target_session: sessionId, target_batch: batchId });
  if (error) throw friendlyError(error, 'Could not remove this batch.');
}

export async function searchStudentsForSession(sessionId: string, search: string) {
  const { data, error } = await supabase.rpc('search_students_for_class_session', { target_session: sessionId, search_text: search, result_limit: 30 });
  if (error) throw friendlyError(error, 'Could not search academy students.');
  return (data ?? []) as SessionStudentSearchResult[];
}

export async function getCompensationCandidates(sessionId: string, studentId: string) {
  const { data, error } = await supabase.rpc('get_compensation_candidates', { target_session: sessionId, target_student: studentId });
  if (error) throw friendlyError(error, 'Could not load missed classes.');
  return (data ?? []) as CompensationCandidate[];
}

export async function addStudentToSession(input: { sessionId: string; studentId: string; reason: string; note?: string; missedSessionId?: string | null }) {
  const { data, error } = await supabase.rpc('add_student_to_class_session', { target_session: input.sessionId, target_student: input.studentId, reason: input.reason, note: input.note?.trim() || null, missed_session: input.missedSessionId || null });
  if (error) throw friendlyError(error, 'Could not add this student.');
  return data as string;
}

export async function removeStudentFromSession(sessionId: string, studentId: string) {
  const { error } = await supabase.rpc('remove_student_from_class_session', { target_session: sessionId, target_student: studentId });
  if (error) throw friendlyError(error, 'Could not remove this student.');
}

export async function saveSessionAttendance(sessionId: string, rows: Array<{ studentId: string; status: ParticipantStatus; note?: string }>, complete = false) {
  const { error } = await supabase.rpc('save_class_session_attendance', { target_session: sessionId, attendance_rows: rows, complete_session: complete });
  if (error) throw friendlyError(error, complete ? 'Could not complete this class session.' : 'Could not save attendance.');
}

export async function reopenClassSession(sessionId: string) {
  const { error } = await supabase.rpc('reopen_class_session', { target_session: sessionId });
  if (error) throw friendlyError(error, 'Could not reopen this class session.');
}

export async function refreshClassSessionRoster(sessionId: string) {
  const { data, error } = await supabase.rpc('refresh_class_session_roster', { target_session: sessionId });
  if (error) throw friendlyError(error, 'Could not refresh the scheduled roster.');
  return data as number;
}

export async function updateStudentSchedule(input: { studentId: string; academyId: string; homeBatchId: string | null; frequency: '1' | '2' | '3' | '4' | 'flexible'; mode: 'inherited' | 'custom' | 'flexible'; classSlotIds: string[] }) {
  const { error } = await supabase.rpc('set_student_class_schedule', { target_student: input.studentId, target_home_batch: input.homeBatchId, weekly_frequency: input.frequency, schedule_source: input.mode, target_slots: input.classSlotIds });
  if (error) throw friendlyError(error, 'Could not update the student schedule.');
}

export async function getStudentScheduleSlotIds(studentId: string) {
  const { data, error } = await supabase.from('student_class_schedules').select('class_slot_id').eq('student_id', studentId).eq('status', 'active');
  if (error) throw friendlyError(error, 'Could not load the student schedule.');
  return (data ?? []).map((row) => row.class_slot_id as string);
}
