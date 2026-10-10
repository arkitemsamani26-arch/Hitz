// The player card: deep green in both appearances, light lettering, the court drawn
// faintly behind. The Hits wordmark top left, PLAYER CARD top right, a deliberate gap,
// then the name at 34px. Under a thin rule: area and a line on the left, the rating on the
// right. Nothing else: no number, no hologram, no tilt.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Wordmark } from './Wordmark';
import { Score } from './Score';
import { Court } from './CourtArt';
import { fixed } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';
import type { LevelSource } from '@/data/types';

export function MemberCard({ name, level, source, verified, area = 'Palo Alto', line = 'Here for a good hit.', style, typing, eyebrow = 'Player card' }:
  { name: string; level: number | null; source?: LevelSource | null; verified?: boolean; area?: string; line?: string; style?: StyleProp<ViewStyle>;
    // The onboarding name step types into the card; an empty name shows the placeholder.
    typing?: boolean; eyebrow?: string;
    // Old props, accepted and ignored.
    court?: string | null; roster?: string | null; minor?: boolean; number?: string; photo?: string | null; flip?: boolean }) {
  return (
    <View style={[s.card, style]} accessible accessibilityLabel={`Player card. ${name || 'No name yet'}. ${area}. ${level != null ? `Rating ${level.toFixed(1)}` : 'No rating yet'}.`}>
      <View style={s.art} pointerEvents="none"><Court width={142} height={265} color={fixed.art} /></View>
      <View style={s.top}>
        <Wordmark size={30} tone="light" />
        <T v="micro" tone="memberMeta" style={{ letterSpacing: 1.8 }}>{eyebrow}</T>
      </View>
      <T v="score" tone={name ? 'memberText' : 'memberMeta'} style={{ fontSize: 34, lineHeight: 39 }} numberOfLines={2}>{name || (typing ? 'Your name' : '—')}</T>
      <View style={s.bottom}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="micro" tone="memberMeta" style={{ letterSpacing: 1.8 }}>{area}</T>
          <T v="meta" tone="memberMeta">{line}</T>
        </View>
        <Score value={level} size="score" source={source} verified={verified} tone="memberText" labelTone="memberMeta" />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: fixed.member, borderRadius: 16, padding: 23, borderWidth: 1, borderColor: fixed.memberLine, overflow: 'hidden', ...shadow({ y: 11, blur: 24, color: '#10221A', opacity: 0.07 }) },
  art: { position: 'absolute', right: -3, top: 34, opacity: 0.65 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 45 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: fixed.memberRule, paddingTop: 15, marginTop: 19 },
});
