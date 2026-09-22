// Court coordinates, used client side to order the picker and to suggest a court that
// sits between two players. The server holds the authoritative set.
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
