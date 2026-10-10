// A rating, in the serif, with what it is underneath. "UTR" when it came from UTR; "UTR ·
// self" when the player typed it; "about" when it is our estimate from a self-assessment.
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { T, type Tone } from './Text';
import { levelBig } from '@/lib/format';
import { font } from '@/theme/tokens';
import type { LevelSource } from '@/data/types';

export function sourceLabel(source: LevelSource | null | undefined, verified?: boolean) {
  if (verified || source === 'utr_verified') return 'UTR';
  if (source === 'utr_self') return 'UTR · SELF';
  if (source === 'estimated') return 'ABOUT';
  return 'UTR';
}

export function Score({ value, size = 'rating', verified, source, tone = 'ink', labelTone, sans, align = 'right', style }:
  { value: number | null; size?: 'score' | 'rating' | 'display' | 'h1' | 'h2'; verified?: boolean; source?: LevelSource | null;
    tone?: Tone; labelTone?: Tone; sans?: boolean; align?: 'left' | 'right'; style?: StyleProp<ViewStyle>; animate?: boolean }) {
  return (
    <View style={[{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }, style]}>
      <T v={size} tone={tone} style={[{ fontVariant: ['tabular-nums'] }, sans && { fontFamily: font.medium, fontSize: 18, lineHeight: 22, letterSpacing: -0.4 }]}>{levelBig(value)}</T>
      <T v="micro" tone={labelTone ?? 'muted'} style={{ letterSpacing: 1, marginTop: sans ? 0 : 4, fontSize: 10, lineHeight: 13 }}>{sourceLabel(source, verified)}</T>
    </View>
  );
}
