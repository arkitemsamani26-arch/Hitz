// The cohort-closed state: the courts open when enough of you are here. Not an error.
import React from 'react';
import { View } from 'react-native';
import { T } from './Text';
import { Button } from './Button';
import { Card } from './Screen';
import { space } from '@/theme/tokens';
import type { MarketStatus } from '@/data/types';

export function Countdown({ m, onInvite }: { m: MarketStatus; onInvite: () => void }) {
  const who = m.band === 'minor' ? 'juniors' : 'players';
  const left = Math.max(0, m.minActivePlayers - m.activePlayers);
  return (
    <Card style={{ gap: space.sm }}>
      <T v="micro" tone="muted">Almost open</T>
      <T v="h1">{m.activePlayers} of {m.minActivePlayers} {who}{'\n'}on the Peninsula.</T>
      <T v="body" tone="muted">The courts open when there are enough of you for it to be worth it. {left} to go.</T>
      <Button title="Bring your team" arrow onPress={onInvite} style={{ marginTop: space.sm }} />
      <T v="meta" tone="muted">One roster code brings a whole team.</T>
    </Card>
  );
}
