import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getProfileRedirectPath } from '../utils/roleRedirects';

export function DashboardRedirect() {
  const { isAuthenticated, loading, userProfile } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <div className="text-lg font-black text-navy">Loading your dashboard</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">Checking your role before opening the workspace.</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !userProfile) return <Navigate to="/login" replace />;
  if (userProfile?.status === 'disabled') return <Navigate to="/unauthorized" replace />;

  return <Navigate to={getProfileRedirectPath(userProfile)} replace />;
}
