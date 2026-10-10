// Pick a window: which day, when it starts, how long. Chips, in the panel's own language.
// Used under the availability panel on Discover and in the invitation review.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Pill } from './Pill';
import { Button } from './Button';
import { space } from '@/theme/tokens';
import { dayShort, timeShort } from '@/lib/format';
import type { Window } from '@/store/window';

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const LENGTHS = [{ min: 60, label: '1 hr' }, { min: 90, label: '1½ hrs' }, { min: 120, label: '2 hrs' }];

export function WindowEditor({ value, onChange, onDone, doneLabel = 'Done' }: { value: Window; onChange: (w: Window) => void; onDone?: () => void; doneLabel?: string }) {
  // Today stays on the list until the evening is gone.
  const days = useMemo(() => {
    const out: Date[] = [];
    const now = new Date();
    for (let i = now.getHours() >= 20 ? 1 : 0; out.length < 8; i++) { const d = new Date(); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); out.push(d); }
    return out;
  }, []);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const setDay = (d: Date) => { const s = new Date(d); s.setHours(value.start.getHours(), value.start.getMinutes(), 0, 0); onChange({ ...value, start: s }); };
  const setHour = (h: number) => { const s = new Date(value.start); s.setHours(h, 0, 0, 0); onChange({ ...value, start: s }); };
  const at = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return timeShort(d); };
  return (
    <View style={s.wrap}>
      <T v="micro" tone="muted">Day</T>
      <View style={s.row}>{days.map(d => <Pill key={d.toISOString()} label={dayShort(d)} on={same(d, value.start)} onPress={() => setDay(d)} />)}</View>
      <T v="micro" tone="muted" style={s.k}>Start</T>
      <View style={s.row}>{HOURS.map(h => <Pill key={h} label={at(h)} on={value.start.getHours() === h} onPress={() => setHour(h)} />)}</View>
      <T v="micro" tone="muted" style={s.k}>Length</T>
      <View style={s.row}>{LENGTHS.map(l => <Pill key={l.min} label={l.label} on={value.durMin === l.min} onPress={() => onChange({ ...value, durMin: l.min })} />)}</View>
      {onDone && <Button title={doneLabel} kind="line" small onPress={onDone} style={{ alignSelf: 'flex-start', marginTop: space.md }} />}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  k: { marginTop: space.sm },
});
