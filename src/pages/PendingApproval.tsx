import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function PendingApproval() {
  const { logout, userProfile } = useAuth();

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <span className="text-xl font-black">!</span>
        </div>
        <h1 className="mt-5 text-3xl font-black text-navy">Academy approval pending</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your academy registration is waiting for Kairoyr approval. You cannot access academy tools until approval is complete.
        </p>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
          Signed in as <span className="text-navy">{userProfile?.email}</span>
        </div>
        <button className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700" onClick={logout} type="button">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </main>
  );
}
