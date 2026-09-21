// Every screen is sky, then court. Content sits on white sheets. The sky is real light:
// it changes with the time of day, there is a sun in it, and the ground has grain.
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { color, space } from '@/theme/tokens';

const grain = require('../../assets/tex/grain.png');

// Time-of-day palettes. Morning is the default look; evening goes gold; a night
// session is floodlit -- dark sky, the court glowing.
export function skyFor(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 6 || h >= 20) return { stops: ['#3E5A8C', '#6F8FC2', '#A9C4E8'] as const, sun: { x: 0.62, y: 0.08, c: '#F4F1E0' }, night: true };
  if (h < 9) return { stops: ['#9FCBFF', '#FFD9A8', '#FFF1D6'] as const, sun: { x: 0.58, y: 0.1, c: '#FFE07A' }, night: false };
  if (h < 16) return { stops: ['#8EC5FF', '#BFE3FF', '#EAF6FF'] as const, sun: { x: 0.62, y: 0.06, c: '#FFF3B0' }, night: false };
  return { stops: ['#5E8FD6', '#F2B27A', '#FFE6C2'] as const, sun: { x: 0.6, y: 0.12, c: '#FFC85C' }, night: false };
}

// Shadows fall away from the sun: morning sun on the left throws them right, and so on.
export function sunShadow(len = 14): { width: number; height: number } {
  const k = skyFor();
  if (!k.sun) return { width: 0, height: len };
  const dx = 0.5 - k.sun.x, dy = 1 - k.sun.y;           // vector from sun toward the ground
  const n = Math.hypot(dx, dy) || 1;
  return { width: Math.round((dx / n) * len * 0.9), height: Math.round(Math.max(0.5, dy / n) * len) };
}

export function Sky({ height = 190 }: { height?: number }) {
  const k = skyFor();
  return (
    <View style={[s.sky, { height }]} pointerEvents="none">
      <LinearGradient colors={[...k.stops]} style={StyleSheet.absoluteFill} />
      {k.sun && (
        <>
          <View style={[s.sun, { left: `${k.sun.x * 100}%`, top: `${k.sun.y * 100}%`, backgroundColor: k.sun.c, opacity: 0.35, transform: [{ scale: 2.6 }] }]} />
          <View style={[s.sun, { left: `${k.sun.x * 100}%`, top: `${k.sun.y * 100}%`, backgroundColor: k.sun.c, opacity: 0.6, transform: [{ scale: 1.5 }] }]} />
          <View style={[s.sun, { left: `${k.sun.x * 100}%`, top: `${k.sun.y * 100}%`, backgroundColor: '#FFFDF2' }]} />
        </>
      )}
      {k.night && <View style={[s.floodlight, { top: height * 0.55 }]} />}
      {/* The horizon lives in the bottom fifth; nothing readable is placed there. */}
      <LinearGradient colors={['transparent', 'rgba(125,181,125,0.55)', color.ground]} locations={[0.72, 0.9, 1]} style={StyleSheet.absoluteFill} />
      <Image source={grain} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} />
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
      <LinearGradient colors={[color.ground, '#256A3A']} style={StyleSheet.absoluteFill} />
      <Image source={grain} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.25, pointerEvents: "none" } as any]} />
      {sky > 0 && <Sky height={sky + insets.top} />}
      {scroll
        ? <ScrollView contentContainerStyle={[s.grow, inner]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        : <View style={[s.grow, inner]}>{children}</View>}
      {bottom && <View style={[s.bottom, { paddingBottom: insets.bottom + space.lg }]}>{bottom}</View>}
    </KeyboardAvoidingView>
  );
}

// A white sheet on the court, lit from the top-left: a highlight along the top edge and a
// warm, long shadow underneath.
export function Sheet({ children, style, accent, loud }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean; loud?: boolean }) {
  return (
    <View style={[s.sheet, { shadowOffset: sunShadow(14) }, accent && s.accent, loud && s.loud, style]}>
      <View style={s.edge} pointerEvents="none" />
      {children}
    </View>
  );
}

export const MAX_W = 520;
export function Centered({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', flex: 1 }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  sky: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  sun: { position: 'absolute', width: 54, height: 54, borderRadius: 27, marginLeft: -27, marginTop: -27 },
  floodlight: { position: 'absolute', left: '10%', right: '10%', height: 260, borderRadius: 200, backgroundColor: 'rgba(229,255,61,0.10)', transform: [{ scaleX: 1.8 }] },
  grow: { flexGrow: 1 },
  pad: { paddingHorizontal: space.lg },
  bottom: { paddingHorizontal: space.lg, paddingTop: space.md },
  sheet: { backgroundColor: color.paper, borderRadius: 24, padding: space.lg, shadowColor: '#071A0C', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 8, overflow: 'hidden' },
  edge: { position: 'absolute', top: 0, left: 24, right: 24, height: 2, backgroundColor: 'rgba(14,27,51,0.06)', borderRadius: 1 },
  accent: { borderWidth: 3, borderColor: color.ball },
  loud: { backgroundColor: color.ball },
});
