// Join your coach. Type their code, see whose academy it is, join. A junior's parent
// approves the coach before the coach sees them at all.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Field } from '@/ui/Field';
import { Icon } from '@/ui/Icon';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { haptic } from '@/lib/haptics';

export default function JoinCoach() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const { profile, refresh } = useSession();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<{ coachName: string; academy: string } | null>(null);
  const [checked, setChecked] = useState('');
  const [busy, setBusy] = useState(false);
  const minor = profile?.band === 'minor';

  // Look the code up as it is typed, once it is long enough to be one.
  useEffect(() => {
    const c = code.trim();
    if (c.length < 4) { setFound(null); setChecked(''); return; }
    let live = true;
    const timer = setTimeout(() => { void api.checkCoachCode(c).then(r => { if (live) { setFound(r); setChecked(c); } }, () => {}); }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [code]);

  const join = async () => {
    setBusy(true);
    try {
      const r = await api.joinCoach(code.trim());
      haptic.confirmed();
      toast(r.needsParent ? `Asked your parent to approve ${r.coachName}.` : `You're on ${r.coachName}'s roster.`);
      await refresh();
      router.back();
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't join."); setBusy(false); }
  };

  return (
    <Screen bottom={<Centered><Button title={found ? `Join ${found.academy}` : 'Join'} arrow onPress={join} loading={busy} disabled={!found} /></Centered>}>
      <Centered>
        <Header backLabel="Profile" />
        <T v="eyebrow" tone="muted">Your coach</T>
        <T v="display" style={{ marginTop: 12, marginBottom: 12 }} accessibilityRole="header">Join your{'\n'}<T v="display" italic>coach.</T></T>
        <T v="small" tone="muted" style={{ marginBottom: 22, lineHeight: 21 }}>
          Your coach can pair you with other players to hit with between lessons. You get their suggestion; you send the invite.
        </T>
        <Field label="Your coach's code" value={code} onChangeText={v => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
          placeholder="PTA26" autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Your coach's code" />
        {found ? (
          <Card style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name="handshake" size={20} color={t.ink} />
            <View style={{ flex: 1 }}>
              <T v="smallM">{found.coachName}</T>
              <T v="meta" tone="muted">{found.academy}</T>
            </View>
          </Card>
        ) : checked && checked === code.trim() ? (
          <T v="small" tone="muted" style={{ marginTop: space.md }}>That code is not a coach on Hits. Check it with them.</T>
        ) : null}
        <Card style={{ marginTop: space.lg, gap: 6 }}>
          <T v="smallM">{minor ? 'Your parent approves this first' : 'What your coach sees'}</T>
          <T v="small" tone="muted">
            {minor
              ? "Your parent gets a request to approve this coach. Once they say yes, and Hits has confirmed who the coach is, your coach can see your first name, level, age and when you usually play, so they can pair you. They can't message you, and your parent still approves every hit."
              : 'Your first name, level, home court and when you usually play, so they can pair you. Not your messages, not your number.'}
          </T>
        </Card>
      </Centered>
    </Screen>
  );
}
