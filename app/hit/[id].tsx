// One request, whatever state it's in. The screen changes shape with the state.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Rally } from '@/ui/Rally';
import { Score } from '@/ui/Score';
import { Pill } from '@/ui/Pill';
import { OptionSheet } from '@/ui/Sheet';
import { CourtSurface } from '@/ui/Court';
import { MatchFound } from '@/ui/MatchFound';
import { BallBurst } from '@/ui/BallBurst';
import { play } from '@/lib/sound';
import { useToast } from '@/ui/Toast';
import { color, font, hit, radius, space } from '@/theme/tokens';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { windowText, windowShout, relTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { DECLINE_COPY, type DeclineReason, type HitPlan, type HitRequest, type Profile } from '@/data/types';

const SEEN = new Set<string>();

export default function Hit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile, tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.hit(id), [id, tick]);
  const shares = useAsync(() => api.sharedPhones(id), [id, tick]);
  const [passing, setPassing] = useState(false);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [showMatch, setShowMatch] = useState(false);
  const [burst, setBurst] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const r = data?.request;

  useEffect(() => {
    if (!r || r.state !== 'confirmed') return;
    const seen = SEEN.has(r.id) || demo?.hasSeenConfirmed(r.id);
    if (!seen) { SEEN.add(r.id); demo?.markSeenConfirmed(r.id); setShowMatch(true); }
  }, [r]);

  if (loading && !data) return <Screen sky={120}><Centered><Header /><Rally /></Centered></Screen>;
  if (!r || !profile) return <Screen sky={120}><Centered><Header /><Sheet><T v="body" tone="ink2">This one's gone.</T></Sheet></Centered></Screen>;

  const me = profile.id;
  const myMove = (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me;
  const theirMove = (r.state === 'pending' || r.state === 'countered') && r.awaitingId !== me;
  const start = new Date(r.windowStart), end = new Date(r.windowEnd);
  const pastWindow = end < new Date();
  const canChat = ['pending', 'countered', 'accepted', 'confirmed', 'completed'].includes(r.state);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await reload(); } catch (e: any) { toast(e.message); } };
  const send = async () => { const b = text.trim(); if (!b) return; setText(''); await act(() => api.sendMessage(r.id, b)); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); };
  const setPlan = (patch: Partial<HitPlan>) => { haptic.tick(); void act(() => api.updatePlan(r.id, patch)); };

  let head: React.ReactNode;
  let bottom: React.ReactNode = undefined;

  if (myMove) {
    head = <Status kicker={r.state === 'countered' ? `${r.other.displayName} countered` : `${r.other.displayName} wants to hit`} title="Your move." r={r} />;
    bottom = (
      <Centered><View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Pass" kind="line" onPress={() => setPassing(true)} />
        <Button title="Counter" kind="line" onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.other.id, counter: r.id } })} />
        <Button title="I'm in" kind="ball" onPress={() => act(async () => { await api.accept(r.id); haptic.accepted(); })} style={{ flex: 1 }} />
      </View></Centered>
    );
  } else if (theirMove) {
    head = <Status kicker="Sent" title={`Waiting on ${r.other.displayName}.`} sub={`Most people reply the same day. This expires in ${Math.max(1, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 3600000))}h if they don't.`} r={r} />;
    bottom = <Centered><Button title="Take it back" kind="ghost" small onPress={() => act(async () => { await api.cancelRequest(r.id); router.back(); })} /></Centered>;
  } else if (r.state === 'accepted') {
    head = <WaitingOnParent r={r} me={profile} setPlan={setPlan} />;
  } else if (r.state === 'confirmed' || r.state === 'completed') {
    head = (
      <View>
        <Tap onPress={() => setShowMatch(true)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel="Replay the moment">
          <Sheet accent style={{ overflow: 'hidden' }}>
            <View style={s.miniCourtWrap} pointerEvents="none"><CourtSurface style={s.miniCourt} dim /></View>
            <T v="micro" tone="court">{r.state === 'completed' ? 'Played' : "It's on"}</T>
            <T v="display" style={{ marginTop: 4 }}>{windowShout(start)}</T>
            <T v="h2" tone="ink2">{r.courtName}</T>
            <View style={s.rule} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <View style={{ flex: 1 }}><T v="bodyM">{r.other.displayName} {r.other.lastInitial}.</T><T v="small" tone="ink2">{r.other.hitsConfirmed} hits · {r.state === 'completed' ? 'and now one more' : 'shows up'}</T></View>
              <Score value={r.other.levelValue} size="h1" verified={r.other.levelVerified} tone="court" />
            </View>
          </Sheet>
        </Tap>
        <PlanCard r={r} me={profile} setPlan={setPlan} compact />
        {/* Numbers are never shown by default. Share yours for this hit if you'd rather text. */}
        {(() => {
          const mine = (shares.data ?? []).find(x => x.mine); const theirs = (shares.data ?? []).find(x => !x.mine);
          return (
            <Sheet style={{ marginTop: space.md, gap: space.sm }}>
              <T v="h2">Rather text?</T>
              {theirs
                ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View style={{ flex: 1 }}><T v="bodyM">{r.other.displayName} shared a number</T><T v="small" tone="ink2">{theirs.phone}</T></View>
                    <Button title={`Text ${r.other.displayName}`} kind="court" small onPress={() => void Linking.openURL(`sms:${theirs.phone.replace(/[^+\d]/g, '')}`)} />
                  </View>
                : <T v="small" tone="ink2">{r.other.displayName} hasn't shared a number for this hit.</T>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: color.hair, paddingTop: space.sm }}>
                <View style={{ flex: 1 }}><T v="bodyM">{mine ? 'Your number is shared for this hit' : 'Share your number for this hit'}</T><T v="small" tone="ink2">{mine ? `${r.other.displayName} can text you. Just for this hit.` : `Only ${r.other.displayName}, only for this hit. Take it back any time.`}</T></View>
                <Button title={mine ? 'Unshare' : 'Share'} kind={mine ? 'line' : 'ball'} small onPress={() => act(() => api.sharePhone(r.id, !mine))} />
              </View>
            </Sheet>
          );
        })()}
        {r.state === 'confirmed' && pastWindow && r.myConfirmation == null && (
          <Sheet style={{ marginTop: space.md }}>
            <T v="h2">Did you hit?</T>
            <T v="small" tone="ink2" style={{ marginBottom: space.md }}>One tap. It's how "hits played" stays honest.</T>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Didn't happen" kind="line" small onPress={() => act(() => api.confirmPlayed(r.id, false))} />
              <Button title="We hit" kind="ball" small onPress={() => { setBurst(b => b + 1); haptic.confirmed(); play('strike'); void act(() => api.confirmPlayed(r.id, true)); }} style={{ flex: 1 }} />
            </View>
            <BallBurst fire={burst} />
          </Sheet>
        )}
      </View>
    );
  } else if (r.state === 'declined') {
    const mineDecline = r.awaitingId === null && r.fromId !== me;
    head = <Status kicker={mineDecline ? 'You passed' : `${r.other.displayName} passed`} title={r.declineReason ?? 'Not this time.'} r={r}
      sub={mineDecline ? 'They got a reason, not silence. That is the whole point.' : 'A real reply, not silence. Go find the next one.'} />;
    bottom = <Centered><Button title="Find another hit" kind="ball" onPress={() => router.replace('/(tabs)')} /></Centered>;
  } else {
    head = <Status kicker={r.state} title="This one's closed." r={r} />;
  }

  return (
    <Screen scroll={false} sky={r.state === 'confirmed' || r.state === 'completed' ? 120 : 250} bottom={canChat && !myMove && !theirMove ? (
      <Centered><View style={s.composer}>
        <TextInput value={text} onChangeText={setText} placeholder={`Message ${r.other.displayName}`} placeholderTextColor={color.ink3} style={s.input} onSubmitEditing={send} returnKeyType="send" maxLength={2000} accessibilityLabel="Message" />
        <Tap onPress={send} style={[s.sendBtn, !text.trim() && { opacity: 0.4 }]} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send"><T v="smallM" tone="onCourt">Send</T></Tap>
      </View></Centered>
    ) : bottom}>
      <Centered>
        <Header right={<Tap onPress={() => setMore(true)} style={{ minHeight: hit.min, justifyContent: 'center', paddingHorizontal: space.sm }} accessibilityRole="button" accessibilityLabel="More options for this hit"><T v="h2">···</T></Tap>} />
        <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
          {head}
          {canChat && (
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              {r.note && <Bubble mine={r.fromId === me} who={r.fromId === me ? 'You' : r.other.displayName} body={r.note} />}
              {(data?.messages ?? []).map(m => <Bubble key={m.id} mine={m.senderId === me} who={m.senderId === me ? 'You' : r.other.displayName} body={m.body} />)}
              {(data?.messages.length ?? 0) === 0 && !r.note && <T v="small" tone="onCourt" center style={{ opacity: 0.9 }}>Say hi. Sort out balls.</T>}
            </View>
          )}
        </ScrollView>
        <OptionSheet open={passing} onClose={() => setPassing(false)} title={`Pass on ${r.other.displayName}. They'll see why.`}
          options={(Object.keys(DECLINE_COPY) as DeclineReason[]).map(k => ({ label: DECLINE_COPY[k], onPress: () => act(() => api.decline(r.id, k)) }))} />
        <OptionSheet open={more} onClose={() => setMore(false)} options={[
          { label: `See ${r.other.displayName}'s profile`, onPress: () => router.push(`/player/${r.other.id}`) },
          ...(r.state === 'confirmed' ? [{ label: 'Replay the moment', onPress: () => setShowMatch(true) }] : []),
          ...(['pending', 'countered', 'accepted', 'confirmed'].includes(r.state) ? [{ label: 'Cancel this hit', onPress: () => act(() => api.cancelRequest(r.id)), danger: true }] : []),
          { label: 'Report', sub: 'Goes to a person, same day', onPress: () => router.push(`/player/${r.other.id}?report=1`), danger: true },
          { label: `Block ${r.other.displayName}`, onPress: () => act(async () => { await api.block(r.other.id); router.replace('/(tabs)'); }), danger: true },
        ]} />
        <MatchFound req={r} me={profile} open={showMatch} onDone={() => setShowMatch(false)} />
      </Centered>
    </Screen>
  );
}

function Status({ kicker, title, sub, r }: { kicker: string; title: string; sub?: string; r: HitRequest }) {
  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <T v="micro" tone="ink2">{kicker}</T>
      <T v="display" style={{ marginTop: 4 }}>{title}</T>
      {sub && <T v="body" tone="ink2" style={{ marginTop: space.sm }}>{sub}</T>}
      <Sheet style={{ marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <View style={{ flex: 1 }}><T v="h2">{windowText(new Date(r.windowStart), new Date(r.windowEnd))}</T><T v="small" tone="ink2">{r.courtName}</T></View>
          <Score value={r.other.levelValue} size="h1" verified={r.other.levelVerified} tone="court" />
        </View>
      </Sheet>
    </Animated.View>
  );
}

// The wait is the planning window. The kids just agreed to hit -- this is exactly when
// they'd sort out details anyway. Both parents' progress shown as two lights.
function WaitingOnParent({ r, me, setPlan }: { r: HitRequest; me: Profile; setPlan: (p: Partial<HitPlan>) => void }) {
  const mine = r.approvals.find(a => a.minorId === me.id) ?? null;
  const theirs = r.approvals.find(a => a.minorId === r.other.id) ?? null;
  const light = (a: typeof mine, who: string) => {
    if (!a) return null;
    const st = a.decision === true ? 'approved' : a.seenAt ? 'looking' : 'sent';
    return (
      <View key={who} style={{ flex: 1, gap: 6 }}>
        <View style={[s.light, st === 'approved' && s.lightOn, st === 'looking' && s.lightHalf]} />
        <T v="smallM">{who}</T>
        <T v="small" tone="ink2">{st === 'approved' ? `Approved ${a.decidedAt ? relTime(a.decidedAt) + ' ago' : ''}` : st === 'looking' ? `Opened it ${a.seenAt ? relTime(a.seenAt) + ' ago' : ''}` : 'Sent'}</T>
      </View>
    );
  };
  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <T v="micro" tone="ink2">{r.other.displayName}'s in</T>
      <T v="display" style={{ marginTop: 4 }}>Almost on.</T>
      <T v="body" tone="ink2" style={{ marginTop: space.sm }}>{windowText(new Date(r.windowStart), new Date(r.windowEnd))} at {r.courtName}. While the parents look, sort out the hit.</T>
      <Sheet style={{ marginTop: space.lg }}>
        <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>Parents</T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {light(mine, 'Your parent')}
          {light(theirs, `${r.other.displayName}'s parent`)}
          {!mine && !theirs && <T v="small" tone="ink2">Confirming…</T>}
        </View>
      </Sheet>
      <PlanCard r={r} me={me} setPlan={setPlan} />
    </Animated.View>
  );
}

// Small, one-tap, both sides see it. Inherited by the confirmed screen.
function PlanCard({ r, me, setPlan, compact }: { r: HitRequest; me: Profile; setPlan: (p: Partial<HitPlan>) => void; compact?: boolean }) {
  const p = r.plan;
  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: space.md }}><T v="micro" tone="ink3" style={{ marginBottom: 6 }}>{k}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View></View>
  );
  return (
    <Sheet style={{ marginTop: space.md }}>
      <T v="h2" style={{ marginBottom: space.md }}>{compact ? 'The plan' : 'Plan the hit'}</T>
      <Row k="Balls">
        <Pill label={`I've got them`} on={p.ballsById === me.id} onPress={() => setPlan({ ballsById: me.id })} />
        <Pill label={`${r.other.displayName} has them`} on={p.ballsById === r.other.id} onPress={() => setPlan({ ballsById: r.other.id })} />
      </Row>
      <Row k="What kind of hit">
        {(['drills', 'sets', 'both'] as const).map(f => <Pill key={f} label={f === 'both' ? 'Drill then play' : f === 'sets' ? 'Sets' : 'Drills'} on={p.format === f} onPress={() => setPlan({ format: f })} />)}
      </Row>
      <Row k="Meet at">
        <Pill label="The courts" on={p.meetAt === 'court'} onPress={() => setPlan({ meetAt: 'court' })} />
        <Pill label="The gate" on={p.meetAt === 'gate'} onPress={() => setPlan({ meetAt: 'gate' })} />
      </Row>
      {compact && (
        <Row k="On the day">
          <Pill label={p.lateById === me.id ? "You're running 5 late" : p.lateById === r.other.id ? `${r.other.displayName} is running 5 late` : 'Running 5 late'} on={!!p.lateById} onPress={() => setPlan({ lateById: p.lateById === me.id ? null : me.id })} />
        </Row>
      )}
    </Sheet>
  );
}

function Bubble({ mine, who, body }: { mine: boolean; who: string; body: string }) {
  return (
    <View style={[s.msg, mine && s.msgMine]}>
      <T v="micro" tone={mine ? 'onCourt' : 'ink3'} style={{ opacity: 0.85 }}>{who}</T>
      <T v="small" tone={mine ? 'onCourt' : 'ink'}>{body}</T>
    </View>
  );
}
const s = StyleSheet.create({
  miniCourtWrap: { position: 'absolute', right: -30, top: -40, opacity: 0.35 },
  miniCourt: { width: 120, height: 220 },
  rule: { height: 2, backgroundColor: color.paper3, marginVertical: space.md },
  light: { height: 8, borderRadius: 4, backgroundColor: color.paper3 },
  lightHalf: { backgroundColor: color.sky },
  lightOn: { backgroundColor: color.court },
  composer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 48, borderRadius: radius.pill, backgroundColor: color.paper, color: color.ink, paddingHorizontal: space.lg, fontFamily: font.regular, fontSize: 16 },
  sendBtn: { backgroundColor: color.court, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  msg: { backgroundColor: color.paper, borderRadius: radius.md, padding: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: color.court },
});
