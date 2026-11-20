// Illustrated icons: each one is a tiny object drawn like a miniature (gradient fills, a warm ink
// outline, a highlight), so the interface reads as things on a nightstand rather than glyphs.
import type { JSX } from 'preact';

const K = '#3a2718';
const sw = 2;

/** Gradients shared by every icon; rendered once at the root of the app. */
export function IconDefs() {
  const lin = (id: string, a: string, b: string, x2 = '0', y2 = '1') => (
    <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}><stop offset="0" stop-color={a} /><stop offset="1" stop-color={b} /></linearGradient>
  );
  return (
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        {lin('g-wood', '#b07a46', '#6e4426')}
        {lin('g-oak', '#e2b274', '#a8703f')}
        {lin('g-leaf', '#8fd06a', '#3f8a3c')}
        {lin('g-brass', '#ffe08a', '#c8862a')}
        {lin('g-cream', '#fffaf0', '#ead9b8')}
        {lin('g-moon', '#fff6d0', '#f0c860')}
        {lin('g-night', '#3a4a8a', '#1a2148')}
        {lin('g-glass', '#d8f4ff', '#8fc8e0')}
        {lin('g-berry', '#ff9aa8', '#d9486a')}
        {lin('g-leather', '#a2603e', '#5e3220')}
        {lin('g-gem', '#d8ccff', '#7a5fe0')}
        {lin('g-flame', '#fff3a0', '#ff8a2a')}
        {lin('g-sky', '#a8dcff', '#4f8fd0')}
        {lin('g-paper', '#fffdf6', '#ecdcbc')}
        {lin('g-moss', '#a8d880', '#4f8a3c')}
        <radialGradient id="g-glow"><stop offset="0" stop-color="#fff7b0" stop-opacity="1" /><stop offset="1" stop-color="#ffd24a" stop-opacity="0" /></radialGradient>
      </defs>
    </svg>
  );
}

type P = { size?: number; class?: string; style?: string };
const S = (p: P, children: JSX.Element | JSX.Element[], vb = '0 0 48 48') => (
  <svg class={'ico ' + (p.class ?? '')} style={p.style} width={p.size ?? 28} height={p.size ?? 28} viewBox={vb} fill="none" stroke={K} stroke-width={sw} stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">{children}</svg>
);

export const IcoHouse = (p: P) => S(p, <>
  <path d="M10 22c-4-1-6-5-4-9 1-4 6-6 9-4 1-4 6-7 10-5 4-3 10-1 11 3 4-1 8 2 7 7 3 3 1 8-3 8H10z" fill="url(#g-leaf)" />
  <path d="M15 22h18v20H15z" fill="url(#g-wood)" />
  <path d="M20 42v-9a4 4 0 0 1 8 0v9" fill="#3a2a20" />
  <circle cx="24" cy="27" r="2.6" fill="#ffd36a" />
  <path d="M12 42h24" />
  <path d="M15 30c-1 3-1 7 0 12M33 30c1 3 1 7 0 12" stroke-width="1.4" opacity=".5" />
</>);

export const IcoClock = (p: P) => S(p, <>
  <path d="M9 13a6 6 0 0 1 9-5M39 13a6 6 0 0 0-9-5" fill="url(#g-brass)" />
  <path d="M8 15a7 7 0 0 1 10-8l-10 8zM40 15a7 7 0 0 0-10-8l10 8z" fill="url(#g-brass)" />
  <path d="M15 40l-3 4M33 40l3 4" />
  <circle cx="24" cy="26" r="15" fill="url(#g-wood)" />
  <circle cx="24" cy="26" r="11" fill="url(#g-cream)" />
  <path d="M24 26V18M24 26l5 3" stroke-width="2.4" />
  <circle cx="24" cy="26" r="1.6" fill={K} />
</>);

export const IcoJar = (p: P) => S(p, <>
  <circle cx="24" cy="28" r="17" fill="url(#g-glow)" stroke="none" opacity=".55" />
  <path d="M16 12h16v5H16z" fill="url(#g-wood)" />
  <path d="M15 17h18c2 3 3 6 3 10v10a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V27c0-4 1-7 3-10z" fill="url(#g-glass)" fill-opacity=".55" />
  <circle cx="20" cy="29" r="2.2" fill="#fff59a" stroke="none" />
  <circle cx="28" cy="34" r="1.8" fill="#fff59a" stroke="none" />
  <circle cx="27" cy="24" r="1.4" fill="#fff59a" stroke="none" />
  <path d="M17 22c-1 4-1 9 0 14" stroke="#fff" stroke-width="1.6" opacity=".7" />
  <path d="M21 12c0-3 6-3 6 0" />
</>);

