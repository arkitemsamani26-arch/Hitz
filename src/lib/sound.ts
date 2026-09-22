// Sound: one crisp ball strike where a hit locks in, a soft pop when something goes out.
// On by default, one toggle in You, off in silent mode. Never on a loading state.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hits.pref.sound';
let enabled = true;
let players: Record<string, any> = {};
let Audio: typeof import('expo-audio') | null = null;
try { Audio = require('expo-audio'); } catch { Audio = null; }

const SRC = {
  strike: require('../../assets/sfx/strike.wav'),
  pop: require('../../assets/sfx/pop.wav'),
};

export async function loadSoundPref() {
  try { const v = await AsyncStorage.getItem(KEY); if (v != null) enabled = v === '1'; } catch {}
  return enabled;
}
export async function setSoundEnabled(v: boolean) {
  enabled = v;
  try { await AsyncStorage.setItem(KEY, v ? '1' : '0'); } catch {}
}

export function play(name: keyof typeof SRC) {
  if (!enabled || !Audio) return;
  try {
    if (!players[name]) {
      players[name] = Audio.createAudioPlayer(SRC[name]);
      if (Platform.OS !== 'web') void Audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    const p = players[name];
    p.seekTo(0); p.play();
  } catch { /* sound is never load-bearing */ }
}
