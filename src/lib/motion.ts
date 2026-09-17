// Motion that feels like the sport: fast, with weight behind it. Things land, they
// don't drift. Springs over linear easing, everywhere.
import { useReducedMotion } from 'react-native-reanimated';

export const spring = {
  // The default. A ball hitting the strings.
  snap: { damping: 18, stiffness: 320, mass: 0.8 },
  // Heavier: big elements arriving.
  land: { damping: 20, stiffness: 190, mass: 1.1 },
  // Press feedback.
  press: { damping: 22, stiffness: 500, mass: 0.6 },
  // Cards leaving the stack.
  fling: { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true },
} as const;

export const duration = {
  instant: 90,
  fast: 150,     // everything interactive responds inside this
  normal: 240,
  slow: 420,
} as const;

export function useMotion() {
  const reduced = useReducedMotion();
  return { reduced };
}
