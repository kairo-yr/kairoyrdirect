import type { AttendanceStatus, BatchMode, CoachRole, FeeStatus, Status, StudentLevel } from '../types';

export const statusStyles: Record<Status, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  inactive: 'bg-slate-100 text-slate-700 ring-slate-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-100',
  waived: 'bg-slate-100 text-slate-700 ring-slate-200',
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  completed: 'bg-blue-50 text-blue-700 ring-blue-100',
  shared: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  sent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  pending_setup: 'bg-amber-50 text-amber-700 ring-amber-100',
  future_integration: 'bg-blue-50 text-blue-700 ring-blue-100',
  present: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  absent: 'bg-rose-50 text-rose-700 ring-rose-100',
  late: 'bg-amber-50 text-amber-700 ring-amber-100',
  excused: 'bg-blue-50 text-blue-700 ring-blue-100',
};

export const levelStyles: Record<StudentLevel, string> = {
  basic: 'bg-sky-50 text-sky-700 ring-sky-100',
  beginner: 'bg-blue-50 text-blue-700 ring-blue-100',
  intermediate: 'bg-amber-50 text-amber-700 ring-amber-100',
  advanced: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  master: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export const feeStyles: Record<FeeStatus, string> = {
  paid: statusStyles.paid,
  pending: statusStyles.pending,
  overdue: statusStyles.overdue,
  waived: statusStyles.waived,
};

export const roleStyles: Record<CoachRole, string> = {
  head_coach: 'bg-navy text-white ring-navy',
  coach: 'bg-blue-50 text-blue-700 ring-blue-100',
  assistant_coach: 'bg-amber-50 text-amber-700 ring-amber-100',
};

export const modeStyles: Record<BatchMode, string> = {
  online: 'bg-blue-50 text-blue-700 ring-blue-100',
  offline: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  hybrid: 'bg-amber-50 text-amber-700 ring-amber-100',
};

export const attendanceStyles: Record<AttendanceStatus, string> = {
  present: statusStyles.present,
  absent: statusStyles.absent,
  late: statusStyles.late,
  excused: statusStyles.excused,
};
