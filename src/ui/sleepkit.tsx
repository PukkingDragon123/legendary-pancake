// Shared pieces for the sleep, clock and morning screens: animated canvases, realistic paper stocks, a
// hold-to-confirm button, pencil ticks and sparkles.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { Art } from './px/sleepart.ts';
import { TEX_URL, tileURL } from './real/tex.ts';
import { frameStyle } from './real/kit.ts';
import { haptic } from './kit.tsx';
import { uiBurstAt } from './chrome/uifx.ts';

/** Dev/screenshot hook: when window.__artT is set every art clock is frozen at that time (s). */
export const frozenT = (): number | null => { const v = (window as unknown as { __artT?: number }).__artT; return typeof v === 'number' ? v : null; };
export const nowT = () => frozenT() ?? performance.now() / 1000;

/**
 * A pixel-art canvas: `draw(art, t, frame)` paints into an Art of w x h texels, shown `k` css px
 * per texel (crisp). Animates at `fps` (0 = draw once, or whenever `deps` change).
 */
export function ArtCanvas(p: { w: number; h: number; k: number; fps?: number; draw: (a: Art, t: number, f: number) => void; deps?: unknown[]; class?: string; style?: JSX.CSSProperties | string; label?: string; onPointerDown?: (e: PointerEvent) => void; onPointerMove?: (e: PointerEvent) => void; onPointerUp?: (e: PointerEvent) => void; onClick?: (e: MouseEvent) => void; canvasRef?: { current: HTMLCanvasElement | null } }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(p.draw);
  drawRef.current = p.draw;
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    if (p.canvasRef) p.canvasRef.current = c;
    const g = c.getContext('2d')!;
    const a = new Art(p.w, p.h);
    const paint = () => { const t = nowT(); a.clear(); drawRef.current(a, t, Math.floor(t * (p.fps || 8))); a.put(g); };
    paint();
    if (!p.fps || frozenT() !== null) return;
    let raf = 0, last = 0;
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      if (ms - last < 1000 / p.fps! - 2) return;
      last = ms;
      if (document.hidden) return;
      paint();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.w, p.h, p.fps, ...(p.deps ?? [])]);
  const st: JSX.CSSProperties = { width: `${p.w * p.k}px`, height: `${p.h * p.k}px`, ...(typeof p.style === 'object' ? p.style : {}) };
  return <canvas ref={cv} width={p.w} height={p.h} class={'px ' + (p.class ?? '')} style={st} role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : true}
    onPointerDown={p.onPointerDown} onPointerMove={p.onPointerMove} onPointerUp={p.onPointerUp} onPointerCancel={p.onPointerUp} onClick={p.onClick} />;
}

/**
 * [ui7] A smooth canvas at device resolution: `draw(g, t, w, h)` paints in CSS px (the context is pre-scaled).
 * Animates at `fps` (0 = draw once, or whenever `deps` change).
 */
export function PaintCanvas(p: { w: number; h: number; fps?: number; draw: (g: CanvasRenderingContext2D, t: number, w: number, h: number) => void; deps?: unknown[]; class?: string; style?: JSX.CSSProperties | string; label?: string; onClick?: (e: MouseEvent) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(p.draw);
  drawRef.current = p.draw;
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const k = Math.min(3, Math.max(1, devicePixelRatio || 1));
    c.width = Math.round(p.w * k); c.height = Math.round(p.h * k);
    const g = c.getContext('2d')!;
    const paint = () => { g.setTransform(k, 0, 0, k, 0, 0); drawRef.current(g, nowT(), p.w, p.h); };
    paint();
    if (!p.fps || frozenT() !== null) return;
    let raf = 0, last = 0;
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      if (ms - last < 1000 / p.fps! - 2 || document.hidden) return;
      last = ms;
      paint();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.w, p.h, p.fps, ...(p.deps ?? [])]);
  const st: JSX.CSSProperties = { width: `${p.w}px`, height: `${p.h}px`, ...(typeof p.style === 'object' ? p.style : {}) };
  return <canvas ref={cv} class={p.class} style={st} role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : true} onClick={p.onClick} />;
}

