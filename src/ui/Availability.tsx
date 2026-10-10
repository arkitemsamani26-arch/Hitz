// When you usually play, as a two-by-three grid: weekday and weekend down the side,
// morning, afternoon and evening across. A chosen cell goes green with a tick.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { SLOTS } from '@/data/types';

const COLS = [
  { part: 'Morning', when: 'before 12' },
  { part: 'Afternoon', when: '12 to 5' },
  { part: 'Evening', when: 'after 5' },
] as const;
const ROWS = [
  { label: 'Weekdays', sub: 'Mon–Fri', bits: [1, 2, 4] },
  { label: 'Weekend', sub: 'Sat & Sun', bits: [8, 16, 32] },
] as const;

export const ALL_SLOTS = SLOTS.reduce((m, s) => m | s.bit, 0);

export function AvailabilityGrid({ mask, onToggle }: { mask: number; onToggle: (bit: number) => void }) {
  const t = useTheme();
  const s = useS();
  return (
    <View style={{ gap: space.sm }}>
      <View style={st.row}>
        <View style={st.rowHead} />
        {COLS.map(c => (
          <View key={c.part} style={st.colHead}>
            <T v="micro" tone="muted">{c.part}</T>
            <T v="meta" tone="muted">{c.when}</T>
          </View>
        ))}
      </View>
      {ROWS.map(r => (
        <View key={r.label} style={st.row}>
          <View style={st.rowHead}>
            <T v="smallM">{r.label}</T>
            <T v="meta" tone="muted">{r.sub}</T>
          </View>
          {r.bits.map((bit, i) => {
            const on = !!(mask & bit);
            return (
              <Tap key={bit} onPress={() => onToggle(bit)} tick style={[s.cell, on && s.cellOn]}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on}
                accessibilityLabel={`${r.label} ${COLS[i].part}`}>
                {on && <Icon name="check" size={16} color={t.greenText} strokeWidth={2} />}
              </Tap>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowHead: { width: 84 },
  colHead: { flex: 1, alignItems: 'center', gap: 1 },
});
const useS = makeStyles(c => ({
  cell: { flex: 1, height: hit.min + 4, borderRadius: radius.md, backgroundColor: c.soft, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: c.green, borderColor: c.green },
}));
