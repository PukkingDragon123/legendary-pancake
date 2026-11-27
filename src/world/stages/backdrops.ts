// [profile] The photo studio's backdrop plates: what replaces the green screen in the keyed portrait. Each is painted
// once on a 2D canvas (512 px square, the size the studio keys at) like a real photographic background plate shot
// with a portrait lens: the far things soft (blurred by distance, as a shallow depth of field would), bokeh discs
// with bright rims where a light is out of focus, a warm key from the upper left like everything else in the game.
//   forest  a moonlit pine wood: four layers of trees thinning into mist, a low moon, fireflies out of focus
//   moon    a big full moon with its seas, rayed craters and limb darkening, a wisp of cloud, faint stars
//   stars   the Milky Way across a deep sky with dust lanes, coloured stars, a tree line at the bottom
//   meadow  a summer meadow: blue sky and cumulus, a hazy tree line, buttercups and daisies out of focus
//   oak     Pip's old oak up close: real bark (the house's bark scan), moss, a round lit window, sunlit woods
//   dusk    golden hour over the hills: a low sun, lit cloud bands, layered violet ridges
//   and six seamless paper rolls (cream, sage, rose, sky, plum, midnight) with a soft spot of light behind the owl.
const N = 512;

export interface Backdrop { id: string; name: string; plain?: string; night?: boolean }
export const BACKDROPS: Backdrop[] = [
  { id: 'forest', name: 'Moonlit wood', night: true },
  { id: 'moon', name: 'Full moon', night: true },
  { id: 'stars', name: 'Starry sky', night: true },
  { id: 'meadow', name: 'Summer meadow' },
  { id: 'oak', name: 'The old oak' },
  { id: 'dusk', name: 'Golden hour' },
  { id: 'cream', name: 'Cream paper', plain: '#e8dac0' },
  { id: 'sage', name: 'Sage paper', plain: '#9db297' },
  { id: 'rose', name: 'Rose paper', plain: '#d8a19c' },
  { id: 'sky', name: 'Sky paper', plain: '#94bddb' },
  { id: 'plum', name: 'Plum paper', plain: '#5e3f67' },
  { id: 'ink', name: 'Midnight paper', plain: '#1c2338' },
];
export const BACKDROP_BY_ID: Record<string, Backdrop> = Object.fromEntries(BACKDROPS.map((b) => [b.id, b]));

// ------------------------------------------------------------------ helpers

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const h2 = (x: number, y: number, s: number) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vn(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number, o = 4) { let t = 0, a = 1, n = 0, f = 1; for (let i = 0; i < o; i++) { t += vn(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2.03; } return t / n; }
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
type C3 = [number, number, number];
const hexc = (h: string): C3 => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a: C3, b: C3, t: number): C3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: C3, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function canvas(n = N): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return [c, c.getContext('2d')!];
}
/** A soft blur that works everywhere (no ctx.filter): down-sample in halving steps, then scale back up smoothly. */
function blurred(src: HTMLCanvasElement, r: number): HTMLCanvasElement {
  if (r <= 0.5) return src;
  const W = src.width, H = src.height;
  let cur = src, w = W, h = H;
  const steps = Math.max(1, Math.round(Math.log2(r * 1.6)));
  for (let i = 0; i < steps; i++) {
    w = Math.max(2, Math.round(w / 2)); h = Math.max(2, Math.round(h / 2));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, w, h);
    cur = c;
  }
  for (let i = 0; i < steps; i++) {
    w = Math.min(W, w * 2); h = Math.min(H, h * 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, w, h);
    cur = c;
  }
  return cur;
}
/** paint a layer on its own canvas, blur it by `r` px and lay it down */
function layer(g: CanvasRenderingContext2D, r: number, paint: (lg: CanvasRenderingContext2D) => void, alpha = 1) {
  const [c, lg] = canvas(g.canvas.width);
  paint(lg);
  g.save(); g.globalAlpha = alpha; g.drawImage(blurred(c, r), 0, 0, g.canvas.width, g.canvas.height); g.restore();
}
function vgrad(g: CanvasRenderingContext2D, stops: [number, string][], y0 = 0, y1 = N) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
}
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: C3, a: number, comp: GlobalCompositeOperation = 'lighter') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.35, rgba(c, a * 0.45)); gr.addColorStop(1, rgba(c, 0));
  g.save(); g.globalCompositeOperation = comp; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
