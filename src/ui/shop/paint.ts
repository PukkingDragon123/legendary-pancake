// Painted art for the boutique UI: the gacha banner backdrops (Frostlight: a snowy pine forest at
// night with a cabin's warm windows, garlands and baubles; Starfall: a violet sky of falling stars),
// big 3D portraits of the featured owls, finish swatches, and prize thumbnails with a fallback.
import * as THREE from 'three';
import { FINISH } from '../../assets/registry.ts';
import { rng, strSeed } from '../../gfx/noise.ts';
import { buildOwl, type OwlLook } from '../../owl/model.ts';
import { PIECE } from '../../owl/outfits.ts';
import { SPECIAL_SKIN } from '../../owl/skins.ts';
import { SPECIES_BY_ID } from '../../owl/species.ts';
import type { RewardKind, Series } from '../../game/series.ts';
import { ITEMS } from '../../assets/registry.ts';
import { itemIcon, owlFull, pieceIcon } from '../portraits.ts';

// ------------------------------------------------------------------ a pixel canvas

type RGB = [number, number, number];
const hx = (s: string): RGB => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

class Pix {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  set(x: number, y: number, c: RGB | string, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const k = typeof c === 'string' ? hx(c) : c, i = (y * this.w + x) * 4;
    if (a >= 1) { this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = 255; return; }
    for (let j = 0; j < 3; j++) this.d[i + j] = this.d[i + j] * (1 - a) + k[j] * a;
    this.d[i + 3] = 255;
  }
  add(x: number, y: number, c: RGB, a: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    for (let j = 0; j < 3; j++) this.d[i + j] = Math.min(255, this.d[i + j] + c[j] * a);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB | string, a = 1) { for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) this.set(i, j, c, a); }
  /** vertical gradient through colour stops with ordered dithering between bands */
  grad(y0: number, y1: number, stops: string[]) {
    const cs = stops.map(hx), n = cs.length - 1;
    for (let y = Math.floor(y0); y < y1; y++) for (let x = 0; x < this.w; x++) {
      const t = Math.max(0, Math.min(0.9999, (y - y0) / (y1 - y0))) * n, i = Math.floor(t), f = t - i;
      const q = Math.floor(f * 4) / 4, r = f * 4 - Math.floor(f * 4);
      const pick = r > BAYER[(y % 4) * 4 + (x % 4)] ? q + 0.25 : q;
      const a = cs[i], b = cs[Math.min(n, i + 1)];
      this.set(x, y, [a[0] + (b[0] - a[0]) * pick, a[1] + (b[1] - a[1]) * pick, a[2] + (b[2] - a[2]) * pick]);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB | string, a = 1) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c, a); }
  glow(cx: number, cy: number, r: number, c: string, a = 0.5) {
    const k = hx(c);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d < 1) { const v = (1 - d) * (1 - d) * a; const q = Math.floor(v * 6) / 6; this.add(x, y, k, q + (v * 6 - Math.floor(v * 6) > BAYER[(y % 4) * 4 + (x % 4)] ? 1 / 6 : 0)); }
    }
  }
  /** a pine tree: stacked triangles with snow on each tier; baubles optional */
  pine(cx: number, base: number, h: number, col: string, snow: string, o: { baubles?: string[]; seed?: number; star?: boolean } = {}) {
    const tiers = Math.max(2, Math.round(h / 7)), r = rng(o.seed ?? 1);
    this.rect(cx - Math.max(1, h / 18), base - h * 0.12, Math.max(2, h / 9), h * 0.12 + 1, '#3a2418');
    for (let k = 0; k < tiers; k++) {
      const top = base - h + (k * h * 0.8) / tiers, bot = top + (h * 1.05) / tiers + h * 0.12, half = ((k + 1.4) / (tiers + 0.4)) * h * 0.34;
      for (let y = Math.floor(top); y < bot; y++) {
        const w = ((y - top) / (bot - top)) * half;
        for (let x = Math.floor(cx - w); x <= cx + w; x++) {
          const edge = y >= bot - 1.5 && r() < 0.8;
          this.set(x, y, edge ? snow : (x + y) % 5 === 0 ? '#0f2436' : col);
        }
        if (y < top + 2) this.set(cx, y, snow);
      }
      if (o.baubles) for (let i = 0; i < 2 + k; i++) { const bx = cx + (r() - 0.5) * half * 1.6, by = bot - 2 - r() * 3; const c = o.baubles[Math.floor(r() * o.baubles.length)]; this.set(bx, by, c); this.set(bx + 1, by, c); this.set(bx, by + 1, c); this.set(bx + 1, by + 1, '#ffffff', 0.4); }
    }
    if (o.star) { const y = base - h - 2; this.set(cx, y - 1, '#fff6c0'); this.set(cx - 1, y, '#ffd84a'); this.set(cx, y, '#fffbe0'); this.set(cx + 1, y, '#ffd84a'); this.set(cx, y + 1, '#ffd84a'); this.glow(cx, y, 7, '#ffd84a', 0.35); }
  }
  url(): string {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c.toDataURL('image/png');
  }
}

