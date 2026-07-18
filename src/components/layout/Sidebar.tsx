import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileClock,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { SUPPORT_TEXT } from '../../config/brand';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types/auth';
import { BrandMark } from '../ui/BrandMark';
import { RoadmapBadge } from '../ui/RoadmapBadge';

const links: Array<{ label: string; to: string; icon: typeof LayoutDashboard; roles: Role[] }> = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'academy_admin', 'coach', 'student'] },
  { label: 'Academies', to: '/super-admin/academies', icon: Building2, roles: ['super_admin'] },
  { label: 'Pending Approvals', to: '/super-admin/approvals', icon: ShieldCheck, roles: ['super_admin'] },
  { label: 'Users', to: '/super-admin/users', icon: UserCog, roles: ['super_admin'] },
  { label: 'Invites', to: '/super-admin/invites', icon: KeyRound, roles: ['super_admin'] },
  { label: 'Audit Logs', to: '/super-admin/audit-logs', icon: FileClock, roles: ['super_admin'] },
  { label: 'My Batches', to: '/coach/batches', icon: ClipboardList, roles: ['coach'] },
  { label: 'My Students', to: '/coach/students', icon: GraduationCap, roles: ['coach'] },
  { label: 'Attendance', to: '/coach/attendance', icon: CalendarCheck, roles: ['coach'] },
  { label: 'Class Reports', to: '/coach/class-reports', icon: BarChart3, roles: ['coach'] },
  { label: 'Progress', to: '/coach/progress', icon: GraduationCap, roles: ['coach'] },
  { label: 'Homework', to: '/coach/homework', icon: BookOpen, roles: ['coach'] },
  { label: 'Attendance', to: '/student/attendance', icon: CalendarCheck, roles: ['student'] },
  { label: 'Class Reports', to: '/student/class-reports', icon: BarChart3, roles: ['student'] },
  { label: 'Progress', to: '/student/progress', icon: GraduationCap, roles: ['student'] },
  { label: 'Fees', to: '/student/fees', icon: CreditCard, roles: ['student'] },
  { label: 'Profile', to: '/student/profile', icon: UserRound, roles: ['student'] },
  { label: 'My Homework', to: '/student/homework', icon: ClipboardList, roles: ['student'] },
  { label: 'Platform Settings', to: '/super-admin/settings', icon: Settings, roles: ['super_admin'] },
  { label: 'Students', to: '/academy/students', icon: GraduationCap, roles: ['academy_admin'] },
  { label: 'Coaches', to: '/academy/coaches', icon: UsersRound, roles: ['academy_admin'] },
  { label: 'Batches', to: '/academy/batches', icon: ClipboardList, roles: ['academy_admin'] },
  { label: 'Class Schedules', to: '/academy/class-schedules', icon: CalendarClock, roles: ['academy_admin'] },
  { label: 'Attendance', to: '/academy/attendance', icon: CalendarCheck, roles: ['academy_admin'] },
  { label: 'Class Reports', to: '/academy/class-reports', icon: BarChart3, roles: ['academy_admin'] },
  { label: 'Progress', to: '/academy/progress', icon: GraduationCap, roles: ['academy_admin'] },
  { label: 'Homework', to: '/academy/homework', icon: BookOpen, roles: ['academy_admin'] },
  { label: 'Fees', to: '/academy/fees', icon: CreditCard, roles: ['academy_admin'] },
  { label: 'Invites', to: '/academy/invites', icon: KeyRound, roles: ['academy_admin'] },
  { label: 'Settings', to: '/academy/settings', icon: Settings, roles: ['academy_admin'] },
  { label: 'Profile', to: '/coach/profile', icon: UserRound, roles: ['coach'] },
];

export function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const { logout, role } = useAuth();
  const visibleLinks = links.filter((link) => role && link.roles.includes(role));
  const content = (
    <>
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
      </div>
      <nav className="mt-8 space-y-1">
        {visibleLinks.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onMobileClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
                isActive ? 'bg-blue-50 text-directBlue' : 'text-slate-600 hover:bg-slate-50 hover:text-navy'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="absolute bottom-5 left-4 right-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white">
        <RoadmapBadge status="Beta" />
        <p className="mt-3 text-sm font-black">Kairoyr Direct V1</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{SUPPORT_TEXT}</p>
        <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white" onClick={logout} type="button" aria-label="Logout" title="Logout">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        {content}
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-navy/40" onClick={onMobileClose} type="button" aria-label="Close navigation" title="Close navigation" />
          <aside className="relative h-full w-72 border-r border-slate-200 bg-white px-4 py-5 shadow-2xl">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
