// Realistic owl eyes, drawn as a pixel canvas per eye and repainted whenever the expression changes.
// Each eye has a coloured iris with radial striations, a darker limbal ring and a lighter collarette,
// a round pupil that dilates in the dark or with excitement, the shadow of the upper lid across the
// top of the eyeball, a crisp specular highlight that stays put while the eye glances, feathered
// lids with a dark margin (the upper lid blinks, the lower lid rises when happy or sleepy), and a
// milky nictitating membrane that sweeps across diagonally. Expressions keep their old meanings:
// happy = lower lids up, closed = sleeping lids, heart/star = shaped pupils, spiral = dizzy, etc.
import * as THREE from 'three';
import { col, mix, ramp } from '../gfx/color.ts';
import { hash } from '../gfx/noise.ts';

export type EyeMode = 'normal' | 'happy' | 'closed' | 'heart' | 'star' | 'spiral' | 'sparkle' | 'wide';

export interface EyeState {
  /** 0 = fully open, 1 = top lid fully down */
  lid: number;
  /** 0..1 lower lid rising (smiling, sleepy) */
  low: number;
  /** -1..1 lid tilt: + grumpy (inner corner down), - worried (inner corner up) */
  tilt: number;
  /** glance direction -1..1: shifts the iris; the highlight stays where the light is */
  lx: number;
  ly: number;
  /** pupil size 2.5..8 (5 = normal; bigger in the dark and when delighted) */
  pupil: number;
  mode: EyeMode;
  tear: boolean;
  /** 0..1 nictitating membrane sweeping across (a quick protective blink) */
  nict?: number;
}

export const defaultEye = (): EyeState => ({ lid: 0, low: 0, tilt: 0, lx: 0, ly: 0, pupil: 5, mode: 'normal', tear: false, nict: 0 });

/** Canvas size per eye and the visible eyeball radius (texels). */
export const EYE_N = 32;
const N = EYE_N;
const C = N / 2;
const R = 12.6;
/** The plane is a bit bigger than the eyeball so lids, margins and lashes fit around it. */
export const EYE_PLANE = (2 * C) / (2 * R) * 0.98;

export interface EyeColours {
  iris: string;
  /** feathered lid colour (usually the facial disc near the eye) */
  lid: string;
  /** the bare eyelid margin round the eye */
  rim: string;
  /** emissive (celestial) */
  glow?: boolean;
  /** vertical slit pupils (Meowl) */
  slit?: boolean;
  /** long lashes and a softer look (Queen Neve) */
  lashes?: boolean;
  style?: 'owl' | 'candy' | 'coal' | 'star';
}

export class Eye {
  readonly canvas: HTMLCanvasElement;
  readonly tex: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private key = '';
  private iris!: number[];
  private lidc!: number[];
  private rim!: number;
  private dark!: boolean;
  private cols!: EyeColours;

