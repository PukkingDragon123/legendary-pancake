// OWNED BY THE UI-CHROME BUILDER. 2D pixel-art particles for the interface (puffs, sparkles,
// hearts, magic, coins, stars), drawn on an overlay canvas above the UI. Anyone may call uiBurst.
// This stub does nothing yet; the chrome builder implements it.
export type UiFxKind = 'puff' | 'sparkle' | 'hearts' | 'magic' | 'coins' | 'stars' | 'snow' | 'leaves' | 'confetti';
export function uiBurst(kind: UiFxKind, x: number, y: number, n = 10): void { void kind; void x; void y; void n; }
/** Burst from the centre of an element. */
export function uiBurstAt(el: Element | null, kind: UiFxKind, n = 10) { if (!el) return; const r = el.getBoundingClientRect(); uiBurst(kind, r.left + r.width / 2, r.top + r.height / 2, n); }
