// The one required action, at exactly one point. Everything a parent needs to decide,
// nothing they don't.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { Score } from '@/ui/Score';
import { Baseline, ServiceBox } from '@/ui/Court';
import { color, radius, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { activeText, pct, windowText } from '@/lib/format';
import { haptic } from '@/lib/haptics';

export default function Approve() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.guardianHit(id), [id, tick]);
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  if (loading && !data) return <Screen><Centered><Header /><Rally /></Centered></Screen>;
  if (!data) return <Screen><Centered><Header /><T v="body" tone="ink2">This one's gone.</T></Centered></Screen>;
  const { request: r, messages, child } = data;
  const mine = r.approvals.find(a => a.minorId === child.id);
  const decided = mine?.decision != null || r.state === 'confirmed' || r.state === 'declined';
  const decide = async (v: boolean) => {
    setBusy(v ? 'yes' : 'no');
    try { await api.guardianDecide(r.id, child.id, v); if (v) haptic.accepted(); await reload(); }
    finally { setBusy(null); }
  };
  const o = r.other;
  return (
    <Screen bottom={!decided ? (
      <Centered><View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Pass" kind="line" onPress={() => decide(false)} loading={busy === 'no'} style={{ flex: 1 }} />
        <Button title="Approve this hit" onPress={() => decide(true)} loading={busy === 'yes'} style={{ flex: 2 }} />
      </View></Centered>
    ) : undefined}>
      <Centered>
        <Header kicker="Parent approval" title={child.displayName} />
        {decided && (
          <ServiceBox accent={r.state === 'confirmed'} style={s.banner}>
            <T v="h2" tone={r.state === 'confirmed' ? 'ball' : 'ink'}>{r.state === 'confirmed' ? `Approved. ${child.displayName}'s hit is on.` : r.state === 'declined' ? 'You passed on this one.' : 'Waiting on the other parent.'}</T>
          </ServiceBox>
        )}

        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Who</T>
        <ServiceBox style={s.box}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <View style={{ flex: 1 }}>
              <T v="h2">{o.displayName} {o.lastInitial}.</T>
              <T v="small" tone="ink2">Under 18 · {activeText(o.lastActiveAt)}</T>
            </View>
            <Score value={o.levelValue} size="h1" verified={o.levelVerified} />
          </View>
          <Baseline style={{ marginVertical: space.md }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Pill label={`${o.hitsConfirmed} hits played`} tone="faint" />
            {pct(o.responseRate) && <Pill label={`Replies ${pct(o.responseRate)}`} tone="faint" />}
            {o.levelVerified ? <Pill label="UTR verified" tone="cyan" /> : <Pill label="Self-reported level" tone="faint" />}
            <Pill label="Phone verified" tone="faint" />
          </View>
        </ServiceBox>

        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Where and when</T>
        <ServiceBox style={s.box}>
          <T v="h2">{r.courtName}</T>
          <T v="small" tone="ink2">Public court, from our directory</T>
          <Baseline style={{ marginVertical: space.md }} />
          <T v="bodyM">{windowText(new Date(r.windowStart), new Date(r.windowEnd))}</T>
        </ServiceBox>

        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Their messages</T>
        <View style={s.thread}>
          {messages.length === 0 ? <T v="small" tone="ink3">Nothing yet.</T> : messages.map(m => (
            <View key={m.id} style={[s.msg, m.senderId === child.id && s.msgMine]}>
              <T v="micro" tone="ink3">{m.senderId === child.id ? child.displayName : o.displayName}</T>
              <T v="small">{m.body}</T>
            </View>
          ))}
        </View>
        <T v="small" tone="ink3" style={{ marginTop: space.lg }}>Something off? You can block {o.displayName} on {child.displayName}'s behalf from their profile.</T>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  banner: { padding: space.lg, marginBottom: space.xl },
  box: { padding: space.lg, marginBottom: space.xl },
  thread: { gap: space.sm },
  msg: { backgroundColor: color.court2, borderRadius: radius.md, padding: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: color.court3 },
});
