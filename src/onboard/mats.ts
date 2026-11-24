// The office's materials: hand-painted pixel textures (tex.ts) on physically lit materials. Painted once,
// shared by every piece of furniture.
import * as THREE from 'three';
import { brass, C, cloth, fbm, hash, leather, lerpRamp, mix3, mul3, paper, ramp, rgb, smooth, Tex, tnoise, vnoise, wood, type RGB } from './tex.ts';
import { mat } from './kit.ts';

export interface OfficeMats {
  mahogany: THREE.MeshStandardMaterial; mahoganyDark: THREE.MeshStandardMaterial; walnut: THREE.MeshStandardMaterial; oak: THREE.MeshStandardMaterial;
  parquet: THREE.MeshStandardMaterial; wallpaper: THREE.MeshStandardMaterial; plaster: THREE.MeshStandardMaterial; rug: THREE.MeshStandardMaterial;
  deskLeather: THREE.MeshStandardMaterial; chairLeather: THREE.MeshStandardMaterial; chairPlain: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial; brassDark: THREE.MeshStandardMaterial; gilt: THREE.MeshStandardMaterial; chrome: THREE.MeshStandardMaterial;
  greenGlass: THREE.MeshStandardMaterial; glass: THREE.MeshPhysicalMaterial; water: THREE.MeshStandardMaterial; ivory: THREE.MeshStandardMaterial;
  blackLacquer: THREE.MeshStandardMaterial; paperStack: THREE.MeshStandardMaterial; slat: THREE.MeshStandardMaterial; ceramic: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; felt: THREE.MeshStandardMaterial; cord: THREE.MeshStandardMaterial;
  heartwood: THREE.MeshStandardMaterial;
  all: THREE.Material[]; textures: THREE.Texture[];
}

const T = (t: Tex, o: { repeat?: boolean; q?: number } = {}) => t.texture({ repeat: o.repeat ?? true, q: o.q ?? 56 });

/** Tileable hardwood: the painter runs on a torus so the edges meet. */
function tileWood(n: number, m: number, r: RGB[], seed: number, o: { scale?: number; contrast?: number; base?: number } = {}): Tex {
  const t = new Tex(n, m);
  wood(t, 0, 0, n, m, { ramp: r, seed, scale: o.scale ?? 1, contrast: o.contrast, base: o.base });
  // blend the seam: crossfade the last 24 columns/rows with the start
  const blend = 24;
  for (let y = 0; y < m; y++) for (let i = 0; i < blend; i++) { const k = i / blend, x = n - blend + i; t.set(x, y, mix3(t.get(x, y), t.get(i, y), k * k)); }
  for (let x = 0; x < n; x++) for (let i = 0; i < blend; i++) { const k = i / blend, y = m - blend + i; t.set(x, y, mix3(t.get(x, y), t.get(x, i), k * k)); }
  return t;
}

function parquet(): Tex {
  // oak chevron parquet: a 512 px tile (2 m); columns of 64 px (0.25 m) with planks at +-45 degrees, 16 px pitch
  const N = 512, t = new Tex(N, N), Cw = 64, P = 16, Lb = 96, NB = 24;
  const bank = new Tex(Lb, P * NB);
  for (let i = 0; i < NB; i++) wood(bank, 0, i * P, Lb, P, { ramp: C.oak, seed: 40 + i, base: 0.36 + hash(i, 3, 9) * 0.3, contrast: 0.9, scale: 0.7 });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = Math.floor(x / Cw), lx = x - c * Cw, dir = c % 2 ? -1 : 1;
    const tt = y + (dir > 0 ? lx : Cw - 1 - lx);
    const j = Math.floor(tt / P), across = tt - j * P;
    const id = Math.floor(hash(c, ((j % (N / P)) + N / P) % (N / P), 17) * NB);
    const along = Math.floor(lx * 1.41 + hash(c, j, 4) * 40) % Lb;
    let col = bank.get(along, id * P + across);
    if (across === 0) col = mul3(col, 0.5);
    else if (across === 1) col = mul3(col, 1.08);
    else if (across === P - 1) col = mul3(col, 0.82);
    if (lx === 0) col = mul3(col, 0.55);
    t.set(x, y, col);
  }
  return t;
}

