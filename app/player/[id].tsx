import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Sheet as Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Rally } from '@/ui/Rally';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { OptionSheet } from '@/ui/Sheet';
import { PlayerCard } from '@/ui/Player';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { slotsOf } from '@/data/types';

const REASONS = [
  { k: 'fake_profile', l: 'Fake profile' }, { k: 'inappropriate_messages', l: 'Inappropriate messages' },
  { k: 'age_misrepresentation', l: 'Not the age they say' }, { k: 'no_show', l: "Didn't show up" },
  { k: 'safety_concern', l: 'I felt unsafe' }, { k: 'other', l: 'Something else' },
];

export default function PlayerScreen() {
  const { id, report } = useLocalSearchParams<{ id: string; report?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useSession();
  const { data: p, loading } = useAsync(() => api.player(id), [id]);
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(!!report);
  const [reason, setReason] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const canRequest = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  if (loading && !p) return <Screen sky={120}><Centered><Header /><Rally /></Centered></Screen>;
  if (!p) return <Screen sky={120}><Centered><Header /><Card><T v="body" tone="ink2">Can't find them.</T></Card></Centered></Screen>;

  const submitReport = async () => {
    if (!reason) return;
    await api.report(p.id, reason, body);
    setReporting(false);
    toast('Got it. A person reads every one of these, same day.');
  };

  return (
    <Screen sky={120} bottom={!reporting ? <Centered><Button kind="ball" title={canRequest ? `Request a hit` : 'Unlocks when your parent says yes'} disabled={!canRequest} onPress={() => router.push(`/request/${p.id}`)} /></Centered> : undefined}>
      <Centered>
        <Header right={<Tap onPress={() => setMore(true)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }} accessibilityRole="button" accessibilityLabel="More options for this player"><T v="h2">···</T></Tap>} />
        <PlayerCard p={p} />
        <Card style={{ marginTop: space.md }}>
          <T v="micro" tone="ink3">Usually free</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {slotsOf(p.availabilityMask).map(t => <Pill key={t} label={t} tone="faint" />)}
          </View>
        </Card>
        <T v="small" tone="onCourt" style={{ marginTop: space.md, opacity: 0.9 }}>
          {p.levelVerified ? 'Level verified through UTR.' : 'Level is self-reported. Close enough is normal; way off is worth a report.'}
        </T>

        {reporting && (
          <Card style={{ marginTop: space.lg, gap: space.md }}>
            <T v="h2">Report {p.displayName}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {REASONS.map(r => <Pill key={r.k} label={r.l} on={reason === r.k} onPress={() => setReason(r.k)} />)}
            </View>
            <Field value={body} onChangeText={setBody} placeholder="What happened? (optional)" multiline />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Never mind" kind="ghost" small onPress={() => setReporting(false)} />
              <Button title="Send report" small onPress={submitReport} disabled={!reason} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <OptionSheet open={more} onClose={() => setMore(false)} options={[
          { label: 'Report', sub: 'Goes to a person, same day', onPress: () => setReporting(true), danger: true },
          { label: `Block ${p.displayName}`, sub: 'You disappear from each other. No notification.', onPress: async () => { await api.block(p.id); router.replace('/(tabs)'); }, danger: true },
        ]} />
      </Centered>
    </Screen>
  );
}
