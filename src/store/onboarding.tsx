// Onboarding answers, held in memory until the profile is created in one shot.
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { LevelSource } from '@/data/types';

export type Draft = {
  phone: string;
  displayName: string;
  lastInitial: string;
  dateOfBirth: string | null;
  levelValue: number | null;
  levelSource: LevelSource | null;
  homeCourtId: string | null;
  availabilityMask: number;
  guardianEmail: string;
  guardianPhone: string;
  rosterCode: string | null;
};

const empty: Draft = {
  phone: '', displayName: '', lastInitial: '', dateOfBirth: null, levelValue: null, levelSource: null,
  homeCourtId: null, availabilityMask: 0, guardianEmail: '', guardianPhone: '', rosterCode: null,
};

const Ctx = createContext<{ draft: Draft; patch: (p: Partial<Draft>) => void; reset: () => void } | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(empty);
  const value = useMemo(() => ({
    draft,
    patch: (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p })),
    reset: () => setDraft(empty),
  }), [draft]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDraft() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDraft outside provider');
  return c;
}

export function isMinor(dob: string | null): boolean {
  if (!dob) return true;
  const d = new Date(dob);
  return new Date(d.getFullYear() + 18, d.getMonth(), d.getDate()) > new Date();
}
