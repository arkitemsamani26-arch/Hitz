import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Only the weights the type scale uses.
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { configureForeground } from '@/lib/push';
import { loadSoundPref } from '@/lib/sound';
import { SessionProvider } from '@/store/session';
import { OnboardingProvider } from '@/store/onboarding';
import { FiltersProvider } from '@/store/filters';
import { ToastProvider } from '@/ui/Toast';
import { color } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [loaded] = useFonts({ BricolageGrotesque_800ExtraBold, BricolageGrotesque_600SemiBold, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold });
  useEffect(() => { configureForeground(); void loadSoundPref(); }, []);
  useEffect(() => { if (loaded) void SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.ground }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ground }}>
      <SafeAreaProvider>
          <SessionProvider>
            <OnboardingProvider>
              <FiltersProvider>
                <ToastProvider>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground }, animation: Platform.OS === 'web' ? 'none' : 'default' }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="filters" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  </Stack>
                </ToastProvider>
              </FiltersProvider>
            </OnboardingProvider>
          </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