function damask(): Tex {
  // emerald regency stripe wallpaper, 128 x 128 px tile (0.5 x 0.5 m): satin stripes with a woven diamond, dark
  // stripes edged with a hairline of gold
  const W = 128, H = 128, t = new Tex(W, H);
  const g = C.emerald;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = tnoise(x / 16, y / 16, W / 16, 3) * 0.6 + tnoise(x / 4, y / 4, W / 4, 4) * 0.4;
    const sx = x % 32;
    let k: number;
    if (sx < 20) {
      // satin stripe: a small woven diamond lattice
      const dx = Math.abs(((sx - 10) % 20)), dy = Math.abs(((y % 16) - 8));
      const dia = Math.abs(dx + dy - 7) < 0.8;
      k = 0.68 + (n - 0.5) * 0.12 + (dia ? 0.12 : 0) + (((x + y) & 1) ? 0.02 : -0.02);
    } else if (sx === 20 || sx === 31) k = -1;
    else k = 0.3 + (n - 0.5) * 0.1 + (sx === 21 || sx === 30 ? -0.06 : 0);
    if (k < 0) t.set(x, y, lerpRamp(C.gilt, 0.45 + (hash(x, y, 2) - 0.5) * 0.3));
    else t.set(x, y, ramp(g, k, x, y, 0.5));
  }
  return t;
}

function plaster(): Tex {
  const N = 128, t = new Tex(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = tnoise(x / 12, y / 12, N / 12 | 0, 7) * 0.6 + tnoise(x / 4, y / 4, N / 4, 8) * 0.4;
    t.set(x, y, mix3(rgb(0xc9b48e), rgb(0xdccaa4), n));
  }
  return t;
}

