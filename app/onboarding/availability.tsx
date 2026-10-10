// When you play. Rough is fine: exact times get picked per hit.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { hit, space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft, isMinor } from '@/store/onboarding';
import { useSession } from '@/store/session';
import { AvailabilityGrid, ALL_SLOTS as ALL } from '@/ui/Availability';
import { flushLocation } from '@/lib/location';

export default function Availability() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const { setProfile } = useSession();
  const [mask, setMask] = useState(draft.availabilityMask);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (b: number) => setMask(m => m ^ b);
  const flexible = mask === ALL;

  const finish = async (m: number) => {
    // The draft lives in memory. A deep link or a web reload can land here with half of
    // it missing, and sending nulls made a minor look like an adult.
    if (!draft.dateOfBirth || draft.levelValue == null || !draft.levelSource || !draft.homeCourtId) {
      setErr('We lost a couple of answers. Start again from the top.');
      router.replace('/onboarding/court');
      return;
    }
    setBusy(true); setErr(null);
    try {
      patch({ availabilityMask: m });
      const p = await api.createProfile({
        displayName: draft.displayName, lastInitial: draft.lastInitial, dateOfBirth: draft.dateOfBirth,
        levelValue: draft.levelValue, levelSource: draft.levelSource, homeCourtId: draft.homeCourtId,
        availabilityMask: m, joinCode: draft.joinCode,
      });
      setProfile(p);
      // There is finally a row to attach it to, so hand over the fix taken at the court step.
      void flushLocation();
      if (draft.photoBase64) { try { setProfile(await api.setPhoto(draft.photoBase64)); } catch { /* photo is optional */ } }
      router.push(isMinor(draft.dateOfBirth) ? '/onboarding/guardian' : '/onboarding/ready');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Screen bottom={
      <Centered>
        <Button title="Next" arrow onPress={() => finish(mask)} loading={busy} disabled={mask === 0} />
        {/* Skipping is fine. Everything open beats a blank week. */}
        <Tap onPress={() => finish(ALL)} style={{ minHeight: hit.min, alignItems: 'center', justifyContent: 'center', marginTop: space.xs }} tick accessibilityRole="button">
          <T v="smallM" tone="muted">Skip for now</T>
        </Tap>
      </Centered>
    }>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
          <T v="eyebrow" tone="muted">Your week</T>
          <T v="display" style={{ marginTop: 12 }}>When do you{'\n'}<T v="display" italic>usually play?</T></T>
          <T v="small" tone="muted" style={{ marginTop: space.md, lineHeight: 21 }}>Rough is right. You pick the exact time for each hit.</T>
        </View>
        <Card><AvailabilityGrid mask={mask} onToggle={toggle} /></Card>
        <View style={{ marginTop: space.md }}>
          <Pill label="I'm flexible. Any time works." on={flexible} onPress={() => setMask(flexible ? 0 : ALL)} style={{ alignSelf: 'flex-start' }} />
        </View>
        {err && <Card style={{ marginTop: space.md }}><T v="small" tone="danger">{err}</T></Card>}
      </Centered>
    </Screen>
  );
}
