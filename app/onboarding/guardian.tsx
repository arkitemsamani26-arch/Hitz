// For the junior: the one thing that's different, explained once, plainly.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { ServiceBox, Baseline } from '@/ui/Court';
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
    <Screen bottom={<Centered><Button title="Send it" onPress={go} loading={busy} disabled={!ok} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>One more —{'\n'}for a parent.</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xl }}>
          You find the hit. They approve the meetup. That's the whole deal — they don't pick your partners or read over your shoulder while you browse.
        </T>
        <ServiceBox style={{ padding: space.lg, marginBottom: space.xl }}>
          <T v="micro" tone="ink3">What they'll see</T>
          <T v="small" style={{ marginTop: 6 }}>Your requests and chats, and a yes/no before any hit is locked in.</T>
          <Baseline style={{ marginVertical: space.md }} />
          <T v="micro" tone="ink3">What they won't</T>
          <T v="small" style={{ marginTop: 6 }}>Who you pass on. Where you are. Anything about anyone else.</T>
        </ServiceBox>
        <View style={{ gap: space.lg }}>
          <Field label="Parent's email" value={email} onChangeText={setEmail} placeholder="parent@example.com" keyboardType="email-address" inputMode="email" autoCapitalize="none" textContentType="emailAddress" />
          <Field label="Parent's phone" value={phone} onChangeText={setPhone} placeholder="(617) 555-0100" keyboardType="phone-pad" inputMode="tel" />
        </View>
        {err && <T v="small" tone="danger" style={{ marginTop: space.md }}>{err}</T>}
        <T v="small" tone="ink3" style={{ marginTop: space.lg }}>You can browse right away. Reaching out unlocks when they say yes.</T>
      </Centered>
    </Screen>
  );
}
