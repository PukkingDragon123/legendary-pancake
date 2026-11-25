// Dev page for the sleep builder's screens without the 3D scene: /dev-sleep.html?s=<screen>
//   art      the pixel art on its own (cuckoo clock, props, presents, stickers)
//   ritual   the Sleep button's bedtime ritual          night   the night screen
//   lock     the phone lock                              alarm   the ringing alarm
//   clock    the cuckoo clock screen                     gift    the morning gift reveal
// Add &t=<seconds> to freeze every animation at that moment (for screenshots).
import { render } from 'preact';
import '../ui/style.css';
import { installRealSkin } from '../ui/real/skin.ts';
import { loadTextures } from '../ui/real/tex.ts';
import { Art } from '../ui/px/sleepart.ts';
import { candle, GIFT_LOOK, moon, mug, nest, nightWindow, phone, present, sack, songbird, stickerURL } from '../ui/px/sleepprops.ts';
import { CH, CK, CW, FINISHES, paintCuckoo } from '../ui/px/cuckoo.ts';
import { edit, save } from '../game/store.ts';
import { demoNight } from '../sleep/index.ts';
import { demoTonight, phase, setPhoneLock } from '../game/night.ts';
import { lootTable } from '../game/catalog.ts';
import { App } from '../ui/app.tsx';
import { panel } from '../ui/state.ts';
import { departing } from '../ui/sleep.tsx';

const q = new URLSearchParams(location.search);
const screen = q.get('s') ?? 'art';
if (q.get('t')) (window as unknown as { __artT: number }).__artT = +q.get('t')!;
if (q.get('cuckoo')) (window as unknown as { __cuckooOut: boolean }).__cuckooOut = true;
if (q.get('step')) (window as unknown as { __giftStage: unknown }).__giftStage = { step: q.get('step'), gift: +(q.get('gift') ?? 0), stage: +(q.get('stage') ?? 0), t: +(q.get('gt') ?? 0) };

function Canvas(p: { w: number; h: number; k: number; draw: (a: Art) => void; label?: string }) {
  return <figure style="margin:6px;color:#fff;font:11px sans-serif;display:inline-block;vertical-align:top"><canvas class="px" width={p.w} height={p.h} style={{ width: p.w * p.k + 'px', height: p.h * p.k + 'px', background: '#3a3550' }} ref={(c) => { if (!c) return; const a = new Art(p.w, p.h); p.draw(a); a.put(c.getContext('2d')!); }} /><figcaption>{p.label}</figcaption></figure>;
}

function ArtGallery() {
  const now = 10 * 60 + 9 + 31 / 60;
  return <div style="overflow:auto;height:100%;padding:8px;box-sizing:border-box">
    {FINISHES.slice(0, 2).map((f, i) => <Canvas w={CW * CK} h={CH * CK} k={3 / CK} label={f.name} draw={(a) => paintCuckoo(a, { now, swing: i ? -0.2 : 0.12, cuckoo: i ? 1 : 0, hoot: !!i, drop: [8, 22], finish: f })} />)}
    <Canvas w={60} h={40} k={3} label="bird and nest" draw={(a) => { songbird(a, 12, 20, 1, { beak: 'open', wing: 1 }); nest(a, 40, 22, 0.9, 0); }} />
    <Canvas w={70} h={44} k={3} label="props" draw={(a) => { candle(a, 0, 4, 1); mug(a, 20, 18, 2, 'coffee'); mug(a, 44, 18, 2, 'tea'); }} />
    <Canvas w={50} h={36} k={3} label="phone" draw={(a) => { phone(a, 0, 0, false); phone(a, 26, 0, true); }} />
    <Canvas w={100} h={60} k={3} label="moons" draw={(a) => { moon(a, 16, 20, 12, { phase: 0.5, face: 'sleep' }); moon(a, 50, 20, 10, { phase: 0.3 }); moon(a, 80, 20, 10, { phase: 0.8 }); }} />
    <Canvas w={150} h={64} k={3} label="window" draw={(a) => nightWindow(a, 150, 64, 3, { phase: 0.62 })} />
    <Canvas w={190} h={50} k={3} label="presents" draw={(a) => { ['common', 'uncommon', 'rare', 'legendary'].forEach((r, i) => present(a, i * 46, 0, GIFT_LOOK[r], i === 3 ? 0 : i, 0.5, 3)); }} />
    <Canvas w={120} h={60} k={3} label="sack" draw={(a) => { sack(a, 0, 0, 0, 0); sack(a, 60, 0, 0.8, 2); }} />
    <div>{['gold', 'moon', 'cloud', 'rain'].map((k) => <img class="px" src={stickerURL(k, 3)} style="margin:6px" />)}</div>
  </div>;
}

/** ~10 tracked nights ending this morning, and a profile from the interview. */
function seed() {
  const nights: ReturnType<typeof demoNight>[] = [];
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 9) continue;
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const n = demoNight({ now: d.getTime(), seed: 100 + i, restless: [0.1, 0.5, 0.2, 0.8, 0.3, 0.15, 0.6, 0.25, 0.4, 0.2, 0.7, 0.1][i], snorer: i % 3 === 0 });
    n.simulated = false;
    nights.push(n);
  }
  nights.sort((a, b) => a.start - b.start);
  edit((x) => {
    x.onboarded = true;
    x.nights = nights;
    x.streak = 3; x.bestStreak = 6;
    x.profile = { ...x.profile, latency: 'long', phone: 'nightly', caffeine: 'late', chronotype: 'owl', goals: ['Fall asleep faster', 'Less stress'], relax: ['reading'], interviewed: true };
  });
}
function startFakeNight() {
  const now = Date.now();
  edit((x) => { x.active = { session: { id: 'ndev', start: now - 3.2 * 3600_000, wakeTarget: now + 4.1 * 3600_000, smartWindowMin: 20, micUsed: true, epochs: [], events: [] }, area: 'woods', peeks: [] }; });
  phase.value = 'sleeping';
}

async function boot() {
  await loadTextures(); installRealSkin();
  try { await document.fonts.load('20px "TBME Body"'); } catch { /* */ }
  const root = document.getElementById('ui')!;
  root.style.pointerEvents = 'auto';
  if (screen === 'art') { render(<ArtGallery />, root); return; }
  if (q.get('fresh') !== '0') seed();
  if (screen === 'ritual') panel.value = 'sleep';
  if (screen === 'clock') panel.value = 'clock';
  if (screen === 'breathe') panel.value = 'breathe';
  if (screen === 'night' || screen === 'lock') startFakeNight();
  if (screen === 'lock') setPhoneLock(true);
  if (screen === 'depart') { startFakeNight(); departing.value = true; }
  if (screen === 'alarm') { startFakeNight(); phase.value = 'ringing'; }
  if (screen === 'gift') {
    demoTonight();
    const t = lootTable('woods');
    const item = t.find((e) => e.kind === 'item')!, piece = t.find((e) => e.kind === 'piece') ?? t[1], item2 = t.filter((e) => e.kind === 'item')[3] ?? t[2];
    edit((x) => { if (x.pending) { x.pending.adventure.finds = [{ ...item, rarity: 'common' }, { ...piece, rarity: 'rare' }, { ...item2, rarity: 'legendary' }]; x.pending.adventure.gems = 2; } });
  }
  render(<App />, root);
  (window as unknown as { __ready: number }).__ready = 1;
}
void boot();
