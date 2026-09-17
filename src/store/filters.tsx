import React, { createContext, useContext, useMemo, useState } from 'react';
import type { DiscoverFilters } from '@/data/types';

export const DEFAULT_FILTERS: DiscoverFilters = { radiusMi: 25, levelLo: null, levelHi: null, availability: 0, onlyLooking: false };

const Ctx = createContext<{ filters: DiscoverFilters; set: (f: DiscoverFilters) => void } | null>(null);
export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, set] = useState(DEFAULT_FILTERS);
  const v = useMemo(() => ({ filters, set }), [filters]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useFilters() {
  const c = useContext(Ctx); if (!c) throw new Error('useFilters outside provider'); return c;
}
export function activeFilterCount(f: DiscoverFilters): number {
  return (f.radiusMi !== 25 ? 1 : 0) + (f.levelLo != null || f.levelHi != null ? 1 : 0) + (f.availability ? 1 : 0) + (f.onlyLooking ? 1 : 0);
}
