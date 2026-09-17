import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Pill } from '@/ui/Pill';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Baseline } from '@/ui/Court';
import { space } from '@/theme/tokens';
import { useFilters, DEFAULT_FILTERS } from '@/store/filters';
import { useSession } from '@/store/session';
import { SLOTS } from '@/data/types';

const RADII = [5, 10, 25, 40];
const BANDS: { label: string; d: number | null }[] = [{ label: '±0.5', d: 0.5 }, { label: '±1', d: 1 }, { label: '±2', d: 2 }, { label: 'Any', d: null }];

export default function Filters() {
  const router = useRouter();
  const { filters, set } = useFilters();
  const { profile } = useSession();
  const [f, setF] = useState(filters);
  const my = profile?.levelValue ?? 6;
  const band = f.levelLo == null ? null : +(my - f.levelLo).toFixed(1);
  const setBand = (d: number | null) => setF(x => ({ ...x, levelLo: d == null ? null : +(my - d).toFixed(2), levelHi: d == null ? null : +(my + d).toFixed(2) }));
  return (
    <Screen bottom={<Centered><View style={{ flexDirection: 'row', gap: space.md }}>
      <Button title="Reset" kind="line" onPress={() => setF(DEFAULT_FILTERS)} />
      <Button title="Show players" onPress={() => { set(f); router.back(); }} style={{ flex: 1 }} />
    </View></Centered>}>
      <Centered>
        <Header title="Filters" />
        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Distance</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {RADII.map(r => <Pill key={r} label={`${r} mi`} on={f.radiusMi === r} onPress={() => setF(x => ({ ...x, radiusMi: r }))} />)}
        </View>
        <Baseline style={{ marginVertical: space.xl }} />
        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Level, around your {my.toFixed(1)}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {BANDS.map(b => <Pill key={b.label} label={b.label} on={band === b.d} onPress={() => setBand(b.d)} />)}
        </View>
        <Baseline style={{ marginVertical: space.xl }} />
        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Free when</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {SLOTS.map(sl => <Pill key={sl.bit} label={`${sl.label} ${sl.part.toLowerCase()}`} on={!!(f.availability & sl.bit)} onPress={() => setF(x => ({ ...x, availability: x.availability ^ sl.bit }))} />)}
        </View>
        <Baseline style={{ marginVertical: space.xl }} />
        <Pill label="Only players looking to hit this week" on={f.onlyLooking} onPress={() => setF(x => ({ ...x, onlyLooking: !x.onlyLooking }))} />
      </Centered>
    </Screen>
  );
}
