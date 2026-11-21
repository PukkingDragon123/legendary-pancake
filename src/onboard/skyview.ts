// The view through the office's round window: a small pixel painting of the forest outside, lit
// for the real time of day (or a previewed hour), with weather the interview can call up: rain, the
// sea, wind-blown leaves, a stream. Painted into a tiny canvas used as a texture.
import * as THREE from 'three';

export type Weather = 'clear' | 'rain' | 'sea' | 'wind' | 'stream' | 'snow';

interface Key { h: number; top: string; hor: string; sun: string; light: string; li: number; night: number }
const KEYS: Key[] = [
  { h: 0, top: '#070b24', hor: '#1c2c5c', sun: '#f7efd0', light: '#8fb0ff', li: 0.35, night: 1 },
  { h: 4.8, top: '#0a1030', hor: '#24356a', sun: '#f7efd0', light: '#8fb0ff', li: 0.35, night: 1 },
  { h: 6.0, top: '#3a3f8c', hor: '#ff9a6a', sun: '#ffd27a', light: '#ffb48a', li: 0.9, night: 0.4 },
  { h: 7.2, top: '#5a8fd8', hor: '#ffd6a0', sun: '#fff0b0', light: '#ffe0b0', li: 1.5, night: 0 },
  { h: 12, top: '#4a9fee', hor: '#c6ebff', sun: '#fffbe0', light: '#fff7e6', li: 1.8, night: 0 },
  { h: 17, top: '#5b8fd8', hor: '#ffdca6', sun: '#fff0b0', light: '#ffd9a0', li: 1.6, night: 0 },
  { h: 18.9, top: '#3c3f8c', hor: '#f58d6c', sun: '#ff9a5a', light: '#ff9a68', li: 0.9, night: 0.35 },
  { h: 20.3, top: '#0c1234', hor: '#2a3a74', sun: '#f7efd0', light: '#8fb0ff', li: 0.4, night: 1 },
  { h: 24, top: '#070b24', hor: '#1c2c5c', sun: '#f7efd0', light: '#8fb0ff', li: 0.35, night: 1 },
];
const c3 = (h: string) => new THREE.Color(h);
function keyAt(h: number) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (h - a.h) / (b.h - a.h);
  const L = (x: string, y: string) => c3(x).lerp(c3(y), t);
  return { top: L(a.top, b.top), hor: L(a.hor, b.hor), sun: L(a.sun, b.sun), light: L(a.light, b.light), li: a.li + (b.li - a.li) * t, night: a.night + (b.night - a.night) * t };
}
export const nowHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

