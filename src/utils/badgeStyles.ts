import type { Status, StudentLevel } from '../types';

export const statusStyles: Record<Status, string> = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  Completed: 'bg-blue-50 text-blue-700 ring-blue-100',
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  Sent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Overdue: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export const levelStyles: Record<StudentLevel, string> = {
  Beginner: 'bg-blue-50 text-blue-700 ring-blue-100',
  Intermediate: 'bg-amber-50 text-amber-700 ring-amber-100',
  Advanced: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  Tournament: 'bg-rose-50 text-rose-700 ring-rose-100',
};
