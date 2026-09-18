// The cohort-closed state: a countdown to the courts opening, not an error.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Button } from './Button';
import { Sheet } from './Screen';
import { CourtSurface } from './Court';
import { color, space } from '@/theme/tokens';
import type { MarketStatus } from '@/data/types';

export function Countdown({ m, onInvite }: { m: MarketStatus; onInvite: () => void }) {
  const who = m.band === 'minor' ? 'juniors' : 'players';
  const left = Math.max(0, m.minActivePlayers - m.activePlayers);
  const frac = Math.min(1, m.activePlayers / m.minActivePlayers);
  return (
    <View style={s.wrap}>
      <CourtSurface style={s.court} dim>
        <View style={[s.fill, { height: `${frac * 100}%` }]} />
      </CourtSurface>
      <Sheet style={{ alignItems: 'center', gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <T v="score" tone="court">{m.activePlayers}</T>
          <T v="h2" tone="ink2" style={{ marginBottom: 12 }}>/ {m.minActivePlayers}</T>
        </View>
        <T v="h2" center>{who} on the Peninsula.</T>
        <T v="body" tone="ink2" center style={{ maxWidth: 300 }}>The courts open when there are enough of you for it to be worth it. {left} to go.</T>
        <Button title="Bring your team" onPress={onInvite} style={{ marginTop: space.sm, alignSelf: 'stretch' }} />
        <T v="small" tone="ink3" center>One roster code brings a whole team.</T>
      </Sheet>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: space.xl, paddingVertical: space.lg },
  court: { width: 110, height: 200, alignSelf: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.ballDim },
});
