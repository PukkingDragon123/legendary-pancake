// [world] Real-world sky maths: where the player roughly is (from geolocation when they shared it,
// otherwise guessed from the timezone), sunrise and sunset for today, the moon's phase, the season,
// and the mapping from the real clock to the diorama's "sky hour" (whose keyframes sit at a fixed
// sunrise of 6.2 and sunset of 18.8). Pure functions, no DOM: safe to unit test.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export interface Place { lat: number; lon: number; source: 'geo' | 'tz' }

/** Approximate centres of the busiest timezones: [lat, lon]. */
const TZ: Record<string, [number, number]> = {
  'America/New_York': [40.7, -74], 'America/Detroit': [42.3, -83], 'America/Toronto': [43.7, -79.4], 'America/Chicago': [41.9, -87.6],
  'America/Denver': [39.7, -105], 'America/Phoenix': [33.4, -112], 'America/Los_Angeles': [34.05, -118.2], 'America/Vancouver': [49.3, -123.1],
  'America/Anchorage': [61.2, -149.9], 'Pacific/Honolulu': [21.3, -157.8], 'America/Halifax': [44.6, -63.6], 'America/St_Johns': [47.6, -52.7],
  'America/Mexico_City': [19.4, -99.1], 'America/Bogota': [4.7, -74.1], 'America/Lima': [-12, -77], 'America/Caracas': [10.5, -66.9],
  'America/Santiago': [-33.4, -70.6], 'America/Sao_Paulo': [-23.5, -46.6], 'America/Argentina/Buenos_Aires': [-34.6, -58.4], 'America/Montevideo': [-34.9, -56.2],
  'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.35, -6.26], 'Europe/Lisbon': [38.7, -9.1], 'Europe/Madrid': [40.4, -3.7], 'Europe/Paris': [48.9, 2.35],
  'Europe/Brussels': [50.85, 4.35], 'Europe/Amsterdam': [52.4, 4.9], 'Europe/Berlin': [52.5, 13.4], 'Europe/Zurich': [47.4, 8.5], 'Europe/Rome': [41.9, 12.5],
  'Europe/Vienna': [48.2, 16.4], 'Europe/Prague': [50.1, 14.4], 'Europe/Warsaw': [52.2, 21], 'Europe/Stockholm': [59.3, 18.1], 'Europe/Oslo': [59.9, 10.75],
  'Europe/Copenhagen': [55.7, 12.6], 'Europe/Helsinki': [60.2, 24.9], 'Europe/Kiev': [50.45, 30.5], 'Europe/Kyiv': [50.45, 30.5], 'Europe/Athens': [38, 23.7],
  'Europe/Istanbul': [41, 29], 'Europe/Moscow': [55.75, 37.6], 'Atlantic/Reykjavik': [64.1, -21.9],
  'Africa/Cairo': [30, 31.2], 'Africa/Lagos': [6.5, 3.4], 'Africa/Nairobi': [-1.3, 36.8], 'Africa/Johannesburg': [-26.2, 28], 'Africa/Casablanca': [33.6, -7.6],
  'Asia/Dubai': [25.2, 55.3], 'Asia/Riyadh': [24.7, 46.7], 'Asia/Tehran': [35.7, 51.4], 'Asia/Jerusalem': [31.8, 35.2], 'Asia/Karachi': [24.9, 67],
  'Asia/Kolkata': [28.6, 77.2], 'Asia/Calcutta': [28.6, 77.2], 'Asia/Dhaka': [23.8, 90.4], 'Asia/Bangkok': [13.75, 100.5], 'Asia/Ho_Chi_Minh': [10.8, 106.7],
  'Asia/Jakarta': [-6.2, 106.8], 'Asia/Singapore': [1.35, 103.8], 'Asia/Kuala_Lumpur': [3.1, 101.7], 'Asia/Manila': [14.6, 121], 'Asia/Hong_Kong': [22.3, 114.2],
  'Asia/Shanghai': [31.2, 121.5], 'Asia/Taipei': [25, 121.5], 'Asia/Seoul': [37.6, 127], 'Asia/Tokyo': [35.7, 139.7],
  'Australia/Perth': [-31.95, 115.9], 'Australia/Adelaide': [-34.9, 138.6], 'Australia/Darwin': [-12.5, 130.8], 'Australia/Brisbane': [-27.5, 153],
  'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145], 'Australia/Hobart': [-42.9, 147.3], 'Pacific/Auckland': [-36.85, 174.8],
};
const REGION_LAT: [string, number][] = [
  ['Australia/', -30], ['Antarctica/', -75], ['America/Argentina/', -34], ['Pacific/', -15], ['Indian/', -12],
  ['Africa/', 5], ['Europe/', 50], ['Arctic/', 75], ['Atlantic/', 40], ['Asia/', 30], ['America/', 38],
];
/** Countries south of the equator, for a locale-only guess. */
const SOUTH = new Set(['AU', 'NZ', 'AR', 'CL', 'UY', 'PY', 'BO', 'BR', 'ZA', 'NA', 'BW', 'ZW', 'MZ', 'MG', 'PE', 'ID', 'FJ']);

/** Standard (non-summer-time) UTC offset in hours for the current zone. */
export function standardOffset(now = new Date()): number {
  const y = now.getFullYear();
  const a = -new Date(y, 0, 1).getTimezoneOffset(), b = -new Date(y, 6, 1).getTimezoneOffset();
  return Math.min(a, b) / 60;
}

