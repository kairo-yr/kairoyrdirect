import type { RoadmapStatus } from '../../types';

const styles: Record<RoadmapStatus, string> = {
  'Mock Data': 'bg-blue-50 text-blue-700 ring-blue-100',
  'Coming Soon': 'bg-amber-50 text-amber-700 ring-amber-100',
  'Phase 2': 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  'Future Integration': 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function RoadmapBadge({ status }: { status: RoadmapStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}
