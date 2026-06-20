import type { SelectHTMLAttributes } from 'react';

type Option = {
  label: string;
  value: string;
};

type FilterSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: Option[];
};

export function FilterSelect({ options, className = '', ...props }: FilterSelectProps) {
  return (
    <select
      className={`rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100 ${className}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