// ------------------------------------------------------------------ banner backdrops

function frostlight(w: number, h: number): Pix {
  const p = new Pix(w, h), r = rng(strSeed('frostlight' + w + 'x' + h));
  const hor = h * 0.62;
  p.grad(0, hor + 4, ['#070d2a', '#0f1d4e', '#1d3a7c', '#3a62a8', '#7aa0d4']);
  for (let i = 0; i < w * h * 0.012; i++) { const x = r() * w, y = r() * hor * 0.85; p.set(x, y, r() < 0.2 ? '#fff6d8' : '#cfe0ff', 0.5 + r() * 0.5); }
  for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * hor * 0.5; p.set(x, y, '#ffffff'); p.set(x - 1, y, '#9fc0ff'); p.set(x + 1, y, '#9fc0ff'); p.set(x, y - 1, '#9fc0ff'); p.set(x, y + 1, '#9fc0ff'); }
  // a big pale moon
  const mx = w * 0.82, my = h * 0.16, mr = Math.max(5, h * 0.07);
  p.glow(mx, my, mr * 3.2, '#9fc0ff', 0.4);
  p.circle(mx, my, mr, '#f6f4e6'); p.circle(mx + mr * 0.3, my - mr * 0.2, mr * 0.28, '#d8dce6'); p.circle(mx - mr * 0.35, my + mr * 0.35, mr * 0.18, '#dfe2ea');
  // mountains with snowcaps
  for (let x = 0; x < w; x++) {
    const m = hor - h * 0.2 - Math.abs(((x * 0.9) % (w * 0.42)) - w * 0.21) * 0.55 - Math.sin(x * 0.05) * h * 0.03;
    for (let y = Math.floor(m); y < hor + 2; y++) p.set(x, y, y < m + h * 0.035 ? '#cfe0f6' : (x + y) % 3 ? '#34518c' : '#2c4680');
  }
  // far forest
  for (let x = -4; x < w + 4; x += 4 + r() * 3) p.pine(x, hor + 3, h * (0.1 + r() * 0.06), '#173356', '#a9c4e6', { seed: x + 1 });
  // snowy ground with blue shadows
  for (let y = Math.floor(hor); y < h; y++) for (let x = 0; x < w; x++) {
    const hill = hor + Math.sin(x * 0.045) * h * 0.025 + Math.sin(x * 0.13) * h * 0.01;
    if (y >= hill) p.set(x, y, (x * 3 + y * 7) % 23 === 0 ? '#ffffff' : y - hill < 2 ? '#f4f9ff' : (x + y * 2) % 9 === 0 ? '#c8dcf2' : '#e2eefa');
  }
  // the cabin, windows aglow
  const cx = w * 0.64, cb = hor + h * 0.05, cw = Math.max(18, w * 0.13), ch = cw * 0.55;
  p.glow(cx, cb - ch * 0.4, cw * 1.4, '#ffb04a', 0.35);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) p.set(cx - cw / 2 + x, cb - ch + y, y % 3 === 0 ? '#3e2216' : x % 7 === 0 ? '#4c2c1c' : '#6a3a24');
  for (let y = 0; y < ch * 0.8; y++) { const half = cw * 0.62 * (y / (ch * 0.8)); for (let x = -half; x <= half; x++) p.set(cx + x, cb - ch - ch * 0.8 + y, y > ch * 0.8 - 3 || r() < 0.08 ? '#ffffff' : y < 2 ? '#f6fbff' : '#e6f0fb'); }
  p.rect(cx + cw * 0.22, cb - ch - ch * 0.7, cw * 0.1, ch * 0.5, '#5a3a2c'); p.rect(cx + cw * 0.2, cb - ch - ch * 0.75, cw * 0.14, 2, '#ffffff');
  for (const wx of [-0.3, 0.18]) { const x0 = cx + wx * cw, y0 = cb - ch * 0.75; p.rect(x0, y0, cw * 0.16, ch * 0.38, '#ffcf6a'); p.rect(x0 + cw * 0.075, y0, 1, ch * 0.38, '#8a4a20'); p.rect(x0, y0 + ch * 0.18, cw * 0.16, 1, '#8a4a20'); p.glow(x0 + cw * 0.08, y0 + ch * 0.2, cw * 0.35, '#ffcf6a', 0.4); }
  p.rect(cx - cw * 0.06, cb - ch * 0.62, cw * 0.12, ch * 0.62, '#3a2014');
  // fairy lights along the eaves
  for (let i = 0; i <= 12; i++) { const t = i / 12, x = cx - cw * 0.62 + t * cw * 1.24, y = cb - ch + 1 + Math.sin(t * Math.PI * 3) * 1.2; const c = ['#ff5a5a', '#ffd84a', '#5ae08a', '#7ac8ff'][i % 4]; p.set(x, y, c); p.glow(x, y, 3, c, 0.25); }
  // smoke from the chimney
  for (let i = 0; i < 6; i++) p.circle(cx + cw * 0.27 + i * 1.6 + Math.sin(i) * 2, cb - ch - ch * 0.8 - i * 3.4, 1.4 + i * 0.4, '#9fb4d4', 0.35);
  // near christmas trees with baubles and a star on the tallest
  p.pine(w * 0.08, h + 2, h * 0.55, '#16402e', '#ffffff', { baubles: ['#e8343f', '#ffd84a', '#7ac8ff'], seed: 3, star: true });
  p.pine(w * 0.2, h + 4, h * 0.38, '#1a4a34', '#ffffff', { baubles: ['#e8343f', '#ffd84a'], seed: 4 });
  p.pine(w * 0.93, h + 2, h * 0.48, '#16402e', '#ffffff', { baubles: ['#e8343f', '#ffd84a', '#c8a0ff'], seed: 5, star: true });
  p.pine(w * 0.46, hor + h * 0.07, h * 0.16, '#1d4a36', '#ffffff', { baubles: ['#e8343f'], seed: 6 });
  // garland across the top with ribbons and baubles
  for (let x = 0; x < w; x++) {
    const sag = Math.abs(Math.sin((x / w) * Math.PI * 3)) * h * 0.06;
    for (let k = 0; k < 4; k++) p.set(x, sag + k, (x + k) % 3 === 0 ? '#0f3a26' : k === 0 ? '#3f8f5f' : '#1f5a3c');
    if (x % 11 === 0) { const c = ['#e8343f', '#ffd84a', '#7ac8ff', '#f2f2f2'][(x / 11) % 4]; p.circle(x, sag + 6, 2.2, c); p.set(x - 1, sag + 5, '#ffffff', 0.7); }
  }
  for (const sx of [0, w]) { const dir = sx ? -1 : 1; for (let i = 0; i < h * 0.3; i++) { p.set(sx + dir * (i * 0.55), i * 1.1 + 2, '#d9343f'); p.set(sx + dir * (i * 0.55 + 1), i * 1.1 + 2, '#ff6a6a'); p.set(sx + dir * (i * 0.55 + 2), i * 1.1 + 2, '#a8202c'); } }
  // candy cane in the corner
  const ccx = w * 0.96, ccy = h * 0.9;
  for (let i = 0; i < h * 0.22; i++) { p.set(ccx, ccy - i, Math.floor(i / 2) % 2 ? '#ffffff' : '#e8343f'); p.set(ccx + 1, ccy - i, Math.floor(i / 2) % 2 ? '#e8e8e8' : '#b82030'); }
  // drifting snow baked in
  for (let i = 0; i < w * h * 0.006; i++) p.set(r() * w, r() * h, '#ffffff', 0.5 + r() * 0.5);
  return p;
}

