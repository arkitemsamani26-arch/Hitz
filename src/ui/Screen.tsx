// Every screen is sky, then court. Content sits on white sheets.
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { color, space } from '@/theme/tokens';

export function Sky({ height = 190 }: { height?: number }) {
  return (
    <View style={[s.sky, { height }]} pointerEvents="none">
      {/* The horizon lives in the bottom fifth of the sky; nothing readable is placed there. */}
      <View style={[s.band, { top: height * 0.72, height: height * 0.10, backgroundColor: color.sky2 }]} />
      <View style={[s.band, { top: height * 0.82, height: height * 0.09, backgroundColor: '#B9DDB9' }]} />
      <View style={[s.band, { top: height * 0.91, height: height * 0.09, backgroundColor: '#7DB57D' }]} />
    </View>
  );
}

export function Screen({ children, scroll = true, pad = true, style, bottom, sky = 190, ground = color.ground }:
  { children: React.ReactNode; scroll?: boolean; pad?: boolean; style?: StyleProp<ViewStyle>; bottom?: React.ReactNode; sky?: number; ground?: string }) {
  const insets = useSafeAreaInsets();
  const inner = [pad && s.pad, { paddingTop: insets.top + space.md, paddingBottom: bottom ? space.md : insets.bottom + space.xl }, style];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root, { backgroundColor: ground }]}>
      <StatusBar style="dark" />
      {sky > 0 && <Sky height={sky + insets.top} />}
      {scroll
        ? <ScrollView contentContainerStyle={[s.grow, inner]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        : <View style={[s.grow, inner]}>{children}</View>}
      {bottom && <View style={[s.bottom, { paddingBottom: insets.bottom + space.lg }]}>{bottom}</View>}
    </KeyboardAvoidingView>
  );
}

// A white sheet on the court.
export function Sheet({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean }) {
  return <View style={[s.sheet, accent && s.accent, style]}>{children}</View>;
}

export const MAX_W = 520;
export function Centered({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', flex: 1 }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  sky: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: color.sky },
  band: { position: 'absolute', left: 0, right: 0, opacity: 0.9 },
  grow: { flexGrow: 1 },
  pad: { paddingHorizontal: space.lg },
  bottom: { paddingHorizontal: space.lg, paddingTop: space.md },
  sheet: { backgroundColor: color.paper, borderRadius: 22, padding: space.lg, shadowColor: '#0A2A12', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  accent: { borderWidth: 3, borderColor: color.ball },
});
