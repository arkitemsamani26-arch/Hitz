import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { color, hit, radius, space } from '@/theme/tokens';

type Kind = 'court' | 'ball' | 'line' | 'ghost' | 'danger' | 'white';

export function Button({ title, onPress, kind = 'court', disabled, loading, style, small }:
  { title: string; onPress?: () => void; kind?: Kind; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const off = disabled || loading;
  const tone = kind === 'court' ? 'onCourt' : kind === 'ball' ? 'onBall' : kind === 'danger' ? 'danger' : kind === 'white' ? 'court' : 'ink';
  return (
    <Tap onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: off }}
      style={[s.base, s[kind], small && s.small, off && s.off, style]}>
      {loading ? <ActivityIndicator color={color[tone]} />
        : <T v={small ? 'smallM' : 'bodyM'} tone={tone}>{title}</T>}
    </Tap>
  );
}
const s = StyleSheet.create({
  base: { minHeight: hit.min + 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, flexDirection: 'row' },
  // 'small' is the shape, not the target. Pass, Counter, I'm in and the guardian's
  // Approve/Remove pair all use it, and 40 is under every platform's minimum.
  small: { minHeight: hit.min, paddingHorizontal: space.lg },
  court: { backgroundColor: color.court },
  ball: { backgroundColor: color.ball },
  white: { backgroundColor: color.paper },
  line: { borderWidth: 1.5, borderColor: color.hair2, backgroundColor: color.paper },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: color.dangerDim },
  off: { opacity: 0.45 },
});
