import { supabase } from './supabaseClient';
import type { Homework, HomeworkDraftInput, StudentHomeworkAssignment, TaskProgress } from '../types/homework';

const homeworkSelect = `*, batch:batches(id,name,primary_coach:coaches(full_name)), creator:profiles!homeworks_created_by_fkey(full_name), homework_tasks(*), student_homework_assignments(*,student:students(id,full_name),student_homework_task_progress(*,homework_task:homework_tasks(*)))`;

export async function listManagedHomework() {
  const { data, error } = await supabase.from('homeworks').select(homeworkSelect).order('created_at', { ascending: false }).limit(100);
  if (error) throw error; return (data ?? []) as unknown as Homework[];
}

export async function listMyHomework() {
  const { data, error } = await supabase.from('student_homework_assignments').select(`*,homework:homeworks(*,batch:batches(id,name,primary_coach:coaches(full_name)),homework_tasks(*)),student_homework_task_progress(*,homework_task:homework_tasks(*))`).order('assigned_at', { ascending: false });
  if (error) throw error; return (data ?? []) as unknown as StudentHomeworkAssignment[];
}

export async function saveHomeworkDraft(input: HomeworkDraftInput, createdByRole: string) {
  const payload = { academy_id: input.academyId, batch_id: input.batchId, class_report_id: input.classReportId || null, title: input.title.trim(), instructions: input.instructions?.trim() || null, parent_note: input.parentNote?.trim() || null, assigned_date: input.assignedDate, due_date: input.dueDate, created_by_role: createdByRole, excluded_student_ids: input.excludedStudentIds };
  let id = input.id;
  if (id) {
    const { error } = await supabase.from('homeworks').update(payload).eq('id', id).eq('status', 'draft'); if (error) throw error;
    const { error: deleteError } = await supabase.from('homework_tasks').delete().eq('homework_id', id); if (deleteError) throw deleteError;
  } else {
    const { data, error } = await supabase.from('homeworks').insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id }).select('id').single(); if (error) throw error; id = data.id;
  }
  const { error: taskError } = await supabase.from('homework_tasks').insert(input.tasks.map((task, index) => ({ ...task, homework_id: id, task_order: index + 1 })));
  if (taskError) throw taskError; return id as string;
}

export async function publishHomework(id: string) { const { data, error } = await supabase.rpc('publish_homework', { target_homework: id }); if (error) throw error; return data as number; }
export async function cancelHomework(id: string) { const { error } = await supabase.rpc('cancel_homework', { target_homework: id }); if (error) throw error; }
export async function openAssignment(id: string) { const { error } = await supabase.rpc('open_homework_assignment', { target_assignment: id }); if (error) throw error; }
export async function submitTask(id: string, input: { text?: string; url?: string; pgn?: string; selfConfirm?: boolean }) { const { error } = await supabase.rpc('submit_homework_task', { target_progress: id, answer_text: input.text || null, answer_url: input.url || null, answer_pgn: input.pgn || null, self_confirm: input.selfConfirm ?? false }); if (error) throw error; }
export async function reviewTask(id: string, decision: 'approve' | 'return', feedback?: string) { const { error } = await supabase.rpc('review_homework_task', { target_progress: id, decision, feedback: feedback || null }); if (error) throw error; }
export async function setExcused(id: string, excused: boolean, reason?: string) { const { error } = await supabase.rpc('set_homework_excused', { target_assignment: id, should_excuse: excused, reason: reason || null }); if (error) throw error; }
export async function recordReminder(homeworkId: string, assignmentId: string | null, kind: string, message: string) { const { error } = await supabase.rpc('record_homework_reminder', { target_homework: homeworkId, target_assignment: assignmentId, kind, message, was_copied: true }); if (error) throw error; }

export function pendingReviews(homework: Homework[]) { return homework.flatMap((item) => (item.student_homework_assignments ?? []).flatMap((assignment) => (assignment.student_homework_task_progress ?? []).filter((progress) => ['submitted','needs_review'].includes(progress.status)).map((progress): { homework: Homework; assignment: StudentHomeworkAssignment; progress: TaskProgress } => ({ homework: item, assignment, progress })))); }
