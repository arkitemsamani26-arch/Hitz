// A face. Optional, but the card looks better with one and so does every row.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Avatar';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { useDraft } from '@/store/onboarding';
import { pickPhoto } from '@/lib/photo';
import { haptic } from '@/lib/haptics';

export default function Photo() {
  const router = useRouter();
  const toast = useToast();
  const { draft, patch } = useDraft();
  const [busy, setBusy] = useState(false);
  const pick = async (from: 'camera' | 'library') => {
    setBusy(true);
    try { const r = await pickPhoto(from); if (r) { patch({ photoBase64: r.base64, photoUri: r.uri }); haptic.accepted(); } }
    catch (e: any) { toast(e.message ?? "Couldn't get a photo."); } finally { setBusy(false); }
  };
  return (
    <Screen sky={260} bottom={<Centered><Button title={draft.photoUri ? 'Looks good' : 'Skip for now'} kind={draft.photoUri ? 'ball' : 'line'} onPress={() => router.push('/onboarding/birthday')} /></Centered>}>
      <Centered>
        <Animated.View entering={FadeInUp.springify().damping(14)}>
          <T v="display" style={{ marginTop: space.xl }}>Put a face{'\n'}on it.</T>
          <T v="body" tone="ink2" style={{ marginTop: space.md, marginBottom: space.lg }}>Players say yes to people, not numbers. Only players at your level see it.</T>
        </Animated.View>
        <Sheet style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xl }}>
          <Animated.View key={draft.photoUri ?? 'none'} entering={ZoomIn.springify().damping(9).stiffness(300)}>
            <Avatar name={draft.displayName || '?'} photo={draft.photoUri} size={140} ring />
          </Animated.View>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Take one" kind="court" small onPress={() => pick('camera')} loading={busy} />
            <Button title="Choose one" kind="line" small onPress={() => pick('library')} disabled={busy} />
          </View>
        </Sheet>
      </Centered>
    </Screen>
  );
}
