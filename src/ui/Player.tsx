// Players, three ways: the featured card, the compact row, and the profile header.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Pill } from './Pill';
import { Score } from './Score';
import { Card } from './Screen';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { fixed, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { activeText } from '@/lib/format';
import { gapLine, gapShort, metaLine, overlapLine, tagLine } from '@/lib/match';
import { slotsOf, slotsSummary, type Player, type Profile } from '@/data/types';
import type { Window } from '@/store/window';
import { shadow } from '@/lib/shadow';

export function name(p: Pick<Player, 'displayName' | 'lastInitial'>) { return p.lastInitial ? `${p.displayName} ${p.lastInitial}.` : p.displayName; }

// The featured card: sage stripe, arched monogram, serif name, the rating at the right,
// one honest line about when you are both free, and the green strip that invites.
export function FeaturedCard({ p, me, win, onInvite, onOpen, locked, lockedLabel }:
  { p: Player; me: Profile; win: Window; onInvite: () => void; onOpen: () => void; locked?: boolean; lockedLabel?: string }) {
  const t = useTheme();
  const s = useS();
  const when = overlapLine(me, p, win);
  return (
    <View style={s.card}>
      <View style={s.stripe} />
      <View style={s.main}>
        <T v="micro" tone="muted" style={{ marginBottom: 14, letterSpacing: 1.25 }}>{tagLine(me, p)}</T>
        <Tap onPress={onOpen} style={s.top} accessibilityRole="button" accessibilityLabel={`${name(p)}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating yet'}. ${metaLine(p)}. Open profile.`}>
          <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h1" style={{ lineHeight: 28 }}>{name(p)}</T>
            {!!metaLine(p) && <T v="meta" tone="muted" style={{ marginTop: 5 }}>{metaLine(p)}</T>}
          </View>
          <Score value={p.levelValue} size="rating" source={p.levelSource} verified={p.levelVerified} />
        </Tap>
        <View style={s.compat}>
          <Icon name={when.known ? 'calendar-check-2' : 'calendar'} size={16} color={t.ink} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <T v="smallM">{when.text}</T>
            <T v="meta" tone="muted" style={{ marginTop: 3 }}>{gapLine(me, p)}</T>
          </View>
        </View>
      </View>
      <Tap onPress={onInvite} disabled={locked} style={[s.invite, locked && { opacity: 0.55 }]} accessibilityRole="button" accessibilityState={{ disabled: !!locked }} accessibilityLabel={locked ? lockedLabel ?? 'Inviting is locked' : `Invite ${p.displayName} to hit`}>
        <T v="smallM" tone="greenText">{locked ? lockedLabel ?? 'Inviting is locked' : 'Invite to hit'}</T>
        <Icon name="arrow-up-right" size={17} color={t.greenText} />
      </Tap>
    </View>
  );
}

// The quieter row: round monogram, sans name, a line of meta, the rating in the sans.
export function CompactRow({ p, onPress, first }: { p: Player; onPress: () => void; first?: boolean }) {
  const s = useS();
  const line = p.prefers ? [p.prefers, slotsOf(p.availabilityMask)[0]].filter(Boolean).join(' · ') : [p.homeCourtName ?? p.distanceBucket, slotsOf(p.availabilityMask)[0]].filter(Boolean).join(' · ');
  return (
    <Tap onPress={onPress} style={[s.row, !first && s.rowRule]} accessibilityRole="button" accessibilityLabel={`${name(p)}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating yet'}. ${line}. Open profile.`}>
      <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={36} shape="round" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="smallM" numberOfLines={1}>{name(p)}</T>
        <T v="meta" tone="muted" numberOfLines={1}>{line || activeText(p.lastActiveAt)}</T>
      </View>
      <Score value={p.levelValue} source={p.levelSource} verified={p.levelVerified} sans />
    </Tap>
  );
}

// The profile header. The same identity row as the featured card, on a plain panel.
export function PlayerCard({ p, anonymous, me }: { p: Player; anonymous?: boolean; me?: Profile | null; tall?: boolean }) {
  const free = slotsOf(p.availabilityMask);
  return (
    <Card>
      <View style={st.top}>
        <Avatar name={anonymous ? '?' : p.displayName} lastInitial={anonymous ? null : p.lastInitial} photo={anonymous ? null : p.photoUrl} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h1" style={{ lineHeight: 28 }}>{anonymous ? 'A player' : name(p)}</T>
          <T v="meta" tone="muted" style={{ marginTop: 5 }}>{metaLine(p) || activeText(p.lastActiveAt)}</T>
        </View>
        <Score value={p.levelValue} size="rating" source={p.levelSource} verified={p.levelVerified} />
      </View>
      <View style={st.tags}>
        {p.lookingToHit && <Pill label="Looking to hit this week" icon="calendar-check-2" />}
        <Pill label={activeText(p.lastActiveAt)} />
        {me && gapShort(me, p) && <Pill label={gapShort(me, p)!} />}
      </View>
      {free.length > 0 && <T v="meta" tone="muted" style={{ marginTop: space.md }}>Usually free: {slotsSummary(p.availabilityMask).toLowerCase()}</T>}
    </Card>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: space.lg },
});
const useS = makeStyles(c => ({
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.xl, overflow: 'hidden', ...shadow({ y: 7, blur: 14, color: c.shadow, opacity: 0.035 }) },
  stripe: { height: 4, backgroundColor: fixed.stripe },
  main: { paddingTop: 17, paddingHorizontal: 17, paddingBottom: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  compat: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', marginTop: 17, paddingTop: 15, borderTopWidth: 1, borderTopColor: c.line },
  invite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, paddingVertical: 13, paddingHorizontal: 17, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, paddingHorizontal: 2, minHeight: hit.row },
  rowRule: { borderTopWidth: 1, borderTopColor: c.line },
}));
