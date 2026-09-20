import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';
import { useSession } from '@/store/session';

export default function Code() {
  const router = useRouter();
  const { draft } = useDraft();
  const { setSession, setProfile } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (c = code) => {
    if (c.length < 6) return;
    setBusy(true); setErr(null);
    try {
      const s = await api.verifyCode(draft.phone, c);
      setSession(s);
      const me = s.isGuardian ? null : await api.me();
      setProfile(me);
      if (s.isGuardian) router.replace('/guardian');
      else if (me) router.replace('/(tabs)');
      else router.replace('/onboarding/name');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen sky={250} bottom={<Centered><Button title="Let's go" kind="ball" onPress={() => go()} loading={busy} disabled={code.length < 6} /></Centered>}>
      <Centered>
        <Header />
        <T v="display" style={{ marginTop: space.xl }}>Check your texts.</T>
        <T v="body" tone="ink2" style={{ marginTop: space.md, marginBottom: space.xl }}>Six digits, sent to {draft.phone}.</T>
        <Field
          big value={code} onChangeText={t => { const c = t.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) void go(c); }}
          placeholder="••••••" keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoFocus maxLength={6}
          accessibilityLabel="Verification code"
        />
        {err && <T v="small" tone="danger" style={{ marginTop: space.md }}>{err}</T>}
      </Centered>
    </Screen>
  );
}
