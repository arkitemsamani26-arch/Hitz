import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Tap } from '@/ui/Tap';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';

export default function Phone() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const [phone, setPhone] = useState(draft.phone);
  const [code, setCode] = useState(draft.rosterCode ?? '');
  const [showCode, setShowCode] = useState(!!draft.rosterCode);
  const [codeName, setCodeName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const checkCode = async (c: string) => {
    setCode(c); setCodeName(null);
    if (c.trim().length >= 5) { const r = await api.checkCode(c); setCodeName(r.valid ? r.rosterName : null); }
  };
  const go = async () => {
    setBusy(true); setErr(null);
    try { await api.sendCode(phone); patch({ phone, rosterCode: codeName ? code.trim() : null }); router.push('/onboarding/code'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen sky={260} bottom={<Centered><Button title="Text me a code" kind="ball" onPress={go} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.xxxl, marginBottom: space.xl }}>
          <T v="micro" tone="ink2">Palo Alto</T>
          <T v="display" style={{ fontSize: 48, lineHeight: 48 }}>Find your{'\n'}next hit.</T>
          <T v="body" tone="ink2" style={{ marginTop: space.md }}>Players at your level, on courts near you, this week.</T>
        </View>
        <Sheet style={{ gap: space.lg }}>
          <Field label="Your number is the login" value={phone} onChangeText={setPhone} placeholder="(650) 555-0137" keyboardType="phone-pad" inputMode="tel" textContentType="telephoneNumber" autoFocus onSubmitEditing={go} accessibilityLabel="Phone number" />
          {showCode ? (
            <View>
              <Field label="Team code" value={code} onChangeText={checkCode} placeholder="PALY26" autoCapitalize="characters" autoCorrect={false} maxLength={12} />
              {codeName && <T v="smallM" tone="court" style={{ marginTop: space.sm }}>✓ Joining {codeName}</T>}
              {!codeName && code.trim().length >= 5 && <T v="small" tone="ink3" style={{ marginTop: space.sm }}>Not a code we know — that's fine, you can join without one.</T>}
            </View>
          ) : (
            <Tap onPress={() => setShowCode(true)} style={{ minHeight: 44, justifyContent: 'center' }} tick><T v="smallM" tone="court">Got a team code? →</T></Tap>
          )}
          {err && <T v="small" tone="danger">{err}</T>}
          {api.mode === 'demo' && <T v="small" tone="ink3">Demo — any number works, the code is 000000. Try team code PALY26.</T>}
        </Sheet>
        <T v="small" tone="onCourt" style={{ marginTop: space.lg, opacity: 0.9 }}>Other players never see your number. Ever.</T>
      </Centered>
    </Screen>
  );
}
