import type { SelectHTMLAttributes } from 'react';

type Option = {
  label: string;
  value: string;
};

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Option[];
};

export function FormSelect({ label, options, className = '', ...props }: FormSelectProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select
        className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
