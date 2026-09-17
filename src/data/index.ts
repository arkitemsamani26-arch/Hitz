import type { HitsApi } from './api';
import { DemoApi } from './demo';
import { SupabaseApi } from './supabase';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const forceDemo = process.env.EXPO_PUBLIC_DEMO === '1';

// Demo unless a Supabase project is configured. Honest about which one is running.
export const api: HitsApi = !forceDemo && url && key ? new SupabaseApi(url, key) : new DemoApi();
export const demo: DemoApi | null = api instanceof DemoApi ? api : null;
