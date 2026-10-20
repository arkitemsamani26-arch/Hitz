// The invitation review. One plan on a panel: when, where, what kind of hit. Every line
// can be changed; one button sends it. Also used to suggest another time for an
// invitation someone sent you.
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Loading } from '@/ui/Loading';
import { PlanPanel } from '@/ui/Plan';
import { OptionSheet } from '@/ui/Sheet';
import { WindowEditor } from '@/ui/WindowEditor';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useNextWindow, type Window } from '@/store/window';
import { useAsync } from '@/store/useAsync';
import { dateLong, rangeText, tzName } from '@/lib/format';
import { endOf, overlapLine } from '@/lib/match';
import { haptic } from '@/lib/haptics';
import { midpointCourt } from '@/lib/courts';
import type { DoublesRole } from '@/data/types';

const HITS = ['Warm up, then practice sets', 'Rally and drills', 'A match', 'Whatever works on the day'];

export default function Invitation() {
  // `court` comes from a court's page: "invite them to meet here".
  // `pairing`, `start`, `end` and `note` come from a coach's suggestion: the invitation
  // arrives filled in, and sending it tells the coach it went out.
  // `doubles`, `match`, `role` and `tournament` come from doubles: asking a partner (from a
  // tournament or the doubles list) or an opponent into a game you set up.
  const { id, counter, court: atCourt, pairing, start: pStart, end: pEnd, note: pNote, doubles: pDoubles, match, role: pRole, tournament } =
    useLocalSearchParams<{ id: string; counter?: string; court?: string; pairing?: string; start?: string; end?: string; note?: string;
      doubles?: string; match?: string; role?: string; tournament?: string }>();
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
  const next = useNextWindow(profile?.availabilityMask ?? 0);

  const [win, setWin] = useState<Window>(() => {
    if (!pStart || !pEnd) return next;
    const s0 = new Date(pStart), e0 = new Date(pEnd);
    return s0 > new Date() ? { start: s0, durMin: Math.max(30, Math.round((e0.getTime() - s0.getTime()) / 60000)) } : next;
  });
  const [courtId, setCourtId] = useState<string | null>(atCourt ?? null);
  const [kind, setKind] = useState(HITS[0]);
  const [note, setNote] = useState(pNote ?? '');
  const [editing, setEditing] = useState<null | 'time' | 'court' | 'kind' | 'format'>(null);
  const [format, setFormat] = useState<'singles' | 'doubles'>(pDoubles || match ? 'doubles' : 'singles');
  const [role, setRole] = useState<DoublesRole>(pRole === 'opponent' ? 'opponent' : 'partner');
  const doubles = format === 'doubles';
  const [busy, setBusy] = useState(false);
  // A counter starts from what they proposed, so the change you make is the whole message.
  useEffect(() => {
    const r = original?.request; if (!r) return;
    const start = new Date(r.windowStart);
    setWin({ start, durMin: Math.max(30, Math.round((new Date(r.windowEnd).getTime() - start.getTime()) / 60000)) });
  }, [original]);

  // Default to the court halfway between your two home courts, so neither of you drives
  // the whole way; then theirs, then yours.
  const middle = useMemo(() => (courts && profile && player ? midpointCourt(profile.homeCourtId, player.homeCourtId, courts.map(c => c.id)) : null), [courts, profile, player]);
  const chosenCourt = courtId ?? original?.request.courtId ?? middle ?? player?.homeCourtId ?? profile?.homeCourtId ?? courts?.[0]?.id ?? null;
  const court = courts?.find(c => c.id === chosenCourt) ?? null;
  const theirs = original?.request ?? null;
  const unchanged = !!theirs && theirs.courtId === chosenCourt && new Date(theirs.windowStart).getTime() === win.start.getTime()
    && new Date(theirs.windowEnd).getTime() === endOf(win).getTime();
  const when = useMemo(() => (profile && player ? overlapLine(profile, player, win) : null), [profile, player, win]);

  const send = async () => {
    if (!player || !chosenCourt || busy) return;
    setBusy(true);
    try {
      const start = win.start, end = endOf(win);
      const body = isCounter ? null : [kind, note.trim()].filter(Boolean).join(' · ');
      const r = isCounter ? await api.counter(counter!, chosenCourt, start, end)
        : await api.sendRequest(player.id, chosenCourt, start, end, body, doubles ? { matchId: match ?? null, role, tournamentId: tournament ?? null } : undefined);
      if (pairing) await api.pairingSent(pairing, r.id).catch(() => {});
      haptic.sent();
      toast(isCounter ? `Sent ${player.displayName} your counter.`
        : doubles ? `Asked ${player.displayName} ${role === 'partner' ? 'to be your partner' : 'to play against you'}.`
        : `Invitation sent to ${player.displayName}. It's on when they accept.`);
      // An opponent joins a game you set up: back to that game. A new doubles game opens on
      // its own page, where you find opponents next.
      router.replace(isCounter ? `/hit/${r.id}` : match ? `/hit/${match}` : doubles ? `/hit/${r.id}` : '/(tabs)/hits');
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't send that. Your plan is still here."); setBusy(false); }
  };

  if (!player || !courts || (isCounter && !original) || !profile) return <Screen><Centered><Header backLabel="Back to players" /><Loading /></Centered></Screen>;

  const why = !courtId && !original && court ? (court.id === middle && court.id !== player.homeCourtId && court.id !== profile.homeCourtId ? 'About halfway between your home courts. ' : court.id === player.homeCourtId ? `${player.displayName}'s home court. ` : court.id === profile.homeCourtId ? 'Your home court. ' : '') : '';
  const courtNote = why + (court?.access === 'club' ? 'Club court: membership or a guest pass may apply. Booking not checked.' : 'Court access and booking availability not checked.');
  return (
    <Screen bottom={
      <Centered>
        <Button title={isCounter ? (unchanged ? 'Change the day, time or court' : 'Send the counter') : 'Send invite'} arrow onPress={send} loading={busy} disabled={!chosenCourt || unchanged} />
        <T v="meta" tone="muted" style={{ marginTop: 12, lineHeight: 18 }}>
          {api.mode === 'demo' ? 'Demo mode. Nobody real receives this.' : isCounter
            ? `${player.displayName} gets a notification. Nothing is set until they agree to the new time.`
            : `${player.displayName} gets a notification. Nothing is confirmed until they accept${profile.band === 'minor' ? ' and a parent approves' : ''}.`}
        </T>
      </Centered>
    }>
      <Centered>
        <Header backLabel={isCounter ? 'Back' : 'Back to players'} />
        <T v="eyebrow" tone="muted">{isCounter ? 'A counterproposal' : doubles ? (role === 'partner' ? 'Doubles, as your partner' : 'Doubles, as an opponent') : 'A little more court time'}</T>
        <T v="display" style={{ marginTop: 12, marginBottom: 12 }} accessibilityRole="header">
          {isCounter ? <>Another time.{'\n'}<T v="display" italic>Same good company.</T></>
            : doubles ? (role === 'partner' ? <>Your side{'\n'}<T v="display" italic>of the net.</T></> : <>The other side{'\n'}<T v="display" italic>of the net.</T></>)
            : <>Same court.{'\n'}<T v="display" italic>Good company.</T></>}
        </T>
        <T v="small" tone="muted" style={{ marginBottom: 24, lineHeight: 21 }}>
          {isCounter ? `${player.displayName} suggested ${theirs ? `${dateLong(new Date(theirs.windowStart))}, ${rangeText(new Date(theirs.windowStart), new Date(theirs.windowEnd))} at ${theirs.courtName}` : 'a time'}. Suggest what works for you.` : `Your invitation to ${player.displayName} ${player.lastInitial ? player.lastInitial + '.' : ''}`}
        </T>

        <PlanPanel groups={[
          { label: dateLong(win.start), values: [`${rangeText(win.start, endOf(win))} · ${tzName()}`], note: when ? (when.known ? when.text : `${when.text}. It is outside what they have said about their week.`) : undefined, onPress: () => setEditing(e => e === 'time' ? null : 'time'), editLabel: 'Change the day or time' },
          { label: 'Suggested court', values: [court?.name ?? 'Pick a court'], note: courtNote, onPress: () => setEditing('court'), editLabel: 'Change the court' },
          ...(isCounter ? [] : [
            { label: 'Singles or doubles', values: [doubles ? (role === 'partner' ? 'Doubles · they are your partner' : 'Doubles · they play against you') : 'Singles'],
              note: doubles ? (match ? 'They join the game you set up. Everyone in it has to be someone each of you could invite.' : 'Once they say yes, find two opponents from the hit page.') : undefined,
              onPress: match ? undefined : () => setEditing('format'), editLabel: 'Change singles or doubles' },
            { label: 'The hit', values: [kind], onPress: () => setEditing('kind'), editLabel: 'Change the kind of hit' },
            { label: 'Balls', values: ['You bring them'], note: 'Whoever asks brings the balls. You can switch it in the plan once it is on.' },
          ]),
        ]} style={{ marginBottom: 18 }}>
          {editing === 'time' && (
            <View style={{ marginTop: 17 }}>
              <WindowEditor value={win} onChange={setWin} onDone={() => setEditing(null)} />
            </View>
          )}
        </PlanPanel>

        {!isCounter && (
          <Field label="A line, if you want" value={note} onChangeText={setNote} placeholder="Down for sets, or just drilling?" maxLength={140} accessibilityLabel="A line to send with the invitation" />
        )}

        <OptionSheet open={editing === 'court'} onClose={() => setEditing(null)} title="Where"
          options={courts.map(c => ({ label: c.name, sub: [c.id === player.homeCourtId ? 'Their home court' : c.id === profile.homeCourtId ? 'Your home court' : null, c.access === 'club' ? 'Club' : 'Public', c.indoor ? 'Indoor' : null, c.distanceBucket].filter(Boolean).join(' · '), onPress: () => setCourtId(c.id) }))} />
        <OptionSheet open={editing === 'format'} onClose={() => setEditing(null)} title="Singles or doubles"
          options={[
            { label: 'Singles', sub: 'The two of you', onPress: () => setFormat('singles') },
            { label: 'Doubles, as your partner', sub: 'You find two opponents together', onPress: () => { setFormat('doubles'); setRole('partner'); } },
          ]} />
        <OptionSheet open={editing === 'kind'} onClose={() => setEditing(null)} title="What kind of hit"
          options={HITS.map(h => ({ label: h, onPress: () => setKind(h) }))} />
        <View style={{ height: space.lg }} />
      </Centered>
    </Screen>
  );
}