function persianRug(): Tex {
  // a Tabriz-style rug, 768 x 512 px for 3.9 x 2.6 m: a madder-red field with an all-over herati lattice, an indigo
  // lozenge medallion with corner spandrels, an indigo main border of rosettes on a running vine, guard stripes
  const W = 768, H = 512, t = new Tex(W, H);
  const red = [rgb(0x300a0b), rgb(0x481012), rgb(0x5e1716), rgb(0x721f1b), rgb(0x842a22)];
  const indigo = [rgb(0x0b0e26), rgb(0x121838), rgb(0x1a234c), rgb(0x24305e)];
  const ivory = [rgb(0x7a6a50), rgb(0x9a8a6a), rgb(0xb4a482), rgb(0xc8b894)];
  const gold = [rgb(0x523a14), rgb(0x6e5020), rgb(0x8a682c), rgb(0xa47e3a)];
  const teal = [rgb(0x0c2628), rgb(0x143a3a), rgb(0x1c4c4a)];
  const brown = rgb(0x24120c);
  const herati = (x: number, y: number, s: number): number => {
    // 0 ground, 1 rosette, 2 rosette heart, 3 leaf, 4 outline
    const u = (x + y) / s, v = (x - y) / s;
    const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
    const d = Math.hypot(fu, fv);
    if (d < 0.07) return 2;
    if (d < 0.15) return 1;
    if (d < 0.18) return 4;
    // lancet leaves along the cell diagonals (the lattice axes)
    const a = Math.abs(fu), b = Math.abs(fv);
    if ((a < 0.05 && b > 0.22 && b < 0.46) || (b < 0.05 && a > 0.22 && a < 0.46)) return 3;
    if ((a < 0.075 && b > 0.2 && b < 0.48) || (b < 0.075 && a > 0.2 && a < 0.48)) return 4;
    return 0;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ex = Math.min(x, W - 1 - x), ey = Math.min(y, H - 1 - y), e = Math.min(ex, ey);
    const wool = (vnoise(x * 0.45, y * 0.45, 3) - 0.5) * 0.14 + (fbm(x * 0.015, y * 0.015, 9) - 0.5) * 0.2;
    const knot = (y & 1 ? 0.025 : -0.025) + ((x >> 1) & 1 ? 0.01 : -0.01);
    const tone = 0.55 + wool + knot;
    let c: RGB;
    if (e < 4) c = ramp(ivory, tone - 0.1, x, y);
    else if (e < 7) c = brown;
    else if (e < 11) c = ramp(red, tone, x, y);
    else if (e < 13) c = ramp(ivory, tone, x, y);
    else if (e < 15) c = brown;
    else if (e < 51) {
      // main border: indigo, rosettes every 40 px on a running vine
      const along = ex <= ey ? y : x, depth = e - 15;
      const cxr = ((along % 40) + 40) % 40 - 20, cy = depth - 18;
      const ros = Math.hypot(cxr, cy);
      const vine = Math.abs(cy - Math.sin(along * Math.PI / 40) * 10) < 1.6;
      const petals = ros < 10 && Math.cos(Math.atan2(cy, cxr) * 8) > 0.2;
      if (ros < 3) c = ramp(gold, tone + 0.1, x, y);
      else if (ros < 5) c = ramp(red, tone + 0.1, x, y);
      else if (petals) c = ramp(ivory, tone, x, y);
      else if (ros < 11) c = brown;
      else if (vine) c = ramp(teal, tone + 0.2, x, y);
      else c = ramp(indigo, tone, x, y);
    } else if (e < 53) c = brown;
    else if (e < 57) c = ((x + y) >> 2) & 1 ? ramp(gold, tone, x, y) : ramp(red, tone, x, y);
    else if (e < 59) c = brown;
    else {
      const fx = (x - W / 2) / (W / 2 - 59), fy = (y - H / 2) / (H / 2 - 59);
      // the lozenge medallion (with pendants) and the corner spandrels
      const md = Math.abs(fx) / 0.3 + Math.abs(fy) / 0.46;
      const cd = Math.min(Math.abs(fx - 1), Math.abs(fx + 1)) / 0.32 + Math.min(Math.abs(fy - 1), Math.abs(fy + 1)) / 0.42;
      const h = herati(x, y, 30);
      if (md < 1) {
        if (md < 0.1) c = ramp(red, tone + 0.1, x, y);
        else if (md < 0.16) c = h === 1 ? ramp(gold, tone, x, y) : ramp(indigo, tone, x, y);
        else if (md < 0.22) c = brown;
        else if (md < 0.45) c = h === 1 || h === 3 ? ramp(ivory, tone, x, y) : h === 4 ? brown : ramp(red, tone + 0.05, x, y);
        else if (md < 0.5) c = ramp(ivory, tone, x, y);
        else if (md < 0.93) c = h === 1 ? ramp(gold, tone, x, y) : h === 3 ? ramp(teal, tone + 0.2, x, y) : h === 4 ? brown : ramp(indigo, tone, x, y);
        else c = brown;
      } else if (cd < 1) {
        c = cd > 0.92 ? brown : h === 1 ? ramp(ivory, tone, x, y) : h === 3 ? ramp(teal, tone + 0.2, x, y) : h === 4 ? brown : ramp(indigo, tone, x, y);
      } else {
        c = h === 2 ? ramp(gold, tone, x, y) : h === 1 ? ramp(ivory, tone - 0.05, x, y) : h === 3 ? ramp(teal, tone + 0.15, x, y) : h === 4 ? mix3(brown, red[1], 0.5) : ramp(red, tone, x, y);
      }
    }
    // gentle wear in the middle where feet go
    const wear = smooth(0.32, 0, Math.hypot((x - W * 0.5) / W, (y - H * 0.62) / H)) * 0.07;
    t.set(x, y, mul3(c, 1 + wear));
  }
  return t;
}

