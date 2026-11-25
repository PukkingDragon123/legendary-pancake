// Keeps the hollow oak in step with the save (rooms, boxes, open floors), seeds a new home on first
// run, and handles the home view's interactions: unpacking moving boxes, poking furniture, tapping a
// boarded-up floor, and Pip pottering about the living room by day. Call bindHome(scene) once.
import { effect, signal } from '@preact/signals';
import * as THREE from 'three';
import { ITEMS } from '../assets/registry.ts';
import { sound } from '../audio/sound.ts';
import { doOpenBox, seedHome, BOX } from '../game/home.ts';
import { phase } from '../game/night.ts';
import { edit, level, save } from '../game/store.ts';
import { IcoSparkle } from '../ui/icons.tsx';
import { toast } from '../ui/kit.tsx';
import { flyReward } from '../ui/fx.tsx';
import { breathing, panel, say } from '../ui/state.ts';
import type { Scene } from '../world/scene.ts';
import { FLOOR_NAME, UNLOCK, type FloorId } from '../world/house/plan.ts';
import { animeMoment } from '../ui/fx/anime.ts'; // [anime6]

/** A floor build mode should open on (set when a boarded-up floor is tapped). */
export const buildFocus = signal<FloorId | null>(null);

const LINES: Record<string, string> = {
  nestbed: 'My nest! Finally somewhere soft to dream.', roundrug: 'A moon rug! It goes with everything.', moonlamp: 'The moon lamp! No more bumping into things.',
  armchair: 'The squashy chair! Dibs.', cushion: 'Cushion! For emergency naps.', bookshelf: 'All my stories made it here safe.', books: 'My to-read tower. It’s... ambitious.',
  nightstand: 'A little table for my glass of water.', candles: 'Candles! Cozy level: maximum.', fernpot: 'Hello, fern. Welcome home.',
  fishbowl: 'Bubbles! You made it, little fish!', goldfish_bowl: 'Bubbles! You made it, little fish!', wardrobe: 'Room for ALL the hats.', telescope: 'Now I can see the stars I fly past!',
};
const say2 = (t: string, ms?: number) => { if (!panel.value && !breathing.value && phase.value === 'day') say(t, ms); };
const coin = (n: number, at: { x: number; y: number }) => (flyReward as unknown as (k: string, n: number, f?: { x: number; y: number }) => void)('coin', n, at);

export function bindHome(scene: Scene): () => void {
  if (!save.value.home.seeded) edit((s) => seedHome(s));
  let key = '', unlockedKey = '';
  const stop = effect(() => {
    const h = save.value.home;
    if (!h.seeded) { edit((s) => seedHome(s)); return; }
    const k = JSON.stringify(h);
    if (k === key) return;
    const uk = h.unlocked.join(',');
    const grew = unlockedKey !== '' && uk.length > unlockedKey.length;
    key = k; unlockedKey = uk;
    scene.setHome(h, grew);
    if (grew) { animeMoment('unlock'); scene.owl.react('starry', 'bang', 2.2); } // [anime6] TA-DA, Pip's starry eyes
  });

  // a boarded-up floor announces itself when Pip is grown-up enough to repair it
  let lastLv = level.value.level;
  const stopLv = effect(() => {
    const lv = level.value.level;
    if (lv > lastLv) for (const f of ['f2', 'f3'] as FloorId[]) if (lastLv < UNLOCK[f].level && lv >= UNLOCK[f].level && !save.value.home.unlocked.includes(f)) setTimeout(() => toast(`The ${FLOOR_NAME[f]} can be repaired now! Open Build.`, IcoSparkle, 4600), 2400);
    lastLv = lv;
  });

  const off = scene.on((e) => {
    if (e.type === 'tapBox') openBoxFlow(scene, e.id, { x: e.x, y: e.y });
    if (e.type === 'tapLock' && phase.value === 'day' && !breathing.value && !panel.value) {
      sound.play('wood_knock', { volume: 0.5 });
      buildFocus.value = e.floor;
      panel.value = 'build';
    }
    if (e.type === 'tapItem' && phase.value === 'day' && !panel.value) pokeItem(scene, e.uid, e.fid);
  });

  // Pip potters about the living room by day: a seat, the rug, the porch, a look at the fish
  let next = 8;
  const tick = (dt: number) => {
    if ((next -= dt) > 0) return;
    next = 12 + Math.random() * 14;
    if (phase.value !== 'day' || panel.value || breathing.value || scene.view !== 'home' || scene.director) return;
    if (!['inside', 'porch', 'roam', 'seat'].includes(scene.owlPlace) || scene.owl.pose !== 'stand') return;
    const r = Math.random();
    const seats = scene.rooms.seats('f1');
    if (r < 0.3 && seats.length) { const s = seats[Math.floor(Math.random() * seats.length)]; scene.sitAt(s.at); }
    else if (r < 0.45 && scene.owlPlace !== 'porch') scene.moveOwl('porch');
    else {
      const p = scene.rooms.freeSpot('f1', (Math.random() - 0.5) * 80, (Math.random() - 0.3) * 70);
      scene.hopTo(p.x, p.z);
    }
  };
  scene.tickers.add(tick);

  // a nudge towards the boxes for a new player
  const hint = setTimeout(() => { if (save.value.home.boxes.some((b) => BOX[b]?.floor === 'f1') && save.value.onboarded) say2('!Boxes everywhere!! Tap one and let’s unpack.', 4200); }, 5200);
  return () => { stop(); stopLv(); off(); scene.tickers.delete(tick); clearTimeout(hint); };
}