/** an out-of-focus point of light: a disc a touch brighter at its rim, with a soft edge */
function bokeh(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: C3, a: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a * 0.7)); gr.addColorStop(0.78, rgba(c, a * 0.82)); gr.addColorStop(0.9, rgba(mixc(c, [255, 255, 255], 0.25), a)); gr.addColorStop(1, rgba(c, 0));
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
}
/** the lens: a soft vignette and a whisper of grain (so plates don't band) */
function finish(g: CanvasRenderingContext2D, vig = 0.35, grain = 5, seed = 1) {
  const gr = g.createRadialGradient(N * 0.5, N * 0.46, N * 0.25, N * 0.5, N * 0.5, N * 0.75);
  gr.addColorStop(0, 'rgba(10,8,16,0)'); gr.addColorStop(1, `rgba(10,8,16,${vig})`);
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  const im = g.getImageData(0, 0, N, N), d = im.data, r = rng(seed * 7919);
  for (let i = 0; i < d.length; i += 4) { const k = (r() - 0.5) * grain; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  g.putImageData(im, 0, 0);
}

// ------------------------------------------------------------------ trees

/** a pine silhouette: a trunk and tiers of drooping, ragged branches */
function pine(g: CanvasRenderingContext2D, x: number, base: number, h: number, w: number, r: () => number) {
  g.beginPath();
  g.moveTo(x - w * 0.04, base); g.lineTo(x - w * 0.03, base - h * 0.2); g.lineTo(x + w * 0.03, base - h * 0.2); g.lineTo(x + w * 0.04, base); g.fill();
  const tiers = 7 + Math.floor(r() * 4);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, y = base - h * (0.12 + t * 0.86), ww = w * (1 - t) * (0.85 + r() * 0.3) * 0.5;
    g.beginPath();
    g.moveTo(x, y - h * 0.11);
    const n = 6;
    for (let k = 0; k <= n; k++) { const u = k / n, px = x - ww * u, py = y - h * 0.11 + h * 0.13 * u + (k % 2 ? h * 0.025 * r() : 0); g.lineTo(px + (r() - 0.5) * w * 0.06, py); }
    for (let k = n; k >= 0; k--) { const u = k / n, px = x + ww * u, py = y - h * 0.11 + h * 0.13 * u + (k % 2 ? h * 0.025 * r() : 0); g.lineTo(px + (r() - 0.5) * w * 0.06, py); }
    g.closePath(); g.fill();
  }
}
/** a broadleaf silhouette: a trunk forking into a lumpy crown */
function broad(g: CanvasRenderingContext2D, x: number, base: number, h: number, w: number, r: () => number) {
  g.beginPath(); g.moveTo(x - w * 0.06, base); g.quadraticCurveTo(x - w * 0.03, base - h * 0.4, x - w * 0.1, base - h * 0.62); g.lineTo(x + w * 0.1, base - h * 0.62); g.quadraticCurveTo(x + w * 0.03, base - h * 0.4, x + w * 0.06, base); g.fill();
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = r() * 0.32; g.beginPath(); g.arc(x + Math.cos(a) * w * d, base - h * (0.66 + Math.sin(a) * d * 0.5), w * (0.16 + r() * 0.14), 0, Math.PI * 2); g.fill(); }
}

// ------------------------------------------------------------------ the plates

