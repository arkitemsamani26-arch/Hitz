// What a parent sees when they tap the text. One page, one button. No account first.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { color, space } from '@/theme/tokens';
import { useSession } from '@/store/session';

function Row({ k, v }: { k: string; v: string }) {
  return <View style={s.row}><T v="bodyM">{k}</T><T v="small" tone="ink2" style={{ marginTop: 2 }}>{v}</T></View>;
}
export default function GuardianLink() {
  const router = useRouter();
  const { profile } = useSession();
  const kid = profile?.displayName ?? 'your kid';
  return (
    <Screen sky={200} bottom={<Centered><Button title={`Yes — I'm ${kid}'s parent`} kind="ball" onPress={() => router.replace('/guardian')} /></Centered>}>
      <Centered>
        <Header />
        <T v="micro" tone="ink2">Hits · Parent approval</T>
        <T v="display" style={{ marginTop: space.sm, fontSize: 34, lineHeight: 36 }}>{kid} finds the hit.{'\n'}You approve the meeting.</T>
        <T v="body" tone="ink2" style={{ marginTop: space.md, marginBottom: space.lg }}>Hits helps tennis players find hitting partners at their level nearby. For players under 18, nothing gets locked in without you. Tap the button and you're done — about 30 seconds.</T>
        <Sheet style={s.box}><T v="micro" tone="court">You control</T>
          <Row k="Every meetup" v="A hit only becomes real after you tap approve. You see who, where and when first." />
          <Row k="The link itself" v="Pause or remove it any time. Their account stops working for meetups the moment you do." />
          <Row k="Blocking" v="You can block anyone on their behalf, from the same screen you approve on." />
        </Sheet>
        <Sheet style={s.box}><T v="micro" tone="court">You'll see</T>
          <Row k="Requests and chats, in full" v="Not summaries. Every message, both directions." />
          <Row k="Who they're meeting" v="Name, level, how many hits they've played, how reliably they show up, and whether their parent is linked too." />
        </Sheet>
        <Sheet style={s.box}><T v="micro" tone="court">Built in, not optional</T>
          <Row k="Under-18s only see under-18s" v="Adults cannot see, find or message your kid. Enforced in the database, not a setting anyone can flip." />
          <Row k="Public courts only" v="Meetups happen at courts from a curated list. Never a house." />
          <Row k="Approximate location" v="Other players see a rough distance — '~4 mi' — never a pin." />
        </Sheet>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({ box: { marginBottom: space.md }, row: { paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.hair, marginTop: space.sm } });
