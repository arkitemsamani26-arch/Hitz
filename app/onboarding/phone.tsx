import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';

export default function Phone() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const [phone, setPhone] = useState(draft.phone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await api.sendCode(phone); patch({ phone }); router.push('/onboarding/code'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Screen style={{ paddingTop: space.xxl }} bottom={<Centered><Button title="Text me a code" onPress={go} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} /></Centered>}>
      <Centered>
        <T v="display">Find your{'\n'}next hit.</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xxl }}>Your number is the login. No password, no email.</T>
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="(617) 555-0137"
          keyboardType="phone-pad"
          inputMode="tel"
          textContentType="telephoneNumber"
          autoFocus
          onSubmitEditing={go}
          accessibilityLabel="Phone number"
        />
        {err && <T v="small" tone="danger" style={{ marginTop: space.md }}>{err}</T>}
        {api.mode === 'demo' && <T v="small" tone="ink3" style={{ marginTop: space.lg }}>Demo — any number works, the code is 000000.</T>}
        <View style={{ flex: 1 }} />
        <T v="small" tone="ink3">Other players never see your number. Ever.</T>
      </Centered>
    </Screen>
  );
}
