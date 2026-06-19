import type { LucideIcon } from 'lucide-react';
import type { RoadmapStatus } from '../../types';
import { RoadmapBadge } from '../ui/RoadmapBadge';

export function FeatureCard({ title, description, icon: Icon, status }: { title: string; description: string; icon: LucideIcon; status?: RoadmapStatus }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-directGold">
          <Icon size={20} />
        </div>
        {status && <RoadmapBadge status={status} />}
      </div>
      <h3 className="mt-5 text-lg font-black text-navy">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
