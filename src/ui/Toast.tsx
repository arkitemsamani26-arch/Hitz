import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Tap } from './Tap';
import { color, radius, space } from '@/theme/tokens';

type Toast = { id: number; text: string; action?: { label: string; onPress: () => void }; ms: number };
const Ctx = createContext<(text: string, action?: Toast['action'], ms?: number) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((text: string, action?: Toast['action'], ms = 3200) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setT({ id, text, action, ms });
    timer.current = setTimeout(() => setT(cur => (cur?.id === id ? null : cur)), ms);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && (
        <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown.duration(150)} style={[s.wrap, { bottom: insets.bottom + 90 }]} pointerEvents="box-none">
          <View style={s.toast}>
            <T v="smallM" tone="onCourt" style={{ flex: 1 }}>{t.text}</T>
            {t.action && (
              // The undo is a real button, not a link: big, ball-coloured, impossible to miss.
              <Tap onPress={() => { t.action!.onPress(); setT(null); }} style={s.action} accessibilityRole="button">
                <T v="smallM" tone="onBall">{t.action.label}</T>
              </Tap>
            )}
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.ink, borderRadius: radius.lg, paddingVertical: space.md, paddingLeft: space.lg, paddingRight: space.sm, width: '100%', maxWidth: 480, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  action: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.ball, justifyContent: 'center' },
});
