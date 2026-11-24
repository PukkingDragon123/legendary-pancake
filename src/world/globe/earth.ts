// Earth maths for the globe: lat/lon on the sphere (matching three's SphereGeometry UVs and the painted
// equirectangular texture), where the sun is overhead right now, and a guess at "home" from the time zone
// (no geolocation: the app also runs inside an artifact).
// [globe] OWNED BY THE GLOBE BUILDER.
import * as THREE from 'three';

const D = Math.PI / 180;

/** Unit vector for a lat/lon in the globe's object space (+Y north; lon 0 at +X; east towards -Z). */
export function latLonToVec3(lat: number, lon: number, r = 1, out = new THREE.Vector3()): THREE.Vector3 {
  const cl = Math.cos(lat * D);
  return out.set(cl * Math.cos(lon * D) * r, Math.sin(lat * D) * r, -cl * Math.sin(lon * D) * r);
}
export function vec3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const n = v.clone().normalize();
  return { lat: Math.asin(Math.max(-1, Math.min(1, n.y))) / D, lon: Math.atan2(-n.z, n.x) / D };
}

/** The point where the sun is straight overhead (degrees), from the standard low-precision solar formulas. */
export function subsolar(t = Date.now()): { lat: number; lon: number } {
  const d = t / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * D;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D;
  const e = (23.439 - 0.00000036 * d) * D;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  let lon = ra / D - gmst * 15;
  lon = ((lon + 540) % 360) - 180;
  return { lat: dec / D, lon };
}

/** Is it night at this place right now? (the sun more than a little below the horizon) */
export function isNightAt(lat: number, lon: number, t = Date.now()): boolean {
  const s = subsolar(t);
  return latLonToVec3(lat, lon).dot(latLonToVec3(s.lat, s.lon)) < -0.05;
}

/** Local time at a zone as "21:40" (or "9:40 pm"). */
export function localTime(tz: string, hour12 = false, t = Date.now()): string {
  try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12, timeZone: tz }).format(t); } catch { return ''; }
}

// A rough home for the player from their time zone: the zone's own city where we know it, else the zone's region.
const ZONES: Record<string, [number, number]> = {
  'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Paris': [48.9, 2.35], 'Europe/Berlin': [52.5, 13.4], 'Europe/Madrid': [40.4, -3.7],
  'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.4, 4.9], 'Europe/Brussels': [50.85, 4.35], 'Europe/Vienna': [48.2, 16.4], 'Europe/Zurich': [47.4, 8.5],
  'Europe/Stockholm': [59.3, 18.1], 'Europe/Oslo': [59.9, 10.75], 'Europe/Copenhagen': [55.7, 12.6], 'Europe/Helsinki': [60.2, 24.9], 'Europe/Warsaw': [52.2, 21],
  'Europe/Prague': [50.1, 14.4], 'Europe/Budapest': [47.5, 19.05], 'Europe/Athens': [38, 23.7], 'Europe/Istanbul': [41, 29], 'Europe/Moscow': [55.75, 37.6],
  'Europe/Kiev': [50.45, 30.5], 'Europe/Kyiv': [50.45, 30.5], 'Europe/Lisbon': [38.7, -9.15], 'Europe/Bucharest': [44.4, 26.1],
  'America/New_York': [40.7, -74], 'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105], 'America/Phoenix': [33.45, -112.1],
  'America/Los_Angeles': [34.05, -118.2], 'America/Anchorage': [61.2, -149.9], 'America/Toronto': [43.65, -79.4], 'America/Vancouver': [49.3, -123.1],
  'America/Edmonton': [53.5, -113.5], 'America/Winnipeg': [49.9, -97.1], 'America/Halifax': [44.65, -63.6], 'America/Mexico_City': [19.4, -99.1],
  'America/Bogota': [4.7, -74.1], 'America/Lima': [-12.05, -77], 'America/Santiago': [-33.45, -70.65], 'America/Sao_Paulo': [-23.55, -46.6],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4], 'America/Caracas': [10.5, -66.9], 'Pacific/Honolulu': [21.3, -157.85],
  'Asia/Tokyo': [35.7, 139.7], 'Asia/Seoul': [37.55, 127], 'Asia/Shanghai': [31.2, 121.5], 'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Taipei': [25, 121.5],
  'Asia/Singapore': [1.35, 103.8], 'Asia/Bangkok': [13.75, 100.5], 'Asia/Jakarta': [-6.2, 106.8], 'Asia/Manila': [14.6, 121], 'Asia/Kolkata': [28.6, 77.2],
  'Asia/Calcutta': [22.6, 88.4], 'Asia/Dubai': [25.2, 55.3], 'Asia/Karachi': [24.9, 67], 'Asia/Dhaka': [23.8, 90.4], 'Asia/Ho_Chi_Minh': [10.8, 106.7],
  'Asia/Kuala_Lumpur': [3.1, 101.7], 'Asia/Jerusalem': [31.8, 35.2], 'Asia/Tehran': [35.7, 51.4], 'Asia/Riyadh': [24.7, 46.7],
  'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145], 'Australia/Brisbane': [-27.5, 153], 'Australia/Perth': [-31.95, 115.9],
  'Australia/Adelaide': [-34.9, 138.6], 'Pacific/Auckland': [-36.85, 174.8], 'Africa/Cairo': [30.05, 31.25], 'Africa/Johannesburg': [-26.2, 28.05],
  'Africa/Lagos': [6.5, 3.4], 'Africa/Nairobi': [-1.3, 36.8], 'Africa/Casablanca': [33.6, -7.6], 'Atlantic/Reykjavik': [64.15, -21.9],
};
const REGION: Record<string, [number, number]> = { Europe: [50, 10], America: [40, -95], Asia: [30, 100], Australia: [-28, 140], Africa: [5, 20], Pacific: [-15, 170], Atlantic: [40, -30], Indian: [-10, 70] };

/** Where home is, roughly (lat, lon), from the device's time zone. */
export function homeGuess(): { lat: number; lon: number; tz: string } {
  let tz = 'Europe/London';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch { /* default */ }
  const z = ZONES[tz] ?? REGION[tz.split('/')[0]];
  if (z) return { lat: z[0], lon: z[1], tz };
  // unknown zone: the longitude the UTC offset suggests, at mid latitudes
  const off = -new Date().getTimezoneOffset() / 60;
  return { lat: 40, lon: off * 15, tz };
}

/** Points along the great circle from a to b, lifted into an arc above the surface (for the flight path). */
export function flightArc(a: { lat: number; lon: number }, b: { lat: number; lon: number }, n = 64, lift = 0.16): THREE.Vector3[] {
  const va = latLonToVec3(a.lat, a.lon), vb = latLonToVec3(b.lat, b.lon);
  const ang = Math.acos(Math.max(-1, Math.min(1, va.dot(vb))));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let v: THREE.Vector3;
    if (ang < 1e-4) v = va.clone();
    else v = va.clone().multiplyScalar(Math.sin((1 - t) * ang) / Math.sin(ang)).add(vb.clone().multiplyScalar(Math.sin(t * ang) / Math.sin(ang)));
    out.push(v.normalize().multiplyScalar(1.008 + Math.sin(t * Math.PI) * lift * Math.min(1, ang / 1.2 + 0.25)));
  }
  return out;
}