function forest(g: CanvasRenderingContext2D) {
  vgrad(g, [[0, '#08122a'], [0.45, '#18304f'], [0.72, '#2f5175'], [1, '#1a2c44']]);
  const mx = N * 0.7, my = N * 0.2;
  glow(g, mx, my, N * 0.55, [150, 180, 230], 0.28);
  layer(g, 3, (lg) => { lg.fillStyle = '#f6f2e0'; lg.beginPath(); lg.arc(mx, my, N * 0.045, 0, Math.PI * 2); lg.fill(); });
  glow(g, mx, my, N * 0.12, [230, 236, 255], 0.5);
  const cols = ['#3a5d80', '#29486a', '#1b3352', '#10213a', '#08121f'];
  const blur = [7, 6, 5, 4, 3.5];
  for (let L = 0; L < 5; L++) {
    const r = rng(101 + L * 31), base = N * (0.66 + L * 0.075), h = N * (0.34 + L * 0.1), n = 14 - L * 2;
    layer(g, blur[L], (lg) => {
      lg.fillStyle = cols[L];
      for (let i = 0; i < n; i++) {
        const x = (i + r() * 0.8) / n * N * 1.1 - N * 0.05;
        if (L === 4 && x > N * 0.25 && x < N * 0.75) continue; // the nearest trees frame the sides
        (r() < 0.78 ? pine : broad)(lg, x, base + r() * N * 0.03, h * (0.7 + r() * 0.5), N * (0.12 + L * 0.03) * (0.8 + r() * 0.4), r);
      }
      lg.fillRect(0, base, N, N - base);
    });
    // mist between the layers
    if (L < 4) { const y = base - N * 0.02; const gr = g.createLinearGradient(0, y - N * 0.08, 0, y + N * 0.04); gr.addColorStop(0, 'rgba(150,180,215,0)'); gr.addColorStop(0.6, 'rgba(150,180,215,0.16)'); gr.addColorStop(1, 'rgba(150,180,215,0)'); g.fillStyle = gr; g.fillRect(0, y - N * 0.08, N, N * 0.12); }
  }
  // moonlight catching the mist on the left, the forest floor in shadow
  const r = rng(7);
  for (let i = 0; i < 46; i++) {
    const x = r() * N, y = N * (0.35 + r() * 0.6), big = r();
    bokeh(g, x, y, 2 + big * big * 11, mixc([255, 226, 120], [190, 255, 150], r() * 0.4), 0.25 + (1 - big) * 0.45);
  }
  finish(g, 0.42, 5, 1);
}

