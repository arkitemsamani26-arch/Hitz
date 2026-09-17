import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Only the four weights the type scale uses; the package index would bundle all 18.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { SessionProvider } from '@/store/session';
import { OnboardingProvider } from '@/store/onboarding';
import { FiltersProvider } from '@/store/filters';
import { ToastProvider } from '@/ui/Toast';
import { color } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [loaded] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_700Bold, Archivo_900Black });
  useEffect(() => { if (loaded) void SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.court }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.court }}>
      <SafeAreaProvider>
          <SessionProvider>
            <OnboardingProvider>
              <FiltersProvider>
                <ToastProvider>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.court }, animation: Platform.OS === 'web' ? 'none' : 'default' }}>
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
