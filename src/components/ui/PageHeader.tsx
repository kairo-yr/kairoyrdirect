import type { ReactNode } from 'react';
import { APP_NAME } from '../../config/brand';

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-directBlue">{APP_NAME}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-navy md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}
