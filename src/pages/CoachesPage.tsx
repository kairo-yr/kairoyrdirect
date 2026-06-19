import { ClipboardList, UsersRound } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { coaches, getBatchById, getStudentsForBatch } from '../data/mockData';

export function CoachesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Coaches" description="Coach allocation placeholder with assigned batches, total students, and weekly class load." action={<RoadmapBadge status="Mock Data" />} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {coaches.map((coach) => (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={coach.id}>
            <h2 className="text-xl font-black text-navy">{coach.name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {coach.assignedBatchIds.map((batchId) => (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-directBlue" key={batchId}>{getBatchById(batchId)?.name}</span>
              ))}
            </div>
            <div className="mt-6 grid gap-3 text-sm font-bold text-slate-700">
              <div className="flex items-center gap-2"><UsersRound size={17} /> {coach.assignedBatchIds.reduce((total, batchId) => total + getStudentsForBatch(batchId).length, 0)} students</div>
              <div className="flex items-center gap-2"><ClipboardList size={17} /> {coach.weeklyClasses} weekly classes</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
