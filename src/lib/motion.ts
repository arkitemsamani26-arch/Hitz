// Motion is ball physics. Things arc, drop, bounce once and settle. Nothing drifts.
import { useReducedMotion } from 'react-native-reanimated';

export const spring = {
  // A ball into the strings: fast, one small overshoot.
  snap: { damping: 16, stiffness: 340, mass: 0.7 },
  // A ball landing on the court: heavier, settles with one bounce.
  land: { damping: 14, stiffness: 220, mass: 1.0 },
  press: { damping: 22, stiffness: 520, mass: 0.6 },
  // Something flung off the court.
  fling: { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true },
} as const;


export function useMotion() {
  const reduced = useReducedMotion();
  return { reduced };
}