const N = 48;
const hash = (x: number, y: number, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class SkyView {
  readonly tex: THREE.CanvasTexture;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  /** displayed hour eases toward the wanted one, so a preview of sunrise actually rises */
  hour = nowHour();
  want: number | null = null;
  weather: Weather = 'clear';
  /** 0..1 how much it is raining etc. (fades in) */
  private amt = 0;
  private t = 0;
  private acc = 0;
  private drops: { x: number; y: number; v: number }[] = [];
  light = new THREE.Color(1, 1, 1);
  lightI = 1;
  night = 0;

  constructor() {
    this.cv = document.createElement('canvas');
    this.cv.width = this.cv.height = N;
    this.g = this.cv.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 40; i++) this.drops.push({ x: hash(i, 1) * N, y: hash(i, 2) * N, v: 40 + hash(i, 3) * 30 });
    this.draw();
  }

  set(hour: number | null, weather: Weather = this.weather) {
    this.want = hour;
    if (weather !== this.weather) { this.weather = weather; this.amt = 0; }
  }

  update(dt: number) {
    this.t += dt;
    const target = this.want ?? nowHour();
    // ease along the shortest way round the clock
    let d = target - this.hour;
    if (d > 12) d -= 24; else if (d < -12) d += 24;
    this.hour = (this.hour + d * Math.min(1, dt * 1.6) + 24) % 24;
    this.amt = Math.min(1, this.amt + dt * 1.2);
    this.acc += dt;
    if (this.acc > 1 / 12) { this.acc = 0; this.draw(); }
  }

  private draw() {
    const g = this.g, k = keyAt(this.hour);
    this.light.copy(k.light); this.lightI = k.li * (this.weather === 'rain' ? 0.6 : 1); this.night = k.night;
    // banded sky
    for (let y = 0; y < N; y++) {
      const t = Math.floor(((N - y) / N) * 10) / 10;
      g.fillStyle = '#' + k.hor.clone().lerp(k.top, t).getHexString();
      g.fillRect(0, y, N, 1);
    }
    const night = k.night;
    if (night > 0.3) for (let i = 0; i < 30; i++) {
      const x = Math.floor(hash(i, 7) * N), y = Math.floor(hash(i, 8) * N * 0.6);
      if (hash(i, Math.floor(this.t * 2), 3) > 0.15) { g.fillStyle = `rgba(255,246,216,${(night * (0.5 + hash(i, 9) * 0.5)).toFixed(2)})`; g.fillRect(x, y, 1, 1); }
    }
    // sun or moon: rises from behind the trees
    const h = this.hour, day = h > 5.6 && h < 19.6;
    const p = day ? (h - 5.6) / 14 : ((h + 24 - 19.6) % 24) / 10;
    const sx = Math.round(6 + p * 36), sy = Math.round(36 - Math.sin(Math.min(1, Math.max(0, p)) * Math.PI) * 28);
    g.fillStyle = '#' + k.sun.getHexString();
    if (this.weather !== 'rain') {
      if (day) {
        g.globalAlpha = 0.25; g.fillRect(sx - 6, sy - 6, 12, 12); g.globalAlpha = 1;
        g.fillRect(sx - 3, sy - 4, 6, 8); g.fillRect(sx - 4, sy - 3, 8, 6);
      } else {
        g.fillRect(sx - 3, sy - 3, 6, 6); g.fillRect(sx - 2, sy - 4, 4, 8); g.fillRect(sx - 4, sy - 2, 8, 4);
        g.fillStyle = '#' + k.top.getHexString(); g.fillRect(sx, sy - 3, 3, 5); g.fillRect(sx + 1, sy - 4, 3, 7);
      }
    }
    // clouds (heavy and grey in the rain)
    const cl = this.weather === 'rain' ? 1 : 0.4;
    for (let i = 0; i < 4; i++) {
      const cx = ((hash(i, 11) * N + this.t * (1.5 + i * 0.4)) % (N + 20)) - 10, cy = 6 + i * 6 + Math.floor(hash(i, 12) * 4);
      g.fillStyle = this.weather === 'rain' ? `rgba(90,100,120,${(0.9 * this.amt).toFixed(2)})` : night > 0.5 ? 'rgba(60,70,120,.55)' : 'rgba(255,255,255,.75)';
      if (cl < 1 && i > 1) continue;
      g.fillRect(Math.round(cx), cy, 10, 3); g.fillRect(Math.round(cx) + 2, cy - 2, 6, 2);
    }
    if (this.weather === 'rain') { g.fillStyle = `rgba(40,50,70,${(0.35 * this.amt).toFixed(2)})`; g.fillRect(0, 0, N, N); }
    // the far shore: sea for 'sea', a stream glinting for 'stream'
    const base = night > 0.5 ? 0.35 : 1;
    if (this.weather === 'sea') {
      for (let y = 30; y < N; y++) {
        g.fillStyle = y === 30 ? '#cfe8ff' : y < 36 ? '#3a8cbc' : '#28699a';
        g.fillRect(0, y, N, 1);
      }
      g.fillStyle = '#e8f6ff';
      for (let i = 0; i < 10; i++) { const x = Math.round((i * 9 + this.t * (6 + (i % 3) * 3)) % (N + 6)) - 3, y = 32 + (i % 5) * 3; g.fillRect(x, y, 3, 1); }
      g.globalAlpha = night > 0.5 ? 0.55 : 0; g.fillStyle = '#0a1030'; g.fillRect(0, 30, N, 18); g.globalAlpha = 1;
    } else {
      // distant canopy and trunks
      for (let x = 0; x < N; x++) {
        const hh = 12 + Math.round(Math.sin(x * 0.3) * 2 + Math.sin(x * 0.71 + 2) * 2 + hash(x >> 2, 3) * 3);
        for (let y = N - hh; y < N; y++) {
          const c = y < N - hh + 2 ? [90, 160, 70] : y < N - 6 ? [58, 118, 52] : [40, 88, 44];
          g.fillStyle = `rgb(${c.map((v) => Math.round(v * base * (night > 0.5 ? 0.55 : 1))).join(',')})`;
          g.fillRect(x, y, 1, 1);
        }
      }
      if (this.weather === 'stream') {
        for (let x = 0; x < N; x++) { const y = 42 + Math.round(Math.sin(x * 0.25) * 1.5); g.fillStyle = (x + Math.floor(this.t * 8)) % 6 === 0 ? '#e8f6ff' : '#4aa0d0'; g.fillRect(x, y, 1, 3); }
      }
    }
    // weather on top
    if (this.weather === 'rain') {
      g.fillStyle = `rgba(190,220,255,${(0.85 * this.amt).toFixed(2)})`;
      for (const d of this.drops) { const y = (d.y + this.t * d.v) % (N + 6) - 3; g.fillRect(Math.round((d.x - y * 0.25 + N) % N), Math.round(y), 1, 3); }
    } else if (this.weather === 'wind' || this.weather === 'snow') {
      for (let i = 0; i < 12; i++) {
        const x = (hash(i, 21) * N + this.t * (14 + i)) % (N + 4) - 2, y = (hash(i, 22) * N + Math.sin(this.t * 2 + i) * 4 + (this.weather === 'snow' ? this.t * 6 : 0)) % N;
        g.fillStyle = this.weather === 'snow' ? '#ffffff' : ['#6cb845', '#e2b84a', '#c9683f'][i % 3];
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
    }
    this.tex.needsUpdate = true;
  }

  dispose() { this.tex.dispose(); }
}
