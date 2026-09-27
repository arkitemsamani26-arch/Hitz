// Deleting your account.
//
// Apple requires this button to exist and to work from inside the app. It is written the
// way it is for a different reason: the people most likely to press it are fourteen and
// upset, and the worst outcome is not that they leave, it is that they cannot tell what
// leaving does. So the screen says exactly what goes, exactly what stays, and why the
// thing that stays cannot be deleted by them.
//
// Typing the word is not theatre. There is no undo behind this and no support inbox that
// can put it back.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGoBack } from '@/lib/nav';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { useToast } from '@/ui/Toast';
import { color, radius, space } from '@/theme/tokens';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { haptic } from '@/lib/haptics';

const WORD = 'DELETE';

export default function DeleteAccount() {
  const router = useRouter();
  const goBack = useGoBack();
  const toast = useToast();
  const { profile, setSession, setProfile } = useSession();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = typed.trim().toUpperCase() === WORD && !busy;

  const go = async () => {
    setBusy(true);
    try {
      await api.deleteAccount();
      haptic.warn();
      setSession(null);
      setProfile(null);
      router.replace('/onboarding/phone');
      toast('Your account is gone.');
    } catch (e: any) {
      haptic.warn();
      toast(e?.message ?? "We couldn't delete your account. Nothing was changed.");
      setBusy(false);
    }
  };

  return (
    <Screen sky={150} extraBottom={space.xl} bottom={
      <Centered>
        <Button title="Delete my account" kind="danger" onPress={go} loading={busy} disabled={!ready} />
      </Centered>
    }>
      <Centered>
        <Header kicker="Your account" title="Delete your account." />

        <Sheet style={{ gap: space.md, marginBottom: space.md }}>
          <T v="h2">This cannot be undone.</T>
          <T v="small" tone="ink2">
            There is no way to get it back and no one to email about it. If you just want a
            break, turn off “Usually free” on your profile instead and nobody will see you.
          </T>
        </Sheet>

        <Sheet style={{ gap: space.sm, marginBottom: space.md }}>
          <T v="micro" tone="ink3">What goes, immediately</T>
          <Line text="Your name, photo, level and home court" />
          <Line text="Your phone number and the location we used to find courts near you" />
          <Line text="Every message you have sent, and every hit in your history" />
          <Line text="Any hit that has not happened yet — the other player is told it is off" />
          {profile?.band === 'minor' && <Line text="The link to your parent, and their view of your account" />}
        </Sheet>

        <Sheet style={{ gap: space.sm, marginBottom: space.md, borderWidth: 2, borderColor: color.hair2 }}>
          <T v="micro" tone="ink3">What stays, and why</T>
          <T v="small" tone="ink2">
            If someone has reported you, that report stays. It no longer carries your name,
            your photo or anything you wrote — only the fact that it was made and who it was
            about. Deleting your account is not a way to clear a safety report, because if it
            were, that is exactly what it would be used for.
          </T>
          <T v="small" tone="ink2">
            We also keep a record that an account existed here and was deleted. It holds no
            personal information about you.
          </T>
        </Sheet>

        <Sheet style={{ gap: space.md }}>
          <T v="micro" tone="ink3">Type {WORD} to confirm</T>
          <Field
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={WORD}
            accessibilityLabel={`Type ${WORD} to confirm`}
            big
          />
          <Button title="Keep my account" kind="line" onPress={goBack} />
        </Sheet>

        {demo && (
          <T v="small" tone="onCourt" style={{ marginTop: space.md }}>
            This is the demo, so there is nothing on a server to delete. Pressing the button
            clears everything stored on this device and starts you over.
          </T>
        )}
      </Centered>
    </Screen>
  );
}

function Line({ text }: { text: string }) {
  return (
    <View style={s.line}>
      <View style={s.dot} />
      <T v="small" tone="ink" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.danger, marginTop: 8 },
});
