// The next seven days in a row, the way a calendar app opens: today first, a dot under any
// day with a hit on it, solid when it is confirmed. Tapping a day with a hit opens it.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { font, radius } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import type { HitRequest } from '@/data/types';

const LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WeekStrip({ hits, onOpen }: { hits: HitRequest[]; onOpen: (r: HitRequest) => void }) {
  const s = useS();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
  const on = (d: Date) => hits.filter(r => { const x = new Date(r.windowStart); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); })
    .sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  return (
    <View style={st.row} accessibilityRole="list" accessibilityLabel="The next seven days">
      {days.map((d, i) => {
        const list = on(d);
        const confirmed = list.some(r => r.state === 'confirmed');
        const label = `${i === 0 ? 'Today' : LONG[d.getDay()]} ${d.getDate()}: ${list.length === 0 ? 'nothing on' : `${list.length} ${list.length === 1 ? 'hit' : 'hits'}${confirmed ? ', confirmed' : ', not confirmed yet'}`}`;
        const body = (
          <>
            <T v="meta" tone={i === 0 ? 'greenText' : 'muted'} style={{ fontSize: 11 }}>{i === 0 ? 'Today' : LETTERS[d.getDay()]}</T>
            <T v="bodyM" tone={i === 0 ? 'greenText' : 'ink'} style={{ fontFamily: font.bold, fontSize: 17 }}>{d.getDate()}</T>
            <View style={[s.dot, list.length > 0 && (confirmed ? (i === 0 ? s.dotOnToday : s.dotOn) : s.dotOpen)]} />
          </>
        );
        return list.length
          ? <Tap key={i} onPress={() => onOpen(list[0])} style={[s.day, i === 0 && s.today]} scaleTo={0.95} accessibilityRole="button" accessibilityLabel={`${label}. Open.`}>{body}</Tap>
          : <View key={i} style={[s.day, i === 0 && s.today]} accessible accessibilityLabel={label}>{body}</View>;
      })}
    </View>
  );
}
const st = StyleSheet.create({ row: { flexDirection: 'row', gap: 5, marginBottom: 22 } });
const useS = makeStyles(c => ({
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: 66 },
  today: { backgroundColor: c.green, borderColor: c.green },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  dotOn: { backgroundColor: c.green },
  dotOnToday: { backgroundColor: c.greenText },
  dotOpen: { borderWidth: 1.5, borderColor: c.muted },
}));
