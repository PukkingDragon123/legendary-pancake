// Real-material textures for the interface, painted at device resolution when the app starts:
// laid paper with fibres, walnut with long grain, linen weave, pebbled leather, wool felt and night
// velvet. They tile seamlessly and are exposed as CSS custom properties (--tx-paper etc.), so every
// surface in the UI is a material, not a flat colour.

const hashf = (x: number, y: number, s: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Tileable value noise with period `p` cells. */
function tnoise(x: number, y: number, p: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const w = (a: number) => ((a % p) + p) % p;
  const a = hashf(w(xi), w(yi), s), b = hashf(w(xi + 1), w(yi), s), c = hashf(w(xi), w(yi + 1), s), d = hashf(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
function fbm(x: number, y: number, p: number, s: number, oct = 4) {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { v += tnoise(x * f, y * f, p * f, s + o * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
  return v / n;
}
const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function paint(size: number, f: (x: number, y: number, u: number, v: number) => [number, number, number, number?]): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, gg, b, a] = f(x, y, x / size, y / size);
    const i = (y * size + x) * 4;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a ?? 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** Overlay strokes drawn with canvas paths after the pixel pass (fibres, threads). */
function strokesOn(url: string, size: number, draw: (g: CanvasRenderingContext2D) => void): Promise<string> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d')!;
      g.drawImage(im, 0, 0);
      draw(g);
      res(c.toDataURL('image/png'));
    };
    im.src = url;
  });
}

export async function installTextures() {
  const dpr = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1)));
  const S = 256 * dpr;
  const root = document.documentElement.style;

  // paper: warm cream, gentle mottling, darker flecks, fine fibres
  const P = hex('#f8efdc');
  let paper = paint(S, (x, y, u, v) => {
    const m = fbm(u * 6, v * 6, 6, 3) - 0.5, fine = (hashf(x, y, 9) - 0.5) * 6;
    const k = 1 + m * 0.07;
    const fleck = hashf(x >> 1, y >> 1, 4) > 0.9985 ? -38 : 0;
    return [P[0] * k + fine + fleck, P[1] * k + fine + fleck, P[2] * k + fine * 0.8 + fleck];
  });
  paper = await strokesOn(paper, S, (g) => {
    for (let i = 0; i < 260 * dpr; i++) {
      const x = hashf(i, 1, 2) * S, y = hashf(i, 2, 2) * S, a = hashf(i, 3, 2) * Math.PI, l = (6 + hashf(i, 4, 2) * 18) * dpr;
      g.strokeStyle = hashf(i, 5, 2) > 0.5 ? 'rgba(150,120,80,0.10)' : 'rgba(255,255,255,0.22)';
      g.lineWidth = 0.6 * dpr;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (hashf(i, 6, 2) - 0.5) * 4 * dpr, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  });

  // walnut: horizontal boards, long wavy grain, an occasional knot
  const W0 = hex('#5b3620'), W1 = hex('#8a5631');
  const wood = paint(S, (x, y, u, v) => {
    const board = Math.floor(v * 4), bv = v * 4 - board;
    const warp = fbm(u * 3 + board * 3.1, v * 2, 3, 11) * 2.2;
    const knot = Math.hypot(u - hashf(board, 1, 5), (bv - 0.5) * 0.25);
    const ring = Math.sin((v * 44 + warp * 6 + (knot < 0.08 ? (0.08 - knot) * 90 : 0)) * 1.2) * 0.5 + 0.5;
    let t = 0.35 + ring * 0.35 + (fbm(u * 18, v * 3, 18, 7) - 0.5) * 0.35 + (hashf(board, 7, 3) - 0.5) * 0.25;
    if (bv < 0.012 || bv > 0.988) t = 0.02;
    else if (bv < 0.04) t += 0.18;
    t = Math.max(0, Math.min(1, t));
    return [W0[0] + (W1[0] - W0[0]) * t, W0[1] + (W1[1] - W0[1]) * t, W0[2] + (W1[2] - W0[2]) * t];
  });

  // light oak for shelves and frames
  const O0 = hex('#a36d3c'), O1 = hex('#d6a464');
  const oak = paint(S, (x, y, u, v) => {
    const warp = fbm(u * 2, v * 4, 2, 21) * 2.5;
    const ring = Math.sin((u * 60 + warp * 7) * 1.1) * 0.5 + 0.5;
    const t = Math.max(0, Math.min(1, 0.4 + ring * 0.3 + (fbm(u * 4, v * 30, 4, 5) - 0.5) * 0.4));
    return [O0[0] + (O1[0] - O0[0]) * t, O0[1] + (O1[1] - O0[1]) * t, O0[2] + (O1[2] - O0[2]) * t];
  });

  // linen weave (neutral: tinted with a colour in CSS via background-blend)
  const linen = paint(S, (x, y) => {
    const tx = Math.floor(x / dpr), ty = Math.floor(y / dpr);
    const warp = (tx % 3 === 0 ? -14 : 0) + (hashf(tx, 0, 31) - 0.5) * 16;
    const weft = (ty % 3 === 0 ? -14 : 0) + (hashf(0, ty, 32) - 0.5) * 16;
    const over = ((tx >> 1) + (ty >> 1)) % 2 ? warp : weft;
    const n = 226 + over + (hashf(x, y, 33) - 0.5) * 10;
    return [n, n - 4, n - 12];
  });

  // pebbled leather for the journal cover
  const L = hex('#6e3d26');
  const leather = paint(S, (x, y, u, v) => {
    const cell = fbm(u * 40, v * 40, 40, 41, 2);
    const crease = Math.abs(fbm(u * 3, v * 3, 3, 43) - 0.5) < 0.012 ? -18 : 0;
    const k = 0.82 + cell * 0.32 + (fbm(u * 5, v * 5, 5, 44) - 0.5) * 0.18;
    return [L[0] * k + crease, L[1] * k + crease, L[2] * k + crease];
  });

  // wool felt (dock lining)
  const F = hex('#2f3a2c');
  const felt = paint(S, (x, y, u, v) => {
    const k = 0.86 + (hashf(x, y, 51) - 0.5) * 0.28 + (fbm(u * 10, v * 10, 10, 52) - 0.5) * 0.25;
    return [F[0] * k, F[1] * k, F[2] * k];
  });

  // night velvet: deep blue with a soft sheen and the faintest stars
  const N = hex('#18203f');
  const velvet = paint(S, (x, y, u, v) => {
    const k = 0.9 + (fbm(u * 4, v * 4, 4, 61) - 0.5) * 0.35 + (hashf(x, y, 62) - 0.5) * 0.06;
    const star = hashf(x, y, 63) > 0.9993 ? 120 : 0;
    return [N[0] * k + star, N[1] * k + star, N[2] * k + star];
  });

  // cork for the pinboard
  const C = hex('#b88a55');
  const cork = paint(S, (x, y, u, v) => {
    const k = 0.75 + hashf(x >> 1, y >> 1, 71) * 0.4 + (fbm(u * 16, v * 16, 16, 72) - 0.5) * 0.3;
    return [C[0] * k, C[1] * k, C[2] * k];
  });

  const sz = `${256}px ${256}px`;
  for (const [k, url] of Object.entries({ paper, wood, oak, linen, leather, felt, velvet, cork })) root.setProperty(`--tx-${k}`, `url(${url})`);
  root.setProperty('--tx-size', sz);
}
