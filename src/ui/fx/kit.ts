// Small shared helpers for the effects layer (src/ui/fx): a seeded random, the shared clock, and the Calm motion test.

/** A small seeded random (shapes and sparkles land the same way every run). */
export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
}

/** The shared clock (seconds) for the effects layer; `window.__fxT` freezes it (screenshots, tests). */
export function fxNow(): number {
  const g = globalThis as { __fxT?: number; __animeT?: number }, f = g.__fxT ?? g.__animeT;
  return f !== undefined ? f : performance.now() / 1000;
}

/** "Calm motion" (the in-app setting) or the system's reduced-motion preference. */
export function calmMotion(): boolean {
  try {
    if (document.documentElement.classList.contains('hh-still')) return true;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}
