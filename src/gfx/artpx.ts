// One art pixel for the whole game. Everything drawn as pixel art (the 3D world's internal
// resolution, the painted HUD objects, the live 3D shelf and owl portrait, the icons, frames,
// emotes and particles, and the Alagard text) uses this same size, so the resolution and the art
// style read as one consistent picture instead of a mix of fine and chunky pixels.
//
// Phones get about 1.33 CSS px per art pixel, bigger screens about 1.75-2. The size is snapped so
// one art pixel covers a whole number of device pixels (crisp on 1x, 2x and 3x screens).
//
//   artPx()            CSS px per art pixel for the current viewport
//   artPxSignal        the same, as a signal that updates on resize and orientation change
//   snapPx(cssPx)      round a CSS length to whole art pixels
//   fontPx(n = 1)      Alagard size in CSS px: n font-pixel rows of 16 at the art pixel size
//   installArtPx()     keeps `--art-px` (and `--font-px`) on :root in sync, for CSS

import { signal } from '@preact/signals';

const PHONE_TARGET = 1.33;
const WIDE_TARGET = 1.75;
/** short side (CSS px) below which we treat the screen as a phone */
const PHONE_SHORT = 600;

function compute(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const short = Math.min(window.innerWidth || 390, window.innerHeight || 844);
  const target = short < PHONE_SHORT ? PHONE_TARGET : WIDE_TARGET;
  const devicePx = Math.max(1, Math.round(target * dpr));
  return devicePx / dpr;
}

export const artPxSignal = signal(compute());

/** CSS px per art pixel for the current viewport. */
export const artPx = (): number => artPxSignal.value;

/** Round a CSS length to a whole number of art pixels. */
export const snapPx = (cssPx: number): number => Math.round(cssPx / artPx()) * artPx();

/** Alagard is drawn on a 16-row grid: its size in CSS px when each font pixel is `n` art pixels. */
export const fontPx = (n = 1): number => 16 * n * artPx();

let installed = false;
/** Keep `--art-px` and `--font-px` on :root in sync with the viewport (call once at start-up). */
export function installArtPx(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const apply = () => {
    const v = compute();
    artPxSignal.value = v;
    const root = document.documentElement.style;
    root.setProperty('--art-px', `${v}px`);
    root.setProperty('--font-px', `${16 * v}px`);
  };
  apply();
  window.addEventListener('resize', apply);
  window.matchMedia?.('(resolution: 1dppx)').addEventListener?.('change', apply);
}
