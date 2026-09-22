// The membership card. Joining a club, not filling a form.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Score } from './Score';
import { Avatar } from './Avatar';
import Animated, { FlipInYRight } from 'react-native-reanimated';
import { color, space } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';

export function MemberCard({ name, level, verified, court, roster, minor, number = '0142', typing, photo, flip }:
  { name: string; level: number | null; verified?: boolean; court: string | null; roster?: string | null; minor?: boolean; number?: string; typing?: 'name' | 'level' | 'court' | null; photo?: string | null; flip?: boolean }) {
  const Line = ({ k, v, blink }: { k: string; v: string; blink?: boolean }) => (
    <View style={{ marginBottom: space.sm }}>
      <T v="micro" tone="ink3">{k}</T>
      <View style={s.val}><T v="h2" tone={v ? 'ink' : 'ink3'} numberOfLines={1} style={{ flexShrink: 1 }}>{v || '—'}</T>{blink && <View style={s.cursor} />}</View>
    </View>
  );
  return (
    <Animated.View style={s.card} entering={flip ? FlipInYRight.springify().damping(14) : undefined}>
      <View style={s.head}>
        <T v="micro" tone="court">Hits · Palo Alto</T>
        <T v="micro" tone="ink3">No. {number}{minor ? ' · U18' : ''}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
        <Avatar name={name || '?'} photo={photo} size={56} ring />
        <View style={{ flex: 1 }}>
          <Line k="Member" v={name} blink={typing === 'name'} />
          <Line k="Home court" v={court ?? ''} blink={typing === 'court'} />
          {roster ? <Line k="Team" v={roster} /> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="micro" tone="ink3">Level</T>
          <Score value={level} size="score" verified={verified} tone="court" animate />
        </View>
      </View>
      <View style={s.stripe} />
    </Animated.View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: color.paper, borderRadius: 18, padding: space.lg, marginBottom: space.md, overflow: 'hidden', ...shadow({ y: 12, blur: 24, color: '#0A2A12', opacity: 0.3 }) },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md },
  val: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: color.paper3, paddingBottom: 2, minHeight: 28 },
  cursor: { width: 2, height: 20, backgroundColor: color.ink, marginLeft: 3 },
  stripe: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: color.court },
});