function moon(g: CanvasRenderingContext2D) {
  vgrad(g, [[0, '#04060f'], [0.6, '#0b1228'], [1, '#18223f']]);
  const r = rng(3);
  for (let i = 0; i < 260; i++) { const b = r(); g.fillStyle = `rgba(240,240,255,${0.15 + b * b * 0.7})`; g.fillRect(r() * N, r() * N, b > 0.92 ? 1.6 : 1, b > 0.92 ? 1.6 : 1); }
  const cx = N * 0.6, cy = N * 0.42, R = N * 0.3;
  glow(g, cx, cy, R * 2.1, [170, 190, 240], 0.32);
  // the disc, per pixel: maria, rayed craters, limb darkening, lit a touch from the upper left
  const x0 = Math.floor(cx - R - 2), y0 = Math.floor(cy - R - 2), S = Math.ceil(R * 2 + 4);
  const im = g.getImageData(x0, y0, S, S), d = im.data;
  const seas: [number, number, number, number][] = [[-0.38, -0.32, 0.34, 0.26], [-0.05, -0.38, 0.2, 0.17], [0.18, -0.08, 0.24, 0.2], [-0.55, 0.12, 0.3, 0.42], [0.3, 0.3, 0.16, 0.13], [-0.18, 0.05, 0.18, 0.14], [0.48, -0.32, 0.12, 0.1]];
  const craters: [number, number, number][] = [];
  const cr = rng(11);
  for (let i = 0; i < 90; i++) { const a = cr() * Math.PI * 2, rr = Math.sqrt(cr()) * 0.95; craters.push([Math.cos(a) * rr, Math.sin(a) * rr, 0.012 + cr() ** 3 * 0.07]); }
  const tycho: [number, number] = [-0.12, 0.62];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const u = (x0 + px + 0.5 - cx) / R, v = (y0 + py + 0.5 - cy) / R, rr = Math.hypot(u, v);
    if (rr > 1.004) continue;
    const cov = clamp((1.004 - rr) * R * 0.9);
    let alb = 0.86 + (fbm(u * 6, v * 6, 5, 4) - 0.5) * 0.12;
    for (const [sx, sy, ax, ay] of seas) { const q = ((u - sx) / ax) ** 2 + ((v - sy) / ay) ** 2 + (fbm(u * 4 + sx * 9, v * 4, 9, 3) - 0.5) * 1.4; alb -= sstep(1.2, 0.5, q) * 0.3; }
    for (const [qx, qy, qr] of craters) { const dd = Math.hypot(u - qx, v - qy) / qr; if (dd < 1.25) { alb += (dd < 0.8 ? -0.05 : 0) + sstep(1.25, 1.0, dd) * sstep(0.8, 1.0, dd) * 0.08 * Math.sign(-(u - qx) - (v - qy) + 0.0001); } }
    // Tycho's rays
    const ta = Math.atan2(v - tycho[1], u - tycho[0]), td = Math.hypot(u - tycho[0], v - tycho[1]);
    alb += Math.pow(Math.abs(Math.sin(ta * 9 + 1.3)), 30) * sstep(0.9, 0.05, td) * 0.12 + sstep(0.06, 0.02, td) * 0.15;
    const mu = Math.sqrt(Math.max(0, 1 - rr * rr)), limb = 0.62 + 0.38 * Math.pow(mu, 0.45), side = 1 + (-u * 0.06 - v * 0.04);
    const L = clamp(alb * limb * side, 0, 1.1);
    const c = mixc([186, 190, 206], [246, 240, 222], clamp(L));
    const i4 = (py * S + px) * 4;
    d[i4] = d[i4] * (1 - cov) + c[0] * L * cov * 1.05; d[i4 + 1] = d[i4 + 1] * (1 - cov) + c[1] * L * cov * 1.04; d[i4 + 2] = d[i4 + 2] * (1 - cov) + c[2] * L * cov;
  }
  g.putImageData(im, x0, y0);
  // a wisp of cloud drifting under the moon, lit from above
  layer(g, 9, (lg) => {
    const cr2 = rng(19);
    for (let i = 0; i < 26; i++) { const x = N * (0.15 + cr2() * 0.85), y = N * (0.66 + (cr2() - 0.5) * 0.1 + (x / N) * -0.08); lg.fillStyle = `rgba(${120 + cr2() * 40},${130 + cr2() * 40},${170 + cr2() * 30},${0.25 + cr2() * 0.3})`; lg.beginPath(); lg.ellipse(x, y, N * (0.06 + cr2() * 0.1), N * (0.02 + cr2() * 0.02), 0, 0, Math.PI * 2); lg.fill(); }
  }, 0.9);
  finish(g, 0.38, 4, 2);
}

