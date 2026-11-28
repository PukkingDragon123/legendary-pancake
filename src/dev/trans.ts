// Dev page for the 3D transitions (dev-trans.html): a stand-in game screen with one transition frame frozen over it.
//   ?kind=leaves&T=0.6      one still at clock T (0..2; 1 = fully covered)  &rev=1  &x=..&y=.. (CSS px)
//   ?sheet=1&T=0.55         a contact sheet of every kind at T (window.__sheet holds it as a PNG data URL)
//   ?play=leaves            play it for real (in, a pause, out), over and over
// window.hhTrans (trans3d.ts) has preview / bench / benchAll for screenshots and timing.
import { preview3D, KINDS_3D, type Kind3D } from '../ui/chrome/trans3d.ts';
import { transition } from '../ui/chrome/transition.ts';

const q = new URLSearchParams(location.search);
document.body.style.cssText = 'margin:0;overflow:hidden;background:#222';
const root = document.getElementById('ui')!;

/** the stand-in screen: a day sky, hills, the oak, a panel and buttons (so the overlay's edges and shadows read) */
function standIn(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#7fc0ea'); sky.addColorStop(0.6, '#cfe6f0'); sky.addColorStop(1, '#e8f0d8');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#86b060'; g.beginPath(); g.moveTo(0, h * 0.62); g.quadraticCurveTo(w * 0.5, h * 0.5, w, h * 0.64); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = '#5e8a44'; g.beginPath(); g.moveTo(0, h * 0.75); g.quadraticCurveTo(w * 0.6, h * 0.66, w, h * 0.78); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = '#6a4a30'; g.fillRect(w * 0.42, h * 0.3, w * 0.16, h * 0.42);
  g.fillStyle = '#3f7a2e'; g.beginPath(); g.arc(w * 0.5, h * 0.28, Math.min(w, h) * 0.25, 0, 7); g.fill();
  g.fillStyle = '#f4eedd'; g.strokeStyle = '#6f553d'; g.lineWidth = 5; g.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.12); g.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.12);
  g.fillStyle = '#2e2b24'; g.font = `bold ${Math.round(h * 0.03)}px sans-serif`; g.fillText('Hoot Hollow', w * 0.12, h * 0.155);
  for (let i = 0; i < 4; i++) { g.fillStyle = ['#c84a3a', '#3a7ac8', '#d8a040', '#5a9a4a'][i]; g.beginPath(); g.arc(w * (0.2 + i * 0.2), h * 0.9, Math.min(w, h) * 0.06, 0, 7); g.fill(); }
  return c;
}

const bg = standIn(innerWidth, innerHeight);
Object.assign(bg.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh' });
root.appendChild(bg);
const lbl = document.createElement('b');
Object.assign(lbl.style, { position: 'fixed', left: '8px', bottom: '6px', zIndex: '99', color: '#fff', background: '#2e2b24', padding: '2px 6px', font: '12px monospace' });
root.appendChild(lbl);

const T = +(q.get('T') ?? 0.55);
const o = { rev: q.has('rev'), x: q.has('x') ? +q.get('x')! : undefined, y: q.has('y') ? +q.get('y')! : undefined };
const W = window as unknown as { __ready?: number; __sheet?: string; hhSheet?: (T: number) => string };

/** every kind at T in a grid, each over the stand-in screen */
function sheet(T: number, list?: [Kind3D, number][]): string {
  const kinds: [Kind3D, number][] = list ?? KINDS_3D.filter((k) => k !== 'fade').map((k) => [k, T]);
  const cols = Math.min(5, kinds.length), tw = Math.round(innerWidth / 2), th = Math.round(innerHeight / 2), rows = Math.ceil(kinds.length / cols);
  const c = document.createElement('canvas'); c.width = cols * tw; c.height = rows * th;
  const g = c.getContext('2d')!;
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  kinds.forEach(([k, T], i) => {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
    g.drawImage(bg, x, y, tw, th);
    preview3D(k, T, o, 1.3);
    g.drawImage(document.querySelector('.hh-trans3d') as HTMLCanvasElement, x, y, tw, th);
    g.fillStyle = 'rgba(20,16,12,0.75)'; g.fillRect(x + 4, y + 4, 90, 18);
    g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(`${k} ${T}`, x + 8, y + 17);
  });
  return c.toDataURL('image/png');
}
W.hhSheet = sheet;

if (q.get('sheet')) {
  // &list=page@0.4,page@0.7 picks kinds and clocks
  const list = q.get('list')?.split(',').map((e) => { const [k, t] = e.split('@'); return [k as Kind3D, +t] as [Kind3D, number]; });
  const url = sheet(T, list);
  W.__sheet = url;
  const img = new Image(); img.src = url; Object.assign(img.style, { position: 'fixed', left: '0', top: '0', width: '100vw', zIndex: '100' });
  root.appendChild(img);
} else if (q.get('play')) {
  const k = q.get('play') as Kind3D;
  const loop = async () => { await transition(k, () => new Promise((r) => setTimeout(r, 300)), { reverse: o.rev, x: o.x, y: o.y }); setTimeout(loop, 700); };
  void loop();
  lbl.textContent = `playing ${k}`;
} else {
  const k = (q.get('kind') ?? 'leaves') as Kind3D;
  preview3D(k, T, o, 1.3);
  lbl.textContent = `${k} T=${T}${o.rev ? ' rev' : ''}`;
}
W.__ready = 1;
