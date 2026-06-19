import { Bell, Menu, Search } from 'lucide-react';
import { mockRole } from '../../data/mockData';
import { APP_NAME } from '../../config/brand';
import { BrandMark } from '../ui/BrandMark';

const roleLabel = {
  academy_owner: 'Academy Owner',
  coach: 'Coach',
  student: 'Student',
  parent: 'Parent',
}[mockRole];

export function Header() {
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
            <div className="text-sm font-black text-navy">Kairoyr Academy</div>
            <div className="text-xs text-slate-500">Viewing as {roleLabel}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-sm font-black text-directGold">
            YA
          </div>
        </div>
      </div>
    </header>
  );
}
