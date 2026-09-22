// Location, used once and never stored on the device: we ask where you are, order the
// court list by what is closest, and hand the point to the server so discovery has a
// radius to work from. The exact point never leaves the server after that.
import type { Court } from '@/data/types';
import { api } from '@/data';
import { COURT_POINTS as POINTS, milesBetween as miles } from '@/lib/courts';

let Location: typeof import('expo-location') | null = null;
try { Location = require('expo-location'); } catch { Location = null; }



/** Returns court ids ordered nearest first, or null if we could not get a fix. */
export async function nearMe(courts: Court[]): Promise<string[] | null> {
  if (!Location) return null;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const me: [number, number] = [pos.coords.latitude, pos.coords.longitude];
    void api.setLocation(me[0], me[1]).catch(() => {});
    return [...courts]
      .filter(c => POINTS[c.id])
      .sort((a, b) => miles(me, POINTS[a.id]) - miles(me, POINTS[b.id]))
      .map(c => c.id);
  } catch { return null; }
}
