// A player's usual week in six squares: weekdays and weekends across, mornings, afternoons
// and evenings down. Solid where you are both free, outlined where only they are.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { makeStyles } from '@/theme/theme';

const ROWS = [{ label: 'AM', bits: [1, 8] }, { label: 'PM', bits: [2, 16] }, { label: 'Eve', bits: [4, 32] }];

export function WeekGrid({ mask, mine }: { mask: number; mine: number }) {
  const s = useS();
  return (
    <View style={st.grid} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={st.row}>
        <View style={st.lab} />
        <T v="meta" tone="muted" style={st.head}>Wkday</T>
        <T v="meta" tone="muted" style={st.head}>Wkend</T>
      </View>
      {ROWS.map(r => (
        <View key={r.label} style={st.row}>
          <T v="meta" tone="muted" style={st.lab}>{r.label}</T>
          {r.bits.map(b => (
            <View key={b} style={[s.cell, mask & b ? (mine & b ? s.both : s.theirs) : null]} />
          ))}
        </View>
      ))}
    </View>
  );
}
const st = StyleSheet.create({
  grid: { gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lab: { width: 24, fontSize: 9, lineHeight: 11 },
  head: { width: 30, fontSize: 9, lineHeight: 11, textAlign: 'center' },
});
const useS = makeStyles(c => ({
  cell: { width: 30, height: 12, borderRadius: 3, backgroundColor: c.soft },
  theirs: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.green },
  both: { backgroundColor: c.green },
}));
