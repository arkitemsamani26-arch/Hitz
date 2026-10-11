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
import { useFilters, activeFilterCount } from '@/store/filters';
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
  // Anyone you already have something open with: an invitation either way, or a hit on
  // the calendar. They are not who we suggest next, and their row says why.
  const openWith = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reqs.data ?? []) {
      if (new Date(r.windowEnd) < new Date()) continue;
      if (r.state === 'confirmed') m.set(r.other.id, 'Hit on the calendar');
      else if (r.state === 'accepted') m.set(r.other.id, 'Waiting on a parent');
      else if ((r.state === 'pending' || r.state === 'countered') && !m.has(r.other.id)) m.set(r.other.id, r.awaitingId === me ? 'Invited you' : 'Invite sent');
    }
    return m;
  }, [reqs.data, me]);
  const top = useMemo(() => (profile ? bestMatch(profile, list.filter(p => !openWith.has(p.id))) : null), [profile, list, openWith]);
  const rest = useMemo(() => list.filter(p => p.id !== top?.id), [list, top]);
  const my = profile?.levelValue;
  const range = filters.levelLo != null && filters.levelHi != null
    ? `UTR ${filters.levelLo.toFixed(1)}–${filters.levelHi.toFixed(1)}`
    : my != null ? `Around UTR ${my.toFixed(1)}` : 'Any level';

  // One tap that actually finds people: drop whatever is narrowing the list and step the
  // radius out, then say exactly what changed so nothing is loosened behind your back.
  const widen = useCallback(() => {
    const changed: string[] = [];
    const next = { ...filters };
    const r = RADII.find(x => x > filters.radiusMi);
    if (r) { next.radiusMi = r; changed.push(`${r} miles`); }
    if (filters.levelLo != null || filters.levelHi != null) { next.levelLo = null; next.levelHi = null; changed.push('any level'); }
    if (filters.availability) { next.availability = 0; changed.push('any time'); }
    if (filters.onlyLooking) { next.onlyLooking = false; changed.push('not just people looking this week'); }
    if (!changed.length) { router.push('/filters'); return; }
    set(next);
    toast(`Now showing ${changed.join(', ')}.`);
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
              <T v="h2">No one matches yet.</T>
              <T v="body" tone="muted">{activeFilterCount(filters) ? `Your filters: ${[`${filters.radiusMi} mi`, filters.levelLo != null ? 'a narrow level band' : null, filters.availability ? 'set times' : null, filters.onlyLooking ? 'looking this week only' : null].filter(Boolean).join(', ')}. Widen them and more players show up.` : 'Nobody near your level within this radius yet. Try a few more miles.'}</T>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
                <Button title="Widen the search" small onPress={widen} />
                <Button title="Filters" kind="line" small onPress={() => router.push('/filters')} />
              </View>
            </Card>
          ) : (
            <>
              {top && <FeaturedCard p={top} me={profile} win={win} onInvite={() => invite(top.id)} onOpen={() => open(top.id)} locked={!canInvite} lockedLabel="Unlocks when your parent says yes" />}
              <View style={{ paddingTop: 4 }}>
                {rest.map((p, i) => <CompactRow key={p.id} p={p} first={i === 0} note={openWith.get(p.id)} onPress={() => { const r = (reqs.data ?? []).find(x => x.other.id === p.id && new Date(x.windowEnd) > new Date() && ['pending', 'countered', 'accepted', 'confirmed'].includes(x.state)); if (r) router.push(`/hit/${r.id}`); else open(p.id); }} />)}
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
