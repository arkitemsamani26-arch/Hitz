// Courts. Every court in the area, how far it is from yours, and how many players you could
// invite call it home. Tap one to see who plays there and to set up a hit on it.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Pill } from '@/ui/Pill';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { Court as CourtArt } from '@/ui/CourtArt';
import { fixed, font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { courtFacts, courtMiles, milesText, playersText } from '@/lib/courts';

type Filter = 'all' | 'public' | 'club';

export default function Courts() {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const courts = useAsync(() => api.courts(), []);
  const stats = useAsync(() => api.courtPlayers(), [tick]);
  const market = useAsync(() => api.marketStatus(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const home = profile?.homeCourtId ?? null;
  const by = useMemo(() => new Map((stats.data ?? []).map(x => [x.courtId, x])), [stats.data]);

  const list = useMemo(() => (courts.data ?? [])
    .filter(c => c.id !== home)
    .filter(c => filter === 'all' || c.access === filter)
    .map(c => ({ c, mi: courtMiles(home, c.id) }))
    .sort((a, b) => (a.mi ?? 99) - (b.mi ?? 99) || a.c.name.localeCompare(b.c.name)), [courts.data, home, filter]);
  const mine = courts.data?.find(c => c.id === home) ?? null;
  const area = market.data?.marketName ?? 'Palo Alto';

  return (
    <Screen onRefresh={async () => { await stats.reload(); }}>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: 10 }}>Courts around {area}</T>
        <T v="display" style={st.h} accessibilityRole="header">Where to{'\n'}<T v="display" italic>play.</T></T>
        <T v="small" tone="muted" style={st.sub}>Public parks and club courts nearby. See who plays where, then invite someone to meet you there.</T>

        {courts.loading && !courts.data ? <Loading label="Loading courts" /> : (
          <>
            {mine && (
              <Tap onPress={() => router.push(`/court/${mine.id}`)} style={s.home} scaleTo={0.99} accessibilityRole="button"
                accessibilityLabel={`Your home court, ${mine.name}. ${playersText(by.get(mine.id))}. Open.`}>
                <View style={st.homeArt} pointerEvents="none"><CourtArt width={110} height={190} color={fixed.art} /></View>
                <View style={st.homeTop}>
                  <View style={s.homeBadge}><Icon name="house" size={13} color={fixed.memberText} /><T v="micro" tone="memberText" style={{ fontSize: 10, letterSpacing: 1.3 }}>Your home court</T></View>
                </View>
                <T v="h1" tone="memberText" style={{ marginTop: 14 }}>{mine.name}</T>
                <T v="meta" tone="memberMeta" style={{ marginTop: 4 }}>{courtFacts(mine)}</T>
                <View style={st.homeFoot}>
                  <T v="smallM" tone="memberText">{playersText(by.get(mine.id))}</T>
                  <View style={st.homeGo}><T v="smallM" tone="memberText">See who plays here</T><Icon name="arrow-up-right" size={16} color={fixed.memberText} /></View>
                </View>
              </Tap>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filters}>
              {([['all', 'All courts'], ['public', 'Public'], ['club', 'Club']] as [Filter, string][]).map(([k, l]) => (
                <Pill key={k} label={l} on={filter === k} onPress={() => setFilter(k)} />
              ))}
            </ScrollView>

            <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
              {list.length === 0 && <T v="small" tone="muted" style={{ padding: 17 }}>No {filter === 'club' ? 'club' : 'public'} courts listed here yet.</T>}
              {list.map(({ c, mi }, i) => {
                const st2 = by.get(c.id);
                return (
                  <Tap key={c.id} onPress={() => router.push(`/court/${c.id}`)} style={[s.row, i > 0 && s.rule]} accessibilityRole="button"
                    accessibilityLabel={`${c.name}. ${courtFacts(c)}. ${milesText(mi) ?? ''}. ${playersText(st2)}. Open.`}>
                    <View style={s.pin}><Icon name="map-pin" size={18} color={t.ink} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="smallM" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{c.name}</T>
                      <T v="meta" tone="muted" numberOfLines={1}>{[courtFacts(c), milesText(mi, true)].filter(Boolean).join(' · ')}</T>
                      <T v="meta" tone={st2?.looking ? 'green' : 'muted'} style={st2?.looking ? { fontFamily: font.medium } : undefined} numberOfLines={1}>{playersText(st2)}</T>
                    </View>
                    <Icon name="chevron-right" size={16} color={t.muted} />
                  </Tap>
                );
              })}
            </Card>
            <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
              Hits does not book courts or check availability. Club courts may need a membership or guest pass.
            </T>
            {!mine && profile && <Button title="Pick your home court" kind="line" onPress={() => router.push('/(tabs)/you')} style={{ marginTop: space.md }} />}
          </>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  sub: { marginBottom: 20, lineHeight: 21 },
  filters: { gap: 7, paddingVertical: space.md },
  homeArt: { position: 'absolute', right: -16, top: -18, opacity: 0.6 },
  homeTop: { flexDirection: 'row' },
  homeFoot: { gap: 8, marginTop: 18, paddingTop: 13, borderTopWidth: 1, borderTopColor: fixed.memberRule },
  homeGo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
const useS = makeStyles(c => ({
  home: { backgroundColor: fixed.member, borderRadius: 16, padding: 19, overflow: 'hidden', borderWidth: 1, borderColor: fixed.memberLine },
  homeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(243,239,219,0.12)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15, minHeight: hit.row + 12 },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  pin: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
}));
