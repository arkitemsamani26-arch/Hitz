// Court-line geometry as layout structure. Never decoration for its own sake.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { color } from '@/theme/tokens';

// A horizontal divider: the baseline.
export function Baseline({ strong, style }: { strong?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: strong ? 2 : 1, backgroundColor: strong ? color.lineStrong : color.line }, style]} />;
}

// The center mark: a short tick, used to punctuate.
export function CenterMark({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: 2, height: 10, backgroundColor: color.lineStrong, alignSelf: 'center' }, style]} />;
}

// A framed surface with service-box lines. Used for cards that should feel like a
// piece of the court rather than a floating rectangle.
export function ServiceBox({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean }) {
  return (
    <View style={[sb.box, accent && sb.accent, style]}>
      <View style={sb.corner} pointerEvents="none" />
      {children}
    </View>
  );
}
const sb = StyleSheet.create({
  box: { backgroundColor: color.court3, borderRadius: 22, borderWidth: 1, borderColor: color.line, overflow: 'hidden' },
  accent: { borderColor: color.ballGlow },
  corner: { position: 'absolute', top: 0, left: 24, right: 24, height: 1, backgroundColor: color.lineFaint },
});

// A full court drawn in line-white, for empty states and the confirmed moment.
export function CourtLines({ width = 260, opacity = 0.35, stroke = color.ink, glow = false }: { width?: number; opacity?: number; stroke?: string; glow?: boolean }) {
  const w = 36, h = 78;        // court proportions (singles+doubles, half-scale)
  const scale = width / (w + 4);
  const sw = glow ? 1.2 : 0.8;
  return (
    <Svg width={(w + 4) * scale} height={(h + 4) * scale} viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ opacity }}>
      <Rect x={0} y={0} width={w} height={h} stroke={stroke} strokeWidth={sw} fill="none" />
      <Line x1={4.5} y1={0} x2={4.5} y2={h} stroke={stroke} strokeWidth={sw} />
      <Line x1={w - 4.5} y1={0} x2={w - 4.5} y2={h} stroke={stroke} strokeWidth={sw} />
      <Line x1={4.5} y1={18} x2={w - 4.5} y2={18} stroke={stroke} strokeWidth={sw} />
      <Line x1={4.5} y1={h - 18} x2={w - 4.5} y2={h - 18} stroke={stroke} strokeWidth={sw} />
      <Line x1={w / 2} y1={18} x2={w / 2} y2={h - 18} stroke={stroke} strokeWidth={sw} />
      <Line x1={-1} y1={h / 2} x2={w + 1} y2={h / 2} stroke={stroke} strokeWidth={sw * 1.8} />
      <Line x1={w / 2} y1={0} x2={w / 2} y2={1.5} stroke={stroke} strokeWidth={sw} />
      <Line x1={w / 2} y1={h - 1.5} x2={w / 2} y2={h} stroke={stroke} strokeWidth={sw} />
    </Svg>
  );
}
