// For the junior: the one thing that's different, explained once, plainly. Then the
// parent's side shown moving -- sent, opened, verified -- so the wait has a heartbeat.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { useTheme } from '@/theme/theme';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';
import { useSession } from '@/store/session';

export default function Guardian() {
  const router = useRouter();
  const t = useTheme();
  const { draft, patch } = useDraft();
  const { refresh } = useSession();
  const [email, setEmail] = useState(draft.guardianEmail);
  const [phone, setPhone] = useState(draft.guardianPhone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = /.+@.+\..+/.test(email) && phone.replace(/\D/g, '').length >= 10;
  const go = async () => {
    setBusy(true); setErr(null);
    try { await api.inviteGuardian(email.trim(), phone); patch({ guardianEmail: email, guardianPhone: phone }); await refresh(); router.push('/onboarding/ready'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen bottom={<Centered><Button title="Text and email them" arrow onPress={go} loading={busy} disabled={!ok} /></Centered>}>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: space.xl }}>Under 18</T>
        <T v="display" style={{ marginTop: 12 }}>One more.{'\n'}<T v="display" italic>For a parent.</T></T>
        <T v="small" tone="muted" style={{ marginTop: space.md, marginBottom: space.lg, lineHeight: 21 }}>
          You find the hit. They approve the meetup. That's the whole deal. They don't pick your partners.
        </T>
        <Card style={{ marginBottom: space.md }}>
          <T v="micro" tone="muted">What they get</T>
          <T v="small" style={{ marginTop: 6 }}>A text and an email that says exactly that, with one button. No account to make, no app to install first. Most parents are done in under a minute.</T>
          <View style={{ height: 1, backgroundColor: t.line, marginVertical: space.md }} />
          <T v="micro" tone="muted">What they'll see later</T>
          <T v="small" style={{ marginTop: 6 }}>Your invitations and chats, and a yes or no before any hit is locked in. Not who you pass on. Not where you are.</T>
        </Card>
        <Card style={{ gap: space.lg }}>
          <Field label="Parent's phone" value={phone} onChangeText={setPhone} placeholder="(650) 555-0100" keyboardType="phone-pad" inputMode="tel" autoFocus />
          <Field label="Parent's email" value={email} onChangeText={setEmail} placeholder="parent@example.com" keyboardType="email-address" inputMode="email" autoCapitalize="none" textContentType="emailAddress" />
          {err && <T v="small" tone="danger">{err}</T>}
        </Card>
        <T v="meta" tone="muted" style={{ marginTop: space.md }}>You can browse right away. Inviting unlocks when they say yes.</T>
      </Centered>
    </Screen>
  );
}
