import { useState, type FormEvent } from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { PLAY_APP_NAME } from '../config/brand';
import { ROLE_LABELS } from '../constants/roles';
import { SUPER_ADMIN_EMAILS } from '../constants/superAdmin';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../hooks/useAppData';
import type { Academy } from '../types';

function AcademySettings() {
  const { academy, updateAcademy } = useAppData();
  const [form, setForm] = useState<Academy>(academy);
  const [saved, setSaved] = useState(false);

  const updateField = (field: keyof Academy, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.ownerName.trim()) {
      alert('Academy name and owner name are required.');
      return;
    }
    updateAcademy(form);
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Settings"
        description={`Manage the academy profile foundation. Permissions, student access, and ${PLAY_APP_NAME} connection stay roadmap-ready for later phases.`}
        action={<RoadmapBadge status="Future Integration" />}
      />

      <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-navy">Academy Profile</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">These details power the dashboard header and local academy data model.</p>
          </div>
          {saved ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Saved locally</span> : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormInput label="Academy name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <FormInput label="Owner name" value={form.ownerName} onChange={(event) => updateField('ownerName', event.target.value)} />
          <FormInput label="Email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          <FormInput label="Phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <FormInput label="City" value={form.city} onChange={(event) => updateField('city', event.target.value)} />
          <FormSelect
            label="Academy type"
            value={form.type}
            onChange={(event) => updateField('type', event.target.value)}
            options={[
              { label: 'Academy', value: 'academy' },
              { label: 'Independent Coach', value: 'independent_coach' },
            ]}
          />
          <FormSelect
            label="Status"
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white shadow-card" type="submit">
            Save Academy Profile
          </button>
        </div>
      </form>
    </div>
  );
}

function SuperAdminSettings() {
  const { userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin / Platform Settings"
        description="Read-only platform administration settings for Kairoyr Direct."
        action={<RoadmapBadge status="Future Integration" />}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-3 text-navy">
          <UserRound size={22} />
          <h2 className="text-xl font-black">Super Admin Profile</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Name</div>
            <div className="mt-1 font-black text-navy">{userProfile?.name || 'Not available'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Email</div>
            <div className="mt-1 font-black text-navy">{userProfile?.email || 'Not available'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Role</div>
            <div className="mt-1 font-black text-navy">Kairoyr Super Admin</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Account status</div>
            <div className="mt-1 font-black text-navy">{userProfile?.status ?? 'Not available'}</div>
          </div>
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
            ['Kairoyr Play integration', 'Future integration'],
            ['Subscription system', 'Future integration'],
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
        <p className="mt-2 text-sm leading-6 text-slate-600">Super admin access is controlled from code for now.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Current email</div>
            <div className="mt-1 font-black text-navy">{userProfile?.email || 'Not available'}</div>
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

function BasicProfileSettings() {
  const { role, userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Basic profile details for this account. Editing will be enabled when profile update rules are ready."
      />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Name</div>
            <div className="mt-1 font-black text-navy">{userProfile?.name || 'Not available'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Email</div>
            <div className="mt-1 font-black text-navy">{userProfile?.email || 'Not available'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Role</div>
            <div className="mt-1 font-black text-navy">{role ? ROLE_LABELS[role] : 'Not available'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Academy ID</div>
            <div className="mt-1 font-black text-navy">{userProfile?.academyId || 'Not assigned'}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { role } = useAuth();

  if (role === 'super_admin') return <SuperAdminSettings />;
  if (role === 'academy_admin') return <AcademySettings />;
  return <BasicProfileSettings />;
}
