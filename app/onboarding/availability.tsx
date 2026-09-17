import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { color, radius, space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft, isMinor } from '@/store/onboarding';
import { useSession } from '@/store/session';
import { SLOTS } from '@/data/types';

export default function Availability() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const { setProfile } = useSession();
  const [mask, setMask] = useState(draft.availabilityMask);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (b: number) => setMask(m => m ^ b);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      patch({ availabilityMask: mask });
      const p = await api.createProfile({
        displayName: draft.displayName, lastInitial: draft.lastInitial, dateOfBirth: draft.dateOfBirth!,
        levelValue: draft.levelValue!, levelSource: draft.levelSource!, homeCourtId: draft.homeCourtId!, availabilityMask: mask,
      });
      setProfile(p);
      router.push(isMinor(draft.dateOfBirth) ? '/onboarding/guardian' : '/onboarding/ready');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const groups = [SLOTS.slice(0, 3), SLOTS.slice(3)];
  return (
    <Screen bottom={<Centered><Button title="Next" onPress={go} loading={busy} disabled={mask === 0} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>When can you{'\n'}usually hit?</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xl }}>Rough is right. You'll pick exact times per hit.</T>
        {groups.map((g, gi) => (
          <View key={gi} style={{ marginBottom: space.xl }}>
            <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>{g[0].label}s</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {g.map(sl => {
                const on = !!(mask & sl.bit);
                return (
                  <Tap key={sl.bit} onPress={() => toggle(sl.bit)} tick style={[s.tile, on && s.on]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${sl.label} ${sl.part}`}>
                    <T v="bodyM" tone={on ? 'onBall' : 'ink'}>{sl.part}</T>
                  </Tap>
                );
              })}
            </View>
          </View>
        ))}
        {err && <T v="small" tone="danger">{err}</T>}
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  tile: { flex: 1, minHeight: 68, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: color.court2, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: color.ball, borderColor: color.ball },
});
