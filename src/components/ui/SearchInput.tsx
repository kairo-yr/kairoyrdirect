import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

export function SearchInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm ${className}`}>
      <Search size={18} className="text-slate-400" />
      <input className="min-w-0 flex-1 bg-transparent py-1 text-sm font-semibold text-navy outline-none placeholder:text-slate-400" {...props} />
    </div>
  );
}
