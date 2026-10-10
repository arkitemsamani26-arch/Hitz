import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Tap } from './Tap';
import { radius, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { shadow } from '@/lib/shadow';

type Toast = { id: number; text: string; action?: { label: string; onPress: () => void }; ms: number };
const Ctx = createContext<(text: string, action?: Toast['action'], ms?: number) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const s = useS();
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
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(150)} style={[s.wrap, { bottom: insets.bottom + 84 }]} pointerEvents="box-none">
          <View style={s.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <T v="smallM" tone="greenText" style={{ flex: 1 }}>{t.text}</T>
            {t.action && (
              <Tap onPress={() => { t.action!.onPress(); setT(null); }} style={s.action} accessibilityRole="button">
                <T v="smallM" tone="green">{t.action.label}</T>
              </Tap>
            )}
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);

const useS = makeStyles(c => ({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.green, borderRadius: radius.lg, paddingVertical: space.md, paddingLeft: space.lg, paddingRight: space.sm, width: '100%', maxWidth: 480, ...shadow({ y: 8, blur: 20, opacity: 0.18, color: c.shadow }) },
  action: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.sm, backgroundColor: c.greenText, justifyContent: 'center' },
}));
