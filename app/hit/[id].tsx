// One hit, whatever state it is in. The screen changes shape with the state.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Loading } from '@/ui/Loading';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { PlanPanel } from '@/ui/Plan';
import { OptionSheet } from '@/ui/Sheet';
import { Court } from '@/ui/CourtArt';
import { ShareCard, shareMoment } from '@/ui/ShareCard';
import { addToCalendar, directionsTo, placeOf } from '@/lib/handoff';
import { useToast } from '@/ui/Toast';
import { fixed, font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { dateLong, rangeText, relTime, tzName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { DECLINE_COPY, type DeclineReason, type HitPlan, type HitRequest, type Profile } from '@/data/types';

const SEEN = new Set<string>();

export default function Hit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.hit(id), [id, tick]);
  const shares = useAsync(() => api.sharedPhones(id), [id, tick]);
  const courts = useAsync(() => api.courts(), []);
  const [passing, setPassing] = useState(false);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const cardRef = useRef<View>(null);
  const r = data?.request;

  // The accent runs once, the first time a confirmed hit is opened. Never again.
  useEffect(() => {
    if (!r || r.state !== 'confirmed') return;
    const seen = SEEN.has(r.id) || demo?.hasSeenConfirmed(r.id);
    if (!seen) { SEEN.add(r.id); demo?.markSeenConfirmed(r.id); setFresh(true); haptic.confirmed(); }
  }, [r]);

  if (loading && !data) return <Screen><Centered><Header /><Loading /></Centered></Screen>;
  if (!r || !profile) return <Screen><Centered><Header /><Card><T v="body" tone="muted">This one's gone.</T></Card></Centered></Screen>;

  const me = profile.id;
  const myMove = (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me;
  const theirMove = (r.state === 'pending' || r.state === 'countered') && r.awaitingId !== me;
  const start = new Date(r.windowStart), end = new Date(r.windowEnd);
  const pastWindow = end < new Date();
  const canChat = ['pending', 'countered', 'accepted', 'confirmed', 'completed'].includes(r.state);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); await reload(); } catch (e: any) { haptic.warn(); toast(e?.message ?? 'That did not go through.'); } finally { setBusy(null); }
  };
  const send = async () => {
    const b = text.trim(); if (!b || sending) return;
    setSending(true);
    try { await api.sendMessage(r.id, b); setText(''); await reload(); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }
    catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't send. Your message is still here."); }
    finally { setSending(false); }
  };
  const setPlan = (patch: Partial<HitPlan>) => { haptic.tick(); void act('plan', () => api.updatePlan(r.id, patch)); };
  const who = `${r.other.displayName}${r.other.lastInitial ? ` ${r.other.lastInitial}.` : ''}`;
  const plan = [
    { label: `With ${who}`, values: [dateLong(start), `${rangeText(start, end)} · ${tzName()}`] },
    { label: 'Court', values: [r.courtName], note: 'Court access and booking availability not checked.' },
  ];

  let head: React.ReactNode;
  let bottom: React.ReactNode = undefined;

  if (myMove) {
    head = (
      <Animated.View entering={FadeIn.duration(150)}>
        <T v="eyebrow" tone="muted">{r.state === 'countered' ? `${r.other.displayName} suggested another time` : `${r.other.displayName} wants to hit`}</T>
        <T v="display" style={st.h}>Your reply.</T>
        <PlanPanel groups={r.note ? [...plan, { label: 'They said', values: [r.note] }] : plan} />
      </Animated.View>
    );
    bottom = (
      <Centered><View style={{ gap: space.sm }}>
        <Button title="Accept" arrow onPress={() => act('accept', async () => { await api.accept(r.id); haptic.accepted(); })} loading={busy === 'accept'} />
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button title="Suggest another time" kind="line" small onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.other.id, counter: r.id } })} style={{ flexGrow: 1 }} />
          <Button title="Decline" kind="ghost" small onPress={() => setPassing(true)} />
        </View>
      </View></Centered>
    );
  } else if (theirMove) {
    const hours = Math.max(1, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 3600000));
    head = (
      <Animated.View entering={FadeIn.duration(150)}>
        <Pill label={`Awaiting ${r.other.displayName}'s reply`} icon="clock-3" />
        <T v="display" style={st.h}>An invitation{'\n'}<T v="display" italic>is the beginning.</T></T>
        <T v="small" tone="muted" style={st.sub}>The hit is confirmed when you both agree. Most people reply the same day; this one expires in {hours}h if they don't.</T>
        <PlanPanel groups={r.note ? [...plan, { label: 'You said', values: [r.note] }] : plan} />
      </Animated.View>
    );
    bottom = <Centered><Button title="Take it back" kind="ghost" small onPress={() => act('cancel', async () => { await api.cancelRequest(r.id); router.back(); })} loading={busy === 'cancel'} /></Centered>;
  } else if (r.state === 'accepted') {
    head = <WaitingOnParent r={r} me={profile} setPlan={setPlan} plan={plan} />;
  } else if (r.state === 'confirmed' || r.state === 'completed') {
    const mine = (shares.data ?? []).find(x => x.mine); const theirs = (shares.data ?? []).find(x => !x.mine);
    // Once the window has passed, this is not a plan any more. It is a question, and then
    // a memory, and the next step is the next hit.
    const over = r.state === 'completed' || pastWindow;
    const asking = r.state === 'confirmed' && pastWindow && r.myConfirmation == null;
    const eyebrow = asking ? 'After the hit' : over ? (r.myConfirmation === false ? 'Did not happen' : 'Played') : 'Confirmed';
    const title = asking ? 'How did it go?' : over ? (r.myConfirmation === false ? 'Next time.' : 'Good hit.') : "It's on.";
    head = (
      <View>
        <ShareCard ref={cardRef} req={r} me={profile} />
        <T v="eyebrow" tone="muted">{eyebrow}</T>
        <T v="display" style={st.h}>{title}</T>
        {asking && (
          <Card style={{ gap: space.sm, marginBottom: space.md }}>
            <T v="smallM">Did you hit with {r.other.displayName}?</T>
            <T v="small" tone="muted">One tap. It is how "hits played" stays honest, for both of you.</T>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
              <Button title="Didn't happen" kind="line" small onPress={() => act('played-no', () => api.confirmPlayed(r.id, false))} loading={busy === 'played-no'} />
              <Button title="We hit" small onPress={() => act('played', async () => { await api.confirmPlayed(r.id, true); haptic.confirmed(); })} loading={busy === 'played'} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        <Animated.View entering={fresh ? FadeIn.duration(240) : undefined} style={[st.summary, over && { opacity: 0.92 }]}>
          <View style={st.summaryArt} pointerEvents="none"><Court width={120} height={200} /></View>
          <T v="micro" tone="memberMeta" style={{ letterSpacing: 1.8 }}>With {who}</T>
          <T v="h1" tone="memberText" style={{ marginTop: 10 }}>{dateLong(start)}</T>
          <T v="bodyM" tone="memberText">{rangeText(start, end)} · {tzName()}</T>
          <View style={st.summaryRule} />
          <T v="bodyM" tone="memberText">{r.courtName}</T>
          {!over && <T v="meta" tone="memberMeta" style={{ marginTop: 4 }}>Court access and booking not checked. Confirm a free court on the day.</T>}
        </Animated.View>
        {!over ? (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            <Button title="Add to calendar" kind="line" small icon="calendar-days" onPress={async () => {
              const res = await addToCalendar(r, courts.data?.find(c => c.id === r.courtId)?.address);
              if (res === 'added') toast('Added to your calendar.');
              else if (res === 'downloaded') toast('Calendar file downloaded. Open it to add the hit.');
              else if (res === 'failed') toast("Couldn't open your calendar.");
            }} />
            <Button title="Directions" kind="line" small icon="map-pin" onPress={async () => { if (!(await directionsTo(placeOf(r, courts.data?.find(c => c.id === r.courtId)?.address)))) toast("Couldn't open maps."); }} />
            <Button title="Share" kind="line" small icon="share" onPress={async () => { const how = await shareMoment(cardRef, r, profile); if (how === 'copied') toast('Copied. Paste it wherever you like.'); else if (how === 'failed') toast("Couldn't share from here."); }} />
          </View>
        ) : (
          <Button title={`Hit with ${r.other.displayName} again`} arrow onPress={() => router.push(`/request/${r.other.id}`)} style={{ marginTop: space.md }} />
        )}
        {!over && <Logistics r={r} me={profile} setPlan={setPlan} onTheDay />}
        {/* Numbers are never shown by default. Share yours for this hit if you'd rather text. */}
        {!over && (
          <>
            <T v="micro" tone="muted" style={st.k}>Rather text?</T>
            <Card style={{ gap: space.sm }}>
              {theirs
                ? <View style={st.row}>
                    <View style={{ flex: 1 }}><T v="smallM">{r.other.displayName} shared a number</T><T v="meta" tone="muted">{theirs.phone}</T></View>
                    <Button title={`Text ${r.other.displayName}`} small icon="message-circle" onPress={() => void Linking.openURL(`sms:${theirs.phone.replace(/[^+\d]/g, '')}`)} />
                  </View>
                : <T v="small" tone="muted">{r.other.displayName} hasn't shared a number for this hit.</T>}
              <View style={[st.row, s.rule, { paddingTop: space.sm }]}>
                <View style={{ flex: 1 }}><T v="smallM">{mine ? 'Your number is shared for this hit' : 'Share your number for this hit'}</T><T v="meta" tone="muted">{mine ? `${r.other.displayName} can text you. Just for this hit.` : `Only ${r.other.displayName}, only for this hit. Take it back any time.`}</T></View>
                <Button title={mine ? 'Hide my number' : 'Share my number'} kind={mine ? 'line' : 'primary'} small onPress={() => act('share', async () => { await api.sharePhone(r.id, !mine); await shares.reload(); toast(mine ? 'Your number is hidden again.' : `${r.other.displayName} can see your number for this hit.`); })} loading={busy === 'share'} />
              </View>
            </Card>
          </>
        )}
      </View>
    );
  } else if (r.state === 'declined') {
    const mineDecline = r.awaitingId === null && r.fromId !== me;
    head = (
      <Animated.View entering={FadeIn.duration(150)}>
        <T v="eyebrow" tone="muted">{mineDecline ? 'You passed' : `${r.other.displayName} passed`}</T>
        <T v="display" style={st.h}>{r.declineReason ?? 'Not this time.'}</T>
        <T v="small" tone="muted" style={st.sub}>{mineDecline ? 'They got a reason, not silence. That is the whole point.' : 'A real reply, not silence. Go find the next one.'}</T>
        <PlanPanel groups={plan} />
      </Animated.View>
    );
    bottom = <Centered><Button title="Find another hit" arrow onPress={() => router.replace('/(tabs)')} /></Centered>;
  } else {
    head = (
      <View>
        <T v="eyebrow" tone="muted">{r.state}</T>
        <T v="display" style={st.h}>This one's closed.</T>
        <PlanPanel groups={plan} />
      </View>
    );
  }

  return (
    <Screen scroll={false} bottom={canChat && !myMove && !theirMove ? (
      <Centered><View style={st.composer}>
        <TextInput value={text} onChangeText={setText} placeholder={`Message ${r.other.displayName}`} placeholderTextColor={t.muted} style={s.input} onSubmitEditing={send} returnKeyType="send" maxLength={2000} accessibilityLabel="Message" editable={!sending} />
        <Button title={sending ? 'Sending' : 'Send'} small onPress={send} disabled={!text.trim() || sending} loading={sending} />
      </View></Centered>
    ) : bottom}>
      <Centered>
        <Header right={<Tap onPress={() => setMore(true)} style={st.more} accessibilityRole="button" accessibilityLabel="More options for this hit"><Icon name="ellipsis" size={18} color={t.ink} /></Tap>} />
        <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: space.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {head}
          {canChat && (
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              <T v="micro" tone="muted">Messages</T>
              {r.note && (myMove || theirMove) ? null : r.note && <Bubble mine={r.fromId === me} who={r.fromId === me ? 'You' : r.other.displayName} body={r.note} />}
              {(data?.messages ?? []).map(m => <Bubble key={m.id} mine={m.senderId === me} who={m.senderId === me ? 'You' : r.other.displayName} body={m.body} when={relTime(m.createdAt)} />)}
              {(data?.messages.length ?? 0) === 0 && <T v="small" tone="muted">{pastWindow ? 'No messages on this one.' : 'Nothing yet. Say hi, sort out balls.'}</T>}
            </View>
          )}
        </ScrollView>
        <OptionSheet open={passing} onClose={() => setPassing(false)} title={`Pass on ${r.other.displayName}. They'll see why.`}
          options={(Object.keys(DECLINE_COPY) as DeclineReason[]).map(k => ({ label: DECLINE_COPY[k], onPress: () => act('decline', () => api.decline(r.id, k)) }))} />
        <OptionSheet open={more} onClose={() => setMore(false)} options={[
          { label: `See ${r.other.displayName}'s profile`, onPress: () => router.push(`/player/${r.other.id}`) },
          ...((r.state === 'confirmed' || r.state === 'accepted') && !pastWindow ? [{ label: 'Suggest another time', sub: `${r.other.displayName} has to agree again.`, onPress: () => router.push({ pathname: '/request/[id]', params: { id: r.other.id, counter: r.id } }) }] : []),
          ...(['pending', 'countered', 'accepted', 'confirmed'].includes(r.state) && !pastWindow ? [{ label: 'Cancel this hit', sub: `${r.other.displayName} is told.`, onPress: () => act('cancel', () => api.cancelRequest(r.id)), danger: true }] : []),
          { label: 'Report', sub: 'Goes to a person, same day', onPress: () => router.push(`/player/${r.other.id}?report=1`), danger: true },
          { label: `Block ${r.other.displayName}`, onPress: () => act('block', async () => { await api.block(r.other.id); router.replace('/(tabs)'); }), danger: true },
        ]} />
      </Centered>
    </Screen>
  );
}

// The wait is the planning window. The kids just agreed to hit; this is exactly when
// they'd sort out details anyway.
function WaitingOnParent({ r, me, setPlan, plan }: { r: HitRequest; me: Profile; setPlan: (p: Partial<HitPlan>) => void; plan: { label?: string; values: string[]; note?: string }[] }) {
  const s = useS();
  const mine = r.approvals.find(a => a.minorId === me.id) ?? null;
  const theirs = r.approvals.find(a => a.minorId === r.other.id) ?? null;
  const light = (a: typeof mine, who: string) => {
    if (!a) return null;
    const st = a.decision === true ? 'approved' : a.seenAt ? 'looking' : 'sent';
    return (
      <View key={who} style={{ flex: 1, gap: 6 }}>
        <View style={[s.light, st === 'approved' && s.lightOn, st === 'looking' && s.lightHalf]} />
        <T v="smallM">{who}</T>
        <T v="meta" tone="muted">{st === 'approved' ? `Approved ${a.decidedAt ? relTime(a.decidedAt) + ' ago' : ''}` : st === 'looking' ? `Opened it ${a.seenAt ? relTime(a.seenAt) + ' ago' : ''}` : 'Sent'}</T>
      </View>
    );
  };
  return (
    <Animated.View entering={FadeIn.duration(150)}>
      <Pill label="Waiting on a parent" icon="users" />
      <T v="display" style={st.h}>Almost on.</T>
      <T v="small" tone="muted" style={st.sub}>{r.other.displayName} is in. While the parents look, sort out the hit.</T>
      <PlanPanel groups={plan} />
      <T v="micro" tone="muted" style={st.k}>Parents</T>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {light(mine, 'Your parent')}
          {light(theirs, `${r.other.displayName}'s parent`)}
          {!mine && !theirs && <T v="small" tone="muted">Confirming…</T>}
        </View>
      </Card>
      <Logistics r={r} me={me} setPlan={setPlan} />
    </Animated.View>
  );
}

// Small, one-tap, both sides see it.
function Logistics({ r, me, setPlan, onTheDay }: { r: HitRequest; me: Profile; setPlan: (p: Partial<HitPlan>) => void; onTheDay?: boolean }) {
  const p = r.plan;
  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: space.md }}><T v="micro" tone="muted" style={{ marginBottom: 7 }}>{k}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{children}</View></View>
  );
  return (
    <>
      <T v="micro" tone="muted" style={st.k}>The plan</T>
      <Card style={{ paddingBottom: 5 }}>
        <Row k="Balls">
          <Pill label="I've got them" on={p.ballsById === me.id} onPress={() => setPlan({ ballsById: me.id })} />
          <Pill label={`${r.other.displayName} has them`} on={p.ballsById === r.other.id} onPress={() => setPlan({ ballsById: r.other.id })} />
        </Row>
        <Row k="What kind of hit">
          {(['drills', 'sets', 'both'] as const).map(f => <Pill key={f} label={f === 'both' ? 'Drill, then play' : f === 'sets' ? 'Sets' : 'Drills'} on={p.format === f} onPress={() => setPlan({ format: f })} />)}
        </Row>
        <Row k="Meet at">
          <Pill label="The courts" on={p.meetAt === 'court'} onPress={() => setPlan({ meetAt: 'court' })} />
          <Pill label="The gate" on={p.meetAt === 'gate'} onPress={() => setPlan({ meetAt: 'gate' })} />
        </Row>
        {onTheDay && (
          <Row k="On the day">
            <Pill label={p.lateById === me.id ? "You're running 5 late" : p.lateById === r.other.id ? `${r.other.displayName} is running 5 late` : 'Running 5 late'} on={!!p.lateById} onPress={() => setPlan({ lateById: p.lateById === me.id ? null : me.id })} />
          </Row>
        )}
      </Card>
    </>
  );
}

