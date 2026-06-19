import { ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { PLAY_APP_NAME } from '../config/brand';

const settings = [
  ['Academy profile', 'Name, address, centers, owner details, and academy branding.'],
  ['Coach permissions', 'Role rules for coaches and future limited dashboard access.'],
  ['Student access settings', 'Parent/student access options and learning visibility.'],
  [`${PLAY_APP_NAME} connection`, 'Future integration area for student learning access.'],
];

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={`Configuration placeholders for future academy profile, permissions, access, and ${PLAY_APP_NAME} integration.`} action={<RoadmapBadge status="Future Integration" />} />
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map(([title, description]) => (
          <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card" key={title}>
            <div>
              <h2 className="text-lg font-black text-navy">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
            <ChevronRight className="shrink-0 text-slate-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
