import type { Court, CourtStats } from '@/data/types';

// Court coordinates, used client side to order the picker and to suggest a court that
// sits between two players. The server holds the authoritative set.
//
// Keyed by the demo's ids, and filled in for the live directory's ids by name when the
// court list loads (registerCourts), so the same lookups work against either backend.
export const COURT_POINTS: Record<string, [number, number]> = {
  'c-rinconada': [37.4460, -122.1500],
  'c-mitchell': [37.4210, -122.1090],
  'c-cubberley': [37.4160, -122.1030],
  'c-burgess': [37.4520, -122.1830],
  'c-nealon': [37.4420, -122.1970],
  'c-stanford': [37.4340, -122.1600],
  'c-cuesta': [37.3800, -122.0790],
  'c-sunnyvale': [37.3650, -122.0270],
  'c-losaltos': [37.3790, -122.1370],
  'c-cupertino': [37.3120, -122.0560],
};

const BY_NAME: Record<string, [number, number]> = {
  'Rinconada Park': [37.4460, -122.1500],
  'Mitchell Park': [37.4210, -122.1090],
  'Cubberley Courts': [37.4160, -122.1030],
  'Burgess Park': [37.4520, -122.1830],
  'Nealon Park': [37.4420, -122.1970],
  'Stanford Taube Courts': [37.4340, -122.1600],
  'Cuesta Park': [37.3800, -122.0790],
  'Sunnyvale Tennis Center': [37.3650, -122.0270],
  'Los Altos Hills Courts': [37.3790, -122.1370],
  'Cupertino Tennis Center': [37.3120, -122.0560],
};

export function registerCourts(courts: { id: string; name: string }[]) {
  for (const c of courts) if (!COURT_POINTS[c.id] && BY_NAME[c.name]) COURT_POINTS[c.id] = BY_NAME[c.name];
}

export function milesBetween(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 7917.5 * Math.asin(Math.sqrt(h));
}

/**
 * A court that splits the difference. Given two home courts, returns the court closest
 * to the point halfway between them, so neither player drives the whole way.
 */
export function midpointCourt(aCourtId: string | null, bCourtId: string | null, courtIds: string[]): string | null {
  const a = aCourtId ? COURT_POINTS[aCourtId] : null;
  const b = bCourtId ? COURT_POINTS[bCourtId] : null;
  if (!a || !b) return null;
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let best: string | null = null, bestD = Infinity;
  for (const id of courtIds) {
    const p = COURT_POINTS[id]; if (!p) continue;
    const d = milesBetween(mid, p);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/** How far apart two home courts are, as a short phrase. */
export function betweenText(aCourtId: string | null, bCourtId: string | null): string | null {
  const a = aCourtId ? COURT_POINTS[aCourtId] : null;
  const b = bCourtId ? COURT_POINTS[bCourtId] : null;
  if (!a || !b) return null;
  const mi = milesBetween(a, b);
  if (mi < 1) return 'Same patch of town';
  return `${Math.round(mi)} mi apart`;
}

/** Miles from one court to another, or null when either has no known point. */
export function courtMiles(fromId: string | null | undefined, toId: string): number | null {
  const a = fromId ? COURT_POINTS[fromId] : null, b = COURT_POINTS[toId];
  return a && b ? milesBetween(a, b) : null;
}

// How a court is described in a list: "Public · Hard · Outdoor", how far it is from
// yours, and how many players call it home.
export function courtFacts(c: Court): string {
  const surface = c.surface ? c.surface.charAt(0).toUpperCase() + c.surface.slice(1) : null;
  return [c.access === 'club' ? 'Club' : 'Public', surface, c.indoor ? 'Indoor' : 'Outdoor'].filter(Boolean).join(' · ');
}
export function milesText(mi: number | null, short = false): string | null {
  if (mi == null) return null;
  if (short) return mi < 0.6 ? 'Near yours' : `~${Math.max(1, Math.round(mi))} mi`;
  return mi < 0.6 ? 'Close to your court' : `~${Math.max(1, Math.round(mi))} mi from your court`;
}
export function playersText(st?: CourtStats): string {
  if (!st || st.players === 0) return 'No players here yet';
  return `${st.players} ${st.players === 1 ? 'player' : 'players'}${st.looking ? ` · ${st.looking} free this week` : ''}`;
}