function starfall(w: number, h: number): Pix {
  const p = new Pix(w, h), r = rng(strSeed('starfall' + w + 'x' + h));
  p.grad(0, h, ['#0b0626', '#1c1150', '#3a2386', '#7446b4', '#c68ad8', '#f3c6e6']);
  // a soft nebula
  for (let i = 0; i < 5; i++) p.glow(w * (0.2 + r() * 0.6), h * (0.2 + r() * 0.35), h * (0.18 + r() * 0.12), ['#8a5ae0', '#e070c0', '#5a8ae0'][i % 3], 0.3);
  for (let i = 0; i < w * h * 0.02; i++) { const x = r() * w, y = r() * h * 0.8; p.set(x, y, r() < 0.3 ? '#ffe9a8' : '#f2eaff', 0.4 + r() * 0.6); }
  for (let i = 0; i < 10; i++) { const x = r() * w, y = r() * h * 0.6, c = '#fff6c8'; p.set(x, y, '#ffffff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, c, 0.8); p.glow(x, y, 4, '#ffe9a8', 0.25); }
  // a big crescent moon
  const mx = w * 0.18, my = h * 0.22, mr = Math.max(6, h * 0.1);
  p.glow(mx, my, mr * 3, '#ffe9a8', 0.4);
  p.circle(mx, my, mr, '#fff4c8');
  p.circle(mx + mr * 0.45, my - mr * 0.25, mr * 0.9, '#2a1a66');
  p.glow(mx + mr * 0.45, my - mr * 0.25, mr * 0.9, '#1c1150', 0);
  // falling stars
  for (let i = 0; i < 6; i++) {
    const x0 = w * (0.3 + r() * 0.75), y0 = h * (0.02 + r() * 0.4), len = h * (0.12 + r() * 0.15);
    for (let k = 0; k < len; k++) { const a = 1 - k / len; p.set(x0 + k, y0 - k * 0.55, '#ffe9a8', a * 0.9); if (k < len * 0.4) p.set(x0 + k, y0 - k * 0.55 + 1, '#ffffff', a * 0.5); }
    p.glow(x0, y0, 5, '#fff6c8', 0.6); p.set(x0, y0, '#ffffff');
  }
  // cloud banks
  for (let layer = 0; layer < 3; layer++) {
    const base = h * (0.72 + layer * 0.1), col = ['#9a7ad0', '#c4a2e8', '#efd8fb'][layer], sh = ['#7a5ab4', '#a284d0', '#d4b8ee'][layer];
    for (let x = -10; x < w + 10; x += 7 + r() * 6) { const rr = h * (0.06 + r() * 0.05) * (1 + layer * 0.3); p.circle(x, base, rr, sh); p.circle(x - 1, base - 1, rr * 0.92, col); }
    p.rect(0, base, w, h - base, col);
  }
  // a little observatory on a cloud
  const ox = w * 0.78, oy = h * 0.74, ow = Math.max(10, w * 0.07);
  p.rect(ox - ow / 2, oy - ow * 0.9, ow, ow * 0.9, '#3a2a6a'); p.circle(ox, oy - ow * 0.9, ow / 2, '#4a3a8a');
  p.rect(ox + ow * 0.05, oy - ow * 1.3, ow * 0.5, 2, '#c8b0ff'); p.rect(ox - ow * 0.15, oy - ow * 0.55, ow * 0.3, ow * 0.3, '#ffe08a'); p.glow(ox, oy - ow * 0.4, ow, '#ffe08a', 0.3);
  // strings of hanging stars along the top
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (w / 9) + (r() - 0.5) * 6, len = h * (0.06 + r() * 0.16);
    for (let y = 0; y < len; y++) p.set(x, y, '#d8c8ff', 0.5);
    const c = i % 2 ? '#ffd84a' : '#fff1b0', sy = len + 2;
    p.set(x, sy - 2, c); p.rect(x - 2, sy - 1, 5, 1, c); p.rect(x - 1, sy, 3, 1, c); p.set(x - 1, sy + 1, c); p.set(x + 1, sy + 1, c); p.set(x, sy - 1, '#ffffff');
    p.glow(x, sy, 5, '#ffe08a', 0.3);
  }
  return p;
}

const bannerCache = new Map<string, string>();
/** Painted backdrop for a series banner at w x h art pixels (shown upscaled, pixelated). */
export function bannerArt(s: Series, w: number, h: number): string {
  const key = `${s.id}:${w}x${h}`;
  let u = bannerCache.get(key);
  if (!u) { u = (s.motif === 'stars' ? starfall(w, h) : frostlight(w, h)).url(); bannerCache.set(key, u); }
  return u;
}

// ------------------------------------------------------------------ big 3D portraits

let R: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.OrthographicCamera;
const bigCache = new Map<string, string>();
/** A large render of an owl look (the featured 5-star), lit like a shop window. */
export function bigOwl(look: OwlLook, size = 384): string {
  const key = JSON.stringify(look) + size;
  const hit = bigCache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    if (!R) {
      const c = document.createElement('canvas');
      R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
      R.setClearColor(0, 0); R.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a6a9a, 1.5));
      const k = new THREE.DirectionalLight(0xfff0d8, 2.1); k.position.set(-3, 6, 7); scene.add(k);
      const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6); rim.position.set(5, 3, -4); scene.add(rim);
      cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    }
    R.setSize(size, size, false);
    const o = buildOwl(look);
    o.eyes.forEach((e) => e.draw({ lid: 0, low: 0.22, tilt: 0, lx: 0.15, ly: 0, pupil: 5.6, mode: 'normal', tear: false }));
    o.rig.bones.jaw.visible = false;
    o.rig.bones.head.rotation.set(0, 0.12, 0.06);
    const root = o.rig.root;
    scene.add(root);
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3());
    const yaw = 0.42, pitch = 0.12, dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    cam.position.copy(c).addScaledVector(dir, 50); cam.lookAt(c); cam.updateMatrixWorld();
    const half = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) * 0.56;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
    R.render(scene, cam);
    url = R.domElement.toDataURL('image/png');
    scene.remove(root); o.dispose();
  } catch (e) { console.warn('big owl render failed', e); }
  bigCache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ swatches and thumbnails

const swatches = new Map<string, string>();
/** A wallpaper / flooring sample tile. */
export function finishSwatch(id: string, n = 48): string {
  const f = FINISH[id];
  if (!f) return '';
  let u = swatches.get(id);
  if (u) return u;
  const p = new Pix(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let c = 0x888888; try { c = f.paint(x, n - 1 - y); } catch { /* */ } p.set(x, y, [(c >> 16) & 255, (c >> 8) & 255, c & 255]); }
  u = p.url();
  swatches.set(id, u);
  return u;
}

/** Thumbnail for anything the boutique sells or a wish gives; '' when its model has not arrived. */
export function prizeArt(kind: RewardKind | 'species', id: string, look: OwlLook): string {
  if (kind === 'item') return ITEMS[id] ? itemIcon(id) : '';
  if (kind === 'piece') return PIECE[id] ? pieceIcon(id, PIECE[id].slot, { ...look, outfit: {} }) : '';
  if (kind === 'skin') return SPECIAL_SKIN[id] ? owlFull({ skin: id as OwlLook['skin'], species: 'snowy', palette: 'snowy', outfit: {} }) : '';
  if (kind === 'species') return SPECIES_BY_ID[id] ? owlFull({ skin: 'owl', species: id, palette: id, outfit: {} }) : '';
  if (kind === 'finish') return finishSwatch(id);
  return '';
}
/** The look used to show a featured 5-star skin big on the banner. */
export const skinLook = (id: string): OwlLook => ({ skin: id as OwlLook['skin'], species: 'snowy', palette: 'snowy', outfit: {} });