/** [ui7] the paper stocks: a seamless photo-real paper tile (tinted per stock), CSS rules / grids on top */
const STOCK: Record<string, { tint?: string; tex?: 'paper' | 'kraft'; base: string; size?: number }> = {
  cream: { base: '#f4e8cc' }, parchment: { tint: '#ecd3a0', base: '#e9d3a4' }, notebook: { tint: '#fff8ea', base: '#f8f0dc' }, graph: { tint: '#f4f6ec', base: '#f1f2e6' },
  kraft: { tex: 'kraft', base: '#b08560' }, postcard: { tint: '#fffaf0', base: '#f7f0e0' }, book: { tint: '#f8ecd0', base: '#f3e4c4' }, spread: { tint: '#f8ecd0', base: '#f3e4c4' },
  sticky: { tint: '#ffe17a', base: '#f8d868' }, receipt: { tint: '#ffffff', base: '#f6f4ee' }, cardboard: { tex: 'kraft', tint: '#c89c6c', base: '#b48a5e' },
  board: { tex: 'kraft', tint: '#d0b088', base: '#c2a07a' }, cork: { base: '#b08050' }, wood: { base: '#7a4a28' }, leather: { base: '#5a2a1c' },
};
/** The CSS background (layers) and inner edge shadow for a paper stock and its options. */
export function paperCSS(kind: string, opts: Record<string, unknown> = {}): { bg: string; edge: string } {
  const k = STOCK[kind] ?? STOCK.cream;
  const tile = kind === 'cork' ? TEX_URL.cork : kind === 'wood' ? TEX_URL.walnut : kind === 'leather' ? TEX_URL.leather : tileURL(k.tex ?? 'paper', k.tint, 512);
  const size = kind === 'wood' ? 400 : 320, seed = Number(opts.seed ?? 0);
  const layers: string[] = [];
  if (kind === 'notebook' || opts.rules) {
    const sp = Number(opts.rules ?? 8) * 3, top = Number(opts.ruleTop ?? 10) * 3, m = Number(opts.margin ?? 0) * 3;
    if (m) layers.push(`linear-gradient(90deg, transparent ${m}px, rgba(200,70,70,.42) ${m}px ${m + 1.5}px, transparent ${m + 1.5}px)`);
    layers.push(`repeating-linear-gradient(180deg, transparent 0 ${sp - 1}px, rgba(70,110,170,.26) ${sp - 1}px ${sp}px) 0 ${top}px / 100% calc(100% - ${top}px) no-repeat`);
  }
  if (kind === 'graph') layers.push('linear-gradient(rgba(70,130,150,.16) 1px, transparent 1px) 0 0 / 12px 12px', 'linear-gradient(90deg, rgba(70,130,150,.16) 1px, transparent 1px) 0 0 / 12px 12px');
  if (kind === 'spread' || opts.spine) layers.push('linear-gradient(90deg, transparent 44%, rgba(90,60,30,.18) 49%, rgba(60,40,20,.3) 50%, rgba(90,60,30,.18) 51%, transparent 56%)');
  if (kind === 'sticky' || opts.sticky) layers.push('linear-gradient(160deg, rgba(255,255,255,.18), transparent 40%, rgba(150,100,0,.12))');
  layers.push(`url("${tile}") ${(seed * 37) % size}px ${(seed * 53) % size}px / ${size}px ${size}px`, k.base);
  const e = Number(opts.edge ?? (kind === 'parchment' ? 0.45 : kind === 'cream' ? 0.2 : 0.15)), ew = Number(opts.edgeW ?? 8);
  return { bg: layers.join(', '), edge: e > 0 ? `inset 0 0 ${ew * 1.6}px rgba(120,76,30,${Math.min(0.6, e * 0.7)})` : 'none' };
}

/** Give an element a realistic paper surface (stocks: cream, parchment, notebook, graph, kraft, postcard, book, sticky...). */
export function usePaper(kind: string, opts: Record<string, unknown> = {}) {
  const ref = useRef<HTMLElement>(null);
  const key = JSON.stringify(opts);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = paperCSS(kind, opts);
    el.style.background = c.bg;
    el.style.setProperty('--paper-edge', c.edge);
  }, [kind, key]);
  return ref as { current: never };
}

/** A paper element (div) with a texture. */
export function Paper(p: { kind: string; opts?: Record<string, unknown>; class?: string; style?: JSX.CSSProperties | string; children?: ComponentChildren; onClick?: (e: MouseEvent) => void; as?: 'div' | 'button'; label?: string }) {
  const ref = usePaper(p.kind, p.opts);
  const Tag = (p.as ?? 'div') as 'div';
  return <Tag ref={ref} class={'hh-paper ' + (p.class ?? '')} style={p.style} onClick={p.onClick} aria-label={p.label}>{p.children}</Tag>;
}

/**
 * Press and hold to confirm. A quilt of stars fills the button while you hold; letting go early
 * drains it back. Space/Enter also work (hold the key).
 */
