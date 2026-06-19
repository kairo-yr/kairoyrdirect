import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { SUPPORT_TEXT } from '../../config/brand';
import { BrandMark } from '../ui/BrandMark';
import { RoadmapBadge } from '../ui/RoadmapBadge';

const links = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Students', to: '/students', icon: GraduationCap },
  { label: 'Batches', to: '/batches', icon: ClipboardList },
  { label: 'Coaches', to: '/coaches', icon: UsersRound },
  { label: 'Attendance', to: '/attendance', icon: CalendarCheck },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Fees', to: '/fees', icon: CreditCard },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
      </div>
      <nav className="mt-8 space-y-1">
        {links.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
        <RoadmapBadge status="Mock Data" />
        <p className="mt-3 text-sm font-black">Phase 1 Foundation</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{SUPPORT_TEXT}</p>
      </div>
    </aside>
  );
}
