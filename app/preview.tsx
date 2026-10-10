// The design preview: the four reference states with the reference's sample data, side
// by side with nothing real. Nothing here is sent, saved or scheduled. It exists so the
// implementation can be compared with the approved mock at the same width, and it says
// so on screen.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, Centered, GUTTER } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Icon, type IconName } from '@/ui/Icon';
import { Header } from '@/ui/Header';
import { PlanPanel } from '@/ui/Plan';
import { MemberCard } from '@/ui/MemberCard';
import { FeaturedCard, CompactRow } from '@/ui/Player';
import { DiscoverHeader, Hero, WindowPanel, SectionHead } from '@/ui/DiscoverParts';
import { font } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { CLUBHOUSE as F } from '@/data/fixtures';
import { dateLong, rangeText, tzName } from '@/lib/format';
import { endOf } from '@/lib/match';
import type { Window } from '@/store/window';

type Tab = 'discover' | 'plan' | 'hits' | 'member';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'discover', label: 'Discover', icon: 'compass' }, { key: 'hits', label: 'My hits', icon: 'calendar-days' }, { key: 'member', label: 'Club card', icon: 'id-card' },
];

export default function Preview() {
  const t = useTheme();
  const s = useS();
  const [tab, setTab] = useState<Tab>('discover');
  const [hour, setHour] = useState<18 | 19>(18);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const win: Window = { start: new Date(2026, 9, 12, hour, 0, 0, 0), durMin: 90 };
  const timeText = `${rangeText(win.start, endOf(win))} · ${tzName()}`;

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Screen flush pad={false} extraBottom={0}>
        <Centered>
          <View style={{ paddingHorizontal: GUTTER }}><Header backLabel="Back to the app" fallback="/(tabs)/you" /></View>
          {tab === 'discover' && (
            <>
              <DiscoverHeader initials="AT" area={F.area} onAccount={() => setTab('member')} />
              <Hero />
              <View style={st.body}>
                <WindowPanel win={win} editing={editing} onEdit={() => setEditing(e => !e)} />
                {editing && (
                  <View style={{ flexDirection: 'row', gap: 7, marginTop: -10, marginBottom: 21, flexWrap: 'wrap' }}>
                    <Pill label="6–7:30 pm" on={hour === 18} onPress={() => setHour(18)} />
                    <Pill label="7–8:30 pm" on={hour === 19} onPress={() => setHour(19)} />
                  </View>
                )}
                <SectionHead title="Your kind of player." right="UTR 9.5–11.5" />
                <FeaturedCard p={F.elena} me={F.me} win={win} onInvite={() => setTab('plan')} onOpen={() => setTab('plan')} />
                <View style={{ paddingTop: 4 }}><CompactRow p={F.kenji} first onPress={() => setTab('member')} /></View>
              </View>
            </>
          )}
          {tab === 'plan' && (
            <View style={st.inner}>
              <Tap onPress={() => setTab('discover')} style={st.back} accessibilityRole="button"><Icon name="arrow-left" size={15} color={t.muted} /><T v="small" tone="muted">Back to players</T></Tap>
              <T v="eyebrow" tone="muted">A little more court time</T>
              <T v="display" style={st.h}>Same court.{'\n'}<T v="display" italic>Good company.</T></T>
              <T v="small" tone="muted" style={st.sub}>Your invitation to Elena R.</T>
              <PlanPanel style={{ marginBottom: 18 }} groups={[
                { label: dateLong(win.start), values: [timeText] },
                { label: 'Suggested court', values: [F.court], note: 'Court access and booking availability not checked.' },
                { label: 'The hit', values: ['Warm up, then practice sets'] },
              ]} />
              <Button title="Send invite" arrow onPress={() => { setPending(true); setTab('hits'); }} />
              <T v="meta" tone="muted" style={st.note}>Design preview only. No message will be sent to a person.</T>
            </View>
          )}
          {tab === 'hits' && (
            <View style={st.inner}>
              <T v="eyebrow" tone="muted">Your court time</T>
              <T v="display" style={st.h}>A little tennis{'\n'}<T v="display" italic>to look forward to.</T></T>
              {!pending ? (
                <>
                  <T v="small" tone="muted" style={st.sub}>Your invitations and upcoming hits, all in one place.</T>
                  <PlanPanel style={{ marginBottom: 18 }} groups={[{ values: ['No sample invitations yet'], note: 'Choose a partner to preview your first plan.' }]} />
                  <Button title="Find your next partner" arrow onPress={() => setTab('discover')} />
                </>
              ) : (
                <>
                  <Pill label="Awaiting Elena's reply" icon="clock-3" />
                  <T v="small" tone="muted" style={[st.sub, { marginTop: 17 }]}>An invitation is the beginning.{'\n'}The hit is confirmed when you both agree.</T>
                  <PlanPanel style={{ marginBottom: 12 }} groups={[
                    { label: 'With Elena R.', values: [dateLong(win.start), timeText] },
                    { values: [F.court], note: 'Suggested court. Booking not confirmed.' },
                  ]} />
                  <T v="meta" tone="muted" style={st.note}>Preview state only. No real invitation was created.</T>
                </>
              )}
            </View>
          )}
          {tab === 'member' && (
            <View style={st.inner}>
              <T v="eyebrow" tone="muted">The clubhouse</T>
              <T v="display" style={st.h}>Your game.{'\n'}<T v="display" italic>Your people.</T></T>
              <T v="small" tone="muted" style={st.sub}>A little identity. A lot more tennis.</T>
              <MemberCard name="Arki T." level={10.5} source="utr_self" area="Palo Alto" />
              <View style={s.row}><T v="small" tone="muted">Typical availability</T><T v="small">Weekday evenings</T></View>
              <View style={s.row}><T v="small" tone="muted">Looking for</T><T v="small">Rally & practice sets</T></View>
              <T v="meta" tone="muted" style={st.note}>Illustrative member card and self-reported rating.</T>
            </View>
          )}
          <View style={s.label}><T v="meta" tone="muted" center>Design preview · sample profiles and availability. Nothing here is sent.</T></View>
        </Centered>
      </Screen>
      <View style={s.nav} accessibilityRole="tablist">
        {TABS.map(x => {
          const on = tab === x.key || (tab === 'plan' && x.key === 'discover');
          return (
            <Tap key={x.key} onPress={() => setTab(x.key)} style={[s.tab, on && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${x.label} (preview)`}>
              <Icon name={x.icon} size={18} color={on ? t.ink : t.muted} />
              <Text style={[s.tabLabel, { color: on ? t.ink : t.muted }]}>{x.label}</Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingBottom: GUTTER },
  inner: { paddingHorizontal: 22, paddingTop: 9, paddingBottom: 25 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingVertical: 8 },
  h: { marginTop: 12, marginBottom: 12 },
  sub: { marginBottom: 24, lineHeight: 21 },
  note: { marginTop: 12, lineHeight: 18 },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: c.line },
  label: { paddingHorizontal: GUTTER, paddingVertical: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 5, paddingTop: 8, paddingHorizontal: 9, paddingBottom: 11, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line },
  tab: { flex: 1, maxWidth: 160, minHeight: 49, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabOn: { backgroundColor: c.soft },
  tabLabel: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
}));
