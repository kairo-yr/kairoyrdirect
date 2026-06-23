import { ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { SUPER_ADMIN_EMAILS } from '../constants/superAdmin';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
  const { userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Read-only platform administration settings for Kairoyr Direct V1."
        action={<RoadmapBadge status="Beta" />}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-3 text-navy">
          <UserRound size={22} />
          <h2 className="text-xl font-black">Super Admin Profile</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ['Name', userProfile?.name || 'Not available'],
            ['Email', userProfile?.email || 'Not available'],
            ['Role', 'Kairoyr Super Admin'],
            ['Account status', userProfile?.status ?? 'Not available'],
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-slate-50 p-4" key={label}>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 break-words font-black text-navy">{value}</div>
            </div>
          ))}
        </div>
        {userProfile?.photoURL ? <img className="mt-6 h-16 w-16 rounded-2xl object-cover" src={userProfile.photoURL} alt={userProfile.name} /> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-3 text-navy">
          <ShieldCheck size={22} />
          <h2 className="text-xl font-black">Platform Configuration</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ['Academy approval mode', 'Manual approval'],
            ['Invite system', 'Enabled'],
            ['Kairoyr Play integration', 'Link placeholder in V1'],
            ['Subscription billing', 'Not built in V1'],
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-slate-50 p-4" key={label}>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 font-black text-navy">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-xl font-black text-navy">Admin Access</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Super admin access is controlled by the configured allowlist for V1.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Current email</div>
            <div className="mt-1 break-words font-black text-navy">{userProfile?.email || 'Not available'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Allowed super admin emails</div>
            <div className="mt-2 space-y-1">
              {SUPER_ADMIN_EMAILS.map((email) => (
                <div className="font-mono text-sm font-black text-navy" key={email}>{email}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
