// The one required action, at exactly one point. Everything a parent needs to decide,
// nothing they don't -- plus what can honestly be said about the other side.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card as Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Pill } from '@/ui/Pill';
import { Loading as Rally } from '@/ui/Loading';
import { Score } from '@/ui/Score';
import { OptionSheet } from '@/ui/Sheet';
import { Avatar } from '@/ui/Avatar';
import { useToast } from '@/ui/Toast';
import { radius, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { activeText, dateLong, rangeText } from '@/lib/format';
import { haptic } from '@/lib/haptics';

export default function Approve() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { tick } = useSession();
  const sx = useS();
  const { data, loading, reload } = useAsync(() => api.guardianHit(id), [id, tick]);
  const assurance = useAsync(() => api.assurance(id), [id, tick]);
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [blocking, setBlocking] = useState(false);
  if (loading && !data) return <Screen><Centered><Header /><Rally /></Centered></Screen>;
  if (!data) return <Screen><Centered><Header /><Sheet><T v="body" tone="muted">This one's gone.</T></Sheet></Centered></Screen>;
  const { request: r, messages, child } = data;
  const mine = r.approvals.find(a => a.minorId === child.id);
  const decided = mine?.decision != null || r.state === 'confirmed' || r.state === 'declined' || r.state === 'cancelled';
  const decide = async (v: boolean) => {
    setBusy(v ? 'yes' : 'no');
    try { await api.guardianDecide(r.id, child.id, v); if (v) haptic.confirmed(); await reload(); } finally { setBusy(null); }
  };
  const o = r.other; const a = assurance.data;
  const months = (n: number | null) => n == null ? '' : n < 1 ? 'this month' : n === 1 ? 'a month ago' : `${n} months ago`;
  const plan = r.plan;

  return (
    <Screen bottom={!decided ? (
      <Centered><View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Pass" kind="line" onPress={() => decide(false)} loading={busy === 'no'} style={{ flex: 1 }} />
        <Button title="Approve this hit" arrow onPress={() => decide(true)} loading={busy === 'yes'} style={{ flex: 2 }} />
      </View></Centered>
    ) : undefined}>
      <Centered>
        <Header kicker="Parent approval" title={child.displayName} />
        <T v="eyebrow" tone="muted" style={{ marginTop: space.md }}>One yes or no</T>
        <T v="display" style={{ marginTop: 12, marginBottom: 18 }}>{decided ? (r.state === 'confirmed' ? "It's on." : 'Decided.') : <>Is this hit{'\n'}<T v="display" italic>okay with you?</T></>}</T>
        {decided && (
          <Sheet stripe={r.state === 'confirmed'} style={s.box}>
            <T v="h2" tone={r.state === 'confirmed' ? 'green' : 'ink'}>{r.state === 'confirmed' ? `Approved. ${child.displayName}'s hit is on.` : r.state === 'declined' ? 'You passed on this one.' : r.state === 'cancelled' ? 'This hit was cancelled.' : "Waiting on the other parent."}</T>
          </Sheet>
        )}

        <T v="micro" tone="muted" style={s.k}>Who</T>
        <Sheet style={s.box}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <Avatar name={o.displayName} lastInitial={o.lastInitial} photo={o.photoUrl} size={46} />
            <View style={{ flex: 1 }}><T v="h2">{o.displayName} {o.lastInitial}.</T><T v="meta" tone="muted">Under 18 · {activeText(o.lastActiveAt)}</T></View>
            <Score value={o.levelValue} source={o.levelSource} verified={o.levelVerified} />
          </View>
          <View style={sx.rule} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Pill label={`${o.hitsConfirmed} hits played`} />
            {o.levelVerified ? <Pill label="Rating verified through UTR" icon="check" /> : <Pill label="Self-reported rating" />}
            <Pill label="Phone verified" />
          </View>
        </Sheet>

        {/* Reassurance without identity: tenure, track record, a clean record. */}
        <T v="micro" tone="muted" style={s.k}>The other side</T>
        <Sheet style={s.box}>
          {a ? (
            <View style={{ gap: space.sm }}>
              {a.otherGuardianVerified
                ? <Line ok text={`${o.displayName}'s parent is linked and phone-verified${a.otherGuardianMonths != null ? `, ${months(a.otherGuardianMonths)}` : ''}.`} />
                : <Line text={`${o.displayName} is an adult player.`} />}
              {a.otherGuardianVerified && <Line ok text={`Their parent has approved ${a.otherGuardianApprovals} ${a.otherGuardianApprovals === 1 ? 'hit' : 'hits'} before this one.`} />}
              <Line ok={a.otherPlayerReports === 0} text={`${o.displayName} has played ${a.otherPlayerHits} ${a.otherPlayerHits === 1 ? 'hit' : 'hits'} through Hits over ${a.otherPlayerMemberMonths} months, with ${a.otherPlayerReports === 0 ? 'no reports' : `${a.otherPlayerReports} report${a.otherPlayerReports === 1 ? '' : 's'}`}.`} />
              {a.bothMinors && <Line ok text="Both players are under 18. No adult can see, find or contact them here. The database enforces it." />}
            </View>
          ) : <T v="small" tone="muted">Checking…</T>}
        </Sheet>

        <T v="micro" tone="muted" style={s.k}>Where and when</T>
        <Sheet style={s.box}>
          <T v="h2">{r.courtName}</T>
          <T v="meta" tone="muted">From our court directory. Access and booking not checked.</T>
          <View style={sx.rule} />
          <T v="bodyM">{dateLong(new Date(r.windowStart))}</T>
          <T v="bodyM">{rangeText(new Date(r.windowStart), new Date(r.windowEnd))}</T>
          {(plan.format || plan.meetAt || plan.ballsById) && (
            <T v="meta" tone="muted" style={{ marginTop: 6 }}>
              Their plan: {[plan.format === 'both' ? 'drill then play' : plan.format, plan.meetAt ? `meet at the ${plan.meetAt}` : null, plan.ballsById ? `${plan.ballsById === child.id ? child.displayName : o.displayName} brings balls` : null].filter(Boolean).join(' · ')}
            </T>
          )}
        </Sheet>

        <T v="micro" tone="muted" style={s.k}>Their messages</T>
        <Sheet style={[s.box, { gap: space.sm }]}>
          {messages.length === 0 ? <T v="small" tone="muted">Nothing yet.</T> : messages.map(m => (
            <View key={m.id} style={[sx.msg, m.senderId === child.id && sx.msgMine]}>
              <T v="micro" tone="muted">{m.senderId === child.id ? child.displayName : o.displayName}</T>
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
  const sx = useS();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
      <View style={[sx.dot, ok && sx.dotOn]} />
      <T v="small" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}
const s = StyleSheet.create({
  k: { marginBottom: 10, marginTop: space.sm },
  box: { marginBottom: space.lg },
});
const useS = makeStyles(c => ({
  rule: { height: 1, backgroundColor: c.line, marginVertical: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: c.line },
  dotOn: { backgroundColor: c.green },
  msg: { backgroundColor: c.soft, borderRadius: radius.md, padding: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
}));
