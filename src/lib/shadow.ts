// Shadows.
//
// React Native 0.86 deprecates shadowOffset/shadowRadius/shadowOpacity on web in favour
// of `boxShadow`, and the fallback drops the blur -- which renders as a hard black band
// under every card. So build a real box-shadow on web and keep the native props on iOS
// and Android, where they are still honoured. textShadow* is deprecated the same way.
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// Accepts #rrggbb, #rgb or any CSS colour string. A three-digit hex or a named colour
// used to come out as rgba(NaN,NaN,NaN,...) on web, which drops the shadow silently.
function rgba(color: string, opacity: number): string {
  if (!color.startsWith('#')) {
    // Already a CSS colour (rgb/rgba/named). Let the browser blend it; the caller's
    // opacity is expressed by the colour itself in that case.
    return color;
  }
  let c = color.slice(1);
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  if (c.length !== 6) return color;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return color;
  return `rgba(${r},${g},${b},${opacity})`;
}

export function shadow(o: { x?: number; y?: number; blur?: number; color?: string; opacity?: number }): ViewStyle {
  const { x = 0, y = 12, blur = 22, color = '#071A0C', opacity = 0.32 } = o;
  if (Platform.OS === 'web') {
    return { boxShadow: `${x}px ${y}px ${blur}px ${rgba(color, opacity)}` } as ViewStyle;
  }
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: blur, shadowOffset: { width: x, height: y }, elevation: Math.round(blur / 3) };
}

export function textShadow(o: { x?: number; y?: number; blur?: number; color?: string; opacity?: number }): TextStyle {
  const { x = 0, y = 2, blur = 0, color = '#000000', opacity = 0.25 } = o;
  if (Platform.OS === 'web') {
    return { textShadow: `${x}px ${y}px ${blur}px ${rgba(color, opacity)}` } as TextStyle;
  }
  return { textShadowColor: rgba(color, opacity), textShadowRadius: blur, textShadowOffset: { width: x, height: y } };
}
