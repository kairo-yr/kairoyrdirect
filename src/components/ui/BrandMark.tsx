import { useState } from 'react';
import { APP_NAME, LOGO_SRC } from '../../config/brand';

export function BrandMark({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {!logoFailed ? (
        <img
          src={LOGO_SRC}
          alt={`${APP_NAME} logo`}
          className="h-11 w-11 rounded-2xl object-contain shadow-card"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-sm font-black text-white shadow-card">
          KD
        </div>
      )}
      {!compact && (
        <div>
          <div className={`text-xl font-black tracking-tight ${light ? 'text-white' : 'text-navy'}`}>{APP_NAME}</div>
          <div className="text-xs font-bold uppercase tracking-widest text-directBlue">Academy OS</div>
        </div>
      )}
    </div>
  );
}
