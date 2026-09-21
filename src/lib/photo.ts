// Pick or take a square photo, small enough to ship: 512px, quality 0.6, base64.
import * as ImagePicker from 'expo-image-picker';

export async function pickPhoto(from: 'camera' | 'library'): Promise<{ uri: string; base64: string } | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true };
  if (from === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) return null;
  } else {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) return null;
  }
  const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, base64: a.base64 ?? '' };
}
