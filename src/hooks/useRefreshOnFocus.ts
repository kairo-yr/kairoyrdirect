import { useEffect, useRef } from 'react';

export function useRefreshOnFocus(refresh: () => void | Promise<void>, enabled = true) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return undefined;

    const refreshVisiblePage = () => {
      if (document.visibilityState === 'visible') void refreshRef.current();
    };

    window.addEventListener('focus', refreshVisiblePage);
    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.removeEventListener('focus', refreshVisiblePage);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [enabled]);
}
