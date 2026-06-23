import type { AcademyStatus } from '../types/auth';

export function getAcademyStatusClass(status: AcademyStatus) {
  const styles: Record<AcademyStatus, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    pending: 'bg-amber-50 text-amber-700 ring-amber-100',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-100',
    disabled: 'bg-slate-100 text-slate-700 ring-slate-200',
    archived: 'bg-slate-50 text-slate-500 ring-slate-100',
  };

  return styles[status];
}
