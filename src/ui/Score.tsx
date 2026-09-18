import React from 'react';
import { View } from 'react-native';
import { T } from './Text';
import { levelBig } from '@/lib/format';

export function Score({ value, size = 'display', verified, tone = 'ink' }: { value: number | null; size?: 'score' | 'display' | 'h1'; verified?: boolean; tone?: 'ink' | 'ball' | 'onBall' | 'court' | 'onCourt' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
      <T v={size} tone={tone} style={{ fontVariant: ['tabular-nums'] }}>{levelBig(value)}</T>
      {verified && <T v="micro" tone={tone === 'onCourt' ? 'onCourt' : 'court'} style={{ marginTop: 6 }}>UTR</T>}
    </View>
  );
}
