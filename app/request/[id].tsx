// Court, day, time. Seconds, not minutes. Also used to counter an existing request.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Pill } from '@/ui/Pill';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Rally } from '@/ui/Rally';
import { Score } from '@/ui/Score';
import { useToast } from '@/ui/Toast';
import { color, hit, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { dayShort, timeShort } from '@/lib/format';
import { haptic } from '@/lib/haptics';

const TIMES = [{ label: 'Morning', h: 9 }, { label: 'Midday', h: 12 }, { label: 'Afternoon', h: 15 }, { label: 'Evening', h: 18 }];

export default function Request() {
  const { id, counter } = useLocalSearchParams<{ id: string; counter?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useSession();
  const isCounter = !!counter;
  // Countering needs the whole request, not just who sent it: you cannot sensibly
  // propose an alternative to something you cannot see.
  const { data: original } = useAsync(() => (isCounter ? api.hit(counter!) : Promise.resolve(null)), [counter]);
  const { data: found } = useAsync(() => (isCounter ? Promise.resolve(null) : api.player(id)), [id, counter]);
  const player = isCounter ? original?.request.other ?? null : found;
  const { data: courts } = useAsync(() => api.courts(), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + 1 + i); d.setHours(0, 0, 0, 0); return d; }), []);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // A counter usually keeps one of the two and changes the other, so start from their
  // court rather than from nothing.
  const chosenCourt = courtId ?? original?.request.courtId ?? player?.homeCourtId ?? profile?.homeCourtId ?? null;

  const send = async () => {
    if (!player || !chosenCourt) return;
    const start = new Date(days[day]); start.setHours(TIMES[time].h, 0, 0, 0);
    const end = new Date(start.getTime() + 90 * 60000);
    setBusy(true);
    try {
      const r = isCounter ? await api.counter(counter!, chosenCourt, start, end) : await api.sendRequest(player.id, chosenCourt, start, end, note.trim() || null);
      haptic.sent();
      router.replace(`/hit/${r.id}`);
    } catch (e: any) { toast(e.message); setBusy(false); }
  };

  if (!player || !courts || (isCounter && !original)) return <Screen sky={120}><Centered><Header /><Rally /></Centered></Screen>;

  const theirs = original?.request ?? null;
  const mineStart = (() => { const d = new Date(days[day]); d.setHours(TIMES[time].h, 0, 0, 0); return d; })();
  const mineCourt = courts.find(c => c.id === chosenCourt)?.name ?? '—';
  // Sending their own proposal back at them is not a counter. The button says so rather
  // than firing off a round trip that reads, to them, as no answer at all.
  const unchanged = !!theirs && theirs.courtId === chosenCourt
    && new Date(theirs.windowStart).getTime() === mineStart.getTime();
  return (
    <Screen sky={120} bottom={<Centered><Button kind="ball" title={isCounter ? (unchanged ? 'Change the day, time or court' : 'Send the counter') : `Send to ${player.displayName}`} onPress={send} loading={busy} disabled={!chosenCourt || unchanged} /></Centered>}>
      <Centered>
        <Header kicker={isCounter ? 'Counter' : 'Hit request'} />
        <Sheet style={s.who}>
          <View style={{ flex: 1 }}>
            <T v="h1">{player.displayName} {player.lastInitial}.</T>
            <T v="small" tone="ink2">{[player.distanceBucket, player.homeCourtName].filter(Boolean).join(' · ')}</T>
          </View>
          <Score value={player.levelValue} size="display" verified={player.levelVerified} tone="court" />
        </Sheet>
        {/* What you are answering. Countering without this on screen is countering blind:
            you are proposing an alternative to something you have to scroll back to read. */}
        {theirs && (
          <Sheet style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T v="micro" tone="ink3">They said</T>
              <T v="bodyM" tone="ink2">{dayShort(new Date(theirs.windowStart))} · {timeShort(new Date(theirs.windowStart))}</T>
              <T v="small" tone="ink3" numberOfLines={1}>{theirs.courtName}</T>
            </View>
            <T v="h2" tone="ink3">→</T>
            <View style={{ flex: 1 }}>
              <T v="micro" tone="court">You're saying</T>
              <T v="bodyM">{dayShort(mineStart)} · {timeShort(mineStart)}</T>
              <T v="small" tone="ink3" numberOfLines={1}>{mineCourt}</T>
            </View>
          </Sheet>
        )}

        <Sheet style={{ marginTop: space.md }}>

        <T v="micro" tone="ink3" style={[s.k, { marginTop: 0 }]}>Day</T>
        <View style={s.wrap}>{days.map((d, i) => <Pill key={i} label={dayShort(d)} on={day === i} onPress={() => setDay(i)} />)}</View>

        <T v="micro" tone="ink3" style={s.k}>Time</T>
        <View style={s.wrap}>{TIMES.map((t, i) => <Pill key={t.label} label={`${t.label} · ${t.h > 12 ? t.h - 12 : t.h}${t.h >= 12 ? 'pm' : 'am'}`} on={time === i} onPress={() => setTime(i)} />)}</View>

        <T v="micro" tone="ink3" style={s.k}>Court</T>
        {courts.map(c => {
          const on = c.id === chosenCourt;
          const theirs = c.id === player.homeCourtId;
          return (
            <Tap key={c.id} onPress={() => setCourtId(c.id)} tick style={s.court} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
              <View style={[s.ring, on && s.ringOn]} />
              <View style={{ flex: 1 }}>
                <T v="bodyM" tone={on ? 'ink' : 'ink2'}>{c.name}</T>
                <T v="small" tone="ink3">{[theirs ? 'Their home court' : c.id === profile?.homeCourtId ? 'Your home court' : null, c.indoor ? 'Indoor' : null].filter(Boolean).join(' · ')}</T>
              </View>
            </Tap>
          );
        })}

        {!isCounter && (
          <>
            <T v="micro" tone="ink3" style={s.k}>A line, if you want</T>
            <Field value={note} onChangeText={setNote} placeholder="Down for sets or just drilling?" maxLength={140} />
          </>
        )}
        </Sheet>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  k: { marginTop: space.xl, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  court: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.min + 4, paddingVertical: space.sm },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.hair2 },
  ringOn: { backgroundColor: color.ball, borderColor: color.ink },
});
