import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { useTheme } from '@/theme/theme';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { MemberCard } from '@/ui/MemberCard';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useDraft } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';

export default function Ready() {
  const router = useRouter();
  const t = useTheme();
  const { profile } = useSession();
  const { reset } = useDraft();
  const { data: courts } = useAsync(() => api.courts(), []);
  const pending = profile?.band === 'minor' && !profile.guardianVerified;
  const court = courts?.find(c => c.id === profile?.homeCourtId)?.name ?? null;
  const stage = !profile?.guardianSentAt ? 0 : !profile.guardianOpenedAt ? 1 : !profile.guardianVerified ? 2 : 3;
  return (
    <Screen bottom={<Centered><Button title="See who's around" arrow onPress={() => { reset(); router.replace('/(tabs)'); }} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.xl }}>
          <T v="eyebrow" tone="muted">The clubhouse</T>
          <T v="display" style={{ marginTop: 12 }}>You're in,{'\n'}<T v="display" italic>{profile?.displayName ?? ''}.</T></T>
          <T v="small" tone="muted" style={{ marginTop: space.md, lineHeight: 21 }}>Home court: {court ?? 'not set'}.{profile?.rosterName ? ` Team: ${profile.rosterName}.` : ''}</T>
        </View>
        <View style={{ marginTop: space.xl, marginBottom: space.lg }}>
          <MemberCard name={`${profile?.displayName ?? ''} ${profile?.lastInitial ?? ''}.`} level={profile?.levelValue ?? null} source={profile?.levelSource} verified={profile?.levelSource === 'utr_verified'} />
        </View>
        {pending && (
          <Card style={{ gap: space.sm }}>
            <T v="micro" tone="muted">Your parent</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {['Sent', 'Opened', 'Said yes'].map((l, i) => (
                <View key={l} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View style={{ height: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: stage > i ? t.green : t.line }} />
                  <T v="meta" tone={stage > i ? 'ink' : 'muted'}>{l}</T>
                </View>
              ))}
            </View>
            <T v="small" tone="muted">{stage >= 2 ? "They've opened it. Inviting unlocks the moment they tap yes." : 'Browse now. We text you the second they say yes.'}</T>
          </Card>
        )}
      </Centered>
    </Screen>
  );
}
