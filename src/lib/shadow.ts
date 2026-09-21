// Shadows.
//
// React Native 0.86 deprecates shadowOffset/shadowRadius/shadowOpacity on web in favour
// of `boxShadow`, and the fallback drops the blur -- which renders as a hard black band
// under every card. So build a real box-shadow on web and keep the native props on iOS
// and Android, where they are still honoured.
import { Platform, type ViewStyle } from 'react-native';

export function shadow(o: { x?: number; y?: number; blur?: number; color?: string; opacity?: number }): ViewStyle {
  const { x = 0, y = 12, blur = 22, color = '#071A0C', opacity = 0.32 } = o;
  if (Platform.OS === 'web') {
    const c = color.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return { boxShadow: `${x}px ${y}px ${blur}px rgba(${r},${g},${b},${opacity})` } as ViewStyle;
  }
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: blur, shadowOffset: { width: x, height: y }, elevation: Math.round(blur / 3) };
}
