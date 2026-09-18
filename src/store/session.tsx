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

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(LIST_KEY);
        if (v != null) setListPref(v === '1');
      } catch {}
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  useEffect(() => api.onChange(() => setTick(t => t + 1)), []);
  useEffect(() => { if (session && !session.isGuardian) void api.me().then(setProfile); }, [tick, session]);

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
