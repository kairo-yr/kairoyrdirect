import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardPathByRole } from '../utils/roleRedirects';

export function Unauthorized() {
  const { role } = useAuth();

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldAlert size={24} />
        </div>
        <h1 className="mt-5 text-3xl font-black text-navy">Access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your account is disabled or does not have access to this workspace. Contact the academy administrator if this looks wrong.
        </p>
        <Link className="mt-6 inline-flex rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" to={role ? getDashboardPathByRole(role) : '/login'}>
          Go to my dashboard
        </Link>
      </div>
    </main>
  );
}
