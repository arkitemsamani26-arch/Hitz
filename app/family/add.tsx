// Add a child the parent will run. Everything a child's profile needs, on one screen: the
// parent knows the answers, and the child does not need a phone. The account is the
// parent's to use (switch to the child from the family view) until the child is 13 and
// gets a sign-in of their own.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { OptionSheet } from '@/ui/Sheet';
import { AvailabilityGrid } from '@/ui/Availability';
import { useToast } from '@/ui/Toast';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { haptic } from '@/lib/haptics';
import type { LevelSource, PlayFormat } from '@/data/types';

// The same scale the player's own level step uses, in a parent's words.
const LEVELS: { label: string; v: number }[] = [
  { label: 'Just starting', v: 2.0 }, { label: 'Can hold a rally', v: 3.5 }, { label: 'Plays matches', v: 5.0 },
  { label: 'Plays tournaments', v: 7.0 }, { label: 'Ranked', v: 9.0 },
];
const FORMATS: { v: PlayFormat; label: string }[] = [{ v: 'singles', label: 'Singles' }, { v: 'doubles', label: 'Doubles' }, { v: 'either', label: 'Either' }];

function parse(v: string): string | null {
  const m = v.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/); if (!m) return null;
  const [, mm, dd, yyyy] = m; const d = new Date(+yyyy, +mm - 1, +dd);
  if (d.getMonth() !== +mm - 1 || d > new Date() || +yyyy < 1990) return null;
  return `${yyyy}-${mm}-${dd}`;
}
function ageOf(iso: string) { const d = new Date(iso + 'T12:00:00'); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }

export default function AddChild() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { refresh } = useSession();
  const courts = useAsync(() => api.courts(), []);
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('');
  const [bday, setBday] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [utr, setUtr] = useState('');
  const [court, setCourt] = useState<string | null>(null);
  const [mask, setMask] = useState(0);
  const [format, setFormat] = useState<PlayFormat>('either');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const dob = useMemo(() => parse(bday), [bday]);
  const age = dob ? ageOf(dob) : null;
  const ageProblem = age == null ? null : age >= 18 ? 'At 18 they sign up themselves.' : age < 4 ? 'Check the birthday. Hits is for kids four and up.' : null;
  const typedUtr = parseFloat(utr);
  const utrOk = !isNaN(typedUtr) && typedUtr >= 1 && typedUtr <= 16.5;
  const levelValue = utrOk ? typedUtr : level;
  const levelSource: LevelSource | null = utrOk ? 'utr_self' : level != null ? 'estimated' : null;
  const courtName = courts.data?.find(c => c.id === court)?.name ?? null;
  const ready = name.trim().length > 0 && !!dob && !ageProblem && levelValue != null && !!court;
  const who = name.trim() || 'your child';

  const onBday = (x: string) => {
    const d = x.replace(/\D/g, '').slice(0, 8);
    setBday(d.length > 4 ? `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d);
  };

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await api.addChild({ displayName: name.trim(), lastInitial: initial.trim() || null, dateOfBirth: dob!, levelValue, levelSource,
        homeCourtId: court, availabilityMask: mask, playFormat: format });
      haptic.confirmed();
      await refresh();
      toast(`${name.trim()} is set up. Switch to them from your family to find a hit.`);
      if (first) router.replace('/guardian'); else router.back();
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't add them."); setBusy(false); }
  };

  return (
    <Screen bottom={<Centered><Button title={name.trim() ? `Add ${name.trim()}` : 'Add your child'} arrow onPress={save} loading={busy} disabled={!ready} /></Centered>}>
      <Centered>
        <Header back={!first} backLabel="Your family" />
        <T v="eyebrow" tone="muted">For your kid</T>
        <T v="display" style={st.h} accessibilityRole="header">Add your{'\n'}<T v="display" italic>child.</T></T>
        <T v="small" tone="muted" style={{ marginBottom: space.lg, lineHeight: 21 }}>
          You run their account from your phone: you find the hit with them, you send it, and you see every message. They don't need a phone or a sign-in of their own.
        </T>

        <View style={st.row2}>
          <View style={{ flex: 1 }}><Field label="First name" value={name} onChangeText={setName} placeholder="Lily" autoCapitalize="words" maxLength={40} accessibilityLabel="Their first name" /></View>
          <View style={{ width: 96 }}><Field label="Last initial" value={initial} onChangeText={x => setInitial(x.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase())} placeholder="S" maxLength={1} autoCapitalize="characters" accessibilityLabel="Their last initial" /></View>
        </View>

        <View style={{ marginTop: space.md }}>
          <Field label="Birthday" value={bday} onChangeText={onBday} placeholder="MM / DD / YYYY" keyboardType="number-pad" inputMode="numeric" accessibilityLabel="Their birthday, month day year" />
          <T v="meta" tone={ageProblem ? 'danger' : 'muted'} style={{ marginTop: 6 }}>
            {ageProblem ?? (age != null ? `${who} is ${age}. Only players near their age see them, and never an adult.` : 'Private. Other players see their age in years, nothing more.')}
          </T>
        </View>

        <T v="micro" tone="muted" style={st.k}>How {who} plays</T>
        <View style={st.chips}>
          {LEVELS.map(l => <Pill key={l.v} label={l.label} on={!utrOk && level === l.v} onPress={() => { setLevel(l.v); setUtr(''); }} />)}
        </View>
        <View style={{ marginTop: space.sm, maxWidth: 200 }}>
          <Field label="Or their UTR" value={utr} onChangeText={x => setUtr(x.replace(/[^0-9.]/g, '').slice(0, 5))} placeholder="4.5" keyboardType="decimal-pad" inputMode="decimal" accessibilityLabel="Their UTR, if you know it" />
        </View>

        <T v="micro" tone="muted" style={st.k}>Where they play</T>
        <Tap onPress={() => setPicking(true)} style={s.court} accessibilityRole="button" accessibilityLabel={courtName ? `Home court: ${courtName}. Change.` : 'Choose their home court'}>
          <Icon name="map-pin" size={17} color={t.ink} />
          <View style={{ flex: 1 }}>
            <T v="smallM">{courtName ?? 'Choose their home court'}</T>
            <T v="meta" tone="muted">Partners are found near here.</T>
          </View>
          <Icon name="chevron-right" size={15} color={t.muted} />
        </Tap>

        <T v="micro" tone="muted" style={st.k}>When they're usually free</T>
        <Card><AvailabilityGrid mask={mask} onToggle={bit => setMask(m => m ^ bit)} /></Card>

        <T v="micro" tone="muted" style={st.k}>Singles or doubles</T>
        <View style={st.chips}>
          {FORMATS.map(f => <Pill key={f.v} label={f.label} on={format === f.v} onPress={() => setFormat(f.v)} />)}
        </View>

        <Card style={{ marginTop: space.lg, gap: 6 }}>
          <T v="smallM">What changes when you run it</T>
          <T v="small" tone="muted">
            Hits you send or accept as {who} count as your OK, so there is nothing extra to approve. Their texts and notifications come to your phone with their name on them. At 13 you can give them their own sign-in, and they keep everything.
          </T>
        </Card>

        <OptionSheet open={picking} onClose={() => setPicking(false)} title="Their home court"
          options={(courts.data ?? []).map(c => ({ label: c.name, sub: c.access === 'club' ? 'Club' : 'Public', onPress: () => setCourt(c.id) }))} />
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 14 },
  row2: { flexDirection: 'row', gap: space.sm },
  k: { marginTop: 24, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
const useS = makeStyles(c => ({
  court: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: hit.row },
}));
