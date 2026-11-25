// A wrapped present for the morning's gifts, drawn smooth at device resolution: glossy printed wrapping paper
// (dots or stripes) over a card box, a satin ribbon and bow, a kraft gift tag; then the unwrapping (the ribbon
// slides away, the paper tears to show the card box, the lid lifts off and light pours out). 44 x 48 units.
import type { GiftLook } from '../px/sleepprops.ts';

const PAPER: Record<string, [string, string, string]> = {
  moss: ['#7fae5a', '#5a8a3c', '#3f6a2a'], green: ['#3fa070', '#2a7a52', '#1a5a3a'], blue: ['#4f86d0', '#2f5ea8', '#1e3e78'], gold: ['#f2c650', '#d49a24', '#9a6a10'],
};
const RIBBON: Record<string, [string, string, string]> = {
  cream: ['#fffaee', '#ecdcbc', '#b8a27a'], gold: ['#fff0a8', '#e0b040', '#9a7014'], white: ['#ffffff', '#e8ecf2', '#a8b0c0'], red: ['#ff8a8a', '#d0343c', '#801820'],
};
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/** Paint the present into `g` (already scaled to units). stage 0 wrapped, 1 ribbon off, 2 paper torn, 3 lid off. */
export function paintPresent(g: CanvasRenderingContext2D, look: GiftLook, stage: number, t = 0, f = 0) {
  const bx = 5, bw = 34, by = 19, bh = 25;
  const [pl, pm, pd] = PAPER[look.paper] ?? PAPER.moss, [rl, rm, rd] = RIBBON[look.ribbon] ?? RIBBON.cream;
  g.clearRect(0, 0, 44, 48);
  // contact shadow
  const sh = g.createRadialGradient(22, 45, 0, 22, 45, 22);
  sh.addColorStop(0, 'rgba(20,10,4,.45)'); sh.addColorStop(1, 'rgba(20,10,4,0)');
  g.fillStyle = sh; g.beginPath(); g.ellipse(22, 45, 21, 3.2, 0, 0, Math.PI * 2); g.fill();
  const paperFill = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = pm; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = pl;
    if (look.dots) for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { g.globalAlpha = 0.7; g.beginPath(); g.arc(x + i * 4 + (j % 2) * 2, y + j * 4, 0.9, 0, Math.PI * 2); g.fill(); }
    if (look.stripes) { g.globalAlpha = 0.55; for (let i = -12; i < 20; i++) { g.beginPath(); g.moveTo(x + i * 4, y); g.lineTo(x + i * 4 + 2, y); g.lineTo(x + i * 4 + 2 + h, y + h); g.lineTo(x + i * 4 + h, y + h); g.fill(); } }
    g.globalAlpha = 1;
    const sd = g.createLinearGradient(x, 0, x + w, 0); sd.addColorStop(0, 'rgba(255,255,255,.22)'); sd.addColorStop(0.25, 'rgba(255,255,255,0)'); sd.addColorStop(0.75, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = sd; g.fillRect(x, y, w, h);
    g.restore();
  };
  // the box (card under torn paper)
  const card = (x: number, y: number, w: number, h: number) => {
    const cg = g.createLinearGradient(x, 0, x + w, 0); cg.addColorStop(0, '#d8b080'); cg.addColorStop(1, '#a87a4a');
    g.fillStyle = cg; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(90,60,30,.25)'; g.lineWidth = 0.3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(x, y + i * 3); g.lineTo(x + w, y + i * 3); g.stroke(); }
  };
  if (stage >= 2) {
    card(bx, by, bw, bh);
    // ragged strips of paper survive at the edges, shrinking as t grows
    const keep = (1 - (stage === 2 ? t : 1)) * 5 + 1.2;
    g.save();
    g.beginPath(); g.rect(bx, by, bw, bh);
    g.moveTo(bx + keep, by + keep);
    for (let i = 0; i <= 12; i++) g.lineTo(bx + keep + (bw - 2 * keep) * (i / 12), by + keep + hash(i, 1) * 2.4);
    for (let i = 0; i <= 10; i++) g.lineTo(bx + bw - keep - hash(i, 2) * 2.4, by + keep + (bh - 2 * keep) * (i / 10));
    for (let i = 12; i >= 0; i--) g.lineTo(bx + keep + (bw - 2 * keep) * (i / 12), by + bh - keep - hash(i, 3) * 2.4);
    for (let i = 10; i >= 0; i--) g.lineTo(bx + keep + hash(i, 4) * 2.4, by + keep + (bh - 2 * keep) * (i / 10));
    g.closePath(); g.clip('evenodd');
    paperFill(bx, by, bw, bh);
    g.restore();
  } else paperFill(bx, by, bw, bh);
  // the lid
  const lidUp = stage === 3 ? -6 - t * 18 : 0, tilt = stage === 3 ? t * 0.35 : 0;
  if (stage === 3) {
    const inside = g.createLinearGradient(0, by, 0, by + 5); inside.addColorStop(0, '#3a2414'); inside.addColorStop(1, '#6a4428');
    g.fillStyle = inside; g.fillRect(bx + 1, by, bw - 2, 4.5);
    const glow = g.createRadialGradient(22, by, 0, 22, by - 6, 22);
    glow.addColorStop(0, `rgba(255,240,180,${0.55 + 0.3 * t})`); glow.addColorStop(1, 'rgba(255,230,150,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(22, by - 2, 22, Math.PI, 0); g.fill();
    for (let i = 0; i < 9; i++) { const gx = bx + 4 + i * 3.4, gy = by - 2 - ((f + i * 3) % 9) * 1.4; g.fillStyle = 'rgba(255,248,200,.9)'; g.beginPath(); g.arc(gx, gy, 0.6, 0, Math.PI * 2); g.fill(); }
  }
  if (stage < 3 || t < 1) {
    g.save();
    g.translate(22, by - 3 + lidUp); g.rotate(tilt); g.translate(-22, -(by - 3));
    g.shadowColor = 'rgba(20,10,4,.35)'; g.shadowBlur = 1.5; g.shadowOffsetY = 1;
    if (stage >= 2) card(bx - 2, by - 6, bw + 4, 7); else paperFill(bx - 2, by - 6, bw + 4, 7);
    g.shadowColor = 'transparent';
    const lg = g.createLinearGradient(0, by - 6, 0, by + 1); lg.addColorStop(0, 'rgba(255,255,255,.3)'); lg.addColorStop(0.3, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = lg; g.fillRect(bx - 2, by - 6, bw + 4, 7);
    g.restore();
  }
  // the ribbon and bow
  if (stage === 0 || (stage === 1 && t < 1)) {
    const slide = stage === 1 ? t * 40 : 0;
    const satin = (x0: number, x1: number) => { const s = g.createLinearGradient(x0, 0, x1, 0); s.addColorStop(0, rl); s.addColorStop(0.4, rm); s.addColorStop(1, rd); return s; };
    g.fillStyle = satin(bx + bw / 2 - 2, bx + bw / 2 + 2); g.fillRect(bx + bw / 2 - 2, by - 6 - slide, 4, bh + 6);
    const hs = g.createLinearGradient(0, by + 9, 0, by + 13); hs.addColorStop(0, rl); hs.addColorStop(0.4, rm); hs.addColorStop(1, rd);
    g.fillStyle = hs; g.fillRect(bx + slide, by + 9, bw, 4);
    if (stage === 0) {
      const cx = bx + bw / 2, cy = by - 7, wob = Math.sin(f * 0.5) * 0.5;
      for (const sd of [-1, 1]) {
        const lg = g.createRadialGradient(cx + sd * 5, cy - 2, 0, cx + sd * 6, cy - 1, 6.5); lg.addColorStop(0, rl); lg.addColorStop(0.6, rm); lg.addColorStop(1, rd);
        g.fillStyle = lg;
        g.beginPath(); g.ellipse(cx + sd * 6, cy - 1 + wob * sd, 6, 4, sd * 0.25, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(cx + sd * 6, cy - 0.6 + wob * sd, 2.6, 1.6, sd * 0.25, 0, Math.PI * 2); g.fill();
        g.fillStyle = rm; g.beginPath(); g.moveTo(cx + sd * 1.5, cy + 1); g.lineTo(cx + sd * 7, cy + 8); g.lineTo(cx + sd * 4, cy + 8.5); g.lineTo(cx + sd * 0.5, cy + 3); g.fill();
      }
      const kn = g.createRadialGradient(cx - 0.8, cy - 0.8, 0, cx, cy, 2.6); kn.addColorStop(0, rl); kn.addColorStop(1, rd);
      g.fillStyle = kn; g.beginPath(); g.arc(cx, cy, 2.5, 0, Math.PI * 2); g.fill();
    }
  }
  // a kraft gift tag on a string
  if (stage < 2) {
    g.strokeStyle = '#f4ecd8'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(bx + bw - 3, by + 1); g.quadraticCurveTo(bx + bw + 1, by + 2, bx + bw + 2, by + 6); g.stroke();
    g.save(); g.translate(bx + bw + 2, by + 6); g.rotate(0.15);
    g.fillStyle = '#c89c6c'; g.beginPath(); g.moveTo(-2, 0.8); g.lineTo(0, -0.6); g.lineTo(2, 0.8); g.lineTo(2, 6.5); g.lineTo(-2, 6.5); g.closePath(); g.fill();
    g.fillStyle = '#7a1f24'; g.beginPath(); g.arc(0, 2.6, 0.6, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  if (look.sparkle && stage < 3) for (let i = 0; i < 4; i++) {
    const k = (f + i * 5) % 20;
    if (k >= 6) continue;
    const sx = hash(i, Math.floor((f + i * 5) / 20)) * 40 + 2, sy = hash(i + 9, Math.floor((f + i * 5) / 20)) * 30 + 8, r = 1 + Math.sin(k / 6 * Math.PI) * 2;
    g.fillStyle = 'rgba(255,252,230,.95)';
    for (const a of [0, Math.PI / 2]) { g.save(); g.translate(sx, sy); g.rotate(a); g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(0, -r * 0.15, r, 0); g.quadraticCurveTo(0, r * 0.15, -r, 0); g.fill(); g.restore(); }
  }
}
