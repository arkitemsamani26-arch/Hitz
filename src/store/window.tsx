// Your next window: one concrete date, start and length, kept on the device. It seeds
// every invitation you write and the "Both free" line on the cards. Distinct from your
// weekly pattern (availabilityMask), which is a preference, not a plan.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nextSlot } from '@/data/demo';

export type Window = { start: Date; durMin: number };
const KEY = 'hits.window.v1';

type Ctx = { win: Window | null; setWin: (w: Window | null) => void };
const C = createContext<Ctx | null>(null);

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [win, setState] = useState<Window | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then(v => {
      if (!v || !alive) return;
      try {
        const o = JSON.parse(v) as { start: string; durMin: number };
        const start = new Date(o.start);
        // A window that has passed is not a plan any more.
        if (start.getTime() > Date.now()) setState({ start, durMin: o.durMin || 90 });
      } catch { /* ignore a bad value */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const setWin = useCallback((w: Window | null) => {
    setState(w);
    if (w) void AsyncStorage.setItem(KEY, JSON.stringify({ start: w.start.toISOString(), durMin: w.durMin })).catch(() => {});
    else void AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);
  const v = useMemo(() => ({ win, setWin }), [win, setWin]);
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useWindow() {
  const c = useContext(C); if (!c) throw new Error('useWindow outside provider'); return c;
}

// The first slot of your usual week, 90 minutes long. Evenings start at 6.
export function defaultWindow(availabilityMask: number): Window {
  return { start: nextSlot(availabilityMask || 4, 1), durMin: 90 };
}

export function useNextWindow(availabilityMask: number): Window {
  const { win } = useWindow();
  return useMemo(() => win ?? defaultWindow(availabilityMask), [win, availabilityMask]);
}