export function HoldButton(p: { ms?: number; onDone: () => void; class?: string; children: ComponentChildren; label: string; sound?: string }) {
  const ms = p.ms ?? 1400;
  const [k, setK] = useState(0);
  const st = useRef({ down: false, t0: 0, raf: 0, k: 0, done: false, lastTick: 0 });
  const el = useRef<HTMLButtonElement>(null);
  const step = () => {
    const s = st.current;
    const now = performance.now();
    if (s.down) s.k = Math.min(1, s.k + (now - s.t0) / ms); else s.k = Math.max(0, s.k - (now - s.t0) / (ms * 0.35));
    s.t0 = now;
    setK(s.k);
    if (s.down && Math.floor(s.k * 8) !== s.lastTick) { s.lastTick = Math.floor(s.k * 8); haptic(4); sound.play('clock_tick', { volume: 0.18 + s.k * 0.3, rate: 0.9 + s.k * 0.5, gap: 30 }); }
    if (s.k >= 1 && !s.done) { s.done = true; s.down = false; haptic(30); uiBurstAt(el.current, 'stars', 18); p.onDone(); return; }
    if (s.down || s.k > 0) s.raf = requestAnimationFrame(step);
  };
  const down = (e: Event) => { e.preventDefault(); const s = st.current; if (s.done) return; s.down = true; s.t0 = performance.now(); cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(step); sound.play(p.sound ?? 'fabric', { volume: 0.4, gap: 200 }); };
  const up = () => { const s = st.current; if (!s.down) return; s.down = false; s.t0 = performance.now(); };
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);
  return (
    <button ref={el} class={'hh-hold ' + (p.class ?? '') + (k > 0 ? ' holding' : '')} aria-label={p.label} style={{ '--k': k } as JSX.CSSProperties}
      onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); }} onKeyUp={up}>
      <span class="fill" />
      <span class="in">{p.children}</span>
    </button>
  );
}

/** A pencil tick that draws itself in. */
export function PencilTick(p: { on: boolean; size?: number }) {
  const s = p.size ?? 28;
  return (
    <svg class={'hh-tick' + (p.on ? ' on' : '')} width={s} height={s} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M1.5 7.5 C3 9 4 10 5 11.2 C7.5 7.5 10 4.5 13 1.8" fill="none" stroke="#2c3a58" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
    </svg>
  );
}

/** Pixel sparkles popping around an element (our own, so it works without the UI-fx layer too). */
export function sparkleAt(el: Element | null, n = 8) {
  if (!el) return;
  uiBurstAt(el, 'sparkle', n);
  const r = el.getBoundingClientRect();
  const host = document.body;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'hh-spark';
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = 24 + Math.random() * 30;
    s.style.left = `${r.left + r.width / 2}px`; s.style.top = `${r.top + r.height / 2}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d - 10}px`);
    s.style.animationDelay = `${i * 25}ms`;
    host.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

let framesInjected = false;
/** BME frames for the classes my screens use (painted 9-slice borders). */
export function injectSleepFrames() {
  if (framesInjected || typeof document === 'undefined') return;
  framesInjected = true;
  const css = `
.hh-btn-night{${frameStyle('button_night', 3)}}
.hh-btn-night:active{${frameStyle('button_night_down', 3)}}
.hh-btn-gold{${frameStyle('button_gold', 3)}}
.hh-btn-gold:active{${frameStyle('button_gold_down', 3)}}
.hh-btn-green{${frameStyle('button_green', 3)}}
.hh-btn-green:active{${frameStyle('button_green_down', 3)}}
.hh-btn-cream{${frameStyle('button_cream', 2)}}
.hh-btn-cream:active{${frameStyle('button_cream_down', 2)}}
.hh-wood{${frameStyle('wood', 3)}}
.hh-wood-dark{${frameStyle('wood_dark', 3)}}
.hh-wood-sm{${frameStyle('wood', 2)}}
.hh-wood-dark-sm{${frameStyle('wood_dark', 2)}}
.hh-parch{${frameStyle('parchment', 2)}}
.hh-plaque{${frameStyle('plaque', 2)}}
.hh-slot{${frameStyle('slot_brass', 2)}}
.hh-slot.on{${frameStyle('slot_gold_active', 2)}}
.hh-ribbon{${frameStyle('ribbon_green', 2)}}
.hh-ribbon.red{${frameStyle('ribbon_red', 2)}}
.hh-sticky{${frameStyle('sticky_note', 2)}}
.hh-bar{${frameStyle('bar_track', 2)}}
.hh-tab{${frameStyle('tab', 2)}}
.hh-tab.on{${frameStyle('button_gold', 2)}}
`;
  const st = document.createElement('style');
  st.id = 'hh-sleep-frames';
  st.textContent = css;
  document.head.appendChild(st);
}
