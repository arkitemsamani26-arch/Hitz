// My hits. Everything with a date on it: what is waiting on you, what is waiting on them,
// what is on, and what happened.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Loading } from '@/ui/Loading';
import { PlanPanel } from '@/ui/Plan';
import { WeekStrip } from '@/ui/WeekStrip';
import { OptionSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { dateLong, expiresText, rangeText, tzName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { DECLINE_COPY, type DeclineReason, type HitRequest } from '@/data/types';
import { groupOf, statusOf, type Group } from '@/lib/status';

export default function MyHits() {
  const router = useRouter();
  const toast = useToast();
  const { profile, tick } = useSession();
  const sx = useS();
  const reqs = useAsync(() => api.requests(), [tick]);
  const [passing, setPassing] = useState<HitRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const me = profile?.id;
  const all = reqs.data ?? [];
  const groups = useMemo(() => {
    const g: Record<Group, HitRequest[]> = { you: [], them: [], upcoming: [], past: [] };
    for (const r of all) g[groupOf(r, me)].push(r);
    const asc = (a: HitRequest, b: HitRequest) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime();
    g.you.sort(asc); g.them.sort(asc); g.upcoming.sort(asc);
    g.past.sort((a, b) => -asc(a, b));
    return g;
  }, [all, me]);
  const live = groups.you.length + groups.them.length + groups.upcoming.length;

  const accept = async (r: HitRequest) => {
    setBusy(r.id);
    try { await api.accept(r.id); haptic.accepted(); await reqs.reload(); router.push(`/hit/${r.id}`); }
    catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't accept that one."); void reqs.reload(); }
    finally { setBusy(null); }
  };
  const decline = async (r: HitRequest, reason: DeclineReason) => {
    try { await api.decline(r.id, reason); toast(`Told ${r.other.displayName}: ${DECLINE_COPY[reason].toLowerCase()}.`); }
    catch (e: any) { toast(e?.message ?? "Couldn't pass on that one."); }
    finally { void reqs.reload(); }
  };

  const panel = (r: HitRequest, actions?: React.ReactNode) => {
    const start = new Date(r.windowStart), end = new Date(r.windowEnd);
    const st = statusOf(r, me);
    return (
      <View key={r.id} style={{ marginBottom: 18 }}>
        <Tap onPress={() => router.push(`/hit/${r.id}`)} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`${st.label}. With ${r.other.displayName}, ${dateLong(start)}, ${rangeText(start, end)}, ${r.courtName}. Open.`}>
          <PlanPanel groups={[
            { label: `With ${r.other.displayName} ${r.other.lastInitial ? r.other.lastInitial + '.' : ''}`, values: [dateLong(start), `${rangeText(start, end)} · ${tzName()}`] },
            { values: [r.courtName], note: r.state === 'confirmed' || r.state === 'completed' ? undefined : 'Suggested court. Booking not confirmed.' },
            ...(r.note && groupOf(r, me) === 'you' ? [{ label: `${r.other.displayName} said`, values: [r.note] }] : []),
          ]}>
            <View style={{ marginTop: 14 }}><Pill label={st.label} icon={st.icon} /></View>
          </PlanPanel>
        </Tap>
        {actions}
      </View>
    );
  };

  return (
    <Screen onRefresh={() => reqs.reload()}>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: 10 }}>Your court time</T>
        <T v="display" style={s.h} accessibilityRole="header">A little tennis{'\n'}<T v="display" italic>to look forward to.</T></T>
        {reqs.data && (
          <WeekStrip hits={all.filter(r => ['pending', 'countered', 'accepted', 'confirmed'].includes(r.state) && new Date(r.windowEnd) > new Date())} onOpen={r => router.push(`/hit/${r.id}`)} />
        )}

        {reqs.loading && !reqs.data ? <Loading label="Loading your hits" /> : live === 0 && groups.past.length === 0 ? (
          <>
            <T v="small" tone="muted" style={s.sub}>Your invitations and upcoming hits, all in one place.</T>
            <PlanPanel groups={[{ values: ['No invitations yet'], note: 'Choose a partner on Discover and your first plan shows up here.' }]} style={{ marginBottom: 18 }} />
            <Button title="Find your next partner" arrow onPress={() => router.push('/(tabs)')} />
          </>
        ) : (
          <>
            {groups.you.length > 0 && (
              <>
                <T v="micro" tone="muted" style={s.k}>Waiting on you</T>
                {groups.you.map(r => panel(r, (
                  <View style={{ gap: space.sm, marginTop: space.sm }}>
                    <Button title="Accept" arrow onPress={() => accept(r)} loading={busy === r.id} />
                    <View style={s.actions}>
                      <Button title="Suggest another time" kind="line" small onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.other.id, counter: r.id } })} style={{ flexGrow: 1 }} />
                      <Button title="Decline" kind="ghost" small onPress={() => setPassing(r)} />
                    </View>
                  </View>
                )))}
              </>
            )}
            {groups.them.length > 0 && (
              <>
                <T v="micro" tone="muted" style={s.k}>Waiting on them</T>
                <T v="small" tone="muted" style={{ marginBottom: 17, lineHeight: 21 }}>An invitation is the beginning.{'\n'}The hit is confirmed when you both agree.</T>
                {groups.them.map(r => panel(r))}
              </>
            )}
            {groups.upcoming.length > 0 && (
              <>
                <T v="micro" tone="muted" style={s.k}>Upcoming</T>
                {groups.upcoming.map(r => panel(r))}
              </>
            )}
            {groups.past.length > 0 && (
              <>
                <T v="micro" tone="muted" style={s.k}>Past</T>
                <Card style={{ paddingVertical: 4 }}>
                  {groups.past.slice(0, 12).map((r, i) => {
                    const st = statusOf(r, me); const start = new Date(r.windowStart);
                    return (
                      <Tap key={r.id} onPress={() => router.push(`/hit/${r.id}`)} style={[s.pastRow, i > 0 && sx.rule]} accessibilityRole="button" accessibilityLabel={`${st.label}. ${r.other.displayName}, ${dateLong(start)}.`}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T v="smallM" numberOfLines={1}>{r.other.displayName} {r.other.lastInitial ? r.other.lastInitial + '.' : ''}</T>
                          <T v="meta" tone="muted" numberOfLines={1}>{dateLong(start)} · {r.courtName}</T>
                        </View>
                        <Pill label={st.label} icon={st.icon} />
                      </Tap>
                    );
                  })}
                </Card>
              </>
            )}
            {live === 0 && <Button title="Find your next partner" arrow onPress={() => router.push('/(tabs)')} style={{ marginTop: 24 }} />}
          </>
        )}
        <OptionSheet open={!!passing} onClose={() => setPassing(null)} title={`Pass on ${passing?.other.displayName ?? ''}. They'll see why.`}
          options={(Object.keys(DECLINE_COPY) as DeclineReason[]).map(k => ({ label: DECLINE_COPY[k], onPress: () => passing && decline(passing, k) }))} />
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  sub: { marginBottom: 24, lineHeight: 21 },
  k: { marginTop: 14, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, minHeight: 56 },
});
const useS = makeStyles(c => ({ rule: { borderTopWidth: 1, borderTopColor: c.line } }));
