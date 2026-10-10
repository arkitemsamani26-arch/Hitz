import React from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Progress } from '@/ui/Progress';
import { useTheme } from '@/theme/theme';
import { GUTTER, MAX_W } from '@/ui/Screen';

// Location comes first: the court step is what asks for it, and asking at step eight
// meant the whole of discovery was guessing until you were nearly done.
const STEPS = ['phone', 'code', 'court', 'name', 'photo', 'birthday', 'level', 'peek', 'availability', 'guardian', 'ready'];

export default function OnboardingLayout() {
  const t = useTheme();
  const path = usePathname();
  const step = STEPS.findIndex(s => path.endsWith(`/${s}`));
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={{ position: 'absolute', zIndex: 2, left: 0, right: 0, paddingTop: insets.top + 6, paddingHorizontal: GUTTER, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
        <Progress value={(Math.max(step, 0) + 1) / STEPS.length} />
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper }, animation: 'slide_from_right', animationDuration: 220 }} />
    </View>
  );
}
