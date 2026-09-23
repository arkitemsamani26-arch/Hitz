// When you can hit, as a grid rather than six pills in a wrap.
//
// The pills carried the same information and read as a form: six identical lozenges,
// each having to spell out "Weekday morning" because nothing about their position said
// it. A two-by-three grid says weekday/weekend down the side and morning/afternoon/
// evening across the top, so each cell only has to be a cell -- and you can see your
// whole week in one glance instead of reading six labels.
//
// The arc over each column is the sun through the day: low left, overhead, low right.
// Same idea as the sky on every screen, and it is what stops this looking like a form.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Pop } from './Pop';
import { color, hit, radius, space } from '@/theme/tokens';
import { SLOTS } from '@/data/types';

const COLS = [
  { part: 'Morning', when: 'before 12', sun: 0.12 },
  { part: 'Afternoon', when: '12 to 5', sun: 0.5 },
  { part: 'Evening', when: 'after 5', sun: 0.88 },
] as const;
const ROWS = [
  { label: 'Weekdays', sub: 'Mon–Fri', bits: [1, 2, 4] },
  { label: 'Weekend', sub: 'Sat & Sun', bits: [8, 16, 32] },
] as const;

export const ALL_SLOTS = SLOTS.reduce((m, s) => m | s.bit, 0);

// The sun's height over the day: low at the edges, overhead at midday.
function SunArc({ at, on }: { at: number; on: boolean }) {
  const lift = Math.sin(at * Math.PI);   // overhead at midday, low at both ends
  return (
    <View style={s.arc} pointerEvents="none">
      <View style={[s.horizon, on && { backgroundColor: 'rgba(14,27,51,0.22)' }]} />
      <View style={[s.sun, { left: `${at * 100}%`, bottom: 3 + lift * 14 }, on && { backgroundColor: color.ink }]} />
    </View>
  );
}

export function AvailabilityGrid({ mask, onToggle }: { mask: number; onToggle: (bit: number) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={s.row}>
        <View style={s.rowHead} />
        {COLS.map(c => (
          <View key={c.part} style={s.colHead}>
            {/* No opacity on the second line: ink3 is tuned to land at 5.3:1 on paper and
                0.7 of it is 3.5:1, under AA. Size and weight separate these two, not alpha. */}
            <T v="micro" tone="ink3">{c.part.toUpperCase()}</T>
            <T v="micro" tone="ink3">{c.when}</T>
          </View>
        ))}
      </View>
      {ROWS.map(r => (
        <View key={r.label} style={s.row}>
          <View style={s.rowHead}>
            <T v="smallM" tone="ink">{r.label}</T>
            <T v="micro" tone="ink3">{r.sub}</T>
          </View>
          {r.bits.map((bit, i) => {
            const on = !!(mask & bit);
            return (
              <Pop key={bit} on={on} style={s.cellWrap}>
                <Tap onPress={() => onToggle(bit)} tick style={[s.cell, on && s.cellOn]}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on}
                  accessibilityLabel={`${r.label} ${COLS[i].part}`}>
                  <SunArc at={COLS[i].sun} on={on} />
                </Tap>
              </Pop>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowHead: { width: 84 },
  colHead: { flex: 1, alignItems: 'center', gap: 1 },
  cellWrap: { flex: 1 },
  cell: {
    height: hit.min + 6, borderRadius: radius.md, backgroundColor: color.paper2,
    borderWidth: 2, borderColor: 'transparent', justifyContent: 'flex-end', overflow: 'hidden',
  },
  cellOn: { backgroundColor: color.ball, borderColor: color.ink },
  arc: { height: 28, marginBottom: 7, marginHorizontal: 9 },
  horizon: { position: 'absolute', left: 0, right: 0, bottom: 3, height: 1.5, borderRadius: 1, backgroundColor: 'rgba(14,27,51,0.18)' },
  sun: { position: 'absolute', width: 11, height: 11, borderRadius: 6, marginLeft: -5.5, backgroundColor: 'rgba(14,27,51,0.3)' },
});
