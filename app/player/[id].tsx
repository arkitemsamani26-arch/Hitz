import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Loading } from '@/ui/Loading';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { OptionSheet } from '@/ui/Sheet';
import { PlayerCard } from '@/ui/Player';
import { useToast } from '@/ui/Toast';
import { hit, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useNextWindow } from '@/store/window';
import { useAsync } from '@/store/useAsync';
import { overlapLine } from '@/lib/match';
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
  const t = useTheme();
  const { profile } = useSession();
  const win = useNextWindow(profile?.availabilityMask ?? 0);
  const { data: p, loading } = useAsync(() => api.player(id), [id]);
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(!!report);
  const [reason, setReason] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const canRequest = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  if (loading && !p) return <Screen><Centered><Header backLabel="Back to players" /><Loading /></Centered></Screen>;
  if (!p) return <Screen><Centered><Header backLabel="Back to players" /><Card><T v="body" tone="muted">Can't find them.</T></Card></Centered></Screen>;

  const submitReport = async () => {
    if (!reason || sending) return;
    setSending(true);
    try { await api.report(p.id, reason, body); setReporting(false); toast('Got it. A person reads every one of these, same day.'); }
    catch (e: any) { toast(e?.message ?? "Couldn't send that report."); }
    finally { setSending(false); }
  };
  const when = profile ? overlapLine(profile, p, win) : null;
  const free = slotsOf(p.availabilityMask);

  return (
    <Screen bottom={!reporting ? <Centered><Button arrow title={canRequest ? 'Invite to hit' : 'Unlocks when your parent says yes'} disabled={!canRequest} onPress={() => router.push(`/request/${p.id}`)} /></Centered> : undefined}>
      <Centered>
        <Header backLabel="Back to players" right={<Tap onPress={() => setMore(true)} style={{ minWidth: hit.min, minHeight: hit.min, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="More options for this player"><Icon name="ellipsis" size={18} color={t.ink} /></Tap>} />
        <PlayerCard p={p} me={profile} />
        <T v="micro" tone="muted" style={{ marginTop: 24, marginBottom: 10 }}>When</T>
        <Card style={{ gap: space.sm }}>
          {when && (
            <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
              <Icon name={when.known ? 'calendar-check-2' : 'calendar'} size={16} color={t.ink} style={{ marginTop: 2 }} />
              <T v="smallM" style={{ flex: 1 }}>{when.text}</T>
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
            {free.length ? free.map(f => <Pill key={f} label={f} />) : <T v="meta" tone="muted">They haven't said when they usually play.</T>}
          </View>
        </Card>
        <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
          {p.levelVerified ? 'Rating verified through UTR.' : 'Rating is self-reported. Close enough is normal; way off is worth a report.'}
        </T>

        {reporting && (
          <Card style={{ marginTop: space.lg, gap: space.md }}>
            <T v="h2">Report {p.displayName}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {REASONS.map(r => <Pill key={r.k} label={r.l} on={reason === r.k} onPress={() => setReason(r.k)} />)}
            </View>
            <Field value={body} onChangeText={setBody} placeholder="What happened? (optional)" multiline accessibilityLabel="What happened" />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Never mind" kind="ghost" small onPress={() => setReporting(false)} />
              <Button title="Send report" small onPress={submitReport} disabled={!reason} loading={sending} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <OptionSheet open={more} onClose={() => setMore(false)} options={[
          { label: 'Report', sub: 'Goes to a person, same day', onPress: () => setReporting(true), danger: true },
          { label: `Block ${p.displayName}`, sub: 'You disappear from each other. No notification.', onPress: async () => { try { await api.block(p.id); router.replace('/(tabs)'); } catch (e: any) { toast(e?.message ?? "Couldn't block."); } }, danger: true },
        ]} />
      </Centered>
    </Screen>
  );
}
