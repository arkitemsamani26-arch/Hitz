// Who you see. Distance, level band, when you are free, and whether to show only people
// who said they want to hit this week.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/ui/Toast';
import { useGoBack } from '@/lib/nav';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Pill } from '@/ui/Pill';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { space } from '@/theme/tokens';
import { useFilters, defaultsFor } from '@/store/filters';
import { useSession } from '@/store/session';
import { AvailabilityGrid } from '@/ui/Availability';

// Bay Area: 10 is a normal drive, 25 reaches San Jose.
const RADII = [5, 10, 15, 25];
const BANDS: { label: string; d: number | null }[] = [{ label: '±0.5', d: 0.5 }, { label: '±1', d: 1 }, { label: '±2', d: 2 }, { label: 'Any level', d: null }];
// Juniors: how close in age. A parent's rule, when there is one, sits underneath whatever
// is chosen here; this can narrow it, never widen past it.
const AGES: { label: string; gap: number | null }[] = [{ label: 'Within a year', gap: 1 }, { label: 'Within 2 years', gap: 2 }, { label: 'Within 3 years', gap: 3 }, { label: 'Any age', gap: null }];

export default function Filters() {
  const toast = useToast();
  const goBack = useGoBack();
  const { filters, set } = useFilters();
  const { profile } = useSession();
  const [f, setF] = useState(filters);
  const my = profile?.levelValue ?? 6;
  // Read and write at the same precision, or the chip you just tapped deselects itself.
  const band = f.levelLo == null ? null : +(my - f.levelLo).toFixed(2);
  const setBand = (d: number | null) => setF(x => ({ ...x, levelLo: d == null ? null : +(my - d).toFixed(2), levelHi: d == null ? null : +(my + d).toFixed(2) }));
  return (
    <Screen bottom={<Centered><View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button title="Reset" kind="line" onPress={() => { setF(defaultsFor(profile?.band)); toast('Filters cleared.'); }} />
      <Button title="Show players" arrow onPress={() => { set(f); goBack(); }} style={{ flex: 1 }} />
    </View></Centered>}>
      <Centered>
        <Header />
        <T v="eyebrow" tone="muted">Who you see</T>
        <T v="display" style={{ marginTop: 12, marginBottom: 24 }}>Your kind{'\n'}<T v="display" italic>of player.</T></T>
        <Card style={{ gap: space.sm }}>
          <T v="micro" tone="muted">Distance</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {RADII.map(r => <Pill key={r} label={`${r} mi`} on={f.radiusMi === r} onPress={() => setF(x => ({ ...x, radiusMi: r }))} />)}
          </View>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Level, around your {my.toFixed(1)}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {BANDS.map(b => <Pill key={b.label} label={b.label} on={band === b.d} onPress={() => setBand(b.d)} />)}
          </View>
          <T v="meta" tone="muted">{band == null ? 'Everyone in range, whatever their level.' : `UTR ${(my - band).toFixed(1)} to ${(my + band).toFixed(1)}.`}</T>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Free when</T>
          <View style={{ marginTop: space.xs }}>
            <AvailabilityGrid mask={f.availability} onToggle={bit => setF(x => ({ ...x, availability: x.availability ^ bit }))} />
          </View>
          {profile?.band === 'minor' && (
            <>
              <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Age{profile.age != null ? `, around your ${profile.age}` : ''}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {AGES.map(a => <Pill key={a.label} label={a.label} on={f.ageGap === a.gap} onPress={() => setF(x => ({ ...x, ageGap: a.gap }))} />)}
              </View>
              <T v="meta" tone="muted">
                {profile.maxPartnerAgeGap ? `Your parent set within ${profile.maxPartnerAgeGap} ${profile.maxPartnerAgeGap === 1 ? 'year' : 'years'}. That always applies. ` : ''}Only players under 18, always.
              </T>
            </>
          )}
          <View style={{ marginTop: space.lg }}><Pill label="Only players looking to hit this week" on={f.onlyLooking} onPress={() => setF(x => ({ ...x, onlyLooking: !x.onlyLooking }))} style={{ alignSelf: 'flex-start' }} /></View>
        </Card>
      </Centered>
    </Screen>
  );
}
