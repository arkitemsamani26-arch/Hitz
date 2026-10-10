// The two drawings the whole system allows: a court in outline and a small shaded ball.
//
// The court is a 140 by 230 rectangle of 1px lines, rotated 22 degrees and cropped by
// whatever holds it. The ball is the one place the flat system breaks: a radial gradient,
// two seams and a local shadow, so it reads as a ball and never as a sun.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop, Circle, ClipPath, G } from 'react-native-svg';
import { fixed } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';

export function Court({ color = fixed.art, width = 140, height = 230, rotate = 22, style }:
  { color?: string; width?: number; height?: number; rotate?: number; style?: StyleProp<ViewStyle> }) {
  const line = { borderColor: color };
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      style={[{ width, height, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={[s.court, line]}>
        <View style={[s.alleys, line]} />
        <View style={[s.service, line]} />
        <View style={[s.net, line]} />
        <View style={[s.centre, line]} />
      </View>
    </View>
  );
}

export function Ball({ size = 39, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const r = size / 2;
  // Seams: two 32x44 ellipses on a 39 ball, hung 3px above the top and 23px past each side.
  const k = size / 39;
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, borderRadius: r, transform: [{ rotate: '-30deg' }] }, s.ballShadow, style]}>
      <Svg width={size} height={size} viewBox="0 0 39 39">
        <Defs>
          <RadialGradient id="felt" cx="31%" cy="24%" r="78%" fx="31%" fy="24%">
            <Stop offset="0" stopColor={fixed.ball[0]} />
            <Stop offset="0.4" stopColor={fixed.ball[1]} />
            <Stop offset="0.8" stopColor={fixed.ball[2]} />
            <Stop offset="1" stopColor={fixed.ball[3]} />
          </RadialGradient>
          <ClipPath id="round"><Circle cx="19.5" cy="19.5" r="19.5" /></ClipPath>
        </Defs>
        <Circle cx="19.5" cy="19.5" r="19.5" fill="url(#felt)" />
        <G clipPath="url(#round)">
          <Ellipse cx={-23 + 16} cy={-3 + 22} rx="16" ry="22" fill="none" stroke={fixed.ballSeam} strokeWidth="2" />
          <Ellipse cx={39 + 23 - 16} cy={-3 + 22} rx="16" ry="22" fill="none" stroke={fixed.ballSeam} strokeWidth="2" />
          {/* The inset shade along the lower-right edge. */}
          <Circle cx="21.5" cy="21.5" r="19.5" fill="none" stroke={fixed.ballShade} strokeWidth="4" />
        </G>
      </Svg>
      {k !== 1 && null}
    </View>
  );
}

const s = StyleSheet.create({
  court: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1 },
  alleys: { position: 'absolute', top: 0, bottom: 0, left: '13%', right: '13%', borderLeftWidth: 1, borderRightWidth: 1 },
  service: { position: 'absolute', top: '24%', bottom: '24%', left: '13%', right: '13%', borderTopWidth: 1, borderBottomWidth: 1 },
  net: { position: 'absolute', left: 0, right: 0, top: '50%', borderTopWidth: 1 },
  centre: { position: 'absolute', top: '24%', bottom: '24%', left: '50%', borderLeftWidth: 1 },
  ballShadow: shadow({ x: 6, y: 12, blur: 12, color: '#071D18', opacity: 0.31 }),
});
