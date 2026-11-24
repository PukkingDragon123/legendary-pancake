// The interview's paper: each question is a printed Hollow & Co. form (letterhead, form number, the question,
// tick boxes with little printed pictograms, fine print, an office-use box for the stamp). Print is crisp pixel
// type (fonts.ts) on hand-painted paper; everything the visitor does is ink on top: ticks and loops drawn by the
// fountain pen, handwriting that appears letter by letter, the rubber stamp's impression. A Form knows its hit
// regions (in texels) so the 3D paper can be picked by uv.
import * as THREE from 'three';
import { F } from './fonts.ts';
import { iconSize, iconURL } from './obicons.ts';
import { C, crispText, hash, lerpRamp, measure, paper as paperFill, rgb, Tex, vnoise, wrap } from './tex.ts';

export const PW = 360, PH = 480;
/** the paper in metres */
export const PAPER_W = 0.24, PAPER_H = 0.32;

export type RegionKind = 'tick' | 'field' | 'card' | 'minus' | 'plus' | 'ampm' | 'scale' | 'file' | 'sign' | 'remind';
export interface Region { id: string; kind: RegionKind; x: number; y: number; w: number; h: number; v?: string }

export const INK = '#1d2552', PRINT = '#22305a', PRINT2 = '#4a5478', RED = '#b3232b', GOLD = '#9a6a1c', BLACK = '#1a1714';

// ------------------------------------------------------------------ images (pictograms, owl photos)

const imgs = new Map<string, HTMLImageElement>();
/** Load images (data/same-origin URLs) so forms can draw them synchronously. */
export async function preload(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => {
    if (imgs.has(u)) return imgs.get(u)!.decode?.().catch(() => undefined) ?? Promise.resolve();
    const im = new Image();
    im.src = u;
    imgs.set(u, im);
    return im.decode ? im.decode().catch(() => undefined) : new Promise<void>((r) => { im.onload = () => r(); im.onerror = () => r(); });
  }));
}
export const iconImg = (name: string) => imgs.get(iconURL(name));
export function preloadIcons(names: string[]) { return preload(names.map(iconURL)); }
export function imgOf(url: string) { return imgs.get(url); }

// ------------------------------------------------------------------ the blank sheet (shared)

let sheet: HTMLCanvasElement | null = null;
/** Cream laid paper with fibres, a faint oak watermark and the letterhead. */
function blank(): HTMLCanvasElement {
  if (sheet) return sheet;
  const t = new Tex(PW, PH);
  paperFill(t, 0, 0, PW, PH, { base: 0.8, seed: 3 });
  // laid lines and a soft deckle shade at the edges
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    if (y % 6 === 0) t.shade(x, y, 0.992);
    const e = Math.min(x, y, PW - 1 - x, PH - 1 - y);
    if (e < 6) t.shade(x, y, 0.94 + e * 0.01);
  }
  // the watermark: an oak in the middle of the sheet
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const dx = (x - PW / 2) / 70, dy = (y - PH * 0.55) / 70;
    const crown = Math.hypot(dx * 0.9, dy + 0.35) < 0.75 + (vnoise(x * 0.08, y * 0.08, 5) - 0.5) * 0.3;
    const trunk = Math.abs(dx) < 0.09 + Math.max(0, dy - 0.5) * 0.25 && dy > 0.1 && dy < 1.05;
    if (crown || trunk) t.shade(x, y, 0.975);
  }
  const c = t.canvas(64), g = c.getContext('2d')!;
  // letterhead: an acorn crest, the firm's name at double size, the strapline, a double rule
  crest(g, 18, 14);
  const name = scaled('HOLLOW & CO.', F.caps(12), PRINT, 2);
  g.drawImage(name, 46, 13);
  crispText(g, 'SLEEP CONSULTANTS  ·  EST. IN THE OLD OAK', 47, 47, F.small(16), PRINT2);
  g.fillStyle = PRINT; g.fillRect(16, 54, PW - 32, 1); g.fillRect(16, 57, PW - 32, 2);
  // footer fine print
  g.fillStyle = PRINT2; g.fillRect(16, PH - 30, PW - 32, 1);
  crispText(g, 'Hollow & Co. keeps your answers on this device only.', 16, PH - 16, F.small(16), PRINT2);
  sheet = c;
  return c;
}
/** A small acorn-and-oak-leaf crest in navy and gold. */
function crest(g: CanvasRenderingContext2D, x: number, y: number) {
  const rows = [
    '.....gg.......',
    '....gGGg......',
    '...gGGGGg.....',
    '..nnnnnnnn....',
    '.nNNNNNNNNn...',
    '.nNnNnNnNNn...',
    '..nNNNNNNn..l.',
    '...bbbbbb..lLl',
    '...bBBBBb.lLLl',
    '...bBBBBb.lLl.',
    '...bBBBBb.ll..',
    '....bBBb..l...',
    '.....bb.......',
  ];
  const col: Record<string, string> = { g: '#6a4a12', G: '#c8962e', n: '#1b2650', N: '#33457e', b: '#7a4a1a', B: '#c7883a', l: '#2a5a2a', L: '#4f8a3a' };
  const k = 2;
  rows.forEach((r, ry) => [...r].forEach((ch, rx) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x + rx * k, y + ry * k, k, k); } }));
}
/** Text drawn at 1x then scaled up by an integer (crisp double pixels). */
export function scaled(text: string, font: string, color: string, k: number): HTMLCanvasElement {
  const w = Math.ceil(measure(text, font)) + 8, h = 24;
  const a = document.createElement('canvas'); a.width = w; a.height = h;
  crispText(a.getContext('2d')!, text, 2, 15, font, color);
  const b = document.createElement('canvas'); b.width = w * k; b.height = h * k;
  const g = b.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(a, 0, 0, w * k, h * k);
  return b;
}

