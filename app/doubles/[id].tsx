// Find players for a doubles game. From a game you set up: people every player already in it
// could play with, closest to the team's level first. From the doubles list ("new"): a
// partner, which starts the game.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Avatar } from '@/ui/Avatar';
import { Score } from '@/ui/Score';
import { Loading } from '@/ui/Loading';
import { WeekGrid } from '@/ui/WeekGrid';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { dateLong, rangeText } from '@/lib/format';
import { name } from '@/ui/Player';
import type { DoublesRole } from '@/data/types';

export default function FindDoubles() {
  const { id, role: pRole } = useLocalSearchParams<{ id: string; role?: string }>();
  const router = useRouter();
  const s = useS();
  const { profile, tick } = useSession();
  const role: DoublesRole = pRole === 'partner' ? 'partner' : 'opponent';
  const hitId = id && id !== 'new' ? id : null;
  const game = useAsync(() => (hitId ? api.hit(hitId) : Promise.resolve(null)), [hitId, tick]);
  const list = useAsync(() => api.suggestDoubles(hitId, role), [hitId, role, tick]);
  const r = game.data?.request ?? null;
  const mine = profile?.availabilityMask ?? 0;
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);

  const invite = (playerId: string) => router.push({
    pathname: '/request/[id]',
    params: r ? {
      id: playerId, doubles: '1', match: r.matchId ?? r.id, role, court: r.courtId, start: r.windowStart, end: r.windowEnd,
    } : { id: playerId, doubles: '1', role: 'partner' },
  });

  return (
    <Screen onRefresh={() => list.reload()}>
      <Centered>
        <Header backLabel={r ? 'The game' : 'Back'} />
        <T v="eyebrow" tone="muted">Doubles</T>
        <T v="display" style={st.h} accessibilityRole="header">
          {role === 'partner' ? <>Find a{'\n'}<T v="display" italic>partner.</T></> : <>Find your{'\n'}<T v="display" italic>opponents.</T></>}
        </T>
        <T v="small" tone="muted" style={{ marginBottom: space.lg, lineHeight: 21 }}>
          {r ? `${dateLong(new Date(r.windowStart))}, ${rangeText(new Date(r.windowStart), new Date(r.windowEnd))} at ${r.courtName}. ` : ''}
          Players who said they play doubles{profile?.band === 'minor' ? ', near your age and everyone else\'s in the game' : ''}, closest to {r ? 'your team\'s' : 'your'} level first.
        </T>

        {list.loading && !list.data ? <Loading label="Finding doubles players" /> : list.error ? (
          <Card><T v="small" tone="muted">{list.error}</T></Card>
        ) : (list.data ?? []).length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <T v="h2">Nobody yet.</T>
            <T v="small" tone="muted">No one nearby who plays doubles fits everyone in this game. Try again later, or ask a friend to join Hits.</T>
          </Card>
        ) : (
          <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
            {(list.data ?? []).map((p, i) => (
              <View key={p.id} style={[s.row, i > 0 && s.rule]}>
                <Tap onPress={() => router.push(`/player/${p.id}`)} style={st.who} accessibilityRole="button"
                  accessibilityLabel={`${name(p)}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating'}${p.age != null ? `, age ${p.age}` : ''}. ${p.commonTimes ? `${p.commonTimes} usual time${p.commonTimes === 1 ? '' : 's'} in common` : 'No usual times in common'}. Open profile.`}>
                  <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={42} dot={p.lookingToHit} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={st.line}>
                      <T v="smallM" numberOfLines={1} style={{ flexShrink: 1 }}>{name(p)}</T>
                      <Score value={p.levelValue} source={p.levelSource} verified={p.levelVerified} sans align="left" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }} />
                    </View>
                    <T v="meta" tone="muted" numberOfLines={2}>
                      {[p.age != null ? `Age ${p.age}` : null, p.playFormat === 'doubles' ? 'Doubles' : 'Singles or doubles',
                        p.commonTimes ? `${p.commonTimes} usual time${p.commonTimes === 1 ? '' : 's'} in common` : null].filter(Boolean).join(' · ')}
                    </T>
                  </View>
                </Tap>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <WeekGrid mask={p.availabilityMask} mine={mine} />
                  <Button title={role === 'partner' ? 'Ask' : 'Invite'} small disabled={!canInvite} onPress={() => invite(p.id)} />
                </View>
              </View>
            ))}
          </Card>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: hit.min },
  line: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap' },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.lg },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
}));
