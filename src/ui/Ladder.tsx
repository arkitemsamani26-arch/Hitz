// An anonymous read of a cohort: how many players sit around your level, without naming
// one of them. Used on the peek screen, before a profile exists and before anyone is
// allowed to see who is out there. One dot per player, a dozen at most; the count is the
// only fact, and it is a true one.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from './Screen';
import { T } from './Text';
import { Court } from './CourtArt';
import { space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';

export function Ladder({ count, label }: { count: number; label: string }) {
  const t = useTheme();
  const s = useS();
  const n = Math.min(12, Math.max(0, count));
  return (
    <Card style={{ overflow: 'hidden' }}>
      <View style={st.art} pointerEvents="none"><Court color={t.line} width={120} height={200} /></View>
      <View accessible accessibilityLabel={`${count} ${label} around your level`}>
        <T v="micro" tone="muted">Around your level</T>
        <T v="display" style={{ marginTop: 4 }}>{count}</T>
        <T v="body" tone="muted">{label} near Palo Alto</T>
        <View style={st.dots}>
          {Array.from({ length: n }, (_, i) => <View key={i} style={s.dot} />)}
          <View style={s.you} />
        </View>
        <T v="meta" tone="muted" style={{ marginTop: space.sm }}>{n === 0 ? 'The court fills up as players join.' : 'The green one is you.'}</T>
      </View>
    </Card>
  );
}
const st = StyleSheet.create({
  art: { position: 'absolute', right: -30, top: -20, opacity: 0.6 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.lg, maxWidth: 220 },
});
const useS = makeStyles(c => ({
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: c.soft, borderWidth: 1, borderColor: c.line },
  you: { width: 14, height: 14, borderRadius: 7, backgroundColor: c.green },
}));
