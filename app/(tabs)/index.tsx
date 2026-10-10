// Discover. The wordmark, the hero, your next window, and the player we would hand you.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card, GUTTER } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Countdown } from '@/ui/Countdown';
import { FeaturedCard, CompactRow } from '@/ui/Player';
import { Icon } from '@/ui/Icon';
import { DiscoverHeader, Hero, WindowPanel, SectionHead } from '@/ui/DiscoverParts';
import { WindowEditor } from '@/ui/WindowEditor';
import { initialsOf } from '@/ui/Avatar';
import { useToast } from '@/ui/Toast';
import { radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useFilters } from '@/store/filters';
import { useNextWindow, useWindow } from '@/store/window';
import { useAsync } from '@/store/useAsync';
import { bestMatch } from '@/lib/defaults';
import { registerPush } from '@/lib/push';

const RADII = [5, 10, 15, 25];

export default function Discover() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const { filters, set } = useFilters();
  const { setWin } = useWindow();
  const win = useNextWindow(profile?.availabilityMask ?? 0);
  const [editing, setEditing] = useState(false);
  const market = useAsync(() => api.marketStatus(), [tick]);
  const players = useAsync(() => api.discover(filters), [filters, tick]);
  const reqs = useAsync(() => api.requests(), [tick]);
  useEffect(() => { void api.touch(); void registerPush(); }, []);

  const me = profile?.id;
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  const list = players.data ?? [];
  const waiting = (reqs.data ?? []).filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me);
  const top = useMemo(() => (profile ? bestMatch(profile, list) : null), [profile, list]);
  const rest = useMemo(() => list.filter(p => p.id !== top?.id), [list, top]);
  const my = profile?.levelValue;
  const range = filters.levelLo != null && filters.levelHi != null
    ? `UTR ${filters.levelLo.toFixed(1)}–${filters.levelHi.toFixed(1)}`
    : my != null ? `Around UTR ${my.toFixed(1)}` : 'Any level';

  const widen = useCallback(() => {
    const next = RADII.find(r => r > filters.radiusMi);
    if (next) { set({ ...filters, radiusMi: next }); toast(`Looking within ${next} miles now.`); }
    else if (filters.levelLo != null) { set({ ...filters, levelLo: null, levelHi: null }); toast('Showing every level now.'); }
    else router.push('/filters');
  }, [filters, set, toast, router]);

  const open = (id: string) => router.push(`/player/${id}`);
  const invite = (id: string) => router.push(`/request/${id}`);

  return (
    <Screen flush pad={false} onRefresh={async () => { await Promise.all([players.reload(), reqs.reload(), market.reload(), api.touch().catch(() => {})]); }}>
      <Centered>
        <DiscoverHeader initials={profile ? initialsOf(profile.displayName, profile.lastInitial) : '·'} area={market.data?.marketName ?? 'Palo Alto'} onAccount={() => router.push('/(tabs)/you')} />
        <Hero />
        <View style={st.body}>
          {/* Your next window, floating up over the hero's bottom edge. */}
          <WindowPanel win={win} editing={editing} onEdit={() => setEditing(e => !e)} />
          {editing && (
            <View style={{ marginTop: -10, marginBottom: 21 }}>
              <WindowEditor value={win} onChange={setWin} onDone={() => setEditing(false)} />
            </View>
          )}

          {profile?.band === 'minor' && !profile.guardianVerified && (
            <View style={s.note}>
              <Icon name="shield" size={14} color={t.ink} />
              <T v="small" style={{ flex: 1 }}>{profile.guardianOpenedAt ? 'Your parent opened the link. Inviting unlocks when they say yes.' : profile.guardianSentAt ? 'Sent to your parent. Inviting unlocks when they say yes.' : 'No parent linked yet. Browse away; inviting unlocks once they say yes.'}</T>
            </View>
          )}
          {waiting.length > 0 && (
            <Tap onPress={() => router.push('/(tabs)/hits')} style={s.note} accessibilityRole="button" accessibilityLabel={`${waiting.length === 1 ? `${waiting[0].other.displayName} is waiting on your reply` : `${waiting.length} invitations are waiting on you`}. Open My hits.`}>
              <Icon name="clock-3" size={14} color={t.ink} />
              <T v="small" style={{ flex: 1 }}>{waiting.length === 1 ? `${waiting[0].other.displayName} ${waiting[0].other.lastInitial ? waiting[0].other.lastInitial + '. ' : ''}is waiting on your reply` : `${waiting.length} invitations are waiting on you`}</T>
              <Icon name="chevron-right" size={15} color={t.muted} />
            </Tap>
          )}

          <SectionHead title="Your kind of player." right={range} onRight={() => router.push('/filters')} rightLabel={`${range}. Change filters.`} />

          {market.data && !market.data.discoveryOpen ? (
            <Countdown m={market.data} onInvite={() => router.push('/(tabs)/you')} />
          ) : players.loading && !players.data ? (
            <Loading label="Finding players near your level" />
          ) : players.error ? (
            <Card style={{ gap: space.sm }}>
              <T v="bodyM">Couldn't load players.</T>
              <T v="small" tone="muted">{players.error}</T>
              <Button title="Try again" kind="line" small onPress={() => players.reload()} style={{ alignSelf: 'flex-start' }} />
            </Card>
          ) : !profile ? null : list.length === 0 ? (
            <Card style={{ gap: space.sm }}>
              <T v="h2">No one in this radius yet.</T>
              <T v="body" tone="muted">Try a few more miles, or a wider level band. You decide how far is too far.</T>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
                <Button title="Widen the search" small onPress={widen} />
                <Button title="Filters" kind="line" small onPress={() => router.push('/filters')} />
              </View>
            </Card>
          ) : (
            <>
              {top && <FeaturedCard p={top} me={profile} win={win} onInvite={() => invite(top.id)} onOpen={() => open(top.id)} locked={!canInvite} lockedLabel="Unlocks when your parent says yes" />}
              <View style={{ paddingTop: 4 }}>
                {rest.map((p, i) => <CompactRow key={p.id} p={p} first={i === 0} onPress={() => open(p.id)} />)}
              </View>
              {rest.length > 0 && <T v="meta" tone="muted" style={{ marginTop: space.md }}>{list.length} players within {filters.radiusMi} miles. Tap a name to invite.</T>}
            </>
          )}
        </View>
      </Centered>
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingBottom: GUTTER },
});
const useS = makeStyles(c => ({
  note: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.soft, borderRadius: radius.xs, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 21, minHeight: 44 },
}));
