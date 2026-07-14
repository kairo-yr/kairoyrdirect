import type { AssignmentStatus, TaskStatus } from '../types/homework';

const terminal = new Set<AssignmentStatus>(['excused', 'cancelled']);

export function effectiveAssignmentStatus(status: AssignmentStatus, dueDate: string, now = new Date()): AssignmentStatus {
  if (terminal.has(status) || status === 'completed' || status === 'completed_late') return status;
  return new Date(dueDate).getTime() < now.getTime() ? 'overdue' : status;
}

export function calculateAssignmentStatus(taskStatuses: Array<{ status: TaskStatus; required: boolean }>, dueDate: string, opened: boolean, now = new Date()): AssignmentStatus {
  const required = taskStatuses.filter((task) => task.required);
  if (required.some((task) => task.status === 'needs_correction')) return 'needs_correction';
  if (required.length > 0 && required.every((task) => ['completed', 'excused'].includes(task.status))) {
    return new Date(dueDate).getTime() < now.getTime() ? 'completed_late' : 'completed';
  }
  if (new Date(dueDate).getTime() < now.getTime()) return 'overdue';
  if (required.some((task) => ['submitted', 'needs_review'].includes(task.status))) return 'needs_review';
  if (required.some((task) => !['assigned', 'opened'].includes(task.status))) return 'in_progress';
  return opened ? 'opened' : 'assigned';
}

export function isSafeHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
}
