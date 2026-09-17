// Discovery. Open the app → see good nearby players → reach out. Three taps, or one swipe.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { Countdown } from '@/ui/Countdown';
import { SwipeStack } from '@/ui/Stack';
import { PlayerRow } from '@/ui/Player';
import { CourtLines } from '@/ui/Court';
import { useToast } from '@/ui/Toast';
import { color, hit, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useFilters, activeFilterCount } from '@/store/filters';
import { useAsync } from '@/store/useAsync';
import { defaultProposal } from '@/lib/defaults';
import { haptic } from '@/lib/haptics';
import { windowText } from '@/lib/format';
import type { Player } from '@/data/types';

export default function Hits() {
  const router = useRouter();
  const toast = useToast();
  const { profile, listMode, setListMode, tick } = useSession();
  const { filters } = useFilters();
  const [passed, setPassed] = useState<string[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const market = useAsync(() => api.marketStatus(), [tick]);
  const players = useAsync(() => api.discover(filters), [filters, tick]);
  useEffect(() => { void api.touch(); }, []);

  const canRequest = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  const visible = useMemo(() => (players.data ?? []).filter(p => !passed.includes(p.id) && !sent.includes(p.id)), [players.data, passed, sent]);

  const quickSend = useCallback(async (p: Player) => {
    if (!profile) return;
    if (!canRequest) { haptic.warn(); toast("Once your parent says yes, you can reach out."); return; }
    const d = defaultProposal(profile, p);
    setSent(s => [...s, p.id]);
    try {
      const r = await api.sendRequest(p.id, d.courtId, d.start, d.end, null);
      haptic.sent();
      toast(`Sent to ${p.displayName} · ${windowText(d.start, d.end)}`, { label: 'Undo', onPress: () => { void api.cancelRequest(r.id); setSent(s => s.filter(x => x !== p.id)); } }, 4500);
    } catch (e: any) { setSent(s => s.filter(x => x !== p.id)); toast(e.message); }
  }, [profile, canRequest, toast]);

  const pass = useCallback((p: Player) => setPassed(s => [...s, p.id]), []);
  const open = useCallback((p: Player) => router.push(`/player/${p.id}`), [router]);
  const nFilters = activeFilterCount(filters);

  const header = (
    <View style={s.head}>
      <T v="display" style={{ letterSpacing: -1.5 }}>Hits</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pill label={listMode ? 'Stack' : 'List'} onPress={() => setListMode(!listMode)} />
        <Pill label={nFilters ? `Filters · ${nFilters}` : 'Filters'} on={nFilters > 0} onPress={() => router.push('/filters')} />
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (market.data && !market.data.discoveryOpen) {
    body = <Countdown m={market.data} onInvite={() => router.push('/(tabs)/you')} />;
  } else if (players.loading && !players.data) {
    body = <Rally label="Finding your level…" />;
  } else if (visible.length === 0) {
    body = (
      <View style={s.empty}>
        <CourtLines width={120} opacity={0.2} />
        <T v="h2" center>{(players.data?.length ?? 0) > 0 ? "That's everyone for now." : 'Quiet in this radius.'}</T>
        <T v="body" tone="ink2" center style={{ maxWidth: 300 }}>
          {(players.data?.length ?? 0) > 0 ? 'New players show up all week. Check Requests, or widen the net.' : 'Widen the radius or loosen the level filter by half a point.'}
        </T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {passed.length > 0 && <Button title="Bring them back" kind="line" onPress={() => setPassed([])} small />}
          <Button title="Filters" onPress={() => router.push('/filters')} small />
        </View>
      </View>
    );
  } else if (listMode) {
    body = (
      <FlatList
        data={visible}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PlayerRow p={item} onPress={() => open(item)} onHit={() => quickSend(item)} disabled={!canRequest} />}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        showsVerticalScrollIndicator={false}
      />
    );
  } else {
    body = <SwipeStack players={visible} onRequest={quickSend} onPass={pass} onOpen={open} canRequest={canRequest} />;
  }

  return (
    <Screen scroll={false}>
      <Centered>
        {header}
        {profile?.band === 'minor' && !profile.guardianVerified && market.data?.discoveryOpen && (
          <View style={s.note}><T v="small" tone="ink2">Browse away. Reaching out unlocks once your parent says yes.</T></View>
        )}
        <View style={{ flex: 1 }}>{body}</View>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg, minHeight: hit.min },
  note: { borderLeftWidth: 2, borderLeftColor: color.ball, paddingLeft: space.md, marginBottom: space.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
});
