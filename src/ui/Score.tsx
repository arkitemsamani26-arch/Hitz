// Scoreline typography for numbers. With `animate`, the number counts up into place.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { T } from './Text';
import { levelBig } from '@/lib/format';
import { useMotion } from '@/lib/motion';

export function Score({ value, size = 'display', verified, tone = 'ink', animate }: { value: number | null; size?: 'score' | 'display' | 'h1'; verified?: boolean; tone?: 'ink' | 'ball' | 'onBall' | 'court' | 'onCourt'; animate?: boolean }) {
  const { reduced } = useMotion();
  const [shown, setShown] = useState<number | null>(animate && !reduced ? 0 : value);
  useEffect(() => {
    if (!animate || reduced || value == null) { setShown(value); return; }
    const start = performance.now(), from = 0, dur = 650;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / dur), e = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate, reduced]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
      <T v={size} tone={tone} style={{ fontVariant: ['tabular-nums'] }}>{levelBig(shown)}</T>
      {verified && <T v="micro" tone={tone === 'onCourt' ? 'onCourt' : 'court'} style={{ marginTop: 6 }}>UTR</T>}
    </View>
  );
}
