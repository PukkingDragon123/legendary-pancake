// Animated pixel sprites: a set of frames (`<base>_<i>` sprites) played along a timeline by one
// shared clock, so dozens of icons animate with a single timer and no re-renders. A one-shot
// timeline (`act`) can be played on top, e.g. the book opening when it is tapped.
import { useEffect, useRef } from 'preact/hooks';
import { hasSprite, SPRITES, spriteURL } from '../px/sprites.js';
import '../px/chromeart.js';
import { iconDev, iconSrc } from './iconset.ts';

/** [frame sprite name, milliseconds] steps, looped. */
export type Timeline = [string, number][];

/** `n` frames `${base}_${from..}` each shown `ms`. */
export const seq = (base: string, n: number, ms: number, from = 0): Timeline => Array.from({ length: n }, (_, i) => [`${base}_${from + i}`, ms] as [string, number]);
export const rep = (tl: Timeline, times: number): Timeline => Array.from({ length: times }, () => tl).flat();
export const hold = (name: string, ms: number): Timeline => [[name, ms]];
export const tlTotal = (tl: Timeline) => tl.reduce((s, [, ms]) => s + ms, 0);

/**
 * The idle animation of a sprite drawn by another builder (e.g. `owlcoin_f0..f7`), or the plain
 * sprite if no frames exist yet.
 */
export function framesOf(name: string, ms = 110): Timeline {
  if (!hasSprite(`${name}_f0`)) return hold(name, 1e9);
  const out: Timeline = [];
  for (let i = 0; hasSprite(`${name}_f${i}`) && i < 32; i++) out.push([`${name}_f${i}`, ms]);
  return out;
}

type W = Window & { __chromeT?: number };
/** Time for every chrome animation; `window.__chromeT` freezes it (screenshots). */
export const clockNow = () => (window as W).__chromeT ?? performance.now();

interface Entry { img: HTMLImageElement; tl: Timeline; total: number; offset: number; scale: number; dev?: number; cur: string; act?: { tl: Timeline; total: number; t0: number }; paused?: boolean }
const live = new Set<Entry>();
let timer = 0;
function frameAt(tl: Timeline, t: number): string {
  for (const [n, ms] of tl) { if (t < ms) return n; t -= ms; }
  return tl[tl.length - 1][0];
}
function update(e: Entry, now: number) {
  if (e.paused) return;
  let name = '';
  if (e.act) {
    const t = now - e.act.t0;
    if (t >= 0 && t < e.act.total) name = frameAt(e.act.tl, t);
    else if (t >= e.act.total) e.act = undefined;
  }
  if (!name) name = frameAt(e.tl, (((now + e.offset) % e.total) + e.total) % e.total);
  if (name !== e.cur) { e.cur = name; e.img.src = (e.dev && iconSrc(name, e.dev, dpr())) || spriteURL(name, e.scale); }
}
function tick() {
  if (typeof document !== 'undefined' && document.hidden) return;
  const now = clockNow();
  for (const e of live) update(e, now);
}
function track(e: Entry) {
  live.add(e);
  if (!timer) timer = window.setInterval(tick, 40);
}
function untrack(e: Entry) {
  live.delete(e);
  if (!live.size && timer) { clearInterval(timer); timer = 0; }
}

const dpr = () => Math.min(4, Math.max(1, Math.round((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1)));
/** CSS size and device scale for a sprite shown about `want` px on its long side, kept pixel-crisp; `zoom`: a CSS scale
 * the sprite is shown through (e.g. the HUD's 1.5 on desktops), so it lands on whole device pixels after it. */
export function crisp(name: string, want: number, zoom = 1) {
  const sp = (SPRITES as Record<string, { w: number; h: number; i3d?: unknown }>)[name];
  const w0 = sp?.w ?? 20, h0 = sp?.h ?? 20, k = dpr();
  // [icons8] the pixel-art icon family: the nearest crisp size (a whole number of device px per art px)
  if (sp?.i3d) { const dev = iconDev(Math.max(8, Math.round(want * k * zoom))); return { w: dev / (k * zoom), h: dev / (k * zoom), scale: 1, dev }; }
  const per = Math.max(1 / k, Math.round((want / Math.max(w0, h0)) * k) / k);
  return { w: Math.round(w0 * per), h: Math.round(h0 * per), scale: Math.max(1, Math.round(per * k)), dev: 0 };
}

export interface AnimHandle { play(tl: Timeline): void }

/**
 * A frame animation. `tl` loops; `act` + a changing `actKey` plays `act` once on top. `offset`
 * desynchronises copies; `handle` receives a play() function.
 */
export function PxAnim(p: { tl: Timeline; size: number; zoom?: number; offset?: number; act?: Timeline; actKey?: number; class?: string; style?: string; paused?: boolean; handle?: (h: AnimHandle) => void; alt?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const ent = useRef<Entry | null>(null);
  const first = p.tl[0][0];
  const c = crisp(first, p.size, p.zoom);
  useEffect(() => {
    const img = ref.current!;
    const e: Entry = { img, tl: p.tl, total: Math.max(1, tlTotal(p.tl)), offset: p.offset ?? 0, scale: c.scale, dev: c.dev, cur: '' };
    ent.current = e;
    update(e, clockNow());
    track(e);
    p.handle?.({ play: (tl) => { e.act = { tl, total: tlTotal(tl), t0: clockNow() }; update(e, clockNow()); } });
    return () => untrack(e);
  }, [p.tl, c.scale, c.dev]);
  useEffect(() => { if (ent.current) ent.current.paused = !!p.paused; }, [p.paused]);
  useEffect(() => {
    const e = ent.current;
    if (!e || !p.act || !p.actKey) return;
    e.act = { tl: p.act, total: tlTotal(p.act), t0: clockNow() };
    update(e, clockNow());
  }, [p.actKey]);
  return <img ref={ref} class={'px ico ' + (p.class ?? '')} style={p.style} src={(c.dev && iconSrc(first, c.dev, dpr())) || spriteURL(first, c.scale)} width={c.w} height={c.h} alt={p.alt ?? ''} draggable={false} />;
}