export const IcoJournal = (p: P) => S(p, <>
  <path d="M11 8h24a3 3 0 0 1 3 3v29a3 3 0 0 1-3 3H11z" fill="url(#g-leather)" />
  <path d="M11 8a4 4 0 0 0-4 4v27a4 4 0 0 0 4 4z" fill="#4a2616" />
  <path d="M38 12v27" stroke="#f6ead2" stroke-width="2.6" />
  <path d="M30 8v16l3-3 3 3V8" fill="url(#g-berry)" />
  <path d="M16 18h9M16 23h7" stroke="#e8c48a" stroke-width="1.8" />
  <circle cx="20" cy="32" r="4" fill="url(#g-moon)" stroke-width="1.6" />
</>);

export const IcoSatchel = (p: P) => S(p, <>
  <path d="M17 16c0-6 14-6 14 0" stroke-width="2.4" />
  <path d="M8 18h32l-2 21a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="url(#g-oak)" />
  <path d="M8 18h32v8c-5 3-27 3-32 0z" fill="url(#g-wood)" />
  <rect x="20.5" y="23" width="7" height="7" rx="1.5" fill="url(#g-brass)" />
  <path d="M14 31v8M34 31v8" stroke-width="1.4" opacity=".45" />
</>);

export const IcoAcorn = (p: P) => S(p, <>
  <path d="M14 22h20c1 10-4 19-10 21-6-2-11-11-10-21z" fill="url(#g-oak)" />
  <path d="M11 22c0-7 6-11 13-11s13 4 13 11z" fill="url(#g-wood)" />
  <path d="M15 17l4 4M21 14l4 5M28 14l3 5M33 17l-2 4" stroke-width="1.2" opacity=".55" />
  <path d="M24 11V6" stroke-width="2.6" />
  <path d="M19 27c0 4 1 8 3 10" stroke="#fff" stroke-width="1.6" opacity=".6" />
</>);

export const IcoStone = (p: P) => S(p, <>
  <path d="M24 5l12 8v18L24 43 12 31V13z" fill="url(#g-gem)" />
  <path d="M12 13l12 7 12-7M24 20v23" stroke-width="1.4" opacity=".6" />
  <path d="M30 21a6 6 0 1 1-4-6 5 5 0 0 0 4 6z" fill="url(#g-moon)" stroke-width="1.4" />
</>);

export const IcoCandle = (p: P) => S(p, <>
  <circle cx="24" cy="12" r="9" fill="url(#g-glow)" stroke="none" opacity=".6" />
  <path class="flame" d="M24 4c4 4 5 7 3 10a3.5 3.5 0 0 1-6 0c-2-3-1-6 3-10z" fill="url(#g-flame)" stroke-width="1.6" />
  <path d="M17 18h14v20H17z" fill="url(#g-cream)" />
  <path d="M17 22c3 2 5-1 7 2s4 0 7 1" stroke-width="1.4" />
  <path d="M11 38h26l-3 5H14z" fill="url(#g-brass)" />
</>);

export const IcoStar = (p: P) => S(p, <path d="M24 5l5.5 11.6 12.5 1.6-9.2 8.6 2.4 12.4L24 33.1l-11.2 6.1 2.4-12.4L6 18.2l12.5-1.6z" fill="url(#g-moon)" />);

export const IcoBrush = (p: P) => S(p, <>
  <path d="M33 7l8 8-15 15-8-8z" fill="url(#g-oak)" />
  <path d="M18 22l8 8-3 3c-3 3-8 2-9 6-4-1-7-5-4-9 3-3 5-5 8-8z" fill="url(#g-berry)" />
  <path d="M29 11l8 8" stroke-width="1.4" opacity=".5" />
</>);

export const IcoHanger = (p: P) => S(p, <>
  <path d="M24 16v-3a4 4 0 1 1 4 4" stroke-width="2.4" />
  <path d="M24 17L6 32a3 3 0 0 0 2 5h32a3 3 0 0 0 2-5z" fill="url(#g-oak)" />
  <path d="M10 33h28" stroke-width="1.4" opacity=".5" />
</>);

export const IcoMap = (p: P) => S(p, <>
  <path d="M6 12l11-4 14 4 11-4v28l-11 4-14-4-11 4z" fill="url(#g-paper)" />
  <path d="M17 8v28M31 12v28" stroke-width="1.4" opacity=".5" />
  <path d="M10 28c4-6 9 2 13-4s8-2 12-8" stroke="#c0533f" stroke-dasharray="2 3" />
  <path d="M33 13l3 3m0-3l-3 3" stroke="#c0533f" stroke-width="2.2" />
  <circle cx="12" cy="28" r="2" fill="url(#g-moss)" stroke-width="1.4" />
</>);

export const IcoGear = (p: P) => S(p, <>
  <path d="M21 5h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="url(#g-brass)" />
  <circle cx="24" cy="24" r="6" fill="url(#g-cream)" />
</>);

export const IcoMic = (p: P) => S(p, <>
  <rect x="17" y="5" width="14" height="24" rx="7" fill="url(#g-brass)" />
  <path d="M17 13h5M17 18h5M17 23h5" stroke-width="1.4" opacity=".6" />
  <path d="M11 22a13 13 0 0 0 26 0M24 35v7M17 43h14" />
</>);

export const IcoBell = (p: P) => S(p, <>
  <path d="M24 6c8 0 12 6 12 14v8l4 6H8l4-6v-8c0-8 4-14 12-14z" fill="url(#g-brass)" />
  <path d="M19 38a5 5 0 0 0 10 0" fill="url(#g-wood)" />
  <path d="M17 14c-2 3-2 7-2 10" stroke="#fff" stroke-width="1.8" opacity=".7" />
</>);

export const IcoMoon = (p: P) => S(p, <>
  <path d="M30 6a18 18 0 1 0 12 26A15 15 0 0 1 30 6z" fill="url(#g-moon)" />
  <circle cx="21" cy="27" r="1.5" fill={K} stroke="none" />
  <circle cx="29" cy="31" r="1.5" fill={K} stroke="none" />
  <path d="M22 33c2 2 5 2 7 0" stroke-width="1.6" />
</>);

export const IcoSun = (p: P) => S(p, <>
  <circle cx="24" cy="24" r="9" fill="url(#g-moon)" />
  <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" stroke-width="2.4" />
</>);

export const IcoRain = (p: P) => S(p, <>
  <path d="M13 30a8 8 0 0 1 1-16 11 11 0 0 1 21 3 7 7 0 0 1 0 13z" fill="url(#g-cream)" />
  <path d="M16 36l-2 5M24 36l-2 5M32 36l-2 5" stroke="#4f8fd0" stroke-width="2.4" />
</>);
export const IcoWaves = (p: P) => S(p, <>
  <path d="M4 22c5-5 9-5 13 0s9 5 13 0 9-5 14 0v20H4z" fill="url(#g-sky)" />
  <path d="M4 32c5-4 9-4 13 0s9 4 13 0 9-4 14 0" stroke="#fff" stroke-width="2" opacity=".8" />
</>);
export const IcoWind = (p: P) => S(p, <path d="M6 18h22a5 5 0 1 0-5-5M6 26h30a5 5 0 1 1-5 5M6 34h14" stroke-width="2.6" />);
export const IcoFire = (p: P) => S(p, <>
  <path d="M24 5c8 8 12 14 10 22a10 10 0 0 1-20 0c-1-5 2-9 5-12 1 4 3 5 5 5-1-6-1-10 0-15z" fill="url(#g-flame)" />
  <path d="M10 40l28-4M10 36l28 4" stroke-width="3" stroke="#6e4426" />
</>);
export const IcoLeaf = (p: P) => S(p, <>
  <path d="M8 40C8 18 20 8 40 8c0 20-10 32-32 32z" fill="url(#g-leaf)" />
  <path d="M8 40L30 18" stroke-width="1.6" />
</>);
export const IcoStream = (p: P) => S(p, <>
  <path d="M6 14c6-4 10 4 18 0s12 4 18 0M6 24c6-4 10 4 18 0s12 4 18 0M6 34c6-4 10 4 18 0s12 4 18 0" stroke="#4f8fd0" stroke-width="2.6" />
</>);
export const IcoMute = (p: P) => S(p, <>
  <path d="M8 18h8l10-8v28l-10-8H8z" fill="url(#g-cream)" />
  <path d="M33 19l9 10M42 19l-9 10" stroke-width="2.4" />
</>);
export const IcoNote = (p: P) => S(p, <>
  <path d="M18 34V10l20-4v24" stroke-width="2.4" />
  <ellipse cx="13" cy="35" rx="6" ry="5" fill="url(#g-berry)" />
  <ellipse cx="33" cy="31" rx="6" ry="5" fill="url(#g-berry)" />
</>);
export const IcoShield = (p: P) => S(p, <>
  <path d="M24 5l15 6v10c0 10-6 18-15 22C15 39 9 31 9 21V11z" fill="url(#g-night)" />
  <path d="M28 15a8 8 0 1 0 5 12 7 7 0 0 1-5-12z" fill="url(#g-moon)" stroke-width="1.6" />
</>);
export const IcoPhoneOff = (p: P) => S(p, <>
  <rect x="14" y="5" width="20" height="38" rx="4" fill="url(#g-night)" />
  <path d="M21 9h6" stroke="#9fb0e0" />
  <path d="M8 8l32 32" stroke="#d9486a" stroke-width="3" />
</>);

export const IcoPlay = (p: P) => S(p, <path d="M15 9l24 15-24 15z" fill="url(#g-brass)" />);
export const IcoPause = (p: P) => S(p, <><rect x="12" y="9" width="8" height="30" rx="2" fill="url(#g-brass)" /><rect x="28" y="9" width="8" height="30" rx="2" fill="url(#g-brass)" /></>);
export const IcoCheck = (p: P) => S(p, <path d="M9 25l9 9 21-21" stroke-width="4" />);
export const IcoClose = (p: P) => S(p, <path d="M12 12l24 24M36 12L12 36" stroke-width="3.6" />);
export const IcoBack = (p: P) => S(p, <path d="M29 9L14 24l15 15" stroke-width="3.6" />);
export const IcoPlus = (p: P) => S(p, <path d="M24 10v28M10 24h28" stroke-width="3.6" />);
export const IcoMinus = (p: P) => S(p, <path d="M10 24h28" stroke-width="3.6" />);
export const IcoLock = (p: P) => S(p, <>
  <path d="M15 21v-6a9 9 0 0 1 18 0v6" stroke-width="3" />
  <rect x="10" y="21" width="28" height="21" rx="4" fill="url(#g-brass)" />
  <circle cx="24" cy="30" r="3" fill={K} stroke="none" />
  <path d="M24 31v5" stroke-width="2.6" />
</>);
export const IcoSparkle = (p: P) => S(p, <>
  <path d="M20 6l3 11 11 3-11 3-3 11-3-11-11-3 11-3z" fill="url(#g-moon)" />
  <path d="M36 28l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5z" fill="url(#g-moon)" stroke-width="1.6" />
</>);
export const IcoPaw = (p: P) => S(p, <>
  <ellipse cx="24" cy="31" rx="9" ry="8" fill="url(#g-berry)" />
  <circle cx="12" cy="21" r="4" fill="url(#g-berry)" /><circle cx="19" cy="13" r="4" fill="url(#g-berry)" /><circle cx="29" cy="13" r="4" fill="url(#g-berry)" /><circle cx="36" cy="21" r="4" fill="url(#g-berry)" />
</>);
export const IcoBed = (p: P) => S(p, <>
  <path d="M6 30c2-8 34-8 36 0l-2 8H8z" fill="url(#g-oak)" />
  <path d="M10 28c4-6 24-6 28 0" fill="url(#g-berry)" />
  <ellipse cx="16" cy="25" rx="6" ry="3.5" fill="url(#g-cream)" />
</>);
export const IcoInfo = (p: P) => S(p, <><circle cx="24" cy="24" r="18" fill="url(#g-paper)" /><path d="M24 22v12M24 15v1" stroke-width="3.6" /></>);
export const IcoRefresh = (p: P) => S(p, <path d="M38 22a14 14 0 1 0-4 12M38 10v12H26" stroke-width="3" />);
export const IcoBreath = (p: P) => S(p, <>
  <circle cx="24" cy="24" r="17" fill="url(#g-glow)" stroke="none" opacity=".7" />
  <circle cx="24" cy="24" r="11" fill="none" stroke="#e8a83a" stroke-width="2.4" />
  <circle cx="24" cy="24" r="5" fill="url(#g-moon)" />
</>);

export const SOUNDSCAPE_ICON: Record<string, (p: P) => JSX.Element> = {
  none: IcoMute, amb_rain: IcoRain, amb_waves: IcoWaves, amb_brown: IcoWind, amb_forest_night: IcoLeaf, amb_fire: IcoFire, amb_stream: IcoStream, music_lullaby: IcoNote,
};