  /** side: -1 for the eye at -x, +1 for the eye at +x */
  constructor(private side: number, cols: EyeColours) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = N; this.canvas.height = N;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(N, N);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.setColours(cols);
  }

  setColours(cols: EyeColours) {
    this.cols = cols;
    // keep the hue steady across the iris shades (yellow eyes must stay yellow, not drift orange)
    this.iris = ramp(col(cols.iris), { n: 7, step: 0.065, shift: 0.02 }).c;
    this.lidc = ramp(col(cols.lid), { n: 5, step: 0.05 }).c;
    this.rim = col(cols.rim);
    const c = col(cols.iris);
    this.dark = ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255) < 200;
    this.key = '';
  }

  draw(s: EyeState): boolean {
    const q = (v: number, k: number) => Math.round(v * k);
    const nict = s.nict ?? 0;
    const key = [q(s.lid, 20), q(s.low, 20), q(s.tilt, 8), q(s.lx, 6), q(s.ly, 6), q(s.pupil, 4), s.mode, s.tear ? 1 : 0, q(nict, 12)].join(',');
    if (key === this.key) return false;
    this.key = key;
    const d = this.img.data;
    d.fill(0);
    const put = (x: number, y: number, c: number, a = 255) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      const i = (y * N + x) * 4;
      d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = a;
    };
    const blend = (x: number, y: number, c: number, k: number) => {
      const i = (y * N + x) * 4;
      if (!d[i + 3]) return;
      d[i] = d[i] + (((c >> 16) & 255) - d[i]) * k; d[i + 1] = d[i + 1] + (((c >> 8) & 255) - d[i + 1]) * k; d[i + 2] = d[i + 2] + ((c & 255) - d[i + 2]) * k;
    };
    const inner = -this.side; // +1 when the inner corner is towards +x on this canvas
    const mode = s.mode, style = this.cols.style ?? 'owl';
    const I = this.iris, Lc = this.lidc, rim = this.rim;

    // ---------------- lids
    let lid = s.lid, low = s.low;
    if (mode === 'wide') { lid = Math.min(lid, 0.02); low = 0; }
    if (mode === 'happy') { low = Math.max(low, 0.62); lid = Math.max(lid, 0.12); }
    if (mode === 'closed') { lid = 1; }
    const nxOf = (x: number) => (x + 0.5 - C) / R;
    const lidEdge = (x: number) => {
      const nx = nxOf(x);
      return C - R - 0.6 + lid * (2 * R + 1.2) * 0.98 + (1 - nx * nx) * 1.6 * Math.min(1, lid * 1.4) + s.tilt * nx * inner * 4.2 * Math.min(1, lid * 2.6 + 0.35);
    };
    const lowEdge = (x: number) => {
      const nx = nxOf(x);
      const arch = mode === 'happy' ? 0.62 : 0.32;
      return C + R + 0.6 - low * R * 1.32 - (1 - nx * nx) * R * arch * low;
    };

    // ---------------- the eyeball
    const pr = THREE.MathUtils.clamp(0.26 + ((s.pupil - 2.5) / 5.5) * 0.5, 0.2, 0.8) * R * (style === 'candy' ? 1.25 : 1);
    const ix = C + s.lx * 2.2, iy = C + s.ly * 1.8;
    const irisAt = (x: number, y: number): number => {
      const dx = x + 0.5 - ix, dy = y + 0.5 - iy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (style === 'candy') {
        if (r < pr) return r > pr - 1 ? 0x2a2a30 : 0x0e0e12;
        return r > R - 1.5 ? 0xe8e2d8 : 0xfbf8f0;
      }
      if (style === 'coal') {
        const h = hash(x, y, 3, 11);
        return h > 0.9 ? 0x4a4a54 : h > 0.6 ? 0x26262c : 0x18181c;
      }
      // the pupil (a slit for the Meowl), with a faint blue sheen low down
      const slitIn = this.cols.slit ? Math.abs(dx) < pr * 0.42 && Math.abs(dy) < R * 0.86 * Math.sqrt(Math.max(0, 1 - (dx / (pr * 0.42)) ** 2)) : false;
      if (mode === 'heart') {
        const u = dx / (R * 0.62), v = -dy / (R * 0.62) + 0.2;
        if ((u * u + v * v - 0.3) ** 3 - u * u * v * v * v < 0) return v > 0.25 && u < -0.05 ? 0xff7a9a : 0xd81e4c;
      } else if (mode === 'star') {
        const sa = a + Math.PI / 2, rr = R * (0.28 + 0.36 * Math.pow(Math.abs(Math.cos(sa * 2.5)), 5));
        if (r < rr) return r < R * 0.2 ? 0xfff6c8 : 0xffc93a;
      } else if (mode === 'spiral') {
        if ((r - a * 1.4 + 40) % 3.4 < 1.3) return this.dark ? 0xe8dcc8 : 0x1a1414;
      } else if ((this.cols.slit ? slitIn : r < pr)) {
        return dy > pr * 0.35 && !this.dark ? 0x141826 : 0x08080c;
      }
      // iris: radial striations, a darker limbal ring, a lighter collarette round the pupil
      const t = (r - pr) / Math.max(1, R - pr);
      const streak = hash(Math.floor(((a + Math.PI) / (Math.PI * 2)) * 30), 0, 5, 7);
      let k = (this.dark ? 1 : 3) + (streak > 0.7 ? 1 : streak < 0.25 ? -1 : 0);
      if (t < 0.22) k += this.dark ? 0 : 1;
      if (t > 0.78) k -= 2;
      if (t > 0.9) k -= 1;
      if (style === 'star' && Math.sin(a * 8) > 0.6 && t > 0.2) k += 2;
      if (hash(x, y, 9, 2) > 0.93) k += 1;
      return I[Math.max(0, Math.min(6, k))];
    };

    // ---------------- paint
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - C, dy = y + 0.5 - C, r = Math.hypot(dx, dy);
      if (r > R + 1.4) continue;
      const yy = y + 0.5;
      const le = lidEdge(x), lo = lowEdge(x);
      if (r > R) { put(x, y, rim); continue; } // the bare eyelid margin all round
      if (yy < le) {
        // upper lid: feathered, with its dark margin along the edge
        if (yy > le - 1.4) { put(x, y, rim); continue; }
        const fea = hash(Math.floor(x / 1.5), Math.floor((yy - le) / 1.8), 1, 4) > 0.6 ? 1 : 0;
        put(x, y, Lc[2 + fea - (yy > le - 3.5 ? 1 : 0)]);
        continue;
      }
      if (low > 0.02 && yy > lo) {
        if (yy < lo + 1.3) { put(x, y, rim); continue; }
        const fea = hash(Math.floor(x / 1.5), Math.floor((yy - lo) / 1.8), 2, 4) > 0.6 ? 1 : 0;
        put(x, y, Lc[3 + fea - 1]);
        continue;
      }
      let c = irisAt(x, y);
      // the upper lid casts a soft shadow over the top of the eyeball
      const sh = yy - le;
      if (sh < 3.2 && style !== 'candy') c = mix(c, 0x000000, (1 - sh / 3.2) * 0.55);
      else if (style === 'candy' && sh < 2) c = mix(c, 0x8a7a68, (1 - sh / 2) * 0.4);
      // sky reflection across the lower half
      if (dy > R * 0.25 && dy < R * 0.62 && Math.abs(dx) < R * 0.7 && style !== 'candy') c = mix(c, 0x9fb4d8, this.dark ? 0.06 : 0.1);
      put(x, y, c);
    }
    const visible = (x: number, y: number) => {
      const dx = x + 0.5 - C, dy = y + 0.5 - C;
      return Math.hypot(dx, dy) <= R && y + 0.5 >= lidEdge(x) + 0.6 && (low <= 0.02 || y + 0.5 <= lowEdge(x) - 0.6);
    };

    // ---------------- closed eyes: a soft lash line where the lids meet
    if (mode === 'closed' || lid > 0.97) {
      for (let x = 0; x < N; x++) {
        const nx = nxOf(x);
        if (Math.abs(nx) > 1.02) continue;
        const yl = C + 1.2 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 2.2;
        put(x, yl, rim); put(x, yl + 1, mix(rim, Lc[2], 0.5));
        if (this.cols.lashes && nx * inner < -0.2 && x % 2 === 0) { put(x, yl + 2, rim); put(x - inner, yl + 3, rim); }
      }
    }

    // ---------------- highlights: they stay where the light is
    const glint = (px: number, py: number, rad: number, c: number, a = 1) => {
      for (let y = Math.floor(py - rad - 1); y <= py + rad + 1; y++) for (let x = Math.floor(px - rad - 1); x <= px + rad + 1; x++) {
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const dd = Math.max(Math.abs(x + 0.5 - px), Math.abs(y + 0.5 - py)) * 0.55 + Math.hypot(x + 0.5 - px, y + 0.5 - py) * 0.45;
        if (dd < rad && visible(x, y)) { if (a >= 1) put(x, y, c); else blend(x, y, c, a); }
      }
    };
    if (mode !== 'closed' && lid < 0.95) {
      const hx = C - R * 0.36, hy = C - R * 0.3;
      if (style === 'star') {
        for (let k = -3; k <= 3; k++) { if (visible(Math.round(hx + k), Math.round(hy))) put(hx + k, hy, 0xffffff); if (visible(Math.round(hx), Math.round(hy + k))) put(hx, hy + k, 0xffffff); }
        glint(hx, hy, 1.5, 0xffffff);
      } else glint(hx, hy, mode === 'wide' ? 3.1 : 2.7, 0xffffff);
      glint(C + R * 0.36, C + R * 0.4, 1.3, 0xffffff, 0.75);
      if (mode === 'sparkle' || mode === 'wide') glint(C + R * 0.05, C - R * 0.52, 1.0, 0xffffff, 0.9);
      if (mode === 'sparkle') for (const [sx, sy] of [[C + R * 0.3, C - R * 0.15], [C - R * 0.1, C + R * 0.25]]) {
        for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (visible(Math.round(sx + ox), Math.round(sy + oy))) put(sx + ox, sy + oy, 0xfff6d0);
      }
      if (mode === 'heart') glint(C - R * 0.12, C - R * 0.12, 1, 0xffd4e0, 0.9);
    }

    // ---------------- nictitating membrane: milky, sweeping from the inner top corner
    if (nict > 0.02) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - C, dy = y + 0.5 - C;
        if (Math.hypot(dx, dy) > R) continue;
        const sweep = ((dx * inner) * 0.75 - dy * 0.66) / R; // +1 at the inner top corner
        const edge = 1 - nict * 2.2;
        if (sweep > edge) blend(x, y, sweep < edge + 0.12 ? 0xf4f8fc : 0xd8e4ee, sweep < edge + 0.12 ? 0.85 : 0.68);
      }
    }

    // ---------------- lashes (Queen Neve): a sweep of dark lashes off the outer top corner
    if (this.cols.lashes && mode !== 'closed' && lid < 0.9) {
      const lc = mix(rim, 0x000000, 0.3);
      for (const [ang, len] of [[-0.55, 3], [-0.25, 3.6], [0.05, 3.2], [0.32, 2.4]] as const) {
        const a0 = -Math.PI / 2 - inner * (0.9 + ang);
        const ex0 = C + Math.cos(a0) * (R + 0.6), ey0 = Math.min(C + Math.sin(a0) * (R + 0.6), lidEdge(Math.round(C + Math.cos(a0) * R)) + 0.5);
        for (let k = 0; k < len * 2; k++) {
          const t2 = k / 2, cx = ex0 + Math.cos(a0) * t2 - inner * t2 * 0.25, cy = ey0 + Math.sin(a0) * t2 - t2 * t2 * 0.05;
          put(cx, cy, lc);
        }
      }
    }

    // ---------------- a tear welling at the lower lid
    if (s.tear) {
      for (let x = 0; x < N; x++) { const yl = Math.round(Math.min(lowEdge(x), C + R) - 1); if (Math.abs(nxOf(x)) < 0.7 && yl > C) blend(x, yl, 0xbfe9ff, 0.7); }
      const tx = C - inner * R * 0.55, ty = C + R * 0.72;
      for (const [dx, dy, c] of [[0, -1, 0xd8f3ff], [0, 0, 0x9fdcff], [-1, 1, 0x6fc4f2], [0, 1, 0x8fd8ff], [1, 1, 0x6fc4f2], [0, 2, 0x4fa8e0], [-1, 2, 0x8fd8ff], [1, 2, 0x5ab4ea], [0, 3, 0x4fa8e0]] as const) put(tx + dx, ty + dy, c);
    }

    this.ctx.putImageData(this.img, 0, 0);
    this.tex.needsUpdate = true;
    return true;
  }
}
