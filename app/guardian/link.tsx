// What a parent sees when they tap the link. They are skeptical and busy. Be plain.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Baseline, ServiceBox } from '@/ui/Court';
import { space } from '@/theme/tokens';
import { useSession } from '@/store/session';

function Row({ k, v }: { k: string; v: string }) {
  return <View style={{ paddingVertical: space.md }}><T v="bodyM">{k}</T><T v="small" tone="ink2" style={{ marginTop: 2 }}>{v}</T></View>;
}

export default function GuardianLink() {
  const router = useRouter();
  const { profile } = useSession();
  const kid = profile?.displayName ?? 'your kid';
  return (
    <Screen bottom={<Centered><Button title={`Yes — link me to ${kid}`} onPress={() => router.replace('/guardian')} /></Centered>}>
      <Centered>
        <Header />
        <T v="micro" tone="ink3">Hits · Parent approval</T>
        <T v="display" style={{ marginTop: space.sm }}>{kid} finds the hit.{'\n'}You approve the meeting.</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xl }}>
          Hits helps tennis players find hitting partners at their level nearby. For players under 18, nothing gets locked in without you.
        </T>

        <ServiceBox style={s.box}>
          <T v="micro" tone="ball">You control</T>
          <Row k="Every meetup" v="A hit only becomes real after you tap approve. You see who, where and when first." />
          <Baseline />
          <Row k="The link itself" v="Pause or remove it any time. Their account stops working for meetups the moment you do." />
          <Baseline />
          <Row k="Blocking" v="You can block anyone on their behalf." />
        </ServiceBox>

        <ServiceBox style={s.box}>
          <T v="micro" tone="cyan">You'll see</T>
          <Row k="Requests and chats, in full" v="Not summaries. Every message, both directions." />
          <Baseline />
          <Row k="Who they're meeting" v="Name, level, how many hits they've played, and how reliably they show up." />
        </ServiceBox>

        <ServiceBox style={s.box}>
          <T v="micro" tone="ink3">Built in, not optional</T>
          <Row k="Under-18s only see under-18s" v="Adults cannot see, find or message your kid. This is enforced in the database, not a setting anyone can flip." />
          <Baseline />
          <Row k="Public courts only" v="Meetups happen at courts from a curated list. Never a house." />
          <Baseline />
          <Row k="Approximate location" v="Other players see a rough distance — '~4 mi' — never a pin." />
        </ServiceBox>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({ box: { paddingHorizontal: space.lg, paddingVertical: space.md, marginBottom: space.lg } });