function deskLeather(): Tex {
  const t = new Tex(512, 256);
  leather(t, 0, 0, 512, 256, C.leatherGreen, { seed: 5, tool: 6, base: 0.55 });
  return t;
}
function tufted(): Tex {
  // oxblood chesterfield: diamond-tufted with deep buttons and creases, 256 x 512 for the chair back
  const W = 256, H = 512, t = new Tex(W, H), r = C.leatherRed;
  const sx = 42, sy = 48;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // distance to the nearest button on a diamond lattice
    const gx = x / sx, gy = y / sy;
    const row = Math.floor(gy + 0.5), off = row % 2 ? 0.5 : 0;
    let best = 9, bx = 0, by = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = row + dr, cc = Math.floor(gx - (rr % 2 ? 0.5 : 0) + 0.5) + dc;
      const px = (cc + (rr % 2 ? 0.5 : 0)) * sx, py = rr * sy;
      const d = Math.hypot(x - px, (y - py) * 0.9);
      if (d < best) { best = d; bx = px; by = py; }
    }
    void off;
    const puff = smooth(0, 26, best);
    // creases radiating from each button along the diamond diagonals
    const ang = Math.atan2(y - by, x - bx), diag = Math.abs(Math.sin(2 * ang));
    const crease = best < 22 && diag > 0.96 ? -0.22 * (1 - best / 22) : 0;
    const n = (fbm(x * 0.05, y * 0.05, 4) - 0.5) * 0.25 + (vnoise(x * 0.8, y * 0.8, 2) - 0.5) * 0.08;
    let k = 0.25 + puff * 0.55 + crease + n;
    if (best < 3.2) k = best < 1.6 ? 0.55 : 0.08;
    t.set(x, y, ramp(r, k, x, y, 0.6));
  }
  return t;
}
function plainLeather(r: RGB[], seed: number): Tex {
  const t = new Tex(256, 256);
  leather(t, 0, 0, 256, 256, r, { seed, base: 0.5 });
  return t;
}
function brassTex(): Tex { const t = new Tex(64, 64); brass(t, 0, 0, 64, 64); return t; }
function heartwood(): Tex {
  // the oak's living wood seen in the window reveal: rings and medullary rays
  const N = 256, t = new Tex(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - N * 0.5, y - N * 1.6) + (vnoise(x * 0.04, y * 0.04, 2) - 0.5) * 10;
    const ring = (d % 7) / 7;
    let k = 0.55 + (ring < 0.2 ? -0.15 : 0) + (fbm(x * 0.03, y * 0.03, 5) - 0.5) * 0.25;
    if (vnoise(Math.atan2(y - N * 1.6, x - N * 0.5) * 80, d * 0.05, 7) > 0.85) k += 0.08;
    t.set(x, y, ramp(C.oak, k, x, y));
  }
  return t;
}
function paperEdge(): Tex {
  // the side of a stack of paper: thin cream lines
  const t = new Tex(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) t.set(x, y, lerpRamp(C.paper, (y % 2 ? 0.55 : 0.85) + (hash(x >> 3, y, 2) - 0.5) * 0.15));
  return t;
}
function ceramic(): Tex {
  const t = new Tex(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const n = fbm(x * 0.05, y * 0.03, 8);
    t.set(x, y, mix3(rgb(0x1d4f5e), rgb(0x2f7a86), n + Math.sin(y * 0.4 + n * 4) * 0.1));
  }
  return t;
}
function soil(): Tex {
  const t = new Tex(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) t.set(x, y, ramp([rgb(0x1e140c), rgb(0x2e1f12), rgb(0x40301c), rgb(0x56432a)], 0.4 + (hash(x, y, 3) - 0.5) * 0.6 + (vnoise(x * 0.2, y * 0.2) - 0.5) * 0.4, x, y));
  return t;
}
function felt(): Tex { const t = new Tex(64, 64); cloth(t, 0, 0, 64, 64, rgb(0x214a35)); return t; }

