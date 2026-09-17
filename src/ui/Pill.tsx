import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { color, radius, space } from '@/theme/tokens';

type Tone = 'ball' | 'line' | 'cyan' | 'faint';

export function Pill({ label, tone = 'line', style, on, onPress }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle>; on?: boolean; onPress?: () => void }) {
  const t = on ? 'ball' : tone;
  const inner = (
    <View style={[s.pill, s[t], style]}>
      <T v="micro" tone={t === 'ball' ? 'onBall' : t === 'cyan' ? 'cyan' : t === 'faint' ? 'ink3' : 'ink2'}>{label}</T>
    </View>
  );
  if (!onPress) return inner;
  return <Tap onPress={onPress} tick accessibilityRole="button" accessibilityState={{ selected: !!on }} style={{ minHeight: 40, justifyContent: 'center' }}>{inner}</Tap>;
}

const s = StyleSheet.create({
  pill: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center' },
  ball: { backgroundColor: color.ball },
  line: { borderWidth: 1, borderColor: color.lineStrong },
  cyan: { backgroundColor: color.cyanDim },
  faint: { backgroundColor: color.lineFaint },
});
