import type { RoadmapStatus } from '../../types';

const styles: Record<RoadmapStatus, string> = {
  'Coming Soon': 'bg-amber-50 text-amber-700 ring-amber-100',
  'Phase 2': 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  'Phase 3': 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'Phase 4': 'bg-violet-50 text-violet-700 ring-violet-100',
  'Phase 5': 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  'Phase 6': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100',
  Beta: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'V1 Placeholder': 'bg-slate-100 text-slate-700 ring-slate-200',
  'Future Integration': 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function RoadmapBadge({ status }: { status: RoadmapStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}
