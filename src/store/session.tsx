import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/data';
import type { Profile, Session } from '@/data/types';

type Ctx = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  setSession: (s: Session | null) => void;
  setProfile: (p: Profile | null) => void;
  tick: number;   // bumps when the backend reports a change
  // A child the signed-in parent runs, when the app is being used as them. Null is you.
  acting: string | null;
  setActing: (childId: string | null) => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tick, setTick] = useState(0);
  const [acting, setActingState] = useState<string | null>(api.actingAs());

  const refresh = useCallback(async () => {
    const s = await api.restore();
    setSession(s);
    setProfile(s && (!s.isGuardian || api.actingAs()) ? await api.me() : null);
  }, []);

  // Switching who the app is being used as. Every screen keyed off `tick` refetches, so
  // nothing from the last person's week is left on screen.
  const setActing = useCallback(async (childId: string | null) => {
    api.actAs(childId);
    setActingState(api.actingAs());
    try { setProfile(await api.me()); } catch { setProfile(null); }
    setTick(t => t + 1);
  }, []);

  // Whatever happens, the app has to become interactive. Restore is two network calls,
  // and if either threw here the splash was already gone and the user sat looking at an
  // empty green screen with no error and no way back.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch {
        if (alive) { setSession(null); setProfile(null); }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  // Fifteen useAsync calls across six screens key off `tick`, so one bump refetches
  // everything mounted -- your invites and your UTR status included, for a message in a
  // hit thread. That was harmless while the realtime publication was empty and the
  // channel never fired; now that it does, a burst of rows (accepting a hit writes the
  // request, both approvals and two notifications) would otherwise mean a burst of
  // refetches. Coalesce them into one. The real fix is a query cache that knows which
  // table changed, and this is not it -- it is the difference between one refetch and
  // six while that waits.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = api.onChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; setTick(t => t + 1); }, 250);
    });
    return () => { if (timer) clearTimeout(timer); stop(); };
  }, []);
  useEffect(() => {
    if (!session || (session.isGuardian && !acting)) return;
    let alive = true;
    void api.me().then(p => { if (alive) setProfile(p); }, () => { /* keep what we have */ });
    return () => { alive = false; };
  }, [tick, session, acting]);

  const value = useMemo(() => ({ ready, session, profile, refresh, setSession, setProfile, tick, acting, setActing }),
    [ready, session, profile, refresh, tick, acting, setActing]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession outside provider');
  return c;
}
