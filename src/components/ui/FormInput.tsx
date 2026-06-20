import type { InputHTMLAttributes } from 'react';

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FormInput({ label, className = '', ...props }: FormInputProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none transition focus:border-directBlue focus:ring-4 focus:ring-blue-100 ${className}`}
        {...props}
      />
    </label>
  );
}
