import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getDashboardPathByRole } from '../../utils/roleRedirects';
import { useAuth } from '../../contexts/AuthContext';
import type { Role, UserStatus } from '../../types/auth';

export function ProtectedRoute({ allowedRoles, allowedStatuses, children }: { allowedRoles: Role[]; allowedStatuses?: UserStatus[]; children: ReactNode }) {
  const { isAuthenticated, loading, role, userProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <div className="text-lg font-black text-navy">Loading your workspace</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">Checking authentication and role access...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (userProfile?.status === 'disabled') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (userProfile?.status === 'pending' && role === 'unassigned' && !allowedRoles.includes('unassigned')) {
    return <Navigate to="/onboarding" replace />;
  }

  if (userProfile?.status === 'pending' && role !== 'unassigned' && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }

  if (allowedStatuses && userProfile?.status && !allowedStatuses.includes(userProfile.status)) {
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }

  return children;
}