function Bubble({ mine, who, body, when }: { mine: boolean; who: string; body: string; when?: string }) {
  const s = useS();
  return (
    <View style={[s.msg, mine && s.msgMine]}>
      <T v="micro" tone={mine ? 'greenText' : 'muted'} style={{ fontSize: 10, lineHeight: 13 }}>{who}{when ? ` · ${when}` : ''}</T>
      <T v="small" tone={mine ? 'greenText' : 'ink'} style={{ marginTop: 2 }}>{body}</T>
    </View>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  sub: { marginBottom: 18, lineHeight: 21 },
  k: { marginTop: 24, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  more: { minWidth: hit.min, minHeight: hit.min, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  summary: { backgroundColor: fixed.member, borderRadius: 16, padding: 23, borderWidth: 1, borderColor: fixed.memberLine, overflow: 'hidden' },
  summaryArt: { position: 'absolute', right: -24, top: -10, opacity: 0.65 },
  summaryRule: { height: 1, backgroundColor: fixed.memberRule, marginVertical: 15 },
});
const useS = makeStyles(c => ({
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  light: { height: 6, borderRadius: 3, backgroundColor: c.line },
  lightHalf: { backgroundColor: c.avatarLine },
  lightOn: { backgroundColor: c.green },
  input: { flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, color: c.ink, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 16 },
  msg: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  msgMine: { alignSelf: 'flex-end', backgroundColor: c.green, borderColor: c.green },
}));
