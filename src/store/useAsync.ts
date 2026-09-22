import { useCallback, useEffect, useRef, useState } from 'react';

// Small fetch hook. Re-runs on `deps`; keeps stale data on screen while reloading so
// nothing flashes.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const gen = useRef(0);
  const alive = useRef(true);
  // `run` is memoised on the caller's deps, so without this it would keep calling the
  // fn from whichever render last changed them -- a stale closure waiting to happen.
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const run = useCallback(async () => {
    const g = ++gen.current;
    const ok = () => alive.current && g === gen.current;
    setLoading(true);
    try {
      const r = await latest.current();
      if (ok()) { setData(r); setError(null); }
    } catch (e: any) {
      if (ok()) setError(e?.message ?? 'Something went wrong');
    } finally {
      if (ok()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}
