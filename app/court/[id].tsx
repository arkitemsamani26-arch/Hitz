// One court: what it is, how to get there, and who calls it home. Every player here is one
// tap from an invitation to meet on this court.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Loading } from '@/ui/Loading';
import { Pill } from '@/ui/Pill';
import { Avatar } from '@/ui/Avatar';
import { Score } from '@/ui/Score';
import { Court as CourtArt } from '@/ui/CourtArt';
import { useToast } from '@/ui/Toast';
import { fixed, hit, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useFilters } from '@/store/filters';
import { useAsync } from '@/store/useAsync';
import { directionsTo } from '@/lib/handoff';
import { courtFacts, courtMiles, milesText, playersText } from '@/lib/courts';
import { activeText } from '@/lib/format';
import { name } from '@/ui/Player';

export default function CourtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const s = useS();
  const { profile, setProfile, tick } = useSession();
  const { filters } = useFilters();
  const courts = useAsync(() => api.courts(), []);
  const stats = useAsync(() => api.courtPlayers(), [tick]);
  // Everyone in range, at any level: this list is about the place, not the filters.
  const players = useAsync(() => api.discover({ radiusMi: 25, levelLo: null, levelHi: null, availability: 0, onlyLooking: false, ageGap: filters.ageGap }), [tick, filters.ageGap]);
  const c = courts.data?.find(x => x.id === id) ?? null;
  const here = useMemo(() => (players.data ?? []).filter(p => p.homeCourtId === id)
    .sort((a, b) => Number(b.lookingToHit) - Number(a.lookingToHit) || (a.levelDelta ?? 9) - (b.levelDelta ?? 9)), [players.data, id]);
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);

  if (courts.loading && !courts.data) return <Screen><Centered><Header backLabel="Courts" /><Loading /></Centered></Screen>;
  if (!c) return <Screen><Centered><Header backLabel="Courts" /><Card><T v="body" tone="muted">We can't find that court.</T></Card></Centered></Screen>;

  const isHome = profile?.homeCourtId === c.id;
  const mi = courtMiles(profile?.homeCourtId, c.id);
  const makeHome = async () => {
    try { const p = await api.updateProfile({ homeCourtId: c.id }); setProfile(p); toast(`${c.name} is your home court now.`); }
    catch (e: any) { toast(e?.message ?? "That didn't save."); }
  };

  return (
    <Screen>
      <Centered>
        <Header backLabel="Courts" fallback="/(tabs)/courts" />
        <View style={s.hero}>
          <View style={st.art} pointerEvents="none"><CourtArt width={130} height={230} color={fixed.art} /></View>
          <T v="micro" tone="memberMeta" style={{ letterSpacing: 1.6, fontSize: 10 }}>{isHome ? 'Your home court' : c.access === 'club' ? 'Club court' : 'Public court'}</T>
          <T v="display" tone="memberText" style={{ marginTop: 10, fontSize: 32, lineHeight: 36 }} accessibilityRole="header">{c.name}</T>
          {!!c.address && <T v="small" tone="memberMeta" style={{ marginTop: 6 }}>{c.address}</T>}
          <View style={st.stats}>
            <View style={{ flex: 1 }}>
              <T v="rating" tone="memberText" style={{ fontSize: 28 }}>{stats.data?.find(x => x.courtId === c.id)?.players ?? 0}</T>
              <T v="micro" tone="memberMeta" style={{ fontSize: 10, letterSpacing: 1.1 }}>Call it home</T>
            </View>
            <View style={[{ flex: 1 }, st.rule]}>
              <T v="rating" tone="memberText" style={{ fontSize: 28 }}>{stats.data?.find(x => x.courtId === c.id)?.looking ?? 0}</T>
              <T v="micro" tone="memberMeta" style={{ fontSize: 10, letterSpacing: 1.1 }}>Looking this week</T>
            </View>
          </View>
        </View>

        <View style={st.chips}>
          {courtFacts(c).split(' · ').map(f => <Pill key={f} label={f} />)}
          {milesText(mi) && !isHome && <Pill label={milesText(mi)!} icon="map-pin" />}
        </View>

        <View style={st.actions}>
          <Button title="Directions" kind="line" small icon="map-pin" onPress={async () => { if (!(await directionsTo(c.address || `${c.name}, Palo Alto, CA`))) toast("Couldn't open maps."); }} style={{ flexGrow: 1 }} />
          {!isHome && profile && <Button title="Make it my court" kind="line" small icon="house" onPress={makeHome} style={{ flexGrow: 1 }} />}
        </View>

        <T v="micro" tone="muted" style={st.k}>Who plays here</T>
        {players.loading && !players.data ? <Loading label="Finding players" /> : here.length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <T v="smallM">{playersText(undefined)}.</T>
            <T v="small" tone="muted">You can still invite anyone to meet here. Pick a player, then choose this court on the invitation.</T>
            <Button title="Find a partner" kind="line" small onPress={() => router.push('/(tabs)')} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
            {here.map((p, i) => (
              <View key={p.id} style={[s.row, i > 0 && s.rowRule]}>
                <Tap onPress={() => router.push(`/player/${p.id}`)} style={st.who} accessibilityRole="button"
                  accessibilityLabel={`${name(p)}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating'}${p.age != null ? `, age ${p.age}` : ''}. ${p.lookingToHit ? 'Looking to hit this week. ' : ''}Open profile.`}>
                  <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={42} dot={p.lookingToHit} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="smallM" numberOfLines={1}>{name(p)}</T>
                    <T v="meta" tone={p.lookingToHit ? 'green' : 'muted'} numberOfLines={1}>{[p.age != null ? `Age ${p.age}` : null, p.lookingToHit ? 'Free this week' : activeText(p.lastActiveAt)].filter(Boolean).join(' · ')}</T>
                  </View>
                  <Score value={p.levelValue} source={p.levelSource} verified={p.levelVerified} sans />
                </Tap>
                <Button title="Invite" small kind={p.lookingToHit ? 'primary' : 'line'} disabled={!canInvite}
                  onPress={() => router.push({ pathname: '/request/[id]', params: { id: p.id, court: c.id } })} />
              </View>
            ))}
          </Card>
        )}
        <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
          {c.access === 'club' ? 'Club court: a membership or guest pass may apply. ' : ''}Hits does not book courts or check availability. Check the court's own rules on the day.
        </T>
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  art: { position: 'absolute', right: -18, top: -14, opacity: 0.6 },
  stats: { flexDirection: 'row', marginTop: 18, paddingTop: 13, borderTopWidth: 1, borderTopColor: fixed.memberRule },
  rule: { paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: fixed.memberRule },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  k: { marginTop: 24, marginBottom: 10 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: hit.min },
});
const useS = makeStyles(c => ({
  hero: { backgroundColor: fixed.member, borderRadius: 16, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: fixed.memberLine, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, paddingHorizontal: 14, minHeight: hit.row },
  rowRule: { borderTopWidth: 1, borderTopColor: c.line },
}));
