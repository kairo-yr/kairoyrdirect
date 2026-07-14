import { useEffect, useRef } from 'react';

type StoredDraft<T> = {
  version: 1;
  savedAt: string;
  data: T;
};

export function readPersistentDraft<T>(key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const draft = parsed as Partial<StoredDraft<unknown>>;
    return draft.version === 1 && typeof draft.savedAt === 'string' && validate(draft.data) ? draft.data : null;
  } catch {
    return null;
  }
}

export function clearPersistentDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in privacy modes; the form must remain usable.
  }
}

export function usePersistentDraft<T>({ key, value, enabled, debounceMs = 500 }: {
  key: string;
  value: T;
  enabled: boolean;
  debounceMs?: number;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!initialized.current) {
      initialized.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      try {
        const draft: StoredDraft<T> = { version: 1, savedAt: new Date().toISOString(), data: value };
        window.localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // A full localStorage quota must not interrupt editing.
      }
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, key, value]);
}