function stars(g: CanvasRenderingContext2D) {
  vgrad(g, [[0, '#03050c'], [0.55, '#0a1230'], [0.85, '#1d2748'], [1, '#2e2a44']]);
  // the Milky Way: a diagonal band of glow with dust lanes, warm in the core, blue at the edges
  const im = g.getImageData(0, 0, N, N), d = im.data;
  const ax = -0.62, ay = 0.78; // band direction (normalised below)
  const al = Math.hypot(ax, ay), dx = ax / al, dy = ay / al;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N - 0.55, v = y / N - 0.45;
    const across = u * dy - v * dx, along = u * dx + v * dy;
    const w = 0.16 + (fbm(along * 3, 0.5, 21, 3) - 0.5) * 0.12;
    const band = Math.exp(-((across / w) ** 2)) * (0.55 + fbm(x / 60, y / 60, 4, 5) * 0.9);
    const dust = sstep(0.45, 0.7, fbm(x / 34 + 3, y / 34, 8, 4)) * Math.exp(-((across / (w * 0.45)) ** 2)) * 0.85;
    const k = Math.max(0, band * (1 - dust)) * 0.55 * sstep(0.98, 0.7, y / N);
    const core = Math.exp(-((along + 0.1) ** 2) / 0.06);
    const c = mixc([120, 140, 210], [236, 214, 190], core * 0.8);
    const i = (y * N + x) * 4;
    d[i] += c[0] * k * 0.55; d[i + 1] += c[1] * k * 0.55; d[i + 2] += c[2] * k * 0.6;
  }
  g.putImageData(im, 0, 0);
  const r = rng(5);
  for (let i = 0; i < 1500; i++) {
    const x = r() * N, y = r() * N * 0.92, b = Math.pow(r(), 3.2);
    g.fillStyle = rgba(mixc([200, 214, 255], [255, 230, 196], r()), clamp(0.18 + b * 1.2));
    const s = 0.6 + b * 1.4; g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  for (let i = 0; i < 22; i++) {
    const x = r() * N, y = r() * N * 0.8, c = mixc([170, 196, 255], [255, 210, 160], r());
    glow(g, x, y, 6 + r() * 10, c, 0.5);
    g.fillStyle = rgba(mixc(c, [255, 255, 255], 0.6), 1); g.beginPath(); g.arc(x, y, 0.9 + r() * 0.9, 0, Math.PI * 2); g.fill();
  }
  // the horizon: a faint warm glow and the black edge of the wood
  glow(g, N * 0.3, N * 1.02, N * 0.6, [120, 80, 90], 0.4);
  layer(g, 1.5, (lg) => {
    lg.fillStyle = '#04060b';
    const tr = rng(77);
    for (let i = 0; i < 22; i++) (tr() < 0.7 ? pine : broad)(lg, (i / 22) * N * 1.1 - 10, N * 0.97, N * (0.1 + tr() * 0.12), N * 0.06, tr);
    lg.fillRect(0, N * 0.96, N, N * 0.04);
  });
  finish(g, 0.3, 4, 3);
}

