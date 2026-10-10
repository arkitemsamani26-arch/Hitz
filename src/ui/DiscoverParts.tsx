// The top of Discover, as parts: the header row, the hero, the window panel. The real
// screen and the design preview both compose these, so the two cannot drift apart.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Wordmark } from './Wordmark';
import { Court, Ball } from './CourtArt';
import { Icon } from './Icon';
import { fixed } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { shadow } from '@/lib/shadow';
import { dayLong, monthShort, rangeText } from '@/lib/format';
import { endOf } from '@/lib/match';
import type { Window } from '@/store/window';

export function DiscoverHeader({ initials, area, onAccount }: { initials: string; area: string; onAccount: () => void }) {
  const s = useS();
  return (
    <View style={st.header}>
      <Wordmark />
      <View style={st.headerRight}>
        <T v="micro" tone="ink" style={{ letterSpacing: 1.3, fontSize: 10 }}>{area.toUpperCase()}, CA</T>
        <Tap onPress={onAccount} style={s.account} accessibilityRole="button" accessibilityLabel="Your club card">
          <T v="h2" style={{ fontSize: 15, lineHeight: 18 }}>{initials}</T>
        </Tap>
      </View>
    </View>
  );
}

// Deep green, a fine inset border, the court cropped at the right, the ball low right.
export function Hero() {
  return (
    <View style={st.hero}>
      <View style={st.inset} pointerEvents="none" />
      <View style={st.art}><Court /></View>
      <View style={st.ball}><Ball /></View>
      <T v="eyebrow" tone="heroEyebrow" style={{ marginBottom: 13 }}>Good people. Great tennis.</T>
      <T v="hero" tone="heroText" accessibilityRole="header">Find your{'\n'}<T v="hero" tone="heroEm" italic>kind of tennis.</T></T>
      <T v="meta" tone="heroCopy" style={st.caption}>A good partner. A court nearby.{'\n'}Something to look forward to.</T>
    </View>
  );
}

export function WindowPanel({ win, editing, onEdit }: { win: Window; editing: boolean; onEdit: () => void }) {
  const t = useTheme();
  const s = useS();
  return (
    <View style={s.window}>
      <View style={s.date}>
        <T v="micro" tone="ink" style={{ fontSize: 10, letterSpacing: 0.8, marginBottom: 4 }}>{monthShort(win.start)}</T>
        <T v="h1" style={{ fontSize: 26, lineHeight: 28 }}>{win.start.getDate()}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="meta" tone="muted" style={{ marginBottom: 4 }}>Your next window</T>
        <T v="smallM">{dayLong(win.start)}, {rangeText(win.start, endOf(win))}</T>
      </View>
      <Tap onPress={onEdit} style={st.edit} accessibilityRole="button" accessibilityLabel="Change your next window" accessibilityState={{ expanded: editing }}>
        <Icon name="sliders-horizontal" size={17} color={t.ink} />
      </Tap>
    </View>
  );
}

export function SectionHead({ title, right, onRight, rightLabel }: { title: string; right: string; onRight?: () => void; rightLabel?: string }) {
  const label = <T v="meta" tone="muted" numberOfLines={1}>{right}</T>;
  return (
    <View style={st.sectionHead}>
      <T v="h1" accessibilityRole="header">{title}</T>
      {onRight ? <Tap onPress={onRight} style={st.range} accessibilityRole="button" accessibilityLabel={rightLabel ?? right}>{label}</Tap> : <View style={st.range}>{label}</View>}
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 19, paddingBottom: 17, paddingHorizontal: 22 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: { backgroundColor: fixed.hero, paddingTop: 25, paddingHorizontal: 24, paddingBottom: 44, minHeight: 218, overflow: 'hidden' },
  inset: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1, borderColor: fixed.heroInset },
  art: { position: 'absolute', right: -38, top: 3 },
  ball: { position: 'absolute', right: 25, bottom: 42 },
  caption: { marginTop: 13, maxWidth: 215, fontSize: 12, lineHeight: 18 },
  edit: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', flexShrink: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 13, flexWrap: 'wrap' },
  range: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
});
const useS = makeStyles(c => ({
  account: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  window: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: -25, marginBottom: 24, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, padding: 13, ...shadow({ y: 7, blur: 14, color: c.shadow, opacity: 0.035 }) },
  date: { width: 50, flexShrink: 0, alignItems: 'center', borderRightWidth: 1, borderRightColor: c.line, paddingRight: 10 },
}));
