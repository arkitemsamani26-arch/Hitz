// A face. Optional, but the card looks better with one and so does every row.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
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
    <Screen bottom={<Centered><Button title={draft.photoUri ? 'Looks good' : 'Skip for now'} arrow kind={draft.photoUri ? 'primary' : 'line'} onPress={() => router.push('/onboarding/birthday')} /></Centered>}>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: space.xl }}>Optional</T>
        <T v="display" style={{ marginTop: 12 }}>Put a face{'\n'}<T v="display" italic>on it.</T></T>
        <T v="small" tone="muted" style={{ marginTop: space.md, marginBottom: space.lg, lineHeight: 21 }}>Players say yes to people, not numbers. Only players at your level see it. A monogram is fine too.</T>
        <Card style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xl }}>
          <Avatar name={draft.displayName || '?'} lastInitial={draft.lastInitial} photo={draft.photoUri} size={92} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Take one" small onPress={() => pick('camera')} loading={busy} />
            <Button title="Choose one" kind="line" small onPress={() => pick('library')} disabled={busy} />
          </View>
        </Card>
      </Centered>
    </Screen>
  );
}
