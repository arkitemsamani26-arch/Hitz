// Auto-match, Plus. Say when, who, and how far; Hits invites the best fit, and if they pass
// or let it expire, the next, until one says yes or the time passes. Every invitation goes
// the ordinary way, with every rule, so a parent still approves a junior's.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { OptionSheet } from '@/ui/Sheet';
import { WindowEditor } from '@/ui/WindowEditor';
import { useToast } from '@/ui/Toast';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useNextWindow, type Window } from '@/store/window';
import { useAsync } from '@/store/useAsync';
import { endOf } from '@/lib/match';
import { dateLong, hitShort, rangeText, tzName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { isPlusError, plainMessage } from '@/lib/plus';

const RADII = [5, 10, 15, 25];
const BANDS: { label: string; d: number | null }[] = [{ label: '±0.5', d: 0.5 }, { label: '±1', d: 1 }, { label: '±2', d: 2 }, { label: 'Any level', d: null }];

export default function AutoMatchScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const current = useAsync(() => api.myAutoMatch(), [tick]);
  const courts = useAsync(() => api.courts(), []);
  const hits = useAsync(() => api.requests(), [tick]);
  const next = useNextWindow(profile?.availabilityMask ?? 0);
  const [win, setWin] = useState<Window>(() => {
    // At least an hour away, or the server says no.
    const soon = new Date(Date.now() + 2 * 3600000);
    return next.start > soon ? next : { start: soon, durMin: 90 };
  });
  const [editing, setEditing] = useState(false);
  const [band, setBand] = useState<number | null>(1);
  const [radius, setRadius] = useState(10);
  const [format, setFormat] = useState<'singles' | 'doubles'>('singles');
  const [courtId, setCourtId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<null | 'start' | 'cancel'>(null);
  const plus = !!profile?.plus;
  const my = profile?.levelValue ?? 6;
  const a = current.data;
  const active = a?.state === 'active';
  const court = courts.data?.find(c => c.id === (courtId ?? profile?.homeCourtId)) ?? null;
  const currentHit = useMemo(() => (hits.data ?? []).find(h => h.id === (a?.currentRequestId ?? a?.matchedRequestId)) ?? null, [hits.data, a]);
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);

  const start = async () => {
    setBusy('start');
    try {
      await api.autoMatch(win.start, endOf(win), band == null ? null : +(my - band).toFixed(2), band == null ? null : +(my + band).toFixed(2), radius, format, courtId);
      haptic.sent(); await current.reload(); await hits.reload();
      toast('On it. The first invitation is out.');
    } catch (e: any) {
      haptic.warn();
      if (isPlusError(e)) router.push('/plus?why=automatch'); else toast(plainMessage(e) || "Couldn't start that.");
    } finally { setBusy(null); }
  };
  const cancel = async () => {
    if (!a) return;
    setBusy('cancel');
    try { await api.cancelAutoMatch(a.id); await current.reload(); await hits.reload(); toast('Stopped. Any open invitation was taken back.'); }
    catch (e: any) { toast(e?.message ?? "Couldn't stop it."); }
    finally { setBusy(null); }
  };

  const statusCard = a && (
    <Card stripe={active} style={{ gap: space.sm, marginBottom: space.lg }}>
      <View style={st.line}>
        <View style={[s.icon, active && s.iconOn]}><Icon name="zap" size={17} color={active ? t.greenText : t.ink} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="smallM">{active ? `Finding you a partner for ${hitShort(a.windowStart)}` : a.state === 'done' ? `Matched for ${hitShort(a.windowStart)}` : a.state === 'expired' ? `Nobody could make ${hitShort(a.windowStart)}` : `Stopped for ${hitShort(a.windowStart)}`}</T>
          <T v="meta" tone="muted">{a.tried === 0 ? 'Looking' : a.tried === 1 ? 'Asked one player' : `Asked ${a.tried} players`}{currentHit ? ` · ${active ? 'waiting on' : 'with'} ${currentHit.other.displayName}` : ''}</T>
        </View>
      </View>
      {active && <T v="small" tone="muted" style={{ lineHeight: 19 }}>One invitation at a time, {a.format}, {a.levelLo != null && a.levelHi != null ? `UTR ${a.levelLo.toFixed(1)}–${a.levelHi.toFixed(1)}` : 'any level'}, within {a.radiusMi} miles. If they pass or let it lapse, Hits asks the next. It stops the moment someone says yes.</T>}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {currentHit && <Button title={active ? 'See the invitation' : 'Open the hit'} small kind={active ? 'line' : 'primary'} onPress={() => router.push(`/hit/${currentHit.id}`)} />}
        {active && <Button title="Stop" kind="ghost" small onPress={cancel} loading={busy === 'cancel'} />}
      </View>
    </Card>
  );

  return (
    <Screen bottom={!active && plus ? <Centered><Button title={canInvite ? 'Start auto-match' : 'Unlocks when your parent says yes'} arrow onPress={start} loading={busy === 'start'} disabled={!canInvite} /></Centered> : undefined}>
      <Centered>
        <Header backLabel="Discover" fallback="/(tabs)" />
        <T v="eyebrow" tone="muted">Auto-match · Plus</T>
        <T v="display" style={st.h} accessibilityRole="header">Say when.{'\n'}<T v="display" italic>Hits asks around.</T></T>
        <T v="small" tone="muted" style={{ marginBottom: space.lg, lineHeight: 21 }}>
          Hits invites the best fit for you. If they pass, the next. One at a time, every rule as usual, until someone says yes or the time passes.
        </T>

        {current.loading && !current.data ? <Loading /> : statusCard}

        {!plus ? (
          <Card style={{ gap: space.sm }}>
            <T v="smallM">Part of Plus</T>
            <T v="small" tone="muted">$4.99 a month, with unlimited invitations, every filter, your stats and more.</T>
            <Button title={profile?.band === 'minor' ? 'Ask your parent for Plus' : 'See Plus'} arrow onPress={() => router.push('/plus?why=automatch')} />
          </Card>
        ) : !active && (
          <>
            <T v="micro" tone="muted" style={st.k}>When</T>
            <Tap onPress={() => setEditing(e => !e)} style={s.field} accessibilityRole="button" accessibilityLabel={`${dateLong(win.start)}, ${rangeText(win.start, endOf(win))}. Change the day or time.`} accessibilityState={{ expanded: editing }}>
              <Icon name="calendar" size={17} color={t.ink} />
              <View style={{ flex: 1 }}>
                <T v="smallM">{dateLong(win.start)}</T>
                <T v="meta" tone="muted">{rangeText(win.start, endOf(win))} · {tzName()}</T>
              </View>
              <Icon name="chevron-right" size={15} color={t.muted} style={editing ? { transform: [{ rotate: '90deg' }] } : undefined} />
            </Tap>
            {editing && <View style={{ marginTop: space.sm }}><WindowEditor value={win} onChange={setWin} onDone={() => setEditing(false)} /></View>}

            <T v="micro" tone="muted" style={st.k}>Level, around your {my.toFixed(1)}</T>
            <View style={st.chips}>{BANDS.map(b => <Pill key={b.label} label={b.label} on={band === b.d} onPress={() => setBand(b.d)} />)}</View>
            <T v="micro" tone="muted" style={st.k}>Within</T>
            <View style={st.chips}>{RADII.map(r => <Pill key={r} label={`${r} mi`} on={radius === r} onPress={() => setRadius(r)} />)}</View>
            <T v="micro" tone="muted" style={st.k}>Singles or doubles</T>
            <View style={st.chips}>
              <Pill label="Singles" on={format === 'singles'} onPress={() => setFormat('singles')} />
              <Pill label="Doubles, find a partner" on={format === 'doubles'} onPress={() => setFormat('doubles')} />
            </View>
            <T v="micro" tone="muted" style={st.k}>Where</T>
            <Tap onPress={() => setPicking(true)} style={s.field} accessibilityRole="button" accessibilityLabel={`Court: ${court?.name ?? 'your home court'}. Change.`}>
              <Icon name="map-pin" size={17} color={t.ink} />
              <View style={{ flex: 1 }}>
                <T v="smallM">{court?.name ?? 'Your home court'}</T>
                <T v="meta" tone="muted">Court access and booking not checked</T>
              </View>
              <Icon name="chevron-right" size={15} color={t.muted} />
            </Tap>
            <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
              Each invitation says Hits matched you and carries your usual plan. Whoever says yes gets the ordinary hit: a conversation, the plan{profile?.band === 'minor' ? ', and both parents approve it' : ''}.
            </T>
          </>
        )}

        <OptionSheet open={picking} onClose={() => setPicking(false)} title="Where"
          options={(courts.data ?? []).map(c => ({ label: c.name, sub: [c.id === profile?.homeCourtId ? 'Your home court' : null, c.access === 'club' ? 'Club' : 'Public', c.indoor ? 'Indoor' : null].filter(Boolean).join(' · '), onPress: () => setCourtId(c.id) }))} />
        <View style={{ height: space.lg }} />
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  k: { marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
const useS = makeStyles(c => ({
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: hit.row },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: c.green },
}));
