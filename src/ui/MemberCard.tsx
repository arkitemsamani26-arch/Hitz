// The player card: deep green in both appearances, the court drawn faintly behind. Your
// face and name, where you play, then the three numbers a partner actually wants: your
// rating, how many hits you have played here, and how reliably you reply. The same card is
// what other players see when they open your profile.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Wordmark } from './Wordmark';
import { Court } from './CourtArt';
import { Avatar } from './Avatar';
import { fixed, font } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';
import { levelBig } from '@/lib/format';
import { sourceLabel } from './Score';
import type { LevelSource } from '@/data/types';

export type CardStat = { value: string; label: string };

export function MemberCard({ name, lastInitial, photo, level, source, verified, area = 'Palo Alto', court, age, looking, line, stats, style, typing, eyebrow = 'Player card' }:
  { name: string; lastInitial?: string | null; photo?: string | null; level: number | null; source?: LevelSource | null; verified?: boolean;
    area?: string; court?: string | null; age?: number | null; looking?: boolean; line?: string | null;
    // The numbers beside the rating. Two is right; three fits.
    stats?: CardStat[];
    style?: StyleProp<ViewStyle>;
    // The onboarding name step types into the card; an empty name shows the placeholder.
    typing?: boolean; eyebrow?: string;
    // Old props, accepted and ignored.
    roster?: string | null; minor?: boolean; number?: string; flip?: boolean }) {
  const shown = name || (typing ? 'Your name' : '—');
  const where = [area, court].filter(Boolean).join(' · ');
  const all: CardStat[] = [{ value: levelBig(level), label: sourceLabel(source, verified) }, ...(stats ?? [])];
  return (
    <View style={[s.card, style]} accessible
      accessibilityLabel={`Player card. ${(name || 'No name yet').replace(/\.$/, '')}${age != null ? `, ${age}` : ''}. ${where}. ${all.map(x => `${x.label} ${x.value}`).join(', ')}.${looking ? ' Looking to hit this week.' : ''}${line ? ` ${line}` : ''}`}>
      <View style={s.art} pointerEvents="none"><Court width={150} height={280} color={fixed.art} /></View>
      <View style={s.top}>
        <Wordmark size={22} tone="light" />
        <T v="micro" tone="memberMeta" style={{ letterSpacing: 1.8, fontSize: 10 }}>{eyebrow}</T>
      </View>

      <View style={s.who}>
        <Avatar name={name || '?'} lastInitial={lastInitial} photo={photo} size={66} onDark ring />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="score" tone={name ? 'memberText' : 'memberMeta'} style={{ fontSize: 30, lineHeight: 34 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{shown}</T>
          <T v="meta" tone="memberMeta" numberOfLines={1} style={{ marginTop: 3 }}>{where}</T>
          {age != null && (
            <View style={s.age}><T v="meta" tone="memberText" style={{ fontFamily: font.medium, fontSize: 11, lineHeight: 14 }}>Age {age}</T></View>
          )}
        </View>
      </View>

      <View style={s.stats}>
        {all.slice(0, 3).map((x, i) => (
          <View key={x.label + i} style={[s.stat, i > 0 && s.statRule]}>
            <T v="rating" tone="memberText" style={{ fontSize: i === 0 ? 30 : 24, lineHeight: 34, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{x.value}</T>
            <T v="micro" tone="memberMeta" style={{ fontSize: 10, lineHeight: 13, letterSpacing: 1.1, marginTop: 2 }} numberOfLines={1}>{x.label}</T>
          </View>
        ))}
      </View>

      {(looking || line) && (
        <View style={s.foot}>
          {looking && (
            <View style={s.looking}>
              <View style={s.dot} />
              <T v="meta" tone="memberText" style={{ fontFamily: font.medium }}>Looking to hit this week</T>
            </View>
          )}
          {!!line && <T v="meta" tone="memberMeta" numberOfLines={2}>{line}</T>}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: fixed.member, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: fixed.memberLine, overflow: 'hidden', ...shadow({ y: 11, blur: 24, color: '#10221A', opacity: 0.08 }) },
  art: { position: 'absolute', right: -20, top: -6, opacity: 0.55 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  age: { alignSelf: 'flex-start', marginTop: 7, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(223,255,79,0.16)', borderWidth: 1, borderColor: 'rgba(223,255,79,0.35)' },
  stats: { flexDirection: 'row', marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: fixed.memberRule },
  stat: { flex: 1, minWidth: 0 },
  statRule: { paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: fixed.memberRule },
  foot: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: fixed.memberRule, gap: 6 },
  looking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: fixed.dot },
});

// The stats a card shows for anyone: hits played here, and how often they reply. Both are
// counted by the server; neither is shown as a number until there is something to count.
// A brand-new player with one invitation they have not got to yet is not a 0% replier;
// they are new, and the card says so until there is a reply or a hit to count.
export function cardStats(p: { hitsConfirmed: number; responseRate: number | null }): CardStat[] {
  const fresh = p.responseRate == null || (p.responseRate === 0 && p.hitsConfirmed === 0);
  return [
    { value: String(p.hitsConfirmed), label: p.hitsConfirmed === 1 ? 'Hit played' : 'Hits played' },
    { value: fresh ? 'New' : `${Math.round(p.responseRate! * 100)}%`, label: fresh ? 'On Hits' : 'Replies' },
  ];
}
