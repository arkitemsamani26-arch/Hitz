import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { color, hit, radius, space } from '@/theme/tokens';

type Kind = 'ball' | 'line' | 'ghost' | 'danger';

export function Button({ title, onPress, kind = 'ball', disabled, loading, style, small }:
  { title: string; onPress?: () => void; kind?: Kind; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const off = disabled || loading;
  return (
    <Tap
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      style={[s.base, s[kind], small && s.small, off && s.off, style]}
    >
      {loading
        ? <ActivityIndicator color={kind === 'ball' ? color.onBall : color.ink} />
        : <T v={small ? 'smallM' : 'bodyM'} tone={kind === 'ball' ? 'onBall' : kind === 'danger' ? 'danger' : 'ink'} style={s.label}>{title}</T>}
    </Tap>
  );
}

const s = StyleSheet.create({
  base: { minHeight: hit.min + 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, flexDirection: 'row' },
  small: { minHeight: 40, paddingHorizontal: space.lg },
  ball: { backgroundColor: color.ball },
  line: { borderWidth: 1.5, borderColor: color.lineStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { borderWidth: 1.5, borderColor: color.dangerDim, backgroundColor: color.dangerDim },
  off: { opacity: 0.45 },
  label: { letterSpacing: 0.2 },
});

export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: space.md }}>{children}</View>;
}
