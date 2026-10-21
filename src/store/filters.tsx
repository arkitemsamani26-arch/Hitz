import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DiscoverFilters } from '@/data/types';
import { useSession } from './session';

export const DEFAULT_FILTERS: DiscoverFilters = { radiusMi: 10, levelLo: null, levelHi: null, availability: 0, onlyLooking: false, ageGap: null };
// A junior starts with players around their own age: two 13-year-olds should find each
// other first. They can widen it; a parent's rule, if there is one, still holds underneath.
export const JUNIOR_AGE_GAP = 2;
export const defaultsFor = (band: 'minor' | 'adult' | undefined): DiscoverFilters => ({ ...DEFAULT_FILTERS, ageGap: band === 'minor' ? JUNIOR_AGE_GAP : null });

const Ctx = createContext<{ filters: DiscoverFilters; set: (f: DiscoverFilters) => void } | null>(null);
export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const [filters, set] = useState(DEFAULT_FILTERS);
  // Once the profile says who this is, start a junior on "around my age". Only once per
  // band, so it never overrides a choice made in Filters.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const band = profile?.band;
    if (!band || seeded.current === band) return;
    seeded.current = band;
    set(f => ({ ...f, ageGap: band === 'minor' ? JUNIOR_AGE_GAP : null }));
  }, [profile?.band]);
  const v = useMemo(() => ({ filters, set }), [filters]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useFilters() {
  const c = useContext(Ctx); if (!c) throw new Error('useFilters outside provider'); return c;
}
export function activeFilterCount(f: DiscoverFilters): number {
  return (f.radiusMi !== 10 ? 1 : 0) + (f.levelLo != null || f.levelHi != null ? 1 : 0) + (f.availability ? 1 : 0) + (f.onlyLooking ? 1 : 0)
    + (f.playStyle ? 1 : 0) + (f.handedness ? 1 : 0) + (f.minReplyRate != null ? 1 : 0) + (f.indoorOnly ? 1 : 0) + (f.format ? 1 : 0);
}
