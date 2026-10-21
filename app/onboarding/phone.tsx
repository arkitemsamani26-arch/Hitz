import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { Wordmark } from '@/ui/Wordmark';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Tap } from '@/ui/Tap';
import { fixed, radius, space } from '@/theme/tokens';
import { StyleSheet } from 'react-native';
import { makeStyles } from '@/theme/theme';
import { Court } from '@/ui/CourtArt';
import { api } from '@/data';
import { formatTyping, toE164 } from '@/lib/phone';
import { useDraft } from '@/store/onboarding';

export default function Phone() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const [phone, setPhone] = useState(draft.phone);
  const [code, setCode] = useState(draft.joinCode ?? '');
  const [showCode, setShowCode] = useState(!!draft.joinCode);
  // The first question: who is this for? A parent signs in with their own number either
  // way: to add a child they will run, or to approve the account their teen made.
  const parent = draft.forKid;
  const setParent = (v: boolean) => patch({ forKid: v });
  const c = useC();
  // One field, two kinds of code: a captain's team code or a friend's personal invite.
  const [found, setFound] = useState<{ valid: boolean; kind: 'roster' | 'invite' | null; label: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Every keystroke asks; replies can land out of order, and a stale one from a shorter
  // prefix must not overwrite what is in the field now.
  const asked = React.useRef('');
  const checkCode = async (c: string) => {
    setCode(c); setFound(null);
    asked.current = c.trim();
    if (c.trim().length < 5) return;
    const r = await api.checkCode(c);
    if (asked.current === c.trim()) setFound(r.kind ? r : null);
  };
  const go = async () => {
    setBusy(true); setErr(null);
    try { await api.sendCode(phone); patch({ phone, joinCode: !parent && found?.valid ? code.trim() : null }); router.push('/onboarding/code'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen bottom={<Centered><Button title="Text me a code" arrow onPress={go} loading={busy} disabled={!toE164(phone)} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}><Wordmark /></View>
        <View style={s.choice} accessibilityRole="radiogroup" accessibilityLabel="Who is this for?">
          {([[false, 'This is for me', '13 or older'], [true, 'This is for my kid', 'You sign in and run it']] as const).map(([v, label, sub]) => {
            const on = parent === v;
            return (
              <Tap key={label} onPress={() => setParent(v)} style={[c.opt, on && c.optOn]} scaleTo={0.98} tick
                accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`${label}. ${sub}.`}>
                <T v="smallM" tone={on ? 'greenText' : 'ink'}>{label}</T>
                <T v="meta" tone={on ? 'greenText' : 'muted'}>{sub}</T>
              </Tap>
            );
          })}
        </View>
        {/* A compact version of the hero: green, serif, one court. Not repeated on later steps. */}
        <View style={s.welcome}>
          <View style={s.inset} pointerEvents="none" />
          <View style={s.art}><Court width={120} height={200} /></View>
          <T v="eyebrow" tone="heroEyebrow" style={{ marginBottom: 12 }}>{parent ? 'Hits · For parents' : 'Good people. Great tennis.'}</T>
          <T v="display" tone="heroText" style={{ fontSize: 34, lineHeight: 37 }}>{parent ? <>Signing in{'\n'}<T v="display" tone="heroEm" italic style={{ fontSize: 34, lineHeight: 37 }}>for your kid.</T></> : <>Find your{'\n'}<T v="display" tone="heroEm" italic style={{ fontSize: 34, lineHeight: 37 }}>kind of tennis.</T></>}</T>
          <T v="meta" tone="heroCopy" style={{ marginTop: 12, maxWidth: 230 }}>{parent ? 'Your number. Next you add your child: they don\'t need a phone of their own.' : 'Players at your level, on courts near you, this week.'}</T>
        </View>
        <Card style={{ gap: space.lg, marginTop: space.lg }}>
          <Field label={parent ? 'Your number' : 'Your number is the login'} value={phone} onChangeText={t => setPhone(formatTyping(t))} placeholder="(650) 555-0137" autoComplete="tel" keyboardType="phone-pad" inputMode="tel" textContentType="telephoneNumber" autoFocus onSubmitEditing={go} accessibilityLabel="Phone number" />
          {parent ? null : showCode ? (
            <View>
              <Field label="Team or invite code" value={code} onChangeText={checkCode} placeholder="PALY26" autoCapitalize="characters" autoCorrect={false} maxLength={12} />
              {found?.valid && <T v="smallM" tone="green" style={{ marginTop: space.sm }}>{found.kind === 'invite' ? `✓ ${found.label} invited you` : `✓ Joining ${found.label}`}</T>}
              {found && !found.valid && <T v="small" tone="muted" style={{ marginTop: space.sm }}>{found.kind === 'invite' ? `${found.label}'s invite has already been used. You can join without one.` : `${found.label} is full. You can join without a code.`}</T>}
              {!found && code.trim().length >= 5 && <T v="small" tone="muted" style={{ marginTop: space.sm }}>Don't know that code. You can join without one.</T>}
            </View>
          ) : (
            <Tap onPress={() => setShowCode(true)} style={{ minHeight: 44, justifyContent: 'center' }} tick accessibilityRole="button"><T v="smallM" tone="green">Got a code from a friend or coach?</T></Tap>
          )}
          {err && <T v="small" tone="danger">{err}</T>}
          {api.mode === 'demo' && <T v="small" tone="muted">Demo mode. Any number works. The code is 000000.</T>}
        </Card>
        {parent && <T v="meta" tone="muted" style={{ marginTop: space.sm, lineHeight: 18 }}>Your teen already made an account and added you? Sign in with the number they gave and you'll see them.</T>}
        <T v="meta" tone="muted" style={{ marginTop: space.xs }}>Other players never see your number. Ever.</T>
      </Centered>
    </Screen>
  );
}
const useC = makeStyles(c => ({
  opt: { flex: 1, minHeight: 64, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  optOn: { backgroundColor: c.green, borderColor: c.green },
}));
const s = StyleSheet.create({
  choice: { flexDirection: 'row', gap: 8, marginBottom: space.md },
  welcome: { backgroundColor: fixed.hero, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 22, minHeight: 180, overflow: 'hidden' },
  inset: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1, borderColor: fixed.heroInset },
  art: { position: 'absolute', right: -34, top: 0 },
});
