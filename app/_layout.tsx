import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Only the faces the type scale uses: the serif in roman and true italic, the sans in
// three weights.
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display/400Regular_Italic';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { configureForeground } from '@/lib/push';
import { SessionProvider } from '@/store/session';
import { OnboardingProvider } from '@/store/onboarding';
import { FiltersProvider } from '@/store/filters';
import { WindowProvider } from '@/store/window';
import { ToastProvider } from '@/ui/Toast';
import { useTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const t = useTheme();
  const [loaded] = useFonts({ DMSerifDisplay_400Regular, DMSerifDisplay_400Regular_Italic, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold });
  useEffect(() => { configureForeground(); }, []);
  useEffect(() => { if (loaded) void SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: t.paper }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.paper }}>
      <SafeAreaProvider>
          <SessionProvider>
            <OnboardingProvider>
              <FiltersProvider>
                <WindowProvider>
                <ToastProvider>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper }, animation: Platform.OS === 'web' ? 'none' : 'default' }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="filters" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  </Stack>
                </ToastProvider>
                </WindowProvider>
              </FiltersProvider>
            </OnboardingProvider>
          </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
