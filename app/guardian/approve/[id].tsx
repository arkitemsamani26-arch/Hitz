// The one required action, at exactly one point. Everything a parent needs to decide,
// nothing they don't -- plus what can honestly be said about the other side.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { Score } from '@/ui/Score';
import { OptionSheet } from '@/ui/Sheet';
import { Stamp } from '@/ui/Stamp';
import { BallBurst } from '@/ui/BallBurst';
import { Avatar } from '@/ui/Avatar';
import { play } from '@/lib/sound';
import { useToast } from '@/ui/Toast';
import { color, radius, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { activeText, pct, windowText } from '@/lib/format';
import { haptic } from '@/lib/haptics';

export default function Approve() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.guardianHit(id), [id, tick]);
  const assurance = useAsync(() => api.assurance(id), [id]);
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [burst, setBurst] = useState(0);
  if (loading && !data) return <Screen sky={120}><Centered><Header /><Rally /></Centered></Screen>;
  if (!data) return <Screen sky={120}><Centered><Header /><Sheet><T v="body" tone="ink2">This one's gone.</T></Sheet></Centered></Screen>;
  const { request: r, messages, child } = data;
  const mine = r.approvals.find(a => a.minorId === child.id);
  const decided = mine?.decision != null || r.state === 'confirmed' || r.state === 'declined' || r.state === 'cancelled';
  const decide = async (v: boolean) => {
    setBusy(v ? 'yes' : 'no');
    try { await api.guardianDecide(r.id, child.id, v); if (v) { haptic.confirmed(); play('strike'); setBurst(b => b + 1); } await reload(); } finally { setBusy(null); }
  };
  const o = r.other; const a = assurance.data;
  const months = (n: number | null) => n == null ? '' : n < 1 ? 'this month' : n === 1 ? 'a month ago' : `${n} months ago`;
  const plan = r.plan;

  return (
    <Screen sky={90} bottom={!decided ? (
      <Centered><View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Pass" kind="line" onPress={() => decide(false)} loading={busy === 'no'} style={{ flex: 1 }} />
        <Button title="Approve this hit" kind="ball" onPress={() => decide(true)} loading={busy === 'yes'} style={{ flex: 2 }} />
      </View></Centered>
    ) : undefined}>
      <Centered>
        <Header kicker="Parent approval" title={child.displayName} />
        {decided && (
          <Sheet accent={r.state === 'confirmed'} style={[s.box, { overflow: 'visible' }]}>
            {r.state === 'confirmed' && <View style={{ marginBottom: space.md }}><Stamp text="Approved" /></View>}
            <BallBurst fire={burst} />
            <T v="h2" tone={r.state === 'confirmed' ? 'court' : 'ink'}>{r.state === 'confirmed' ? `Approved. ${child.displayName}'s hit is on.` : r.state === 'declined' ? 'You passed on this one.' : r.state === 'cancelled' ? 'This hit was cancelled.' : "Waiting on the other parent."}</T>
          </Sheet>
        )}

        <T v="micro" tone="onCourt" style={s.k}>Who</T>
        <Sheet style={s.box}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <Avatar name={o.displayName} photo={o.photoUrl} size={52} ring />
            <View style={{ flex: 1 }}><T v="h2">{o.displayName} {o.lastInitial}.</T><T v="small" tone="ink2">Under 18 · {activeText(o.lastActiveAt)}</T></View>
            <Score value={o.levelValue} size="h1" verified={o.levelVerified} tone="court" />
          </View>
          <View style={s.rule} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Pill label={`${o.hitsConfirmed} hits played`} tone="faint" />
            {pct(o.responseRate) && <Pill label={`Replies ${pct(o.responseRate)}`} tone="faint" />}
            {o.levelVerified ? <Pill label="UTR verified" tone="court" /> : <Pill label="Self-reported level" tone="faint" />}
            <Pill label="Phone verified" tone="faint" />
          </View>
        </Sheet>

        {/* Reassurance without identity: tenure, track record, a clean record. */}
        <T v="micro" tone="onCourt" style={s.k}>The other side</T>
        <Sheet style={s.box}>
          {a ? (
            <View style={{ gap: space.sm }}>
              {a.otherGuardianVerified
                ? <Line ok text={`${o.displayName}'s parent is linked and phone-verified${a.otherGuardianMonths != null ? `, ${months(a.otherGuardianMonths)}` : ''}.`} />
                : <Line text={`${o.displayName} is an adult player.`} />}
              {a.otherGuardianVerified && <Line ok text={`Their parent has approved ${a.otherGuardianApprovals} ${a.otherGuardianApprovals === 1 ? 'hit' : 'hits'} before this one.`} />}
              <Line ok={a.otherPlayerReports === 0} text={`${o.displayName} has played ${a.otherPlayerHits} ${a.otherPlayerHits === 1 ? 'hit' : 'hits'} through Hits over ${a.otherPlayerMemberMonths} months, with ${a.otherPlayerReports === 0 ? 'no reports' : `${a.otherPlayerReports} report${a.otherPlayerReports === 1 ? '' : 's'}`}.`} />
              {a.bothMinors && <Line ok text="Both players are under 18. Adults cannot see, find or contact either of them on Hits — that is enforced in the database, not a setting." />}
            </View>
          ) : <T v="small" tone="ink2">Checking…</T>}
        </Sheet>

        <T v="micro" tone="onCourt" style={s.k}>Where and when</T>
        <Sheet style={s.box}>
          <T v="h2">{r.courtName}</T>
          <T v="small" tone="ink2">Public court, from our directory</T>
          <View style={s.rule} />
          <T v="bodyM">{windowText(new Date(r.windowStart), new Date(r.windowEnd))}</T>
          {(plan.format || plan.meetAt || plan.ballsById) && (
            <T v="small" tone="ink2" style={{ marginTop: 6 }}>
              Their plan: {[plan.format === 'both' ? 'drill then play' : plan.format, plan.meetAt ? `meet at the ${plan.meetAt}` : null, plan.ballsById ? `${plan.ballsById === child.id ? child.displayName : o.displayName} brings balls` : null].filter(Boolean).join(' · ')}
            </T>
          )}
        </Sheet>

        <T v="micro" tone="onCourt" style={s.k}>Their messages</T>
        <Sheet style={[s.box, { gap: space.sm }]}>
          {messages.length === 0 ? <T v="small" tone="ink3">Nothing yet.</T> : messages.map(m => (
            <View key={m.id} style={[s.msg, m.senderId === child.id && s.msgMine]}>
              <T v="micro" tone="ink3">{m.senderId === child.id ? child.displayName : o.displayName}</T>
              <T v="small">{m.body}</T>
            </View>
          ))}
        </Sheet>

        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginBottom: space.xl }}>
          <Button title={`Block ${o.displayName} for ${child.displayName}`} kind="danger" small onPress={() => setBlocking(true)} />
          {child.photoUrl && <Button title={`Remove ${child.displayName}'s photo`} kind="line" small onPress={async () => { try { await api.guardianRemovePhoto(child.id); toast('Photo removed.'); await reload(); } catch (e: any) { toast(e.message); } }} />}
        </View>
        <OptionSheet open={blocking} onClose={() => setBlocking(false)} title={`Block ${o.displayName} on ${child.displayName}'s behalf?`} options={[
          { label: 'Block', sub: `They disappear from each other. This hit is cancelled. ${o.displayName} is not told.`, danger: true,
            onPress: async () => { try { await api.guardianBlock(child.id, o.id); toast(`Blocked. ${child.displayName} won't see ${o.displayName} again.`); router.replace('/guardian'); } catch (e: any) { toast(e.message); } } },
          { label: 'Never mind', onPress: () => {} },
        ]} />
      </Centered>
    </Screen>
  );
}
function Line({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: ok ? color.court : color.paper3 }} />
      <T v="small" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}
const s = StyleSheet.create({
  k: { marginBottom: space.sm, marginTop: space.sm },
  box: { marginBottom: space.lg },
  rule: { height: 2, backgroundColor: color.paper3, marginVertical: space.md },
  msg: { backgroundColor: color.paper2, borderRadius: radius.md, padding: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: color.paper3 },
});
