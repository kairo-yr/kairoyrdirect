import { LogOut } from 'lucide-react';
import { ROLE_LABELS } from '../constants/roles';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/auth';

export function RoleDashboard({ title, description, role }: { title: string; description: string; role: Role }) {
  const { logout, userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-directBlue ring-1 ring-blue-100">{ROLE_LABELS[role]}</div>
            <h1 className="mt-4 text-3xl font-black text-navy">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" onClick={logout} type="button">
            <LogOut size={18} /> Logout
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Name</div>
            <div className="mt-1 font-black text-navy">{userProfile?.name || 'Kairoyr Direct User'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Email</div>
            <div className="mt-1 font-black text-navy">{userProfile?.email || 'No email'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Current Role</div>
            <div className="mt-1 font-black text-navy">{userProfile?.role ? ROLE_LABELS[userProfile.role] : ROLE_LABELS[role]}</div>
          </div>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          TODO: Frontend route checks are only a usability layer. Production Firestore security rules must enforce role and academy access on the server side.
        </p>
      </section>
    </div>
  );
}
