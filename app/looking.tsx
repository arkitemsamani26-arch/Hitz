// Looking to hit. Everyone who said they want to play this week, with their usual week laid
// out next to yours: solid squares are times you are both free. Filter to the times that
// suit you, and invite straight from the list.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Pill } from '@/ui/Pill';
import { Avatar } from '@/ui/Avatar';
import { Icon } from '@/ui/Icon';
import { Score } from '@/ui/Score';
import { Loading } from '@/ui/Loading';
import { WeekGrid } from '@/ui/WeekGrid';
import { useToast } from '@/ui/Toast';
import { font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useFilters } from '@/store/filters';
import { useAsync } from '@/store/useAsync';
import { SLOTS, slotsSummary } from '@/data/types';
import { name } from '@/ui/Player';
import { haptic } from '@/lib/haptics';
import { FORMAT_LABEL } from '@/lib/tournaments';
import type { PlayFormat } from '@/data/types';

export default function Looking() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { format: pFormat } = useLocalSearchParams<{ format?: string }>();
  const { profile, setProfile, tick } = useSession();
  // From Discover's Doubles shortcut the list opens on doubles players.
  const [onlyDoubles, setOnlyDoubles] = useState(pFormat === 'doubles');
  const { filters } = useFilters();
  const players = useAsync(() => api.discover({ radiusMi: 25, levelLo: null, levelHi: null, availability: 0, onlyLooking: true, ageGap: filters.ageGap, limit: 1000 }), [tick, filters.ageGap]);
  const mine = profile?.availabilityMask ?? 0;
  // Start on "when I'm free", the question most people are asking.
  const [want, setWant] = useState<number>(-1);
  const mask = want === -1 ? mine : want;
  const looking = !!profile?.lookingToHitUntil && new Date(profile.lookingToHitUntil) > new Date();
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);

  const list = useMemo(() => (players.data ?? [])
    .filter(p => !mask || (p.availabilityMask & mask))
    .filter(p => !onlyDoubles || p.playFormat === 'doubles' || p.playFormat === 'either')
    .sort((a, b) => {
      const ov = (x: typeof a) => SLOTS.filter(sl => x.availabilityMask & mine & sl.bit).length;
      return ov(b) - ov(a) || (a.levelDelta ?? 9) - (b.levelDelta ?? 9);
    }), [players.data, mask, mine, onlyDoubles]);

  const myFormat = profile?.playFormat ?? 'either';
  const setFormat = async (f: PlayFormat) => {
    try { const p = await api.updateProfile({ playFormat: f }); setProfile(p); haptic.tick(); }
    catch (e: any) { toast(e?.message ?? "That didn't save."); }
  };
  const toggle = async () => {
    try { const p = await api.setLooking(looking ? null : 7); setProfile(p); haptic.tick(); toast(looking ? "You're off the list." : "You're on the list for 7 days."); }
    catch (e: any) { toast(e?.message ?? "That didn't save."); }
  };

  return (
    <Screen onRefresh={() => players.reload()}>
      <Centered>
        <Header backLabel="Discover" />
        <T v="eyebrow" tone="muted">This week</T>
        <T v="display" style={st.h} accessibilityRole="header">Who's free{'\n'}<T v="display" italic>{onlyDoubles ? 'for doubles.' : 'to hit.'}</T></T>

        <View style={[s.me, looking && s.meOn]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="smallM" tone={looking ? 'greenText' : 'ink'}>{looking ? "You're on the list" : "You're not on the list"}</T>
            <T v="meta" tone={looking ? 'greenText' : 'muted'} numberOfLines={2}>{mine ? `Usually free ${slotsSummary(mine).toLowerCase()}.` : 'Set when you usually play in Profile.'}</T>
          </View>
          <Button title={looking ? 'Take me off' : "I'm free this week"} small kind={looking ? 'line' : 'primary'} onPress={toggle} />
        </View>

        <View style={st.fmt}>
          <T v="meta" tone="muted">You play</T>
          {(['singles', 'doubles', 'either'] as const).map(f => <Pill key={f} label={f === 'either' ? 'Either' : FORMAT_LABEL[f]} on={myFormat === f} onPress={() => setFormat(f)} />)}
        </View>
        {onlyDoubles && (
          <Button title="Set up a doubles game" small kind="line" icon="users-round" onPress={() => router.push({ pathname: '/doubles/[id]', params: { id: 'new', role: 'partner' } })}
            style={{ alignSelf: 'flex-start', marginTop: space.md }} disabled={!canInvite} />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={st.filters}>
          <Pill label="Doubles players" icon="users-round" on={onlyDoubles} onPress={() => setOnlyDoubles(v => !v)} />
          {mine ? <Pill label="When I'm free" on={want === -1} onPress={() => setWant(-1)} /> : null}
          <Pill label="Any time" on={want === 0 || (want === -1 && !mine)} onPress={() => setWant(0)} />
          {SLOTS.map(sl => <Pill key={sl.bit} label={`${sl.label} ${sl.part.toLowerCase()}s`} on={want === sl.bit} onPress={() => setWant(sl.bit)} />)}
        </ScrollView>

        <View style={st.legend} accessible accessibilityLabel="Solid squares are times you are both free; outlined squares are times only they are.">
          <View style={[s.key, s.keyBoth]} /><T v="meta" tone="muted">Both free</T>
          <View style={[s.key, s.keyTheirs]} /><T v="meta" tone="muted">Just them</T>
        </View>

        {players.loading && !players.data ? <Loading label="Finding who's free" /> : list.length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <T v="h2">Nobody yet.</T>
            <T v="small" tone="muted">{onlyDoubles ? 'No one looking this week plays doubles then. Try "Any time", or turn off "Doubles players".' : mask ? 'No one looking this week is free then. Try "Any time".' : 'No one nearby has said they are looking this week. Put yourself on the list and they will see you.'}</T>
          </Card>
        ) : (
          <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
            {list.map((p, i) => {
              const both = p.availabilityMask & mine;
              return (
                <View key={p.id} style={[s.row, i > 0 && s.rule]}>
                  <Tap onPress={() => router.push(`/player/${p.id}`)} style={st.who} accessibilityRole="button"
                    accessibilityLabel={`${name(p)}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating'}${p.age != null ? `, age ${p.age}` : ''}. ${both ? `Both free ${slotsSummary(both).toLowerCase()}` : `Free ${slotsSummary(p.availabilityMask).toLowerCase()}`}. Open profile.`}>
                    <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={42} dot />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={st.line}>
                        <T v="smallM" numberOfLines={1} style={{ flexShrink: 1 }}>{name(p)}</T>
                        <Score value={p.levelValue} source={p.levelSource} verified={p.levelVerified} sans align="left" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }} />
                      </View>
                      <T v="meta" tone={both ? 'green' : 'muted'} style={both ? { fontFamily: font.medium } : undefined} numberOfLines={2}>
                        {[p.age != null ? `Age ${p.age}` : null, p.playFormat === 'doubles' ? 'Doubles' : null, both ? `Both free ${slotsSummary(both).toLowerCase()}` : p.availabilityMask ? `Free ${slotsSummary(p.availabilityMask).toLowerCase()}` : 'Ask when they play'].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                  </Tap>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <WeekGrid mask={p.availabilityMask} mine={mine} />
                    <Button title="Invite" small kind={both ? 'primary' : 'line'} disabled={!canInvite} onPress={() => router.push(`/request/${p.id}`)} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        {/* Free sees the five best fits; the rest of the list is Plus. */}
        {!profile?.plus && (players.data?.length ?? 0) >= 5 && (
          <Tap onPress={() => router.push('/plus?why=looking')} style={s.more} accessibilityRole="button" accessibilityLabel="These are the five best fits. See everyone looking this week with Plus.">
            <Icon name="lock" size={15} color={t.ink} />
            <View style={{ flex: 1 }}>
              <T v="smallM">These are your five best fits</T>
              <T v="meta" tone="muted">See everyone looking this week with Plus.</T>
            </View>
            <Icon name="chevron-right" size={15} color={t.muted} />
          </Tap>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 16 },
  filters: { gap: 7, paddingVertical: space.md, alignItems: 'center' },
  fmt: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: space.md },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.md },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: hit.min },
  line: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap' },
});
const useS = makeStyles(c => ({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  meOn: { backgroundColor: c.green, borderColor: c.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  key: { width: 14, height: 10, borderRadius: 3, marginLeft: 4 },
  keyBoth: { backgroundColor: c.green },
  keyTheirs: { borderWidth: 1.5, borderColor: c.green, backgroundColor: c.card },
  more: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: space.md, borderRadius: radius.lg, backgroundColor: c.soft, minHeight: hit.row },
}));