/** Best guess of where the player is, without asking: timezone, then locale, then 40 N. */
export function guessPlace(tz?: string, locale?: string, now = new Date()): Place {
  const off = standardOffset(now);
  const lon = Math.max(-180, Math.min(180, off * 15));
  if (tz && TZ[tz]) return { lat: TZ[tz][0], lon: TZ[tz][1], source: 'tz' };
  if (tz) for (const [p, lat] of REGION_LAT) if (tz.startsWith(p)) return { lat, lon, source: 'tz' };
  const cc = locale?.split(/[-_]/)[1]?.toUpperCase();
  return { lat: cc && SOUTH.has(cc) ? -30 : 40, lon, source: 'tz' };
}

const RAD = Math.PI / 180;

export interface SunDay {
  /** local clock hours (may fall outside 0..24 near the date line) */
  rise: number; set: number; noon: number;
  /** length of civil twilight in hours */
  twilight: number;
  /** highest elevation of the day, degrees */
  maxEl: number;
  polar: 'day' | 'night' | null;
}

function dayOfYear(d: Date): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
}

/** NOAA's low-precision solar position: sunrise, solar noon and sunset in local clock hours. */
export function sunDay(date: Date, lat: number, lon: number): SunDay {
  const g = ((2 * Math.PI) / 365) * (dayOfYear(date) - 1 + 0.5);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tzMin = -date.getTimezoneOffset();
  const noonUtc = 720 - 4 * lon - eq;
  const noon = (noonUtc + tzMin) / 60;
  const phi = lat * RAD;
  const hourAngle = (zenith: number) => {
    const c = Math.cos(zenith * RAD) / (Math.cos(phi) * Math.cos(decl)) - Math.tan(phi) * Math.tan(decl);
    return c;
  };
  const c0 = hourAngle(90.833), c6 = hourAngle(96);
  const maxEl = 90 - Math.abs(lat - decl / RAD);
  let polar: SunDay['polar'] = null, half: number;
  if (c0 < -1) { polar = 'day'; half = 11.5; }
  else if (c0 > 1) { polar = 'night'; half = 0.5; }
  else half = (Math.acos(c0) / RAD) * 4 / 60;
  const halfCivil = c6 < -1 ? 12 : c6 > 1 ? half : (Math.acos(c6) / RAD) * 4 / 60;
  const twilight = Math.max(0.45, Math.min(2.5, halfCivil - half));
  return { rise: noon - half, set: noon + half, noon, twilight, maxEl, polar };
}

// Anchors of the diorama's sky keyframes (see KEYS in sky.ts).
const K_DAWN = 4.6, K_RISE = 6.2, K_NOON = 12.6, K_SET = 18.8, K_DUSK = 20.4;

/** Map a real local clock hour to the diorama's sky hour for the given sun day. */
export function skyHour(clock: number, sun: SunDay): number {
  const tw = sun.twilight;
  const rise = Math.min(sun.rise, sun.noon - 0.5), set = Math.max(sun.set, sun.noon + 0.5);
  // anchors in real hours, unwrapped to be increasing, with the sky hours they map to
  const real = [rise - tw, rise, sun.noon, set, set + tw];
  const sky = [K_DAWN, K_RISE, K_NOON, K_SET, K_DUSK];
  // night: from dusk to the next dawn
  real.push(real[0] + 24); sky.push(K_DAWN + 24);
  let h = clock;
  while (h < real[0]) h += 24;
  while (h >= real[0] + 24) h -= 24;
  for (let i = 0; i < real.length - 1; i++) {
    if (h >= real[i] && h <= real[i + 1]) {
      const k = real[i + 1] > real[i] ? (h - real[i]) / (real[i + 1] - real[i]) : 0;
      return ((sky[i] + (sky[i + 1] - sky[i]) * k) % 24 + 24) % 24;
    }
  }
  return 12;
}

/** Moon age as a fraction of the synodic month: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const age = (jd - 2451550.1) / 29.530588853;
  return ((age % 1) + 1) % 1;
}
/** Fraction of the moon's disc that is lit, 0..1. */
export const moonLit = (phase: number) => (1 - Math.cos(phase * 2 * Math.PI)) / 2;
export function moonName(phase: number): string {
  const n = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return n[Math.round(phase * 8) % 8];
}

export interface SeasonInfo {
  season: Season;
  /** 0..1 progress through the season (early -> late) */
  t: number;
  /** 0..1 how far into the year's cold half we are (for snow chances): peaks mid winter */
  cold: number;
}

/** Meteorological seasons by month, flipped south of the equator. */
export function seasonOf(date: Date, lat: number): SeasonInfo {
  let m = date.getMonth() + (date.getDate() - 1) / 31;
  if (lat < 0) m = (m + 6) % 12;
  const order: Season[] = ['winter', 'spring', 'summer', 'autumn'];
  // winter is Dec..Feb: shift so Dec = 0
  const s = (m + 1) % 12;
  const idx = Math.floor(s / 3);
  const tropic = Math.abs(lat) < 18;
  const cold = tropic ? 0 : Math.max(0, Math.cos(((s - 1.5) / 12) * 2 * Math.PI)) * Math.min(1, (Math.abs(lat) - 18) / 30);
  return { season: order[idx], t: (s % 3) / 3, cold };
}