function openBoxFlow(scene: Scene, id: string, screen: { x: number; y: number }) {
  if (scene.rooms.isOpening(id) || !save.value.home.boxes.includes(id)) return;
  const at = scene.rooms.boxWorld(id);
  if (!at) return;
  scene.owl.lookAt = at.clone().add(new THREE.Vector3(0, 0.6, 0));
  scene.owl.setMood('excited', 2.2);
  scene.rooms.openBox(id, () => {
    const r = doOpenBox(id);
    if (!r) return;
    r.placed.forEach((p, i) => scene.rooms.flyIn(p.uid, at.clone().add(new THREE.Vector3(0, 0.7, 0)), i * 0.22));
    scene.refreshSpots();
    scene.owl.play('hop');
    const o = scene.owl.headWorld;
    scene.fx.burst('hearts', o.x, o.y + 0.2, o.z, 3);
    const first = r.placed[0]?.id;
    setTimeout(() => {
      scene.owl.lookAt = null;
      if (r.lastOnFloor) {
        sound.play('reward_unlock', { volume: 0.7 });
        coin(r.reward, screen);
        scene.owl.play('dance');
        say2(r.floor === 'f1' ? '*All unpacked!* It finally feels like ~home.~' : 'All unpacked up here too. ~Cozy!~', 4200);
      } else if (first) say2(LINES[first] ?? `Ooh, the ${ITEMS[first]?.name ?? 'thing'}!`, 3200);
    }, 1100);
  });
}

function pokeItem(scene: Scene, uid: string, fid: FloorId) {
  const m = scene.rooms.meshOf(uid);
  if (!m) return;
  const id = save.value.home.floors[fid]?.items.find((p) => p.uid === uid)?.id ?? '';
  const def = ITEMS[id];
  const cat = def?.cat ?? '';
  sound.play(cat === 'beds' || cat === 'seating' || cat === 'rugs' ? 'fabric' : cat === 'plants' ? 'rustle_bush' : id.includes('fish') ? 'water_plop' : 'wood_knock', { volume: 0.45, gap: 120 });
  // a squashy wobble
  const t0 = performance.now(), s0 = m.scale.clone();
  const wob = (now: number) => {
    const k = (now - t0) / 420;
    if (k >= 1) { m.scale.copy(s0); return; }
    const a = Math.sin(k * Math.PI * 3) * (1 - k) * 0.14;
    m.scale.set(s0.x * (1 + a), s0.y * (1 - a), s0.z * (1 + a));
    requestAnimationFrame(wob);
  };
  requestAnimationFrame(wob);
  const w = m.getWorldPosition(new THREE.Vector3());
  scene.fx.burst(cat === 'plants' ? 'leaves' : 'sparkle', w.x, w.y + 0.6, w.z, 5);
  if (fid === 'f1' && scene.owl.pose === 'stand' && !scene.director) {
    scene.owl.lookAt = w.clone().add(new THREE.Vector3(0, 0.4, 0));
    setTimeout(() => { scene.owl.lookAt = null; }, 1600);
    if (def?.sit && Math.random() < 0.6) { const seat = scene.rooms.seats(fid).find((s) => s.at.distanceTo(w) < 1.2); if (seat) scene.sitAt(seat.at); }
  }
}