// ------------------------------------------------------------------ a form

export interface Mark { kind: 'tick' | 'loop' | 'cross'; id: string; t: number }
export interface Writing { id: string; text: string; shown: number; x: number; y: number; font: string; color: string; slant?: number }
export interface StampMark { text: string; sub?: string; x: number; y: number; ang: number; t: number; color: string }

export class Form {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  regions: Region[] = [];
  marks: Mark[] = [];
  writings = new Map<string, Writing>();
  stamps: StampMark[] = [];
  private base = document.createElement('canvas');
  /** a highlight ring for the region the pointer is over (tap targets glow faintly) */
  hover: string | null = null;
  /** a pulsing hint on a region (e.g. the office box when the page can be filed) */
  hint: string | null = null;
  hintT = 0;
  dirty = true;

  constructor(readonly no: number, readonly total: number) {
    this.canvas.width = this.base.width = PW;
    this.canvas.height = this.base.height = PH;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.anisotropy = 8;
    const g = this.base.getContext('2d')!;
    g.drawImage(blank(), 0, 0);
    // form number and page count
    crispText(g, `FORM HC-${String(no).padStart(2, '0')}`, PW - 16, 24, F.small(16), PRINT2, { align: 'right' });
    crispText(g, `page ${no} of ${total}`, PW - 16, 37, F.small(16), PRINT2, { align: 'right' });
  }
  get g() { return this.base.getContext('2d')!; }

  // ---- printing helpers (onto the base)
  /** The question: "Q3." in gold caps and the title at double size, wrapped. Returns the y below it. */
  title(q: string, text: string, y = 72): number {
    const g = this.g;
    crispText(g, q, 16, y + 13, F.caps(12), GOLD);
    const qw = measure(q, F.caps(12)) + 8;
    const lines = wrap(text, F.caps(12), (PW - 32 - qw) / 2);
    lines.forEach((l, i) => g.drawImage(scaled(l, F.caps(12), BLACK, 2), 16 + qw - 4, y - 14 + i * 22));
    return y + lines.length * 22 + 4;
  }
  text(s: string, x: number, y: number, o: { font?: string; color?: string; align?: CanvasTextAlign; max?: number; lh?: number } = {}): number {
    const font = o.font ?? F.body(), lines = o.max ? wrap(s, font, o.max) : [s];
    lines.forEach((l, i) => crispText(this.g, l, x, y + i * (o.lh ?? 13), font, o.color ?? BLACK, { align: o.align }));
    return y + lines.length * (o.lh ?? 13);
  }
  rule(x: number, y: number, w: number, color = PRINT2, dotted = false) {
    const g = this.g; g.fillStyle = color;
    for (let i = 0; i < w; i++) if (!dotted || i % 3 === 0) g.fillRect(x + i, y, 1, 1);
  }
  box(x: number, y: number, w: number, h: number, color = PRINT, fill?: string) {
    const g = this.g;
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
    g.fillStyle = color; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  }
  icon(name: string, x: number, y: number) {
    const im = iconImg(name);
    if (im?.complete && im.naturalWidth) { const s = iconSize(name); this.g.drawImage(im, x, y, s.w, s.h); }
  }
  /** a tick-box option row: box, pictogram, label, fine-print sub; registers a region */
  option(id: string, v: string, x: number, y: number, w: number, label: string, sub?: string, icon?: string) {
    this.box(x, y + 3, 12, 12, PRINT, '#fbf6ea');
    let tx = x + 18;
    if (icon) { this.icon(icon, tx, y - 4); tx += iconSize(icon).w + 4; }
    crispText(this.g, label, tx, y + 13, F.body(), BLACK);
    if (sub) crispText(this.g, sub, tx, y + 25, F.small(16), PRINT2);
    this.regions.push({ id, kind: 'tick', x: x - 4, y: y - 4, w, h: sub ? 34 : 24, v });
  }
  /** the office-use box where the stamp lands (also a tap target to file the page) */
  officeBox(label = 'FILE IT') {
    const x = PW - 132, y = PH - 98, w = 116, h = 58;
    this.box(x, y, w, h, PRINT2);
    this.box(x + 2, y + 2, w - 4, h - 4, PRINT2);
    crispText(this.g, 'FOR OFFICE USE', x + w / 2, y + 14, F.small(16), PRINT2, { align: 'center' });
    crispText(this.g, label, x + w / 2, y + 40, F.caps(12), PRINT2, { align: 'center' });
    this.regions.push({ id: 'file', kind: 'file', x, y, w, h });
    return { x: x + w / 2, y: y + h / 2 + 4 };
  }

