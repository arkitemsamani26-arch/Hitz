import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, demo } from '@/data';
import type { Profile, Session } from '@/data/types';

type Ctx = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  setSession: (s: Session | null) => void;
  setProfile: (p: Profile | null) => void;
  // Persisted list/court preference.
  listMode: boolean;
  setListMode: (v: boolean) => void;
  tick: number;   // bumps when the backend reports a change
};

const SessionCtx = createContext<Ctx | null>(null);
const LIST_KEY = 'hits.pref.list';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listPref, setListPref] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const s = await api.restore();
    setSession(s);
    setProfile(s && !s.isGuardian ? await api.me() : null);
  }, []);

  // Whatever happens, the app has to become interactive. Restore is two network calls,
  // and if either threw here the splash was already gone and the user sat looking at an
  // empty green screen with no error and no way back.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(LIST_KEY);
        if (v != null && alive) setListPref(v === '1');
      } catch { /* the default is fine */ }
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

  useEffect(() => api.onChange(() => setTick(t => t + 1)), []);
  useEffect(() => {
    if (!session || session.isGuardian) return;
    let alive = true;
    void api.me().then(p => { if (alive) setProfile(p); }, () => { /* keep what we have */ });
    return () => { alive = false; };
  }, [tick, session]);

  // List is the default for everyone; the court is the browse mode you switch to.
  const listMode = listPref ?? true;
  const setListMode = useCallback((v: boolean) => {
    setListPref(v);
    void AsyncStorage.setItem(LIST_KEY, v ? '1' : '0').catch(() => {});
    demo?.setListMode(v);
  }, []);

  const value = useMemo(() => ({ ready, session, profile, refresh, setSession, setProfile, listMode, setListMode, tick }),
    [ready, session, profile, refresh, listMode, setListMode, tick]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession outside provider');
  return c;
}
