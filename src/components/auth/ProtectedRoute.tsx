import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getDashboardPathByRole, getProfileRedirectPath } from '../../utils/roleRedirects';
import { useAuth } from '../../contexts/AuthContext';
import type { Role, UserStatus } from '../../types/auth';

export function ProtectedRoute({ allowedRoles, allowedStatuses, children }: { allowedRoles: Role[]; allowedStatuses?: UserStatus[]; children: ReactNode }) {
  const { isAuthenticated, loading, session, userProfile } = useAuth();
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (session?.user && !userProfile) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <div className="text-lg font-black text-navy">Access blocked</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">Your account profile could not be loaded. Please contact Kairoyr support.</p>
        </div>
      </main>
    );
  }

  if (userProfile?.status === 'disabled') {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <div className="text-lg font-black text-navy">Access blocked</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">Your account is disabled. Please contact Kairoyr support.</p>
        </div>
      </main>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const routeRole = userProfile.platform_role === 'super_admin' ? 'super_admin' : userProfile.app_role;
  const hasAllowedRole = allowedRoles.some((allowedRole) => {
    if (allowedRole === 'super_admin') return userProfile.platform_role === 'super_admin';
    return userProfile.app_role === allowedRole;
  });

  if (userProfile.status === 'pending' && routeRole === 'unassigned' && !allowedRoles.includes('unassigned')) {
    return <Navigate to="/onboarding" replace />;
  }

  if (userProfile.status === 'pending' && routeRole !== 'unassigned' && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!hasAllowedRole) {
    return <Navigate to={getProfileRedirectPath(userProfile)} replace />;
  }

  if (allowedStatuses && userProfile.status && !allowedStatuses.includes(userProfile.status)) {
    return <Navigate to={getDashboardPathByRole(routeRole)} replace />;
  }

  return children;
}
