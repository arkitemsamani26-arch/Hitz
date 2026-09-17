// The cohort-closed state. A countdown to something good, not an error message.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { CourtLines } from './Court';
import { Button } from './Button';
import { color, space } from '@/theme/tokens';
import type { MarketStatus } from '@/data/types';

export function Countdown({ m, onInvite }: { m: MarketStatus; onInvite: () => void }) {
  const who = m.band === 'minor' ? 'juniors' : 'players';
  const left = Math.max(0, m.minActivePlayers - m.activePlayers);
  const frac = Math.min(1, m.activePlayers / m.minActivePlayers);
  return (
    <View style={s.wrap}>
      <View style={s.court}><CourtLines width={150} opacity={0.22} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <T v="score" tone="ball">{m.activePlayers}</T>
        <T v="h2" tone="ink2" style={{ marginBottom: 12 }}>/ {m.minActivePlayers}</T>
      </View>
      <T v="h2" center>{who} in {m.marketName}.</T>
      <View style={s.track}><View style={[s.fill, { width: `${frac * 100}%` }]} /></View>
      <T v="body" tone="ink2" center style={{ maxWidth: 320 }}>
        We open the courts when there's enough of you for it to be worth it. {left} to go.
      </T>
      <Button title="Bring a hitting partner" onPress={onInvite} />
      <T v="small" tone="ink3" center>Every code you hand out moves that number.</T>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingVertical: space.xxl },
  court: { marginBottom: space.md },
  track: { width: 220, height: 4, backgroundColor: color.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: color.ball },
});
