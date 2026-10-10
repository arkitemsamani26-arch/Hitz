// Waiting. A spinner and a sentence; nothing bounces.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { T } from './Text';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

export function Loading({ label = 'Loading' }: { label?: string; a?: string; b?: string }) {
  const t = useTheme();
  return (
    <View style={s.wrap} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={t.muted} />
      <T v="small" tone="muted" center>{label}</T>
    </View>
  );
}
export const Rally = Loading;
const s = StyleSheet.create({ wrap: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl } });
