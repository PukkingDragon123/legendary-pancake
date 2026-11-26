// [clock14] The office's library: real books on the bookcase shelves. Every book is modelled: two cover boards with
// squares (they stand proud of the page block), a page block with fine page edges (some gilt on top), a rounded
// spine and, on leather books, raised bands. 84 hand-made spine designs are painted into one atlas at a uniform
// texel density (calf with raised bands, tooled panels and a contrasting title label; morocco with gilt fillets;
// cloth with the title running down the spine; half-leather ledgers; limp vellum) with a companion roughness and
// metalness map, so the gilt tooling and titles shine like metal while the leather stays satin and the cloth matte.
// Sets of matching volumes stand together, heights, depths and thicknesses vary, a few lean on their neighbours,
// some lie flat in stacks, ribbons hang over the shelf edge, bookends and small objects sit between them, and every
// copy gets its own tint, rubbing and sun fade so the shelves never look copy-pasted.
import * as THREE from 'three';
import type { OfficeMats } from './mats.ts';
import { at, cyl, lathe } from './kit.ts';
import { hash, vnoise } from './tex.ts';

type C3 = [number, number, number];
const hx = (h: number): C3 => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ------------------------------------------------------------------ the designs

type Style = 'calf' | 'morocco' | 'cloth' | 'ledger' | 'vellum';
interface Design {
  style: Style; w: number; h: number; d: number;
  col: C3; label: C3; gilt: boolean; bands: number;
  title: string; sub: string; vol: string;
  /** atlas cell and the painted rectangle in it (px) */
  cell: number; pw: number; ph: number;
  ribbon: C3 | null; giltTop: boolean;
}

const LEATHER = [0x5a1c14, 0x6b2418, 0x4a1a12, 0x7a3a1c, 0x8a5430, 0x5c3a22, 0x3a2418, 0x1f3424, 0x223a2c, 0x1c2840, 0x2a1e2e, 0x1a1512, 0x6a4a2a, 0x4e1420].map(hx);
const CLOTH = [0x1f4a4c, 0x8a6a22, 0x7a3418, 0x4a4e2a, 0x3a4c62, 0x5a2232, 0x2c3a5a, 0x6a6a5a, 0x264a32, 0x8a4a2a, 0x40304a, 0x9a8a62, 0x2a2a2e, 0xa04a32, 0x3e5a4a].map(hx);
const LABEL = [0x8a1c16, 0x1a1512, 0x1f3a26, 0x5a1420, 0x1c2a44].map(hx);
const RIB = [0x9a1c1c, 0x1f5a32, 0xc8a040, 0x2a3a6a, 0x6a1a3a].map(hx);
const WORDS = ['SLEEP', 'DREAMS', 'OWLS', 'NIGHT', 'MOONS', 'STARS', 'TIDES', 'HOURS', 'ANNALS', 'ATLAS', 'LAWS', 'POEMS', 'ESSAYS', 'WOODS', 'CLOCKS', 'ALMANAC', 'MINUTES', 'ACCOUNTS', 'FOLKLORE', 'BOTANY', 'FEATHERS', 'NOCTURNS', 'LETTERS', 'SERMONS', 'VOYAGES', 'ACORNS', 'MOTHS', 'RECORDS'];
const LONG = ['A History of Sleep', 'The Owl’s Almanac', 'On Dreaming', 'Night Birds of the Wood', 'Moon & Tide Tables', 'Quiet Hours', 'The Hollow Oak', 'Rest: A Treatise', 'Collected Lullabies', 'Notes on Nocturnes', 'Field Guide to Moths', 'Starlight Navigation', 'The Art of Napping', 'Lamplight Essays', 'Feathers & Flight', 'The Long Night', 'Woodland Ledgers', 'Of Clocks & Bells', 'Small Hours', 'The Dormouse Papers', 'Twilight Botany', 'A Calendar of Moons'];
const WHO = ['H. HOOT', 'E. TAWNY', 'M. BARN', 'W. OWLETT', 'P. NIGHTJAR', 'R. BRAMBLE', 'J. MOSS', 'A. WREN', 'C. FERN'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export const BOOK_ATLAS = { W: 2048, H: 1024, CW: 48, CH: 512, cols: 42, rows: 2 };

function designs(): Design[] {
  const r = rng(907), pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: Design[] = [];
  const add = (d: Omit<Design, 'cell' | 'pw' | 'ph'>) => {
    const { CW, CH } = BOOK_ATLAS, ppm = Math.min((CW - 2) / d.w, (CH - 2) / d.h);
    out.push({ ...d, cell: out.length, pw: Math.max(4, Math.round(d.w * ppm)), ph: Math.round(d.h * ppm) });
  };
  // two sets of matching volumes
  { const col = hx(0x5c2216), label = hx(0x1a1512);
    for (let i = 0; i < 6; i++) add({ style: 'calf', w: 0.052, h: 0.3, d: 0.22, col, label, gilt: true, bands: 5, title: 'SLEEP', sub: 'ENCYCL.', vol: ROMAN[i], ribbon: i === 2 ? RIB[0] : null, giltTop: true }); }
  { const col = hx(0x1f3a2a);
    for (let i = 0; i < 5; i++) add({ style: 'cloth', w: 0.038, h: 0.245, d: 0.17, col, label: col, gilt: true, bands: 0, title: 'Laws of the Wood', sub: 'VOL.', vol: String(i + 1), ribbon: null, giltTop: false }); }
  { const col = hx(0x2a1e18), label = hx(0x8a1c16);
    for (let i = 0; i < 4; i++) add({ style: 'ledger', w: 0.06, h: 0.36, d: 0.25, col, label, gilt: true, bands: 0, title: 'LEDGER', sub: '', vol: String(1896 + i), ribbon: null, giltTop: false }); }
  const n = BOOK_ATLAS.cols * BOOK_ATLAS.rows;
  while (out.length < n) {
    const k = r();
    const style: Style = k < 0.3 ? 'calf' : k < 0.48 ? 'morocco' : k < 0.88 ? 'cloth' : k < 0.95 ? 'ledger' : 'vellum';
    const leather = style === 'calf' || style === 'morocco' || style === 'ledger';
    const h = style === 'ledger' ? 0.3 + r() * 0.07 : 0.18 + r() * r() * 0.17 + r() * 0.03;
    const w = style === 'vellum' ? 0.018 + r() * 0.02 : style === 'cloth' ? 0.018 + r() * 0.035 : 0.026 + r() * 0.04;
    add({
      style, w, h, d: Math.min(0.27, h * (0.62 + r() * 0.14)),
      col: style === 'vellum' ? hx(0xd8c8a0) : leather ? pick(LEATHER) : pick(CLOTH),
      label: pick(LABEL), gilt: style !== 'vellum' && r() < 0.92, bands: style === 'calf' ? 4 + Math.floor(r() * 2) : 0,
      title: style === 'cloth' || style === 'vellum' ? pick(LONG) : pick(WORDS), sub: pick(WHO), vol: r() < 0.25 ? pick(ROMAN.slice(0, 4)) : '',
      ribbon: r() < 0.12 ? pick(RIB) : null, giltTop: leather && r() < 0.4,
    });
  }
  return out;
}

// ------------------------------------------------------------------ the atlas painter

/** The spine atlas (colour) and its companion (G roughness, B metalness), and where each design sits. */
export function paintSpines(): { map: HTMLCanvasElement; mr: HTMLCanvasElement; list: Design[] } {
  const { W, H, CW, CH, cols } = BOOK_ATLAS, list = designs();
  const map = document.createElement('canvas'), mr = document.createElement('canvas');
  map.width = mr.width = W; map.height = mr.height = H;
  const g = map.getContext('2d', { willReadFrequently: true })!, q = mr.getContext('2d')!;
  q.fillStyle = 'rgb(0,200,0)'; q.fillRect(0, 0, W, H);
  const im = g.createImageData(W, H), D = im.data;
  // the material: grain, creases, rubbing, sun fade at the head, painted per pixel
  for (const b of list) {
    const ox = (b.cell % cols) * CW + 1, oy = Math.floor(b.cell / cols) * CH + 1, s = b.cell * 13 + 5;
    const leather = b.style === 'calf' || b.style === 'morocco' || b.style === 'ledger';
    const creases = Array.from({ length: 3 + Math.floor(hash(s, 1, 4) * 6) }, (_, i) => hash(s, i, 7) * b.ph);
    for (let y = 0; y < b.ph; y++) for (let x = 0; x < b.pw; x++) {
      const u = x / b.pw, v = y / b.ph;
      let k = 1, c = b.col;
      if (b.style === 'ledger' && (v < 0.17 || v > 0.83)) c = [b.col[0] * 0.8, b.col[1] * 0.8, b.col[2] * 0.8];
      else if (b.style === 'ledger') { // marbled paper sides showing on the spine's middle? cloth: a dark buckram
        c = [72, 40, 30];
        k *= 0.9 + (((x + y) & 1) ? 0.05 : -0.05);
      }
      if (leather) {
        k *= 0.86 + vnoise(x * 0.9, y * 0.9, s) * 0.18 + (vnoise(x * 0.18, y * 0.05, s + 1) - 0.5) * 0.22;
        for (const cy of creases) k *= 1 - 0.16 * sm(1.4, 0, Math.abs(y - cy)) * (0.6 + 0.4 * Math.sin(u * 9 + cy));
      } else if (b.style === 'vellum') {
        k *= 0.95 + (vnoise(x * 0.12, y * 0.12, s) - 0.5) * 0.16 + (vnoise(x * 0.8, y * 0.8, s) - 0.5) * 0.04;
      } else {
        // book cloth: a fine weave and a little fading
        k *= 0.92 + (((x & 1) ^ (y & 1)) ? 0.06 : -0.03) + (vnoise(x * 0.5, y * 0.05, s) - 0.5) * 0.08 + (vnoise(x * 0.06, y * 0.06, s + 3) - 0.5) * 0.12;
      }
      // rubbed hinges and head and tail (lighter, drier), sun fade from the head down a little
      const edge = Math.min(u, 1 - u) * b.pw, end = Math.min(y, b.ph - 1 - y);
      const rub = sm(3, 0, edge) * 0.25 + sm(4, 0, end) * 0.35;
      const fade = sm(b.ph * 0.25, 0, y) * 0.12 * hash(s, 9, 2);
      const o = ((oy + y) * W + ox + x) * 4;
      for (let j = 0; j < 3; j++) {
        let val = c[j] * k;
        val += (200 - val) * rub * 0.35 + (180 - val) * fade;
        D[o + j] = clamp(val, 0, 255);
      }
      D[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  // the tooling and the lettering, painted twice: colour on the map, shine on the companion
  const gold = (_c: CanvasRenderingContext2D, isMR: boolean) => (isMR ? 'rgb(0,90,255)' : '#d9ae52');
  const both = (fn: (c: CanvasRenderingContext2D, isMR: boolean) => void) => { fn(g, false); fn(q, true); };
  for (const b of list) {
    const ox = (b.cell % cols) * CW + 1, oy = Math.floor(b.cell / cols) * CH + 1, pw = b.pw, ph = b.ph, cx = ox + pw / 2;
    const mm = ph / b.h / 1000; // px per mm
    // the base's own shine (leather satin, cloth matte, vellum soft)
    q.fillStyle = b.style === 'cloth' ? 'rgb(0,225,0)' : b.style === 'vellum' ? 'rgb(0,175,0)' : 'rgb(0,140,0)';
    q.fillRect(ox, oy, pw, ph);
    const line = (y: number, t = 1, inset = 1.5) => both((c, m) => { c.fillStyle = gold(c, m); c.fillRect(ox + inset, oy + y, pw - inset * 2, t); });
    const fleuron = (y: number, r: number) => both((c, m) => {
      c.fillStyle = gold(c, m);
      c.beginPath(); c.moveTo(cx, oy + y - r); c.lineTo(cx + r * 0.6, oy + y); c.lineTo(cx, oy + y + r); c.lineTo(cx - r * 0.6, oy + y); c.closePath(); c.fill();
      for (const dx of [-1, 1]) { c.beginPath(); c.arc(cx + dx * r * 1.05, oy + y, Math.max(0.6, r * 0.22), 0, Math.PI * 2); c.fill(); }
    });
    const text = (str: string, y: number, size: number, col: string | null, o: { vertical?: boolean; maxW?: number; italic?: boolean } = {}) => both((c, m) => {
      c.save();
      c.font = `${o.italic ? 'italic ' : ''}bold ${size.toFixed(1)}px Georgia, 'Times New Roman', serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = m ? (col ? 'rgb(0,200,0)' : 'rgb(0,90,255)') : (col ?? gold(c, m));
      if (o.vertical) { c.translate(cx, oy + y); c.rotate(Math.PI / 2); c.fillText(str, 0, 0, o.maxW); }
      else c.fillText(str, cx, oy + y, o.maxW ?? pw - 3);
      c.restore();
    });
    const rect = (x: number, y: number, w: number, h: number, col: C3) => {
      g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.fillRect(ox + x, oy + y, w, h);
      q.fillStyle = 'rgb(0,120,0)'; q.fillRect(ox + x, oy + y, w, h);
    };
    if (b.style === 'calf') {
      // raised bands with gilt fillets either side, tooled panels, a title label and a volume label
      const n = b.bands, top = ph * 0.1, bot = ph * 0.9, step = (bot - top) / n;
      for (let i = 0; i <= n; i++) {
        const y = top + i * step;
        both((c, m) => { if (!m) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(ox, oy + y - 2.5 * mm * 0.6, pw, 1); } });
        if (b.gilt) { line(y - 4 * mm, Math.max(1, 0.5 * mm)); line(y + 4 * mm, Math.max(1, 0.5 * mm)); }
      }
      for (let i = 0; i < n; i++) {
        const y0 = top + i * step, y1 = y0 + step, ym = (y0 + y1) / 2;
        if (i === 1) {
          rect(2, y0 + 6 * mm, pw - 4, step - 12 * mm, b.label);
          if (b.gilt) { line(y0 + 7 * mm, 1, 3); line(y1 - 7 * mm - 1, 1, 3); }
          text(b.title, ym - (b.sub ? 3.2 * mm : 0), Math.min(6.5 * mm, pw * 0.3), null);
          if (b.sub) text(b.sub, ym + 4.5 * mm, Math.min(3.6 * mm, pw * 0.2), null);
        } else if (i === 2 && b.vol) {
          if (b.style === 'calf' && b.label[0] !== b.col[0]) rect(4, ym - 7 * mm, pw - 8, 14 * mm, b.label);
          text(b.vol, ym, Math.min(7 * mm, pw * 0.34), null);
        } else if (b.gilt) fleuron(ym, Math.min(step * 0.22, pw * 0.2));
      }
    } else if (b.style === 'morocco') {
      // gilt fillets at head and tail, false bands, the title at the top
      if (b.gilt) {
        for (const y of [ph * 0.05, ph * 0.065, ph * 0.935, ph * 0.95]) line(y, 1);
        for (const y of [ph * 0.32, ph * 0.335, ph * 0.66, ph * 0.675]) line(y, 1);
        fleuron(ph * 0.5, Math.min(ph * 0.05, pw * 0.22));
        fleuron(ph * 0.82, Math.min(ph * 0.04, pw * 0.18));
      }
      text(b.title, ph * 0.18, Math.min(6 * mm, pw * 0.28), b.gilt ? null : '#e8dcc0');
      if (b.vol) text(b.vol, ph * 0.25, Math.min(5 * mm, pw * 0.25), null);
    } else if (b.style === 'cloth') {
      // the title down the spine, the author, rules at head and tail, the publisher's device at the foot
      const ink = b.gilt ? null : (b.col[0] + b.col[1] + b.col[2] > 330 ? '#2a1a12' : '#e8dcc0');
      for (const y of [ph * 0.035, ph * 0.045, ph * 0.955, ph * 0.965]) both((c, m) => { c.fillStyle = m ? (ink ? 'rgb(0,200,0)' : 'rgb(0,90,255)') : (ink ?? gold(c, m)); c.fillRect(ox + 1, oy + y, pw - 2, 1); });
      const size = Math.min(pw * 0.42, 6.5 * mm);
      if (b.vol && b.sub === 'VOL.') {
        text(b.title, ph * 0.42, size, ink, { vertical: true, maxW: ph * 0.6 });
        text(b.vol, ph * 0.86, Math.min(pw * 0.5, 7 * mm), ink);
      } else {
        text(b.title, ph * 0.38, size, ink, { vertical: true, maxW: ph * 0.6 });
        text(b.sub, ph * 0.8, size * 0.72, ink, { vertical: true, maxW: ph * 0.2, italic: true });
      }
      both((c, m) => { c.fillStyle = m ? (ink ? 'rgb(0,200,0)' : 'rgb(0,90,255)') : (ink ?? gold(c, m)); c.beginPath(); c.arc(cx, oy + ph * 0.92, Math.min(pw * 0.14, 2.4 * mm), 0, Math.PI * 2); c.fill(); });
    } else if (b.style === 'ledger') {
      // half leather: the leather ends with gilt rules, a red label, the year
      if (b.gilt) for (const y of [ph * 0.17, ph * 0.83]) { line(y - 2, 1); line(y + 1, 1); }
      rect(3, ph * 0.24, pw - 6, ph * 0.12, b.label);
      if (b.gilt) { line(ph * 0.24 + 1, 1, 4); line(ph * 0.36 - 2, 1, 4); }
      text(b.title, ph * 0.3, Math.min(5.5 * mm, pw * 0.22), null);
      text(b.vol, ph * 0.09, Math.min(5 * mm, pw * 0.22), null);
      // a paper label at the foot with a hand-written shelf mark
      rect(5, ph * 0.86, pw - 10, ph * 0.06, [222, 206, 170]);
      text(String.fromCharCode(65 + (b.cell % 6)) + '-' + (b.cell % 9 + 1), ph * 0.89, Math.min(4 * mm, pw * 0.2), '#3a2a20', { italic: true });
    } else {
      // limp vellum: a brown inked title down the spine
      text(b.title, ph * 0.4, Math.min(pw * 0.42, 5.5 * mm), '#5a3a22', { vertical: true, maxW: ph * 0.6, italic: true });
    }
    // gilt wears off where hands grab: knock back a few flecks of the tooling with the leather again
    if (b.gilt) {
      const im2 = g.getImageData(ox, oy, pw, ph), d2 = im2.data, s = b.cell * 31 + 3;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const o = (y * pw + x) * 4;
        if (d2[o] > 160 && d2[o + 1] > 120 && d2[o + 2] < 140) {
          const wear = vnoise(x * 0.35, y * 0.35, s) * 0.7 + hash(x, y, s) * 0.3;
          const sheen = 0.82 + vnoise(x * 0.6, y * 0.2, s + 2) * 0.3;
          if (wear > 0.78) { d2[o] *= 0.62; d2[o + 1] *= 0.55; d2[o + 2] *= 0.5; } else { d2[o] = Math.min(255, d2[o] * sheen); d2[o + 1] = Math.min(255, d2[o + 1] * sheen); d2[o + 2] = Math.min(255, d2[o + 2] * sheen * 0.9); }
        }
      }
      g.putImageData(im2, ox, oy);
    }
  }
  return { map, mr, list };
}

/** Covers: a fine leather and cloth grain to multiply with each book's colour (grey, tileable). */
function coverGrain(): HTMLCanvasElement {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!, im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = 0.82 + (vnoise((x % S) * 0.7, (y % S) * 0.7, 3) - 0.5) * 0.12 + (hash(x, y, 9) - 0.5) * 0.06 + (((x ^ y) & 1) ? 0.02 : -0.02);
    const o = (y * S + x) * 4, v = Math.round(clamp(n) * 255);
    im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/** Page edges: fine cream lines (pages) along v, a little dust and foxing. */
function pageEdges(): HTMLCanvasElement {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!, im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const page = (x % 2 ? 0.9 : 0.78) + (hash(x, y >> 4, 4) - 0.5) * 0.08 + (vnoise(x * 0.05, y * 0.05, 8) - 0.5) * 0.12;
    const o = (y * S + x) * 4;
    im.data[o] = 236 * page; im.data[o + 1] = 222 * page; im.data[o + 2] = 190 * page; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// ------------------------------------------------------------------ geometry

/** Accumulates triangles (position, normal, uv, colour) for one merged mesh. */
class Acc {
  p: number[] = []; n: number[] = []; uv: number[] = []; c: number[] = [];
  private nm = new THREE.Matrix3(); private v = new THREE.Vector3();
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, col: C3, uvf?: (u: number, v: number, x: number, y: number, z: number) => [number, number]) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position as THREE.BufferAttribute, N = g.attributes.normal as THREE.BufferAttribute, U = g.attributes.uv as THREE.BufferAttribute | undefined;
    this.nm.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      this.v.set(x, y, z).applyMatrix4(m); this.p.push(this.v.x, this.v.y, this.v.z);
      this.v.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(this.nm).normalize(); this.n.push(this.v.x, this.v.y, this.v.z);
      const u0 = U ? U.getX(i) : 0, v0 = U ? U.getY(i) : 0;
      const [u, v] = uvf ? uvf(u0, v0, x, y, z) : [u0, v0];
      this.uv.push(u, v);
      this.c.push(col[0] / 255, col[1] / 255, col[2] / 255);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  /** raw triangles in local space (already with normals and uvs) */
  tri(m: THREE.Matrix4, col: C3, pts: number[], nrm: number[], uvs: number[]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.add(g, m, col);
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** The curve of a rounded spine: x across (-w/2..w/2), z forward (0 at the joints, `bulge` in the middle). */
function spinePts(w: number, bulge: number, N: number, off = 0) {
  const out: { x: number; z: number; nx: number; nz: number; t: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = Math.PI * t, x = -w / 2 + w * t, z = bulge * Math.sin(a);
    const dz = (bulge * Math.PI / w) * Math.cos(a), l = Math.hypot(dz, 1);
    out.push({ x: x + (-dz / l) * off, z: z + off / l, nx: -dz / l, nz: 1 / l, t });
  }
  return out;
}

interface Placed { d: Design; m: THREE.Matrix4; tint: C3; scaleD: number }

/** Every book's geometry into the three merged meshes. */
function buildBooks(books: Placed[], A: { spine: Acc; cover: Acc; page: Acc }) {
  const { W, H, CW, CH, cols } = BOOK_ATLAS;
  for (const { d: b, m, tint, scaleD } of books) {
    const w = b.w, h = b.h, dd = b.d * scaleD, bt = Math.min(0.003, w * 0.1), sq = 0.0025, bulge = Math.min(0.007, w * 0.16);
    const cover: C3 = b.style === 'ledger' ? [Math.round(b.col[0] * 0.8), Math.round(b.col[1] * 0.8), Math.round(b.col[2] * 0.8)] : b.col;
    const ct: C3 = [cover[0] * tint[0], cover[1] * tint[1], cover[2] * tint[2]];
    // atlas window
    const ox = (b.cell % cols) * CW + 1, oy = Math.floor(b.cell / cols) * CH + 1;
    const u0 = ox / W, u1 = (ox + b.pw) / W, vTop = 1 - oy / H, vBot = 1 - (oy + b.ph) / H;
    const U = (t: number) => u0 + (u1 - u0) * t, V = (y: number) => vBot + (vTop - vBot) * (y / h);
    const st: C3 = [255 * tint[0], 255 * tint[1], 255 * tint[2]];
    // the boards
    for (const sx of [-1, 1]) {
      const g = new THREE.BoxGeometry(bt, h, dd - 0.002);
      g.translate(sx * (w / 2 - bt / 2), h / 2, -(dd - 0.002) / 2 - 0.0008);
      A.cover.add(g, m, ct, (u, v, x, y, z) => [z * 7 + b.cell * 0.37, y * 7]);
    }
    // the page block (fine edges on top; gilt on top for some)
    {
      const pwid = w - 2 * bt - 0.0006, g = new THREE.BoxGeometry(pwid, h - 2 * sq, dd - 0.006);
      g.translate(0, h / 2, -(dd - 0.006) / 2 - 0.0035);
      const pc: C3 = b.giltTop ? [210, 160, 70] : [255 * (0.95 - hash(b.cell, 3, 3) * 0.12), 255 * (0.93 - hash(b.cell, 3, 3) * 0.14), 255 * (0.88 - hash(b.cell, 3, 3) * 0.2)];
      A.page.add(g, m, pc, (u, v, x, y, z) => [x * 30 + 0.5, z * 3 + y * 3]);
    }
    // the rounded spine with caps at head and tail
    const N = 6, pts = spinePts(w, bulge, N);
    const P: number[] = [], Nn: number[] = [], UV: number[] = [];
    const quad = (a: { x: number; z: number; nx: number; nz: number; t: number }, c: { x: number; z: number; nx: number; nz: number; t: number }, y0: number, y1: number) => {
      P.push(a.x, y0, a.z, c.x, y0, c.z, c.x, y1, c.z, a.x, y0, a.z, c.x, y1, c.z, a.x, y1, a.z);
      Nn.push(a.nx, 0, a.nz, c.nx, 0, c.nz, c.nx, 0, c.nz, a.nx, 0, a.nz, c.nx, 0, c.nz, a.nx, 0, a.nz);
      UV.push(U(a.t), V(y0), U(c.t), V(y0), U(c.t), V(y1), U(a.t), V(y0), U(c.t), V(y1), U(a.t), V(y1));
    };
    for (let i = 0; i < N; i++) quad(pts[i], pts[i + 1], 0, h);
    // the head and tail caps: the spine leather turned in over the page block
    for (const [y, ny] of [[h, 1], [0, -1]] as [number, number][]) for (let i = 0; i < N; i++) {
      const a = pts[i], c = pts[i + 1], back = -0.003;
      const tri = ny > 0 ? [a.x, y, a.z, c.x, y, c.z, c.x, y, back, a.x, y, a.z, c.x, y, back, a.x, y, back] : [a.x, y, a.z, c.x, y, back, c.x, y, c.z, a.x, y, a.z, a.x, y, back, c.x, y, back];
      P.push(...tri);
      for (let k = 0; k < 6; k++) Nn.push(0, ny, 0);
      const vy = ny > 0 ? V(h) - 0.5 / H : V(0) + 0.5 / H;
      for (let k = 0; k < 6; k++) UV.push(U(0.5), vy);
    }
    // raised bands on calf
    if (b.style === 'calf') {
      const top = h * 0.1, bot = h * 0.9, step = (bot - top) / b.bands, out = spinePts(w + 0.0016, bulge + 0.0012, N, 0.0016), bh = 0.0045;
      for (let k = 0; k <= b.bands; k++) {
        const yc = h - (top + k * step), y0 = yc - bh / 2, y1 = yc + bh / 2;
        for (let i = 0; i < N; i++) {
          quad(out[i], out[i + 1], y0, y1);
          // the band's top and bottom faces
          for (const [y, ny] of [[y1, 1], [y0, -1]] as [number, number][]) {
            const a = pts[i], c = pts[i + 1], A2 = out[i], C2 = out[i + 1];
            P.push(...(ny > 0 ? [a.x, y, a.z, C2.x, y, C2.z, c.x, y, c.z, a.x, y, a.z, A2.x, y, A2.z, C2.x, y, C2.z] : [a.x, y, a.z, c.x, y, c.z, C2.x, y, C2.z, a.x, y, a.z, C2.x, y, C2.z, A2.x, y, A2.z]));
            for (let q = 0; q < 6; q++) Nn.push(0, ny, 0);
            for (let q = 0; q < 6; q++) UV.push(U(0.5), V(yc));
          }
        }
      }
    }
    A.spine.tri(m, st, P, Nn, UV);
    // a ribbon marker out of the tail, over the shelf's lip
    if (b.ribbon) {
      const rl = 0.035 + hash(b.cell, 5, 5) * 0.03, rx = (hash(b.cell, 6, 6) - 0.5) * w * 0.5;
      const flat = new THREE.BoxGeometry(0.0065, 0.0005, 0.012); flat.translate(rx, 0.0003, 0.0035);
      A.cover.add(flat, m, b.ribbon, (u, v) => [u * 0.05, v * 0.05]);
      const hang = new THREE.BoxGeometry(0.0065, rl, 0.0005); hang.translate(rx, -rl / 2 + 0.0003, 0.0095);
      A.cover.add(hang, m, b.ribbon, (u, v) => [u * 0.05, v * 0.4]);
    }
  }
}

// ------------------------------------------------------------------ shelves

export interface ShelfRun { x0: number; x1: number; y: number; z: number; depth: number; maxH: number; seed: number; ornament?: boolean }

/** Fill shelf runs with books (and the odd bookend or object): returns the library group. */
export function buildLibrary(runs: ShelfRun[], m: OfficeMats): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'books';
  const art = paintSpines();
  const tx = (c: HTMLCanvasElement, srgb: boolean, repeat = false) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    m.textures.push(t);
    return t;
  };
  const mrT = tx(art.mr, false);
  const spineMat = new THREE.MeshStandardMaterial({ map: tx(art.map, true), roughnessMap: mrT, metalnessMap: mrT, roughness: 1, metalness: 1, vertexColors: true, envMapIntensity: 0.9, name: 'bookSpines' });
  const coverMat = new THREE.MeshStandardMaterial({ map: tx(coverGrain(), true, true), roughness: 0.62, vertexColors: true, name: 'bookCovers' });
  const pageMat = new THREE.MeshStandardMaterial({ map: tx(pageEdges(), true, true), roughness: 0.85, vertexColors: true, name: 'bookPages' });
  m.all.push(spineMat, coverMat, pageMat);
  const A = { spine: new Acc(), cover: new Acc(), page: new Acc() };
  const placed: Placed[] = [];
  const list = art.list;
  const singles = list.filter((d) => !(d.cell < 15));
  const sets: Design[][] = [list.slice(0, 6), list.slice(6, 11), list.slice(11, 15)];
  const props = new THREE.Group();
  for (const run of runs) placeRun(run, singles, sets, placed, props, m);
  buildBooks(placed, A);
  const mk = (a: Acc, mat: THREE.Material) => { const me = new THREE.Mesh(a.build(), mat); me.castShadow = true; me.receiveShadow = true; return me; };
  grp.add(mk(A.spine, spineMat), mk(A.cover, coverMat), mk(A.page, pageMat), props);
  return grp;
}

const M4 = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

function tintOf(r: () => number): C3 {
  const k = 0.88 + r() * 0.2, warm = (r() - 0.5) * 0.06;
  return [k * (1 + warm), k, k * (1 - warm)];
}

function placeRun(run: ShelfRun, singles: Design[], sets: Design[][], out: Placed[], props: THREE.Group, m: OfficeMats) {
  const r = rng(run.seed * 7919 + 17);
  const fits = (d: Design) => d.h <= run.maxH - 0.012 && d.d <= run.depth;
  let x = run.x0 + 0.004, last = -1;
  const upright = (d: Design) => {
    out.push({ d, m: M4(x + d.w / 2, run.y, run.z, 0, (r() - 0.5) * 0.03, 0), tint: tintOf(r), scaleD: 0.94 + r() * 0.06 });
    x += d.w + 0.0006 + r() * 0.0015;
    last = d.cell;
  };
  // the run's plan: at most one set, one pile lying flat, one object, a leaning book at the end of some
  const len = run.x1 - run.x0, at = (f: number) => run.x0 + len * f;
  const plan = {
    set: r() < 0.5 ? at(r() * 0.6) : Infinity,
    stack: r() < 0.38 ? at(r() < 0.5 ? 0 : 0.55 + r() * 0.2) : Infinity,
    thing: run.ornament !== false && r() < 0.3 ? at(0.15 + r() * 0.7) : Infinity,
    endGap: r() < 0.45 ? 0.07 + r() * 0.05 : 0,
  };
  if (r() < 0.3) x += bookend(props, m, x, run, r);
  while (x < run.x1 - 0.012) {
    const room = run.x1 - x;
    if (x >= plan.set) {
      plan.set = Infinity;
      const set = sets[Math.floor(r() * sets.length)].filter(fits);
      const n = Math.min(set.length, 3 + Math.floor(r() * 4)), start = Math.floor(r() * (set.length - n + 1));
      const vols = set.slice(start, start + n);
      if (vols.reduce((s2, d) => s2 + d.w + 0.002, 0) < room - plan.endGap) { for (const d of vols) upright(d); continue; }
    }
    if (x >= plan.stack && room > 0.34 + plan.endGap) { plan.stack = Infinity; x += flatStack(out, x, run, singles.filter(fits), r, props, m); continue; }
    if (x >= plan.thing && room > 0.2 + plan.endGap) { plan.thing = Infinity; x += ornament(props, m, x, run, r); continue; }
    if (plan.endGap && room < plan.endGap + 0.02) {
      const pool = singles.filter((d) => fits(d) && d.cell !== last);
      leaner(pool.sort(() => r() - 0.5), out, x, run, r);
      break;
    }
    const pool = singles.filter((d) => fits(d) && d.cell !== last && d.w < room - plan.endGap - 0.002);
    if (!pool.length) break;
    upright(pool[Math.floor(r() * pool.length)]);
  }
}

/** A book leaning on the last upright one, its foot out on the shelf. */
function leaner(pool: Design[], out: Placed[], x: number, run: ShelfRun, r: () => number) {
  const prev = out[out.length - 1];
  const d = pool.filter((p) => p.h <= prev.d.h * 0.98 && p.h < (run.x1 - x) * 6)[0];
  if (!d) return;
  const room = run.x1 - x, a = Math.min(0.42, Math.max(0.12, Math.asin(clamp((room - d.w - 0.004) / d.h, 0, 0.9)) * 0.85));
  // it stands on its foot's inner corner (the outer one lifts), its top corner against the neighbour's side
  const pivot = x + 0.0015 + d.h * Math.sin(a);
  if (pivot + d.w * Math.cos(a) > run.x1 - 0.002) return;
  const mtx = new THREE.Matrix4().makeTranslation(pivot, run.y, run.z).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(d.w / 2, 0, 0));
  out.push({ d, m: mtx, tint: tintOf(r), scaleD: 0.96 });
}

/** Two to five books lying flat, spines out, biggest at the bottom; sometimes an object on top. */
function flatStack(out: Placed[], x: number, run: ShelfRun, pool: Design[], r: () => number, props: THREE.Group, m: OfficeMats): number {
  const n = 2 + Math.floor(r() * 4);
  const pick = pool.filter((d) => d.h < 0.3).sort(() => r() - 0.5).slice(0, n).sort((a, b) => b.h - a.h);
  let y = run.y, wMax = 0;
  for (const d of pick) {
    if (y + d.w > run.y + run.maxH - 0.03) break;
    // lying on its side: the book's height runs along x, its thickness up
    const yaw = (r() - 0.5) * 0.08, cx = x + 0.01 + d.h / 2;
    const mtx = M4(cx, y + d.w / 2, run.z - 0.004, 0, yaw, Math.PI / 2).multiply(new THREE.Matrix4().makeTranslation(0, -d.h / 2, 0));
    out.push({ d, m: mtx, tint: tintOf(r), scaleD: 0.97 });
    y += d.w;
    wMax = Math.max(wMax, d.h);
  }
  // a small thing on top of the pile
  if (r() < 0.6 && y < run.y + run.maxH - 0.12) {
    const o = smallThing(m, r);
    o.position.set(x + 0.01 + wMax * (0.45 + r() * 0.1), y, run.z - 0.09);
    o.rotation.y = r() * Math.PI * 2;
    props.add(o);
  }
  return wMax + 0.02;
}

/** A bookend: a block of green marble with a brass owl's-head finial. */
function bookend(props: THREE.Group, m: OfficeMats, x: number, run: ShelfRun, r: () => number): number {
  const g = new THREE.Group();
  const w = 0.045, h = 0.15 + r() * 0.03, d = 0.11;
  const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.mahoganyDark);
  block.position.set(w / 2, h / 2, -d / 2 - 0.01);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, 0.014, d + 0.012), m.brassDark);
  plinth.position.set(w / 2, 0.007, -d / 2 - 0.01);
  const ball = new THREE.Mesh(lathe([[0, 0], [0.012, 0.003], [0.019, 0.02], [0.016, 0.034], [0.007, 0.042], [0, 0.044]], 18), m.brass);
  ball.position.set(w / 2, h, -d / 2 - 0.01);
  g.add(block, plinth, ball);
  for (const c of g.children) { c.castShadow = true; c.receiveShadow = true; }
  g.position.set(x, run.y, run.z);
  props.add(g);
  return w + 0.004;
}

/** A small object standing in a gap: an hourglass, a brass armillary sphere, rolled papers or a candlestick. */
function ornament(props: THREE.Group, m: OfficeMats, x: number, run: ShelfRun, r: () => number): number {
  const o = smallThing(m, r, run.maxH);
  const room = 0.13 + r() * 0.04;
  o.position.set(x + room / 2, run.y, run.z - 0.12);
  o.rotation.y = (r() - 0.5) * 1.2;
  props.add(o);
  return room;
}

const extra = new WeakMap<OfficeMats, { sand: THREE.Material; tape: THREE.Material }>();
function smallThing(m: OfficeMats, r: () => number, maxH = 0.4): THREE.Group {
  const g = new THREE.Group(), k = Math.floor(r() * 4);
  let X = extra.get(m);
  if (!X) { X = { sand: new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 0.95 }), tape: new THREE.MeshStandardMaterial({ color: 0x8a1c16, roughness: 0.7 }) }; extra.set(m, X); m.all.push(X.sand, X.tape); }
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(at(geo, x, y, z, rx, ry, rz), mat); me.castShadow = true; me.receiveShadow = true; g.add(me); };
  if (k === 0 && maxH > 0.2) {
    // an hourglass: turned walnut ends, three spindles, the glass and its sand
    for (const y of [0, 0.142]) add(cyl(0.036, 0.012, 20), m.walnut, 0, y, 0);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(lathe([[0.004, 0], [0.005, 0.03], [0.003, 0.065], [0.005, 0.1], [0.004, 0.13]], 8), m.walnut, Math.cos(a) * 0.028, 0.012, Math.sin(a) * 0.028); }
    add(lathe([[0.002, 0], [0.022, 0.012], [0.024, 0.04], [0.006, 0.062], [0.003, 0.065], [0.006, 0.068], [0.024, 0.09], [0.022, 0.118], [0.002, 0.13]], 24), m.glass, 0, 0.012, 0);
    add(lathe([[0, 0], [0.019, 0.004], [0.012, 0.026], [0, 0.034]], 16), X.sand, 0, 0.014, 0);
  } else if (k === 1 && maxH > 0.22) {
    // a small brass armillary sphere on a turned stand
    add(lathe([[0, 0], [0.035, 0], [0.034, 0.008], [0.012, 0.016], [0.008, 0.06], [0.014, 0.07], [0, 0.072]], 20), m.brass, 0, 0, 0);
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.055, 0.0025, 6, 40), m.brass, 0, 0.128, 0, i === 0 ? Math.PI / 2 : 0, i * 1.0, i === 2 ? 0.41 : 0);
    add(new THREE.SphereGeometry(0.012, 14, 10), m.brassDark, 0, 0.128, 0);
  } else if (k === 2) {
    // rolled documents tied with red tape
    for (let i = 0; i < 3; i++) {
      add(cyl(0.012 + i * 0.002, 0.2 - i * 0.02, 14), m.ivory, -0.1 + i * 0.006, 0.013 + i * 0.022, (i - 1) * 0.026 - (i === 2 ? 0.0 : 0), 0, 0, -Math.PI / 2);
    }
    add(new THREE.TorusGeometry(0.03, 0.003, 6, 24), X.tape, 0.0, 0.03, 0, 0, Math.PI / 2, 0);
  } else {
    // a brass chamberstick with a part-burnt candle
    add(lathe([[0, 0], [0.045, 0], [0.046, 0.004], [0.04, 0.008], [0.012, 0.012], [0.01, 0.03], [0.016, 0.034], [0.014, 0.04], [0, 0.04]], 24), m.brass, 0, 0, 0);
    add(cyl(0.0095, 0.07 + r() * 0.05, 14), m.ivory, 0, 0.04, 0);
  }
  return g;
}
