// Hits. The whole loop on one screen: your move, what's in play, and who to hit next.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { Countdown } from '@/ui/Countdown';
import { PlayerRow, PlayerCard } from '@/ui/Player';
import { CourtSurface, Token, You, layout } from '@/ui/Court';
import { Score } from '@/ui/Score';
import { Wordmark } from '@/ui/Wordmark';
import { Avatar } from '@/ui/Avatar';
import { OptionSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { color, hit, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useFilters, activeFilterCount } from '@/store/filters';
import { useAsync } from '@/store/useAsync';
import { defaultProposal } from '@/lib/defaults';
import { haptic } from '@/lib/haptics';
import { windowText } from '@/lib/format';
import { registerPush } from '@/lib/push';
import { DECLINE_COPY, type DeclineReason, type HitRequest, type Player } from '@/data/types';

export default function Hits() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { profile, listMode, setListMode, tick } = useSession();
  const { filters } = useFilters();
  const [sent, setSent] = useState<string[]>([]);
  const [picked, setPicked] = useState<Player | null>(null);
  const [passing, setPassing] = useState<HitRequest | null>(null);
  const [showPlay, setShowPlay] = useState(false);
  const market = useAsync(() => api.marketStatus(), [tick]);
  const players = useAsync(() => api.discover(filters), [filters, tick]);
  const reqs = useAsync(() => api.requests(), [tick]);
  useEffect(() => { void api.touch(); void registerPush(); }, []);

  const me = profile?.id;
  const canRequest = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  const visible = useMemo(() => (players.data ?? []).filter(p => !sent.includes(p.id)), [players.data, sent]);
  const all = reqs.data ?? [];
  const myMove = all.filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me);
  const inPlay = all.filter(r => r.state === 'accepted' || r.state === 'confirmed' || ((r.state === 'pending' || r.state === 'countered') && r.awaitingId !== me));
  const nFilters = activeFilterCount(filters);

  const quickSend = useCallback(async (p: Player) => {
    if (!profile) return;
    if (!canRequest) { haptic.warn(); toast('Once your parent says yes, you can reach out.'); return; }
    const d = defaultProposal(profile, p);
    setSent(s => [...s, p.id]); setPicked(null);
    try {
      const r = await api.sendRequest(p.id, d.courtId, d.start, d.end, null);
      haptic.sent();
      // Undo is a real button and the window is long enough to read the toast twice.
      toast(`Sent to ${p.displayName} · ${windowText(d.start, d.end)}`, { label: 'Undo', onPress: () => { void api.cancelRequest(r.id); setSent(s => s.filter(x => x !== p.id)); } }, 7000);
    } catch (e: any) { setSent(s => s.filter(x => x !== p.id)); toast(e.message); }
  }, [profile, canRequest, toast]);

  const accept = async (r: HitRequest) => { await api.accept(r.id); haptic.accepted(); await reqs.reload(); router.push(`/hit/${r.id}`); };
  const decline = async (r: HitRequest, reason: DeclineReason) => { await api.decline(r.id, reason); await reqs.reload(); };
  const open = (p: Player) => router.push(`/player/${p.id}`);
  const courtW = Math.min(width - 32, 480), courtH = Math.min(courtW * 1.5, 540);

  return (
    <Screen sky={150}>
      <Centered>
        <View style={s.head}>
          <View>
            <Wordmark />
            <T v="smallM" tone="ink2">Palo Alto · {profile?.band === 'minor' ? 'juniors' : 'players'} near your level</T>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Pill label={listMode ? 'Court' : 'List'} tone="white" onPress={() => setListMode(!listMode)} />
            <Pill label={nFilters ? `Filters · ${nFilters}` : 'Filters'} tone="white" on={nFilters > 0} onPress={() => router.push('/filters')} />
          </View>
        </View>

        {profile?.band === 'minor' && !profile.guardianVerified && (
          <Sheet style={s.note}>
            <T v="smallM">{profile.guardianOpenedAt ? 'Your parent opened the link.' : profile.guardianSentAt ? 'Sent to your parent.' : 'No parent linked yet.'}</T>
            <T v="small" tone="ink2">Browse away — reaching out unlocks the moment they say yes.</T>
          </Sheet>
        )}

        {/* Your move, pinned. One tap either way. */}
        {myMove.map(r => (
          <Sheet key={r.id} loud style={s.move}>
            <Tap onPress={() => router.push(`/hit/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} accessibilityRole="button">
              <Avatar name={r.other.displayName} size={48} ring />
              <View style={{ flex: 1 }}>
                <T v="micro" tone="ink">{r.state === 'countered' ? 'Countered · your move' : 'Your move'}</T>
                <T v="h2" tone="ink">{r.other.displayName} {r.other.lastInitial}. wants to hit</T>
                <T v="small" tone="ink" numberOfLines={1} style={{ opacity: 0.8 }}>{windowText(new Date(r.windowStart), new Date(r.windowEnd))} · {r.courtName}</T>
              </View>
              <Score value={r.other.levelValue} size="h1" verified={r.other.levelVerified} tone="ink" />
            </Tap>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Button title="Pass" kind="white" small onPress={() => setPassing(r)} />
              <Button title="Counter" kind="white" small onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.other.id, counter: r.id } })} />
              <Button title="I'm in" kind="court" small onPress={() => accept(r)} style={{ flex: 1, backgroundColor: '#0E1B33' }} />
            </View>
          </Sheet>
        ))}

        {inPlay.length > 0 && (
          <Sheet style={s.play}>
            <Tap onPress={() => setShowPlay(v => !v)} style={s.playHead} accessibilityRole="button" accessibilityState={{ expanded: showPlay }}>
              <T v="micro" tone="ink3">In play · {inPlay.length}</T>
              <T v="smallM" tone="court">{showPlay ? 'Hide' : 'Show'}</T>
            </Tap>
            {(showPlay ? inPlay : inPlay.slice(0, 2)).map(r => (
              <Tap key={r.id} onPress={() => router.push(`/hit/${r.id}`)} style={s.playRow} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <T v="bodyM" numberOfLines={1}>{r.other.displayName} {r.other.lastInitial}. <T v="small" tone="ink3">· {windowText(new Date(r.windowStart), new Date(r.windowEnd))}</T></T>
                </View>
                {r.state === 'confirmed' ? <Pill label="On" tone="ball" /> : r.state === 'accepted' ? <Pill label="Parent" tone="court" /> : <Pill label="Waiting" tone="faint" />}
              </Tap>
            ))}
          </Sheet>
        )}

        {market.data && !market.data.discoveryOpen ? (
          <Countdown m={market.data} onInvite={() => router.push('/(tabs)/you')} />
        ) : players.loading && !players.data ? (
          <Rally label="Finding your level…" a={profile?.levelValue?.toFixed(1)} />
        ) : visible.length === 0 ? (
          <Sheet style={{ alignItems: 'center', gap: space.md }}>
            <T v="h2" center>Quiet in this radius.</T>
            <T v="body" tone="ink2" center>Widen it, or loosen the level filter by half a point.</T>
            <Button title="Filters" small onPress={() => router.push('/filters')} />
          </Sheet>
        ) : listMode ? (
          <Sheet style={{ paddingVertical: 4 }}>
            {visible.map(p => <PlayerRow key={p.id} p={p} onPress={() => open(p)} onHit={() => quickSend(p)} disabled={!canRequest} />)}
          </Sheet>
        ) : (
          // The court view: players positioned by level and distance. Closer to the net
          // means closer to your level. You're the ball at the baseline.
          <View style={{ alignItems: 'center', paddingBottom: space.lg }}>
            <CourtSurface tilt style={{ width: courtW, height: courtH }}>
              {(() => { const ps = visible.slice(0, 12); const pos = layout(ps, filters.radiusMi); return ps.map((p, i) => <Token key={p.id} p={p} x={pos[i].x} y={pos[i].y} hot={p.lookingToHit} delay={i * 60} above={false} onPress={() => setPicked(p)} />); })()}
              <You level={profile?.levelValue ?? null} />
            </CourtSurface>
            <T v="small" tone="onCourt" center style={{ marginTop: space.md, opacity: 0.9 }}>Closer to the net, closer to your level. Left to right is distance.</T>
          </View>
        )}

        <OptionSheet open={!!picked} onClose={() => setPicked(null)}>
          {picked && (
            <View style={{ gap: space.md }}>
              <PlayerCard p={picked} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button title="Profile" kind="line" onPress={() => { const p = picked; setPicked(null); open(p); }} />
                <Button title={`Hit ${picked.displayName}`} kind="ball" onPress={() => quickSend(picked)} disabled={!canRequest} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </OptionSheet>
        <OptionSheet open={!!passing} onClose={() => setPassing(null)} title={`Pass on ${passing?.other.displayName ?? ''} — they'll see why`}
          options={(Object.keys(DECLINE_COPY) as DeclineReason[]).map(k => ({ label: DECLINE_COPY[k], onPress: () => passing && decline(passing, k) }))} />
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: space.lg, minHeight: hit.min, gap: space.md },
  note: { marginBottom: space.md, paddingVertical: space.md },
  move: { marginBottom: space.md },
  play: { marginBottom: space.md, paddingVertical: space.sm },
  playHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, borderTopWidth: 1, borderTopColor: color.hair },
});
