import { supabase } from './supabaseClient';
import type { Coach } from './coachApi';
import type { Student } from './studentApi';

export type BatchStatus = 'active' | 'paused' | 'completed' | 'disabled' | 'archived';
export type BatchLevel = 'absolute_beginner' | 'beginner' | 'intermediate' | 'advanced' | 'tournament';

export type Batch = {
  id: string;
  academy_id: string;
  primary_coach_id: string | null;
  name: string;
  level: BatchLevel | null;
  status: BatchStatus;
  description: string | null;
  location: string | null;
  schedule_label: string | null;
  start_date: string | null;
  end_date: string | null;
  max_students: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  primary_coach?: Pick<Coach, 'id' | 'full_name' | 'status'> | null;
  student_count?: number;
};

export type BatchStudent = {
  id: string;
  academy_id: string;
  batch_id: string;
  student_id: string;
  status: 'active' | 'paused' | 'removed' | 'completed';
  joined_at: string | null;
  removed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Student | null;
};

export type BatchInput = {
  academy_id: string;
  name: string;
  level?: BatchLevel | null;
  primary_coach_id?: string | null;
  schedule_label?: string | null;
  location?: string | null;
  max_students?: number | null;
  notes?: string | null;
};

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function getActorUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

async function insertAuditLog(input: {
  actor_user_id: string | null;
  academy_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_user_id: input.actor_user_id,
    academy_id: input.academy_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    old_values: input.old_values ?? null,
    new_values: input.new_values ?? null,
  });
  if (error) throw error;
}

async function withStudentCounts(batches: Batch[]) {
  if (batches.length === 0) return batches;
  const { data, error } = await supabase
    .from('batch_students')
    .select('batch_id')
    .in('batch_id', batches.map((batch) => batch.id))
    .eq('status', 'active');
  if (error) throw error;
  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => counts.set(row.batch_id, (counts.get(row.batch_id) ?? 0) + 1));
  return batches.map((batch) => ({ ...batch, student_count: counts.get(batch.id) ?? 0 }));
}

export async function getBatchesByAcademy(academyId: string) {
  const { data, error } = await supabase
    .from('batches')
    .select('*, primary_coach:coaches(id, full_name, status)')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return withStudentCounts((data ?? []) as Batch[]);
}

export async function getBatchesByCoach(coachId: string) {
  const { data, error } = await supabase
    .from('batches')
    .select('*, primary_coach:coaches(id, full_name, status)')
    .eq('primary_coach_id', coachId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return withStudentCounts((data ?? []) as Batch[]);
}

export async function createBatch(input: BatchInput) {
  const { data, error } = await supabase.rpc('create_batch_for_academy', {
    target_academy_id: input.academy_id,
    batch_name: input.name,
    batch_level: input.level ?? null,
    primary_coach_id: input.primary_coach_id ?? null,
    schedule_label: cleanText(input.schedule_label),
    location: cleanText(input.location),
    max_students: input.max_students ?? null,
    notes: cleanText(input.notes),
  });
  if (error) throw error;
  return data as Batch;
}

export async function updateBatch(id: string, input: Partial<Omit<BatchInput, 'academy_id'>>) {
  const actorUserId = await getActorUserId();
  const { data: previous, error: previousError } = await supabase.from('batches').select('*').eq('id', id).single();
  if (previousError) throw previousError;
  const update = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.level !== undefined ? { level: input.level } : {}),
    ...(input.primary_coach_id !== undefined ? { primary_coach_id: input.primary_coach_id } : {}),
    ...(input.schedule_label !== undefined ? { schedule_label: cleanText(input.schedule_label) } : {}),
    ...(input.location !== undefined ? { location: cleanText(input.location) } : {}),
    ...(input.max_students !== undefined ? { max_students: input.max_students } : {}),
    ...(input.notes !== undefined ? { notes: cleanText(input.notes) } : {}),
  };
  const { data, error } = await supabase.from('batches').update(update).eq('id', id).select('*').single();
  if (error) throw error;
  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'batch.updated',
    entity_type: 'batch',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });
  return data as Batch;
}

export async function disableBatch(id: string) {
  return updateBatchStatus(id, 'disabled', 'batch.disabled');
}

export async function reactivateBatch(id: string) {
  return updateBatchStatus(id, 'active', 'batch.reactivated');
}

async function updateBatchStatus(id: string, status: BatchStatus, action: string) {
  const actorUserId = await getActorUserId();
  const { data: previous, error: previousError } = await supabase.from('batches').select('*').eq('id', id).single();
  if (previousError) throw previousError;
  const { data, error } = await supabase.from('batches').update({ status }).eq('id', id).select('*').single();
  if (error) throw error;
  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action,
    entity_type: 'batch',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });
  return data as Batch;
}

export async function getBatchStudents(batchId: string) {
  const { data, error } = await supabase
    .from('batch_students')
    .select('*, student:students(*)')
    .eq('batch_id', batchId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BatchStudent[];
}

export async function getStudentsForBatch(batchId: string) {
  const assignments = await getBatchStudents(batchId);
  return assignments.map((assignment) => assignment.student).filter(Boolean) as Student[];
}

export async function getUnassignedStudentsForAcademy(academyId: string) {
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('academy_id', academyId)
    .eq('status', 'active')
    .order('full_name', { ascending: true });
  if (studentError) throw studentError;
  return (students ?? []) as Student[];
}

export async function assignStudentToBatch(batchId: string, studentId: string) {
  const { data, error } = await supabase.rpc('assign_student_to_batch', {
    target_batch_id: batchId,
    target_student_id: studentId,
  });
  if (error) throw error;
  return data as BatchStudent;
}

export async function removeStudentFromBatch(batchId: string, studentId: string) {
  const { data, error } = await supabase.rpc('remove_student_from_batch', {
    target_batch_id: batchId,
    target_student_id: studentId,
  });
  if (error) throw error;
  return data as BatchStudent;
}
