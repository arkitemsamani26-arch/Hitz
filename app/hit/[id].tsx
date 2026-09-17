// One request, whatever state it's in. The screen changes shape with the state.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Rally } from '@/ui/Rally';
import { Score } from '@/ui/Score';
import { Sheet } from '@/ui/Sheet';
import { Baseline, CourtLines, ServiceBox } from '@/ui/Court';
import { MatchFound } from '@/ui/MatchFound';
import { useToast } from '@/ui/Toast';
import { color, font, radius, space } from '@/theme/tokens';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { windowText, windowShout } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/motion';
import { DECLINE_COPY, type DeclineReason, type HitRequest } from '@/data/types';

const SEEN = new Set<string>();

export default function Hit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile, tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.hit(id), [id, tick]);
  const [passing, setPassing] = useState(false);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [showMatch, setShowMatch] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const r = data?.request;
  // The showpiece plays once, the first time you see this hit confirmed.
  useEffect(() => {
    if (!r || r.state !== 'confirmed') return;
    const seen = SEEN.has(r.id) || demo?.hasSeenConfirmed(r.id);
    if (!seen) { SEEN.add(r.id); demo?.markSeenConfirmed(r.id); setShowMatch(true); }
  }, [r]);

  if (loading && !data) return <Screen><Centered><Header /><Rally /></Centered></Screen>;
  if (!r || !profile) return <Screen><Centered><Header /><T v="body" tone="ink2">This one's gone.</T></Centered></Screen>;

  const me = profile.id;
  const myMove = (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me;
  const theirMove = (r.state === 'pending' || r.state === 'countered') && r.awaitingId !== me;
  const start = new Date(r.windowStart), end = new Date(r.windowEnd);
  const pastWindow = end < new Date();
  const canChat = ['pending', 'countered', 'accepted', 'confirmed', 'completed'].includes(r.state);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await reload(); } catch (e: any) { toast(e.message); } };
  const send = async () => { const b = text.trim(); if (!b) return; setText(''); await act(() => api.sendMessage(r.id, b)); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); };

  let head: React.ReactNode;
  let bottom: React.ReactNode = undefined;

  if (myMove) {
    head = <Status kicker={r.state === 'countered' ? `${r.other.displayName} countered` : `${r.other.displayName} wants to hit`} title="Your move." r={r} />;
    bottom = (
      <Centered><View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Pass" kind="line" onPress={() => setPassing(true)} />
        <Button title="Counter" kind="line" onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.other.id, counter: r.id } })} />
        <Button title="I'm in" onPress={() => act(async () => { await api.accept(r.id); haptic.accepted(); })} style={{ flex: 1 }} />
      </View></Centered>
    );
  } else if (theirMove) {
    head = <Status kicker="Sent" title={`Waiting on ${r.other.displayName}.`} sub={`Most people reply the same day. This expires in ${Math.max(1, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 3600000))}h if they don't.`} r={r} />;
    bottom = <Centered><Button title="Take it back" kind="ghost" small onPress={() => act(async () => { await api.cancelRequest(r.id); router.back(); })} /></Centered>;
  } else if (r.state === 'accepted') {
    head = <WaitingOnParent r={r} me={profile} />;
  } else if (r.state === 'confirmed' || r.state === 'completed') {
    head = (
      <View>
        <Tap onPress={() => setShowMatch(true)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel="Replay the moment">
        <ServiceBox accent style={s.lockedBox}>
          <View style={s.lockedLines} pointerEvents="none"><CourtLines width={150} opacity={0.08} /></View>
          <T v="micro" tone="ball">{r.state === 'completed' ? 'Played' : "It's on"}</T>
          <T v="display" style={{ marginTop: 4 }}>{windowShout(start)}</T>
          <T v="h2" tone="ink2">{r.courtName}</T>
          <Baseline style={{ marginVertical: space.md }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <View style={{ flex: 1 }}><T v="bodyM">{r.other.displayName} {r.other.lastInitial}.</T><T v="small" tone="ink2">{r.other.hitsConfirmed} hits · {r.state === 'completed' ? 'and now one more' : 'shows up'}</T></View>
            <Score value={r.other.levelValue} size="h1" verified={r.other.levelVerified} />
          </View>
        </ServiceBox>
        </Tap>
        {r.state === 'confirmed' && pastWindow && r.myConfirmation == null && (
          <ServiceBox style={s.ask}>
            <T v="h2">Did you hit?</T>
            <T v="small" tone="ink2" style={{ marginBottom: space.md }}>One tap. It's how "hits played" stays honest.</T>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Didn't happen" kind="line" small onPress={() => act(() => api.confirmPlayed(r.id, false))} />
              <Button title="We hit" small onPress={() => act(async () => { await api.confirmPlayed(r.id, true); haptic.accepted(); })} style={{ flex: 1 }} />
            </View>
          </ServiceBox>
        )}
        {r.state === 'confirmed' && !pastWindow && <T v="small" tone="ink3" style={{ marginTop: space.md }}>Tap the card to replay the moment. Bring balls.</T>}
      </View>
    );
  } else if (r.state === 'declined') {
    const mineDecline = r.awaitingId === null && r.fromId !== me;
    head = (
      <Status kicker={mineDecline ? 'You passed' : `${r.other.displayName} passed`} title={r.declineReason ?? 'Not this time.'} r={r}
        sub={mineDecline ? "They got a reason, not silence. That's the whole point." : 'A real reply. No hard feelings — find the next one.'} />
    );
    bottom = <Centered><Button title="Find another hit" onPress={() => router.replace('/(tabs)')} /></Centered>;
  } else {
    head = <Status kicker={r.state} title="This one's closed." r={r} />;
  }

  return (
    <Screen scroll={false} bottom={canChat && !myMove && !theirMove ? (
      <Centered><View style={s.composer}>
        <TextInput value={text} onChangeText={setText} placeholder={`Message ${r.other.displayName}`} placeholderTextColor={color.ink3} style={s.input} onSubmitEditing={send} returnKeyType="send" maxLength={2000} accessibilityLabel="Message" />
        <Tap onPress={send} style={[s.sendBtn, !text.trim() && { opacity: 0.4 }]} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send"><T v="smallM" tone="onBall">Send</T></Tap>
      </View></Centered>
    ) : bottom}>
      <Centered>
        <Header right={<Tap onPress={() => setMore(true)} style={{ minHeight: 48, justifyContent: 'center' }} accessibilityLabel="More"><T v="h2" tone="ink2">···</T></Tap>} />
        <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
          {head}
          {canChat && (
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              {r.note && r.fromId !== me && <Bubble mine={false} who={r.other.displayName} body={r.note} />}
              {r.note && r.fromId === me && <Bubble mine who="You" body={r.note} />}
              {(data?.messages ?? []).map(m => <Bubble key={m.id} mine={m.senderId === me} who={m.senderId === me ? 'You' : r.other.displayName} body={m.body} />)}
              {(data?.messages.length ?? 0) === 0 && !r.note && r.state === 'confirmed' && <T v="small" tone="ink3" center>Say hi. Sort out balls.</T>}
            </View>
          )}
        </ScrollView>
        <Sheet open={passing} onClose={() => setPassing(false)} title={`Pass on ${r.other.displayName} — they'll see why`}
          options={(Object.keys(DECLINE_COPY) as DeclineReason[]).map(k => ({ label: DECLINE_COPY[k], onPress: () => act(() => api.decline(r.id, k)) }))} />
        <Sheet open={more} onClose={() => setMore(false)} options={[
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
      <T v="micro" tone="ink3">{kicker}</T>
      <T v="display" style={{ marginTop: 4 }}>{title}</T>
      {sub && <T v="body" tone="ink2" style={{ marginTop: space.sm }}>{sub}</T>}
      <ServiceBox style={{ padding: space.lg, marginTop: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <View style={{ flex: 1 }}>
            <T v="h2">{windowText(new Date(r.windowStart), new Date(r.windowEnd))}</T>
            <T v="small" tone="ink2">{r.courtName}</T>
          </View>
          <Score value={r.other.levelValue} size="h1" verified={r.other.levelVerified} />
        </View>
      </ServiceBox>
    </Animated.View>
  );
}

// The junior just did the fun part. This is anticipation, not a blocked action.
function WaitingOnParent({ r, me }: { r: HitRequest; me: { band: string; displayName: string } }) {
  const { reduced } = useMotion();
  const glow = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) return;
    glow.value = withRepeat(withSequence(withTiming(0.7, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1);
  }, [reduced, glow]);
  const gs = useAnimatedStyle(() => ({ opacity: glow.value }));
  const mine = r.approvals.find(a => a.minorId === (me as any).id) ?? null;
  const waitingOnMine = me.band === 'minor' && (!mine || mine.decision == null);
  const waitingOnTheirs = r.approvals.some(a => a.minorId === r.other.id && a.decision == null);
  const who = waitingOnMine && waitingOnTheirs ? 'both parents' : waitingOnMine ? 'your parent' : `${r.other.displayName}'s parent`;
  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ alignItems: 'center', paddingTop: space.lg }}>
      <Animated.View style={gs}><CourtLines width={160} opacity={1} stroke={color.ball} glow /></Animated.View>
      <T v="micro" tone="ball" style={{ marginTop: space.xl }}>{r.other.displayName}'s in</T>
      <T v="display" center style={{ marginTop: 4 }}>Almost on.</T>
      <T v="body" tone="ink2" center style={{ marginTop: space.md, maxWidth: 300 }}>
        {windowText(new Date(r.windowStart), new Date(r.windowEnd))} at {r.courtName}. Last stop: {who}. They've got it — you'll feel it the second they tap yes.
      </T>
      <T v="small" tone="ink3" center style={{ marginTop: space.lg }}>You can keep chatting in the meantime.</T>
    </Animated.View>
  );
}

function Bubble({ mine, who, body }: { mine: boolean; who: string; body: string }) {
  return (
    <View style={[s.msg, mine && s.msgMine]}>
      <T v="micro" tone={mine ? 'onBall' : 'ink3'} style={{ opacity: 0.8 }}>{who}</T>
      <T v="small" tone={mine ? 'onBall' : 'ink'}>{body}</T>
    </View>
  );
}
const s = StyleSheet.create({
  lockedBox: { padding: space.xl, overflow: 'hidden' },
  lockedLines: { position: 'absolute', right: -30, top: -50 },
  ask: { padding: space.lg, marginTop: space.lg },
  composer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.court2, color: color.ink, paddingHorizontal: space.lg, fontFamily: font.regular, fontSize: 16 },
  sendBtn: { backgroundColor: color.ball, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  msg: { backgroundColor: color.court2, borderRadius: radius.md, padding: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: color.ball },
});
