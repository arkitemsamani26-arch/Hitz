import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
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
      else router.replace('/onboarding/court');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen bottom={<Centered><Button title="Let's go" arrow onPress={() => go()} loading={busy} disabled={code.length < 6} /></Centered>}>
      <Centered>
        <Header />
        <T v="eyebrow" tone="muted" style={{ marginTop: space.md }}>One text</T>
        <T v="display" style={{ marginTop: 12 }}>Check your texts.</T>
        <T v="small" tone="muted" style={{ marginTop: space.md, marginBottom: space.xl, lineHeight: 21 }}>Six digits, sent to {draft.phone}.</T>
        <Card><Field
          big value={code} onChangeText={t => { const c = t.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) void go(c); }}
          placeholder="••••••" keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoFocus maxLength={6}
          accessibilityLabel="Verification code"
        /></Card>
        {err && <T v="small" tone="danger" style={{ marginTop: space.md }}>{err}</T>}
      </Centered>
    </Screen>
  );
}
