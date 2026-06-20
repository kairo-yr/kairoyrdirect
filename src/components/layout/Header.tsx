import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '../../constants/roles';
import { APP_NAME } from '../../config/brand';
import { BrandMark } from '../ui/BrandMark';
import { useAppData } from '../../hooks/useAppData';
import { useAuth } from '../../contexts/AuthContext';
import { getDashboardPathByRole } from '../../utils/roleRedirects';

export function Header() {
  const { academy } = useAppData();
  const { isAuthenticated, logout, role, userProfile } = useAuth();
  const dashboardPath = role ? getDashboardPathByRole(role) : '/login';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <button className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600" aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <BrandMark compact />
          <div className="text-lg font-black text-navy">{APP_NAME}</div>
        </div>
        <div className="hidden max-w-md flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 lg:flex">
          <Search size={18} className="text-slate-400" />
          <span className="text-sm text-slate-400">Search students, batches, coaches...</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="hidden text-right sm:block">
            <div className="text-sm font-black text-navy">{isAuthenticated ? userProfile?.name || academy.name : academy.name}</div>
            <div className="text-xs text-slate-500">{role ? ROLE_LABELS[role] : 'Not signed in'}</div>
          </div>
          {isAuthenticated && role ? (
            <>
              <Link className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 sm:inline-flex" to={dashboardPath}>
                Dashboard
              </Link>
              <button className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600" onClick={logout} type="button" aria-label="Logout">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700" to="/login">
              Login
            </Link>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-sm font-black text-directGold">
            {(userProfile?.name ?? 'YA').slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
