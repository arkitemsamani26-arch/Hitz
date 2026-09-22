// Getting your level verified without the Engage API.
//
// You state your UTR and hand over enough for a person to check it: the link to your UTR
// profile and the name on it. A human opens that page, confirms it is you, and grants the
// badge. The rule the product rests on is untouched -- filing a claim is not the same as
// being verified, and nothing a player can call awards the badge.
import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Score } from '@/ui/Score';
import { Rally } from '@/ui/Rally';
import { useToast } from '@/ui/Toast';
import { color, hit, radius, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { relTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';

export default function VerifyUtr() {
  const router = useRouter();
  const toast = useToast();
  const { profile, refresh, tick } = useSession();
  const claim = useAsync(() => api.myUtrClaim(), [tick]);
  const [rating, setRating] = useState(profile?.levelValue ? String(profile.levelValue) : '');
  const [url, setUrl] = useState('');
  const [name, setName] = useState(profile ? `${profile.displayName} ${profile.lastInitial ?? ''}`.trim() : '');
  const [busy, setBusy] = useState(false);

  const n = parseFloat(rating);
  const ready = !isNaN(n) && n >= 1 && n <= 16.5 && /^https?:\/\//i.test(url.trim()) && name.trim().length >= 2;

  const send = async () => {
    setBusy(true);
    try {
      await api.submitUtrClaim(n, url.trim(), name.trim());
      haptic.sent();
      await claim.reload();
      await refresh();
      toast("Sent. We'll check it and let you know.");
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't send that."); }
    finally { setBusy(false); }
  };

  const withdraw = async () => {
    try { await api.withdrawUtrClaim(); await claim.reload(); toast('Withdrawn.'); }
    catch (e: any) { toast(e?.message ?? "Couldn't withdraw."); }
  };

  const c = claim.data;

  return (
    <Screen sky={150} bottom={!c || c.state === 'rejected' ? (
      <Centered><Button title="Send it in" kind="ball" onPress={send} loading={busy} disabled={!ready} /></Centered>
    ) : undefined}>
      <Centered>
        <Header kicker="Your level" title="Get verified." />

        {claim.loading && !claim.data ? <Rally /> : c?.state === 'pending' ? (
          <Animated.View entering={FadeInDown.springify().damping(16)}>
            <Sheet accent style={{ gap: space.sm }}>
              <View style={s.top}>
                <View style={{ flex: 1 }}>
                  <T v="h2">We're checking it.</T>
                  <T v="small" tone="ink2">Sent {relTime(c.createdAt)} ago. A person opens your UTR page and confirms it is you. Usually within a day.</T>
                </View>
                <Score value={c.claimedRating} size="h1" tone="court" />
              </View>
              <View style={s.rule} />
              <T v="micro" tone="ink3">What we're checking</T>
              <T v="small">{c.fullName}</T>
              <Tap onPress={() => void Linking.openURL(c.profileUrl).catch(() => {})} accessibilityRole="link" style={{ minHeight: hit.min, justifyContent: 'center' }}>
                <T v="small" tone="court" numberOfLines={1}>{c.profileUrl}</T>
              </Tap>
              <Button title="Withdraw" kind="ghost" small onPress={withdraw} />
            </Sheet>
            <T v="small" tone="onCourt" style={{ marginTop: space.md, opacity: 0.9 }}>
              Until then your number is on your profile as self-reported. Nothing is blocked.
            </T>
          </Animated.View>
        ) : c?.state === 'approved' ? (
          <Animated.View entering={FadeInDown.springify().damping(16)}>
            <Sheet accent style={{ gap: space.sm }}>
              <View style={s.top}>
                <View style={{ flex: 1 }}>
                  <T v="h2">Verified.</T>
                  <T v="small" tone="ink2">Checked against your UTR profile{c.decidedAt ? ` ${relTime(c.decidedAt)} ago` : ''}. Your level carries the badge.</T>
                </View>
                <Score value={c.decidedRating ?? c.claimedRating} size="score" verified tone="court" />
              </View>
            </Sheet>
            <Button title="Back" kind="line" onPress={() => router.back()} style={{ marginTop: space.md }} />
          </Animated.View>
        ) : (
          <>
            {c?.state === 'rejected' && (
              <Sheet style={{ marginBottom: space.md, borderWidth: 2, borderColor: color.danger }}>
                <T v="bodyM" tone="danger">We couldn't verify that one.</T>
                <T v="small" tone="ink2">{c.reviewerNote ?? 'Check the link and the name on your UTR profile, then send it again.'}</T>
              </Sheet>
            )}

            <Sheet style={{ gap: space.lg }}>
              <View>
                <T v="h2">Three things</T>
                <T v="small" tone="ink2">A person checks them against utrsports.net. No UTR password, ever.</T>
              </View>
              <Field label="Your UTR" value={rating} onChangeText={setRating} placeholder="8.5" keyboardType="decimal-pad" inputMode="decimal" maxLength={5} accessibilityLabel="Your UTR rating" />
              <Field label="Link to your UTR profile" value={url} onChangeText={setUrl} placeholder="https://app.utrsports.net/profiles/..." autoCapitalize="none" autoCorrect={false} inputMode="url" accessibilityLabel="Link to your UTR profile" />
              <Field label="The name on that profile" value={name} onChangeText={setName} placeholder="Maya Rodriguez" autoCapitalize="words" accessibilityLabel="The name on your UTR profile" />
            </Sheet>

            <Tap onPress={() => void Linking.openURL('https://app.utrsports.net/').catch(() => {})} style={s.help} accessibilityRole="link">
              <T v="smallM" tone="onCourt">Find your profile link →</T>
            </Tap>

            <Sheet style={{ marginTop: space.md, gap: 6 }}>
              <T v="micro" tone="ink3">Why bother</T>
              <T v="small" tone="ink2">A verified level is the one other players trust. It gets you better matches, and it is the difference between "says they're 8.5" and "is 8.5".</T>
            </Sheet>
          </>
        )}
      </Centered>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { height: 2, backgroundColor: color.paper3, marginVertical: space.sm, borderRadius: 1 },
  help: { minHeight: hit.min, justifyContent: 'center', alignItems: 'center', marginTop: space.md, borderRadius: radius.md },
});
