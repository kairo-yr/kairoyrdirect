import { CalendarDays, UsersRound } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { batches, getCoachById, getStudentsForBatch } from '../data/mockData';
import { levelStyles } from '../utils/badgeStyles';

export function BatchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Batches" description="Batch management placeholder showing coach allocation, schedule, level, and student count." action={<RoadmapBadge status="Mock Data" />} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {batches.map((batch) => (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={batch.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-navy">{batch.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Coach: {getCoachById(batch.coachId)?.name}</p>
              </div>
              <Badge className={levelStyles[batch.level]}>{batch.level}</Badge>
            </div>
            <div className="mt-6 grid gap-3 text-sm font-bold text-slate-700">
              <div className="flex items-center gap-2"><UsersRound size={17} /> {getStudentsForBatch(batch.id).length} students</div>
              <div className="flex items-center gap-2"><CalendarDays size={17} /> {batch.schedule}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
