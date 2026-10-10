// What a parent sees when they tap the text. One page, one button. No account first:
// the link signs them in (magic link), the button verifies the link, done.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card as Sheet } from '@/ui/Screen';
import { Wordmark } from '@/ui/Wordmark';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';

function Row({ k, v }: { k: string; v: string }) {
  const s = useS();
  return <View style={s.row}><T v="smallM">{k}</T><T v="meta" tone="muted" style={{ marginTop: 2 }}>{v}</T></View>;
}
export default function GuardianLink() {
  const router = useRouter();
  const toast = useToast();
  const { link, token_hash } = useLocalSearchParams<{ link?: string; token_hash?: string }>();
  const { profile, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const linkId = link ?? 'link-demo';
  const { data: preview } = useAsync(() => api.guardianLinkPreview(linkId), [linkId]);
  const kid = preview?.childName ?? profile?.displayName ?? 'your kid';
  useEffect(() => { void api.guardianLinkOpened(linkId); }, [linkId]);
  useEffect(() => {
    // Arrived from the email/SMS: complete the magic-link sign-in first.
    if (token_hash && 'signInWithMagicToken' in api) void (api as any).signInWithMagicToken(token_hash).catch((e: any) => toast(e.message));
  }, [token_hash, toast]);
  const yes = async () => {
    setBusy(true);
    try { await api.guardianAccept(linkId); await refresh(); router.replace('/guardian'); }
    catch (e: any) { toast(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen bottom={<Centered><Button title={preview?.verified ? 'Open your dashboard' : `Yes, I'm ${kid}'s parent`} arrow onPress={preview?.verified ? () => router.replace('/guardian') : yes} loading={busy} /></Centered>}>
      <Centered>
        <Header />
        <View style={{ marginTop: space.sm, marginBottom: space.lg }}><Wordmark /></View>
        <T v="eyebrow" tone="muted">Parent approval</T>
        <T v="display" style={{ marginTop: 12 }}>{kid} finds the hit.{'\n'}<T v="display" italic>You approve the meeting.</T></T>
        <T v="small" tone="muted" style={{ marginTop: space.md, marginBottom: space.lg, lineHeight: 21 }}>Hits finds tennis partners at your kid's level nearby. Under 18, nothing gets locked in without you. One tap and you're done.</T>
        <Sheet style={st.box}><T v="micro" tone="muted">You control</T>
          <Row k="Every meetup" v="A hit only becomes real after you tap approve. You see who, where and when first." />
          <Row k="The link itself" v="Pause or remove it any time. Their account stops working for meetups the moment you do." />
          <Row k="Blocking" v="You can block anyone on their behalf, from the same screen you approve on." />
        </Sheet>
        <Sheet style={st.box}><T v="micro" tone="muted">You'll see</T>
          <Row k="Requests and chats, in full" v="Not summaries. Every message, both directions." />
          <Row k="Who they're meeting" v="Name, level, how many hits they've played, how reliably they show up, and whether their parent is linked too." />
        </Sheet>
        <Sheet style={st.box}><T v="micro" tone="muted">Built in, not optional</T>
          <Row k="Under-18s only see under-18s" v="Adults cannot see, find or message your kid. Enforced in the database, not a setting anyone can flip." />
          <Row k="Public courts only" v="Meetups happen at courts from a curated list. Never a house." />
          <Row k="Approximate location" v="Players see a rough distance like '~4 mi'. Never a pin." />
        </Sheet>
      </Centered>
    </Screen>
  );
}
const st = { box: { marginBottom: space.md } } as const;
const useS = makeStyles(c => ({ row: { paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.line, marginTop: space.sm } }));
