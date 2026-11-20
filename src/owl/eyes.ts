// Pip's eyes are small, simple, glossy bead eyes: a dark dot with a big catch-light. Each eye is a tiny
// pixel canvas repainted whenever the expression changes, so blinks, glances, smiles, hearts and
// sleepy lines are all drawn at true pixel resolution and match the voxel textures around them.
import * as THREE from 'three';
import { col, mix, ramp } from '../gfx/color.ts';

export type EyeMode = 'normal' | 'happy' | 'closed' | 'heart' | 'star' | 'spiral' | 'sparkle' | 'wide';

export interface EyeState {
  /** 0 = fully open, 1 = top lid fully down */
  lid: number;
  /** 0..1 lower lid rising (smiling cheeks) */
  low: number;
  /** -1..1 lid tilt: + grumpy (inner corner down), - worried (inner corner up) */
  tilt: number;
  /** glance direction -1..1: shifts the bead and its shine */
  lx: number;
  ly: number;
  /** bead size 3..8 (5 = normal; bigger in the dark and when delighted) */
  pupil: number;
  mode: EyeMode;
  tear: boolean;
}

export const defaultEye = (): EyeState => ({ lid: 0, low: 0, tilt: 0, lx: 0, ly: 0, pupil: 5, mode: 'normal', tear: false });

const N = 16;
const C = N / 2;

export interface EyeColours { eye: string; lid: string; liner: string }

export class Eye {
  readonly canvas: HTMLCanvasElement;
  readonly tex: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private key = '';
  private bead!: number[];
  private lidc!: number[];
  private ink!: number;

  /** side: -1 for the eye at -x, +1 for the eye at +x */
  constructor(private side: number, cols: EyeColours) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = N; this.canvas.height = N;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(N, N);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.setColours(cols);
  }

  setColours(cols: EyeColours) {
    // the bead: near-black with a cool sheen in its lower half
    this.bead = [col(cols.eye), mix(cols.eye, '#3a4a78', 0.35), mix(cols.eye, '#6a7cb0', 0.45)];
    this.lidc = ramp(col(cols.lid), { n: 5, step: 0.05 }).c;
    this.ink = col(cols.liner);
    this.key = '';
  }

  draw(s: EyeState): boolean {
    const q = (v: number, k: number) => Math.round(v * k);
    const key = [q(s.lid, 14), q(s.low, 14), q(s.tilt, 6), q(s.lx, 4), q(s.ly, 4), q(s.pupil, 2), s.mode, s.tear ? 1 : 0].join(',');
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
    const inner = -this.side;
    const white = 0xffffff;
    const mode = s.mode;

    if (mode === 'happy' || mode === 'closed') {
      // a soft curved line: ^ when delighted, ‿ when asleep
      for (let x = 2; x < N - 2; x++) {
        const nx = (x + 0.5 - C) / 4.6;
        if (Math.abs(nx) > 1) continue;
        const k = Math.sqrt(1 - nx * nx);
        const y = mode === 'happy' ? C + 1.2 - k * 2.6 : C - 0.4 + k * 1.9;
        put(x, y, this.ink); put(x, y + 1, this.ink);
      }
    } else {
      // the bead: shifts a little with the glance, grows in the dark
      const R = Math.max(3.2, Math.min(5.2, mode === 'wide' ? 4.9 : 3.9 + (s.pupil - 5) * 0.28));
      const cx = C + s.lx * 1.1, cy = C + s.ly * 0.9;
      const nxOf = (x: number) => (x + 0.5 - cx) / R;
      const lidEdge = (x: number) => { const nx = nxOf(x); return cy - R + s.lid * 2 * R * 1.04 + (1 - nx * nx) * 1.2 * s.lid + s.tilt * nx * inner * 2.6 * Math.min(1, s.lid * 3 + 0.4); };
      const lowEdge = (x: number) => { const nx = nxOf(x); return cy + R - s.low * R * 1.25 - (1 - nx * nx) * 1.6 * s.low; };
      const inside = (x: number, y: number) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R;
      const open = (x: number, y: number) => inside(x, y) && y + 0.5 >= lidEdge(x) && (s.low < 0.03 || y + 0.5 <= lowEdge(x));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!inside(x, y)) continue;
        const yy = y + 0.5;
        if (yy < lidEdge(x)) { put(x, y, yy > lidEdge(x) - 1.1 ? this.ink : this.lidc[2]); continue; }
        if (s.low > 0.03 && yy > lowEdge(x)) { put(x, y, this.lidc[3]); continue; }
        // glossy bead: darkest at the top, a cool sheen pooling at the bottom
        const dy = (yy - cy) / R;
        put(x, y, this.bead[0]);
      }
      const dot = (px: number, py: number, r: number, c: number) => {
        for (let y = Math.floor(py - r - 1); y <= py + r + 1; y++) for (let x = Math.floor(px - r - 1); x <= px + r + 1; x++)
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py) < r && open(x, y)) put(x, y, c);
      };
      if (mode === 'heart') {
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const u = (x + 0.5 - cx) / 5.2, v = -(y + 0.5 - cy) / 5.2 + 0.18;
          if ((u * u + v * v - 0.3) ** 3 - u * u * v * v * v < 0 && open(x, y)) put(x, y, v > 0.2 && u < 0 ? 0xff8aa8 : 0xff4f7a);
        }
        dot(cx - 2, cy - 1.8, 1.1, white);
      } else if (mode === 'star') {
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = Math.atan2(dy, dx) + Math.PI / 2, rr = Math.hypot(dx, dy);
          if (rr < 2.4 + 3.4 * Math.pow(Math.abs(Math.cos(a * 2.5)), 6) && open(x, y)) put(x, y, rr < 2 ? 0xfff6c0 : 0xffd23a);
        }
      } else if (mode === 'spiral') {
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
          if (open(x, y)) put(x, y, (rr - a * 0.9 + 40) % 2.6 < 1 ? white : this.bead[0]);
        }
      } else {
        // catch-lights: one big, one tiny, opposite corners; they stay put while the bead glances
        // a simple dot with one tiny glint
        dot(cx - R * 0.36, cy - R * 0.38, 1.05, white);
        if (mode === 'sparkle' || mode === 'wide') {
          dot(cx + R * 0.38, cy + R * 0.3, 0.7, white);
          if (mode === 'sparkle') { for (const k of [-1, 0, 1]) { if (open(Math.round(cx - 1 + k), Math.round(cy + 2))) put(cx - 1 + k, cy + 2, white); } }
        }
      }
    }

    if (s.tear) {
      const tx = C - inner * 4.6, ty = C + 4.4;
      for (const [dx, dy, c] of [[0, -1, 0xbfe9ff], [0, 0, 0x8fd8ff], [-1, 1, 0x6fc4f2], [0, 1, 0x8fd8ff], [1, 1, 0x6fc4f2], [0, 2, 0x4fa8e0]] as const) put(tx + dx, ty + dy, c);
    }

    this.ctx.putImageData(this.img, 0, 0);
    this.tex.needsUpdate = true;
    return true;
  }
}

/** Eye colours from a coat: lids are the fur around the eye, so a closing lid melts into the face. */
export const eyeColours = (p: { eye: string; fur: string; liner: string; pattern: string; stripe: string; muzzle: string; skin: string }): EyeColours => ({
  eye: p.eye,
  lid: p.skin === 'owl' ? '#' + mix(p.muzzle, p.liner, 0.12).toString(16).padStart(6, '0') : p.pattern === 'points' ? '#' + mix(p.fur, p.stripe, 0.5).toString(16).padStart(6, '0') : p.fur,
  liner: p.liner,
});
