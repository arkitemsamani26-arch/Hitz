// For the junior: the one thing that's different, explained once, plainly. Then the
// parent's side shown moving -- sent, opened, verified -- so the wait has a heartbeat.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';
import { useSession } from '@/store/session';

export default function Guardian() {
  const router = useRouter();
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
    <Screen sky={250} bottom={<Centered><Button title="Text and email them" kind="ball" onPress={go} loading={busy} disabled={!ok} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>One more —{'\n'}for a parent.</T>
        <T v="body" tone="ink2" style={{ marginTop: space.md, marginBottom: space.lg }}>
          You find the hit. They approve the meetup. That's the whole deal — they don't pick your partners or read over your shoulder while you browse.
        </T>
        <Sheet style={{ marginBottom: space.md }}>
          <T v="micro" tone="court">What they get</T>
          <T v="small" style={{ marginTop: 6 }}>A text and an email that says exactly that, with one button. No account to make, no app to install first. Most parents are done in under a minute.</T>
          <View style={{ height: 1, backgroundColor: '#E3EAF5', marginVertical: space.md }} />
          <T v="micro" tone="court">What they'll see later</T>
          <T v="small" style={{ marginTop: 6 }}>Your requests and chats, and a yes/no before any hit is locked in. Not who you pass on. Not where you are.</T>
        </Sheet>
        <Sheet style={{ gap: space.lg }}>
          <Field label="Parent's phone" value={phone} onChangeText={setPhone} placeholder="(650) 555-0100" keyboardType="phone-pad" inputMode="tel" autoFocus />
          <Field label="Parent's email" value={email} onChangeText={setEmail} placeholder="parent@example.com" keyboardType="email-address" inputMode="email" autoCapitalize="none" textContentType="emailAddress" />
          {err && <T v="small" tone="danger">{err}</T>}
        </Sheet>
        <T v="small" tone="onCourt" style={{ marginTop: space.lg, opacity: 0.9 }}>You can browse right away. Reaching out unlocks when they say yes.</T>
      </Centered>
    </Screen>
  );
}
