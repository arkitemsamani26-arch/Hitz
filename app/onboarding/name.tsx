import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { space } from '@/theme/tokens';
import { useDraft } from '@/store/onboarding';

export default function Name() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const [first, setFirst] = useState(draft.displayName);
  const [last, setLast] = useState(draft.lastInitial);
  const ok = first.trim().length >= 2 && /^[A-Za-z]$/.test(last);
  const go = () => { patch({ displayName: first.trim(), lastInitial: last.toUpperCase() }); router.push('/onboarding/birthday'); };
  return (
    <Screen bottom={<Centered><Button title="Next" onPress={go} disabled={!ok} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>What do we{'\n'}call you?</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xxl }}>
          Players see "{first || 'Maya'} {last ? last.toUpperCase() : 'R'}." until a hit is confirmed.
        </T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 3 }}><Field label="First name" value={first} onChangeText={setFirst} placeholder="Maya" autoFocus autoCapitalize="words" textContentType="givenName" /></View>
          <View style={{ flex: 1 }}><Field label="Last initial" value={last} onChangeText={t => setLast(t.slice(-1))} placeholder="R" autoCapitalize="characters" maxLength={1} onSubmitEditing={() => ok && go()} /></View>
        </View>
      </Centered>
    </Screen>
  );
}