export function officeMats(): OfficeMats {
  const textures: THREE.Texture[] = [];
  const tx = (t: Tex, o?: { repeat?: boolean; q?: number }) => { const x = T(t, o); textures.push(x); return x; };
  const mah = tx(tileWood(512, 512, C.mahogany, 3, { base: 0.5 }));
  const mahD = tx(tileWood(256, 256, C.mahogany, 9, { base: 0.36, contrast: 0.8 }));
  const wal = tx(tileWood(256, 256, C.walnut, 5, { base: 0.5 }));
  const oakT = tx(tileWood(256, 256, C.oak, 7, { base: 0.5 }));
  const s = 0.62;
  const out: Omit<OfficeMats, 'all' | 'textures'> = {
    mahogany: mat({ map: mah, roughness: 0.42, name: 'mahogany' }),
    mahoganyDark: mat({ map: mahD, roughness: 0.5, name: 'mahoganyDark' }),
    walnut: mat({ map: wal, roughness: 0.5, name: 'walnut' }),
    oak: mat({ map: oakT, roughness: 0.55, name: 'oak' }),
    parquet: mat({ map: tx(parquet()), roughness: 0.48, name: 'parquet' }),
    wallpaper: mat({ map: tx(damask()), roughness: 0.85, name: 'wallpaper' }),
    plaster: mat({ map: tx(plaster()), roughness: 0.95, name: 'plaster' }),
    rug: mat({ map: tx(persianRug(), { repeat: false }), roughness: 1, name: 'rug' }),
    deskLeather: mat({ map: tx(deskLeather(), { repeat: false }), roughness: s, name: 'deskLeather' }),
    chairLeather: mat({ map: tx(tufted(), { repeat: false }), roughness: 0.45, name: 'chairLeather' }),
    chairPlain: mat({ map: tx(plainLeather(C.leatherRed, 6)), roughness: 0.45, name: 'chairPlain' }),
    brass: mat({ map: tx(brassTex()), color: 0xffffff, metalness: 0.85, roughness: 0.32, name: 'brass' }),
    brassDark: mat({ map: tx(brassTex()), color: 0x9a8060, metalness: 0.8, roughness: 0.45, name: 'brassDark' }),
    gilt: mat({ color: 0xd9ab4a, metalness: 0.9, roughness: 0.35, name: 'gilt' }),
    chrome: mat({ color: 0xd8dde2, metalness: 1, roughness: 0.2, name: 'chrome' }),
    greenGlass: mat({ color: 0x1d7a45, emissive: 0x0a3a1c, roughness: 0.15, metalness: 0.1, name: 'greenGlass' }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe8f2ee, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, specularIntensity: 1, envMapIntensity: 1.4, depthWrite: false, name: 'glass' }),
    water: mat({ color: 0xb8d8d8, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false, name: 'water' }),
    ivory: mat({ color: 0xf0e6cf, roughness: 0.5, name: 'ivory' }),
    blackLacquer: mat({ color: 0x14110f, roughness: 0.18, metalness: 0.1, name: 'blackLacquer' }),
    paperStack: mat({ map: tx(paperEdge()), roughness: 0.9, name: 'paperStack' }),
    slat: mat({ color: 0xeadfc6, roughness: 0.55, name: 'slat' }),
    ceramic: mat({ map: tx(ceramic()), roughness: 0.2, name: 'ceramic' }),
    soil: mat({ map: tx(soil()), roughness: 1, name: 'soil' }),
    rubber: mat({ color: 0x2a1d18, roughness: 0.9, name: 'rubber' }),
    felt: mat({ map: tx(felt()), roughness: 1, name: 'felt' }),
    cord: mat({ color: 0xd8c9a4, roughness: 0.9, name: 'cord' }),
    heartwood: mat({ map: tx(heartwood()), roughness: 0.7, name: 'heartwood' }),
  };
  return { ...out, all: Object.values(out), textures };
}
export { paper, rgb };
