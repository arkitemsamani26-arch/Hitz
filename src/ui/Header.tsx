import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { hit, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { useGoBack } from '@/lib/nav';

// A quiet row: a muted "← Back" on the left, an optional title, a slot on the right.
export function Header({ title, right, back = true, kicker, backLabel = 'Back', fallback }:
  { title?: string; right?: React.ReactNode; back?: boolean; kicker?: string; backLabel?: string; fallback?: string }) {
  const t = useTheme();
  const goBack = useGoBack(fallback);
  return (
    <View style={s.row}>
      {back ? (
        <Tap onPress={goBack} style={s.back} accessibilityRole="button" accessibilityLabel={backLabel}>
          <Icon name="arrow-left" size={15} color={t.muted} />
          <T v="small" tone="muted">{backLabel}</T>
        </Tap>
      ) : <View style={s.back} />}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {kicker && <T v="micro" tone="muted">{kicker}</T>}
        {title && <T v="bodyM" numberOfLines={1}>{title}</T>}
      </View>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.min },
  back: { minHeight: hit.min, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: space.sm, paddingRight: space.md, minWidth: 56 },
  side: { minWidth: 56, minHeight: hit.min, justifyContent: 'center' },
});
