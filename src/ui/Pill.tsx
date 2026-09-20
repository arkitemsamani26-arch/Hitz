import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { color, radius, space } from '@/theme/tokens';

type Tone = 'ball' | 'line' | 'court' | 'faint' | 'white';

export function Pill({ label, tone = 'line', style, on, onPress }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle>; on?: boolean; onPress?: () => void }) {
  const t: Tone = on ? 'ball' : tone;
  const textTone = t === 'ball' ? 'onBall' : t === 'court' ? 'onCourt' : t === 'white' ? 'court' : t === 'faint' ? 'ink2' : 'ink';
  const inner = <View style={[s.pill, s[t], style]}><T v="micro" tone={textTone}>{label}</T></View>;
  if (!onPress) return inner;
  return <Tap onPress={onPress} tick accessibilityRole={on === undefined ? 'button' : 'checkbox'} accessibilityState={on === undefined ? undefined : { checked: !!on }} aria-checked={on === undefined ? undefined : !!on} style={{ minHeight: 40, justifyContent: 'center' }}>{inner}</Tap>;
}
const s = StyleSheet.create({
  pill: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center' },
  ball: { backgroundColor: color.ball },
  line: { borderWidth: 1.5, borderColor: color.hair2, backgroundColor: color.paper },
  court: { backgroundColor: color.court },
  white: { backgroundColor: color.paper },
  faint: { backgroundColor: color.paper2 },
});
