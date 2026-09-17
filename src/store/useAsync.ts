import { useCallback, useEffect, useRef, useState } from 'react';

// Small fetch hook. Re-runs on `deps`; keeps stale data on screen while reloading so
// nothing flashes.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const gen = useRef(0);
  const run = useCallback(async () => {
    const g = ++gen.current;
    setLoading(true);
    try {
      const r = await fn();
      if (g === gen.current) { setData(r); setError(null); }
    } catch (e: any) {
      if (g === gen.current) setError(e?.message ?? 'Something went wrong');
    } finally {
      if (g === gen.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}
