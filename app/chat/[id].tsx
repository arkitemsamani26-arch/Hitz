// One conversation. It belongs to a hit, so the hit sits at the top; sharing your number
// lives here too, because this is where you would think to ask for it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Avatar';
import { Icon } from '@/ui/Icon';
import { Pill } from '@/ui/Pill';
import { Loading } from '@/ui/Loading';
import { useToast } from '@/ui/Toast';
import { font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { emit } from '@/store/bus';
import { useGoBack } from '@/lib/nav';
import { chatDay, chatTime, hitShort } from '@/lib/format';
import { statusOf } from '@/lib/status';
import { haptic } from '@/lib/haptics';
import type { HitRequest, Message } from '@/data/types';

const OPEN = ['pending', 'countered', 'accepted', 'confirmed'];

// The things people actually type to each other before a hit, one tap to send, the way a
// phone's own messages app offers them.
function quickReplies(r: HitRequest, me: string): string[] {
  const start = new Date(r.windowStart).getTime();
  const hours = (start - Date.now()) / 3600000;
  const day = hours > -2 && hours < 18;
  const balls = r.plan.ballsById === me ? "I'll bring a new can of balls" : 'Can you bring balls?';
  if (r.state === 'pending' || r.state === 'countered') return ['Does that time work?', 'Can we do a bit later?', 'Sets or drills?', balls];
  if (day) return ['On my way', 'Running 5 minutes late', "I'm at the courts", 'Which court number?'];
  return ['Sounds good', balls, 'Warm up, then sets?', 'See you there'];
}

type Row = { kind: 'day'; label: string; key: string } | { kind: 'msg'; m: Message; mine: boolean; last: boolean; first: boolean; key: string };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/messages');
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.hit(id), [id, tick]);
  const shares = useAsync(() => api.sharedPhones(id), [id, tick]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  // The box grows with what you type, up to about five lines.
  const [boxH, setBoxH] = useState(46);
  const [focus, setFocus] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  // Whether a parent runs the other player's account, so the thread can say who is typing.
  const parentRun = useAsync(() => (data?.request ? api.parentRun([data.request.other.id]) : Promise.resolve([] as string[])), [data?.request?.other.id]);
  const r = data?.request;
  const msgs = data?.messages ?? [];

  // Opening the thread reads it; so does a new message arriving while it is open.
  useEffect(() => {
    if (!r) return;
    void api.markRead(r.id).then(() => emit('inbox'), () => {});
  }, [r?.id, msgs.length]);

  const rows = useMemo<Row[]>(() => {
    if (!profile) return [];
    const all: Message[] = [];
    // The line that came with the invitation is the first thing said in the thread.
    if (r?.note) all.push({ id: 'note', hitId: r.id, senderId: r.fromId, body: r.note, createdAt: r.createdAt });
    all.push(...msgs);
    const out: Row[] = [];
    let lastDay = '';
    all.forEach((m, i) => {
      const d = chatDay(m.createdAt);
      if (d !== lastDay) { out.push({ kind: 'day', label: d, key: `d-${m.id}` }); lastDay = d; }
      const prev = all[i - 1], next = all[i + 1];
      const near = (a?: Message, b?: Message) => !!a && !!b && a.senderId === b.senderId && Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < 5 * 60000 && chatDay(a.createdAt) === chatDay(b.createdAt);
      out.push({ kind: 'msg', m, mine: m.senderId === profile.id, first: !near(prev, m), last: !near(m, next), key: m.id });
    });
    return out;
  }, [msgs, r, profile]);

  if (loading && !data) return <Screen><Centered><Loading /></Centered></Screen>;
  if (!r || !profile) return (
    <Screen><Centered>
      <Tap onPress={goBack} style={st.back} accessibilityRole="button" accessibilityLabel="Back"><Icon name="arrow-left" size={18} color={t.ink} /></Tap>
      <T v="body" tone="muted">This conversation is gone.</T>
    </Centered></Screen>
  );

  const me = profile.id;
  const open = OPEN.includes(r.state) && new Date(r.windowEnd) > new Date(Date.now() - 6 * 3600000);
  const confirmed = r.state === 'confirmed' || r.state === 'completed';
  const status = statusOf(r, me);
  const mine = (shares.data ?? []).find(x => x.mine);
  const theirs = (shares.data ?? []).find(x => !x.mine);
  const who = r.other.displayName;

  const send = async (body = text) => {
    const b = body.trim(); if (!b || sending) return;
    const typed = body === text;
    setSending(true);
    try {
      await api.sendMessage(r.id, b); if (typed) { setText(''); setBoxH(46); } haptic.tick(); await reload();
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't send. Your message is still here."); }
    finally { setSending(false); }
  };
  const share = async () => {
    setSharing(true);
    try { await api.sharePhone(r.id, !mine); await shares.reload(); toast(mine ? 'Your number is hidden again.' : `${who} can see your number for this hit.`); }
    catch (e: any) { toast(e?.message ?? "Couldn't change that."); }
    finally { setSharing(false); }
  };
  const digits = theirs?.phone.replace(/[^+\d]/g, '') ?? '';

  return (
    <Screen scroll={false} pad={false} bottom={open ? (
      <Centered style={{ flex: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.quickBar} contentContainerStyle={st.quick} keyboardShouldPersistTaps="handled">
          {quickReplies(r, me).map(q => (
            <Tap key={q} onPress={() => void send(q)} disabled={sending} style={s.chip} accessibilityRole="button" accessibilityLabel={`Send: ${q}`}>
              <T v="small">{q}</T>
            </Tap>
          ))}
        </ScrollView>
        <View style={st.composer}>
          <TextInput ref={input} value={text} onChangeText={setText} placeholder={`Message ${who}`} placeholderTextColor={t.muted}
            style={[s.input, { height: boxH }, focus && s.inputOn]} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} multiline numberOfLines={1} maxLength={2000}
            onContentSizeChange={e => setBoxH(Math.min(120, Math.max(46, Math.ceil(e.nativeEvent.contentSize.height))))} accessibilityLabel={`Message ${who}`} editable={!sending}
            onSubmitEditing={() => void send()} blurOnSubmit={false} returnKeyType="send" />
          <Tap onPress={() => void send()} disabled={!text.trim() || sending} style={[s.send, (!text.trim() || sending) && { opacity: 0.45 }]}
            accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !text.trim() || sending }}>
            <Icon name="send" size={18} color={t.greenText} />
          </Tap>
        </View>
      </Centered>
    ) : (
      <Centered style={{ flex: 0 }}>
        <T v="small" tone="muted" style={{ marginBottom: space.sm }}>
          {r.state === 'completed' || (confirmed && !open) ? 'This hit has happened. The thread stays here.' : 'This hit is closed, so the thread is too.'}
        </T>
        <Button title={`Invite ${who} again`} arrow onPress={() => router.push(`/request/${r.other.id}`)} />
      </Centered>
    )}>
      <Centered style={{ paddingHorizontal: 0 }}>
        {/* Who, and which hit. Tapping either goes there. */}
        <View style={s.head}>
          <Tap onPress={goBack} style={st.back} accessibilityRole="button" accessibilityLabel="Back to messages"><Icon name="arrow-left" size={18} color={t.ink} /></Tap>
          <Tap onPress={() => router.push(`/player/${r.other.id}`)} style={st.who} accessibilityRole="button" accessibilityLabel={`${who}'s profile`}>
            <Avatar name={who} lastInitial={r.other.lastInitial} photo={r.other.photoUrl} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="bodyM" numberOfLines={1}>{who}{r.other.lastInitial ? ` ${r.other.lastInitial}.` : ''}</T>
              <T v="meta" tone="muted" numberOfLines={1}>{r.other.levelValue != null ? `${r.other.levelValue.toFixed(1)} UTR` : 'No rating yet'}{r.other.age != null ? ` · Age ${r.other.age}` : ''}</T>
            </View>
          </Tap>
          {theirs && (
            <Tap onPress={() => void Linking.openURL(`tel:${digits}`)} style={st.icon} accessibilityRole="button" accessibilityLabel={`Call ${who}`}>
              <Icon name="phone" size={18} color={t.ink} />
            </Tap>
          )}
          <Tap onPress={() => router.push(`/hit/${r.id}`)} style={st.icon} accessibilityRole="button" accessibilityLabel="Open the hit">
            <Icon name="calendar-days" size={18} color={t.ink} />
          </Tap>
        </View>

        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={st.thread} keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} showsVerticalScrollIndicator={false}>
          {/* The hit this conversation is about. */}
          <Tap onPress={() => router.push(`/hit/${r.id}`)} style={s.hitCard} accessibilityRole="button" accessibilityLabel={`${status.label}. ${hitShort(r.windowStart)} at ${r.courtName}. Open the hit.`}>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Pill label={status.label} icon={status.icon} />
              <T v="smallM" style={{ marginTop: 6 }}>{hitShort(r.windowStart)} · {r.courtName}</T>
              <T v="meta" tone="muted">{r.plan.ballsById === me ? 'You bring the balls' : r.plan.ballsById === r.other.id ? `${who} brings the balls` : 'Balls: not decided'}</T>
            </View>
            <Icon name="chevron-right" size={16} color={t.muted} />
          </Tap>

          {/* Numbers: off by default, one hit at a time, here where you would ask for one. */}
          {confirmed && open && (
            <View style={s.numbers}>
              {theirs ? (
                <View style={st.numRow}>
                  <Icon name="phone" size={15} color={t.ink} />
                  <View style={{ flex: 1 }}>
                    <T v="meta" tone="muted">{who} shared a number</T>
                    <T v="bodyM">{theirs.phone}</T>
                  </View>
                  <Button title="Text" small kind="line" onPress={() => void Linking.openURL(`sms:${digits}`)} />
                </View>
              ) : (
                <T v="small" tone="muted">{who} hasn't shared a number for this hit.</T>
              )}
              <View style={[st.numRow, { marginTop: space.sm }]}>
                <T v="small" tone="muted" style={{ flex: 1 }}>{mine ? `Your number is shared with ${who}, just for this hit.` : 'Rather text? Share your number for this hit only.'}</T>
                <Button title={mine ? 'Hide' : 'Share my number'} small kind={mine ? 'ghost' : 'primary'} onPress={share} loading={sharing} />
              </View>
            </View>
          )}
          {!confirmed && open && (
            <T v="meta" tone="muted" style={st.center}>You can share phone numbers once the hit is confirmed.</T>
          )}
          {profile.runByParent
            ? <T v="meta" tone="muted" style={st.center}>You're writing as {profile.displayName}.</T>
            : profile.band === 'minor' && <T v="meta" tone="muted" style={st.center}>Your parent can read this conversation.</T>}
          {(parentRun.data ?? []).includes(r.other.id) && <T v="meta" tone="muted" style={st.center}>A parent runs {who}'s account, so a parent may be the one writing.</T>}

          {rows.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: 6 }}>
              <T v="smallM">Say hi to {who}.</T>
              <T v="meta" tone="muted" style={{ textAlign: 'center' }}>Sort out the court, the balls, and where to meet.</T>
            </View>
          )}
          {rows.map(row => row.kind === 'day'
            ? <T key={row.key} v="meta" tone="muted" style={[st.center, { marginTop: space.md }]}>{row.label}</T>
            : (
              <View key={row.key} style={[st.msgWrap, row.mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }, !row.first && { marginTop: 2 }]}>
                <View style={[s.bubble, row.mine ? s.mine : s.theirs, row.mine ? (row.last ? s.mineTail : null) : (row.last ? s.theirsTail : null)]}>
                  <T v="body" tone={row.mine ? 'greenText' : 'ink'} style={{ fontSize: 15, lineHeight: 21 }}>{row.m.body}</T>
                </View>
                {row.last && <T v="meta" tone="muted" style={{ fontSize: 11, marginTop: 3, marginHorizontal: 4 }}>{row.m.id === 'note' ? 'With the invitation' : chatTime(row.m.createdAt)}</T>}
              </View>
            ))}
        </ScrollView>
      </Centered>
    </Screen>
  );
}

const st = StyleSheet.create({
  back: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: hit.min },
  icon: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  thread: { paddingHorizontal: 16, paddingTop: space.md, paddingBottom: space.lg, gap: 0 },
  center: { textAlign: 'center', marginVertical: 6 },
  msgWrap: { marginTop: 10 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // A fixed height: a horizontal list in a column collapses to nothing on the web otherwise.
  quickBar: { flexGrow: 0, flexShrink: 0, height: 44 + space.sm },
  quick: { gap: 7, paddingBottom: space.sm, paddingRight: 4, alignItems: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
});
const useS = makeStyles(c => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.line },
  hitCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, marginBottom: space.sm },
  numbers: { padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, marginBottom: space.sm },
  bubble: { maxWidth: '82%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18 },
  mine: { backgroundColor: c.green },
  theirs: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  mineTail: { borderBottomRightRadius: 5 },
  theirsTail: { borderBottomLeftRadius: 5 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.card },
  input: { flex: 1, height: 46, minHeight: 46, maxHeight: 120, borderRadius: 23, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, color: c.ink, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: font.regular, fontSize: 16, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null) },
  inputOn: { borderColor: c.green, borderWidth: 2, paddingHorizontal: 15 },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
}));
