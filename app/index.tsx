import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/store/session';

// The gate. Where you land depends only on what's true about you.
export default function Index() {
  const { ready, session, profile } = useSession();
  if (!ready) return null;
  if (!session) return <Redirect href="/onboarding/phone" />;
  if (session.isGuardian) return <Redirect href="/guardian" />;
  if (!profile) return <Redirect href="/onboarding/name" />;
  return <Redirect href="/(tabs)" />;
}