function meadow(g: CanvasRenderingContext2D) {
  vgrad(g, [[0, '#3f87cf'], [0.42, '#86bfe6'], [0.58, '#cfe6ef'], [1, '#cfe6ef']]);
  // soft cumulus, white tops and blue-grey bellies
  layer(g, 6, (lg) => {
    const r = rng(41);
    for (let c = 0; c < 4; c++) {
      const cx = N * (0.1 + c * 0.28 + r() * 0.08), cy = N * (0.18 + r() * 0.16), s = N * (0.07 + r() * 0.05);
      for (let i = 0; i < 12; i++) { const x = cx + (r() - 0.5) * s * 3, y = cy + (r() - 0.5) * s * 0.8; const gr = lg.createRadialGradient(x, y - s * 0.3, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(226,236,248,0.8)'); gr.addColorStop(1, 'rgba(200,214,232,0)'); lg.fillStyle = gr; lg.beginPath(); lg.arc(x, y, s, 0, Math.PI * 2); lg.fill(); }
    }
  });
  // a hazy tree line
  layer(g, 7, (lg) => {
    const r = rng(9);
    lg.fillStyle = '#5f7f5a';
    for (let i = 0; i < 24; i++) broad(lg, (i / 24) * N * 1.1, N * 0.6, N * (0.12 + r() * 0.1), N * 0.12, r);
    lg.fillRect(0, N * 0.58, N, N * 0.1);
  });
  // the meadow: warm sunlit grass running towards us, out of focus
  layer(g, 4, (lg) => {
    const gr = lg.createLinearGradient(0, N * 0.6, 0, N);
    gr.addColorStop(0, '#b8cf74'); gr.addColorStop(0.35, '#8fb24e'); gr.addColorStop(1, '#4d7a2a');
    lg.fillStyle = gr; lg.fillRect(0, N * 0.6, N, N * 0.4);
    const r = rng(13);
    for (let i = 0; i < 900; i++) {
      const y = N * (0.6 + Math.pow(r(), 0.8) * 0.4), x = r() * N, h = (y - N * 0.55) * (0.08 + r() * 0.14);
      lg.strokeStyle = rgba(mixc([70, 110, 40], [214, 226, 128], r()), 0.5); lg.lineWidth = 1 + (y / N) * 1.5;
      lg.beginPath(); lg.moveTo(x, y); lg.quadraticCurveTo(x + (r() - 0.5) * h * 0.5, y - h * 0.6, x + (r() - 0.5) * h * 0.6, y - h); lg.stroke();
    }
  });
  // flowers out of focus: smaller and sharper far off, big soft discs close by
  const r = rng(17), cols: C3[] = [[255, 222, 70], [255, 252, 240], [240, 160, 196], [255, 200, 60]];
  for (let i = 0; i < 70; i++) {
    const t = Math.pow(r(), 1.6), y = N * (0.62 + t * 0.4), x = r() * N;
    bokeh(g, x, y, 1.5 + t * 13, cols[Math.floor(r() * cols.length)], 0.35 + (1 - t) * 0.4);
  }
  glow(g, N * 0.05, N * 0.02, N * 0.75, [255, 236, 190], 0.35, 'screen');
  finish(g, 0.26, 4, 4);
}

let barkImg: HTMLImageElement | null = null;
let barkReady: Promise<void> | null = null;
/** the house's bark scan (public/models/house/tex/bark.webp), for the oak plate */
export function loadBark(): Promise<void> {
  if (barkReady) return barkReady;
  barkReady = new Promise((res) => {
    if (typeof Image === 'undefined') { res(); return; }
    const im = new Image();
    im.onload = () => { barkImg = im; res(); };
    im.onerror = () => res();
    im.src = `${import.meta.env.BASE_URL}models/house/tex/bark.webp`;
  });
  return barkReady;
}

function oak(g: CanvasRenderingContext2D) {
  // sunlit woods beyond the trunk: green and gold, well out of focus
  vgrad(g, [[0, '#9cc56a'], [0.5, '#6e9a45'], [1, '#3d5f2a']]);
  const r = rng(23);
  layer(g, 8, (lg) => { for (let i = 0; i < 40; i++) { lg.fillStyle = rgba(mixc([46, 80, 30], [190, 210, 110], r()), 0.7); lg.beginPath(); lg.arc(r() * N * 0.4, r() * N, N * (0.04 + r() * 0.08), 0, Math.PI * 2); lg.fill(); } });
  for (let i = 0; i < 18; i++) bokeh(g, r() * N * 0.3, r() * N * 0.9, 4 + r() * 12, [255, 244, 190], 0.35);
  // the trunk: bark scan (or painted ridges), shaded as a great cylinder lit from the left
  const x0 = N * 0.2, x1 = N * 1.15;
  layer(g, 2, (lg) => {
    lg.save();
    lg.beginPath(); lg.moveTo(x0 + N * 0.03, 0); lg.bezierCurveTo(x0 - N * 0.02, N * 0.4, x0 + N * 0.02, N * 0.7, x0 - N * 0.06, N); lg.lineTo(N, N); lg.lineTo(N, 0); lg.closePath(); lg.clip();
    if (barkImg) {
      const tw = N * 0.55, th = tw * (barkImg.height / barkImg.width);
      for (let y = -th; y < N + th; y += th) for (let x = x0 - tw; x < N; x += tw) lg.drawImage(barkImg, x, y, tw, th);
    } else {
      const im = lg.getImageData(0, 0, N, N), d = im.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = fbm(x / 9, y / 70, 31, 4), rid = Math.pow(Math.abs(Math.sin(x / 7 + fbm(x / 40, y / 40, 2, 2) * 6)), 0.6); const k = 0.35 + v * 0.5 * rid; const i = (y * N + x) * 4; d[i] = 112 * k + 30; d[i + 1] = 92 * k + 24; d[i + 2] = 72 * k + 18; d[i + 3] = 255; }
      lg.putImageData(im, 0, 0);
    }
    // cylinder shading: light on the left flank, falling into shadow on the right
    const sh = lg.createLinearGradient(x0, 0, x1, 0);
    sh.addColorStop(0, 'rgba(255,236,200,0.18)'); sh.addColorStop(0.12, 'rgba(255,236,200,0.06)'); sh.addColorStop(0.45, 'rgba(20,14,10,0.05)'); sh.addColorStop(1, 'rgba(14,10,16,0.62)');
    lg.fillStyle = sh; lg.fillRect(0, 0, N, N);
    // moss creeping up from the roots, and on the ridges
    const mr = rng(29);
    for (let i = 0; i < 240; i++) { const y = N * (0.55 + Math.pow(mr(), 0.7) * 0.45), x = x0 + mr() * (N - x0); lg.fillStyle = rgba(mixc([60, 96, 30], [140, 176, 60], mr()), 0.35 + mr() * 0.3); lg.beginPath(); lg.ellipse(x, y, 3 + mr() * 9, 2 + mr() * 5, mr(), 0, Math.PI * 2); lg.fill(); }
    lg.restore();
  });
  // a round window in the trunk, lamplit within
  const wx = N * 0.64, wy = N * 0.34, wr = N * 0.13;
  layer(g, 2.5, (lg) => {
    lg.fillStyle = '#1a0f08'; lg.beginPath(); lg.arc(wx + 4, wy + 5, wr * 1.12, 0, Math.PI * 2); lg.fill();
    const gl = lg.createRadialGradient(wx - wr * 0.2, wy - wr * 0.2, 0, wx, wy, wr);
    gl.addColorStop(0, '#ffe3a0'); gl.addColorStop(0.6, '#f2a94e'); gl.addColorStop(1, '#a8571e');
    lg.fillStyle = gl; lg.beginPath(); lg.arc(wx, wy, wr, 0, Math.PI * 2); lg.fill();
    lg.strokeStyle = '#3a220f'; lg.lineWidth = wr * 0.09;
    lg.beginPath(); lg.moveTo(wx - wr, wy); lg.lineTo(wx + wr, wy); lg.moveTo(wx, wy - wr); lg.lineTo(wx, wy + wr); lg.stroke();
    lg.strokeStyle = '#6a4626'; lg.lineWidth = wr * 0.16; lg.beginPath(); lg.arc(wx, wy, wr * 1.04, 0, Math.PI * 2); lg.stroke();
  });
  glow(g, wx, wy, wr * 2.6, [255, 190, 110], 0.35);
  // ivy trailing down the left edge
  layer(g, 3, (lg) => {
    const ir = rng(37);
    for (let i = 0; i < 26; i++) { const y = ir() * N, x = x0 + Math.sin(y / 40) * 12 + ir() * 30; lg.fillStyle = rgba(mixc([40, 82, 30], [110, 150, 60], ir()), 0.95); lg.save(); lg.translate(x, y); lg.rotate(ir() * 6); lg.beginPath(); lg.moveTo(0, -9); lg.quadraticCurveTo(9, -4, 0, 9); lg.quadraticCurveTo(-9, -4, 0, -9); lg.fill(); lg.restore(); }
  });
  glow(g, 0, 0, N * 0.8, [255, 232, 170], 0.25, 'screen');
  finish(g, 0.34, 4, 5);
}

function dusk(g: CanvasRenderingContext2D) {
  vgrad(g, [[0, '#2a2c62'], [0.32, '#7a4a7c'], [0.55, '#e0765e'], [0.7, '#f8b86a'], [0.8, '#ffe0a0'], [1, '#ffe8b8']]);
  const sx = N * 0.36, sy = N * 0.7;
  glow(g, sx, sy, N * 0.7, [255, 190, 120], 0.45);
  layer(g, 3, (lg) => { lg.fillStyle = '#fff4d6'; lg.beginPath(); lg.arc(sx, sy, N * 0.07, 0, Math.PI * 2); lg.fill(); });
  // long cloud bands, lit gold from below
  layer(g, 5, (lg) => {
    const r = rng(53);
    for (let i = 0; i < 9; i++) {
      const y = N * (0.18 + i * 0.05 + r() * 0.03), x = r() * N, w = N * (0.25 + r() * 0.4), h = N * (0.012 + r() * 0.016);
      const gr = lg.createLinearGradient(0, y - h, 0, y + h);
      gr.addColorStop(0, 'rgba(110,70,120,0.75)'); gr.addColorStop(1, `rgba(255,${150 + i * 8},110,0.9)`);
      lg.fillStyle = gr; lg.beginPath(); lg.ellipse(x, y, w, h, 0, 0, Math.PI * 2); lg.fill();
    }
  });
  // ridges, each a little darker and bluer than the one behind
  const ridge = ['#b0708a', '#86506f', '#5c3756', '#3a2340'];
  for (let L = 0; L < 4; L++) {
    layer(g, 5 - L, (lg) => {
      lg.fillStyle = ridge[L];
      lg.beginPath(); lg.moveTo(0, N);
      for (let x = 0; x <= N; x += 4) lg.lineTo(x, N * (0.68 + L * 0.075) - (fbm(x / (110 - L * 18), L * 3.1, 61 + L, 3) - 0.3) * N * (0.12 + L * 0.03));
      lg.lineTo(N, N); lg.closePath(); lg.fill();
    });
  }
  finish(g, 0.3, 4, 6);
}

function plain(g: CanvasRenderingContext2D, hexCol: string, seed: number) {
  const c = hexc(hexCol);
  // a seamless paper roll lit by one soft light behind the owl: brighter in the middle, falling off to the edges
  const gr = g.createRadialGradient(N * 0.46, N * 0.4, N * 0.04, N * 0.5, N * 0.48, N * 0.78);
  gr.addColorStop(0, rgba(mixc(c, [255, 250, 240], 0.22))); gr.addColorStop(0.55, rgba(c)); gr.addColorStop(1, rgba(mixc(c, [20, 16, 28], 0.38)));
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  // the paper's fibre, barely there
  const im = g.getImageData(0, 0, N, N), d = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = (fbm(x / 3, y / 18, seed, 2) - 0.5) * 7 + (fbm(x / 90, y / 90, seed + 5, 3) - 0.5) * 10; const i = (y * N + x) * 4; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  g.putImageData(im, 0, 0);
  finish(g, 0.12, 3, seed);
}

const PAINT: Record<string, (g: CanvasRenderingContext2D) => void> = { forest, moon, stars, meadow, oak, dusk };
const plates = new Map<string, HTMLCanvasElement>();
/** A backdrop plate (512 px), painted once. The oak repaints itself once the bark scan is in (`loadBark()`). */
export function backdropCanvas(id: string): HTMLCanvasElement {
  const key = id + (id === 'oak' && barkImg ? ':bark' : '');
  let c = plates.get(key);
  if (c) return c;
  const [cv, g] = canvas();
  const b = BACKDROP_BY_ID[id] ?? BACKDROPS[0];
  if (b.plain) plain(g, b.plain, BACKDROPS.indexOf(b) + 3);
  else (PAINT[b.id] ?? forest)(g);
  c = cv;
  plates.set(key, c);
  return c;
}
const swatches = new Map<string, string>();
/** A small square of a backdrop for the picker (`px` device px). */
export function backdropSwatch(id: string, px = 96): string {
  const key = id + ':' + px + (id === 'oak' && barkImg ? ':bark' : '');
  let u = swatches.get(key);
  if (u) return u;
  const [c, g] = canvas(px);
  g.imageSmoothingQuality = 'high';
  g.drawImage(backdropCanvas(id), 0, 0, px, px);
  u = c.toDataURL('image/png');
  swatches.set(key, u);
  return u;
}