  // ---- ink (redrawn on top every time)
  setTick(id: string, on: boolean, kind: 'tick' | 'loop' = 'tick') {
    const i = this.marks.findIndex((m) => m.id === id && m.kind === kind);
    if (on && i < 0) this.marks.push({ kind, id, t: 0 });
    if (!on && i >= 0) this.marks.splice(i, 1);
    this.dirty = true;
  }
  /** start or update a piece of handwriting in a field */
  write(id: string, text: string, x: number, y: number, o: { font?: string; color?: string; instant?: boolean; slant?: number } = {}) {
    const w = this.writings.get(id);
    const shown = o.instant ? text.length : w && text.startsWith(w.text.slice(0, Math.floor(w.shown))) ? Math.min(w.shown, text.length) : 0;
    this.writings.set(id, { id, text, shown, x, y, font: o.font ?? F.hand(16), color: o.color ?? INK, slant: o.slant });
    this.dirty = true;
  }
  stamp(text: string, x: number, y: number, o: { sub?: string; color?: string; ang?: number } = {}) {
    this.stamps.push({ text, sub: o.sub, x, y, ang: o.ang ?? -0.12, t: 0, color: o.color ?? RED });
    this.dirty = true;
  }
  region(id: string) { return this.regions.find((r) => r.id === id) ?? null; }
  hit(tx: number, ty: number): Region | null {
    for (let i = this.regions.length - 1; i >= 0; i--) { const r = this.regions[i]; if (tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h) return r; }
    return null;
  }
  /** where the pen is drawing right now (texels), or null when every mark is done */
  penAt(): { x: number; y: number } | null {
    for (const m of this.marks) if (m.t < 1) { const r = this.region(m.id); if (r) return m.kind === 'loop' ? loopPoint(r, m.t) : tickPoint(r, m.t); }
    for (const w of this.writings.values()) if (w.shown < w.text.length) return { x: w.x + measure(w.text.slice(0, Math.ceil(w.shown)), w.font) + 1, y: w.y - 4 };
    return null;
  }
  /** advance ink animations; returns true while something is still being drawn */
  step(dt: number): boolean {
    let busy = false;
    for (const m of this.marks) if (m.t < 1) { m.t = Math.min(1, m.t + dt / (m.kind === 'loop' ? 0.55 : 0.32)); busy = true; this.dirty = true; }
    for (const w of this.writings.values()) if (w.shown < w.text.length) { w.shown = Math.min(w.text.length, w.shown + dt * 14); busy = true; this.dirty = true; }
    for (const s of this.stamps) if (s.t < 1) { s.t = Math.min(1, s.t + dt / 0.12); this.dirty = true; }
    if (this.hint) { this.hintT += dt; this.dirty = true; }
    return busy;
  }
  /** recompose base + ink into the texture */
  render() {
    if (!this.dirty) return;
    this.dirty = false;
    const g = this.canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.base, 0, 0);
    // a faint pencil ring round the hovered / hinted target
    for (const id of [this.hover, this.hint]) {
      const r = id ? this.region(id) : null;
      if (!r) continue;
      const pulse = id === this.hint ? 0.5 + Math.sin(this.hintT * 5) * 0.5 : 1;
      g.fillStyle = `rgba(178,120,24,${(0.18 + pulse * 0.32).toFixed(2)})`;
      for (let x = r.x; x < r.x + r.w; x += 2) { g.fillRect(x, r.y, 1, 1); g.fillRect(x, r.y + r.h - 1, 1, 1); }
      for (let y = r.y; y < r.y + r.h; y += 2) { g.fillRect(r.x, y, 1, 1); g.fillRect(r.x + r.w - 1, y, 1, 1); }
    }
    for (const m of this.marks) { const r = this.region(m.id); if (r) (m.kind === 'loop' ? drawLoop : drawTick)(g, r, m.t); }
    for (const w of this.writings.values()) {
      const s = w.text.slice(0, Math.ceil(w.shown));
      if (!s) continue;
      if (w.slant) { g.save(); g.translate(w.x, w.y); g.transform(1, 0, -w.slant, 1, 0, 0); crispText(g, s, 0, 0, w.font, w.color); g.restore(); }
      else crispText(g, s, w.x, w.y, w.font, w.color);
    }
    for (const s of this.stamps) drawStamp(g, s);
    this.texture.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ ink drawing

function inkDot(g: CanvasRenderingContext2D, x: number, y: number, c = INK) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
const tickPath = (r: Region) => { const bx = r.x + 4, by = r.y + 7; return [[bx - 1, by + 5], [bx + 4, by + 10], [bx + 15, by - 4]] as [number, number][]; };
function along(pts: [number, number][], t: number) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = t * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i]) { const k = d / lens[i]; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k }; } d -= lens[i]; }
  return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
}
function tickPoint(r: Region, t: number) { return along(tickPath(r), t); }
function drawTick(g: CanvasRenderingContext2D, r: Region, t: number) {
  const pts = tickPath(r), n = Math.ceil(t * 40);
  for (let i = 0; i <= n; i++) { const p = along(pts, i / 40); inkDot(g, p.x, p.y); }
}
function loopPoint(r: Region, t: number) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, a = -Math.PI * 0.6 + t * Math.PI * 2.15;
  return { x: cx + Math.cos(a) * (r.w / 2 + 2 + Math.sin(a * 3) * 1.2), y: cy + Math.sin(a) * (r.h / 2 + 1) };
}
function drawLoop(g: CanvasRenderingContext2D, r: Region, t: number) {
  const n = Math.ceil(t * 120);
  for (let i = 0; i <= n; i++) { const p = loopPoint(r, i / 120); inkDot(g, p.x, p.y); }
}
/** a rubber stamp impression: a double-ruled box with the word, uneven ink, rotated; it fades in as it lands */
function drawStamp(g: CanvasRenderingContext2D, s: StampMark) {
  const w = 104, h = s.sub ? 40 : 30;
  const c = document.createElement('canvas'); c.width = w + 8; c.height = h + 8;
  const cg = c.getContext('2d')!;
  cg.fillStyle = s.color;
  const rect = (x: number, y: number, ww: number, hh: number) => { cg.fillRect(x, y, ww, 2); cg.fillRect(x, y + hh - 2, ww, 2); cg.fillRect(x, y, 2, hh); cg.fillRect(x + ww - 2, y, 2, hh); };
  rect(4, 4, w, h); rect(7, 7, w - 6, h - 6);
  const word = scaled(s.text, F.caps(12), s.color, 2);
  cg.drawImage(word, 4 + (w - (word.width - 16)) / 2 - 2, s.sub ? 1 : 3);
  if (s.sub) crispText(cg, s.sub, 4 + w / 2, h - 2, F.small(16), s.color, { align: 'center' });
  // uneven ink: knock out texels where the rubber didn't take the ink
  const img = cg.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width);
    if (d[i + 3] && (hash(x, y, 77) > 0.86 || vnoise(x * 0.25, y * 0.25, 9) > 0.78)) d[i + 3] = 0;
    else if (d[i + 3]) d[i + 3] = 215;
  }
  cg.putImageData(img, 0, 0);
  g.save();
  g.globalAlpha = Math.min(1, s.t * 1.2);
  g.translate(Math.round(s.x), Math.round(s.y));
  g.rotate(s.ang);
  g.imageSmoothingEnabled = false;
  g.drawImage(c, -Math.round(c.width / 2), -Math.round(c.height / 2));
  g.restore();
}
export const _paperColors = { C, lerpRamp, rgb };
