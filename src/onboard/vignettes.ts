// Pip acting out your answers. Each vignette pops props into the office, moves Pip, sets his mood,
// frames the camera and plays sounds; `exit` tidies up. Keyed by `<question>:<option>`.
import * as THREE from 'three';
import { PX } from '../gfx/box.ts';
import { sound } from '../audio/sound.ts';
import { SPR } from '../world/fx.ts';
import * as P from './props.ts';
import { SPOT, type InterviewRoom, type ShotName, type Vig } from './room.ts';

const U = (px: number) => px * PX;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const F = SPOT.floor;
const DESK_TOP = U(P.DESK.h);
/** on the desk, in front of Pip (right of centre over the drawer, or left by the lamp) */
const DESK_R = V(U(20), DESK_TOP, U(-36));
const DESK_L = V(U(-8), DESK_TOP, U(-34));

type Make = (r: InterviewRoom) => Vig;

/** Reset Pip between vignettes. */
function calm(r: InterviewRoom) {
  const p = r.pip;
  p.pose = 'stand'; p.lookAt = null; p.breath = 0;
  p.setMood('neutral');
}
function loop(id: string, level = 0.55) {
  void sound.loop(id, true, level, 'amb', 0.6);
  return () => void sound.loop(id, false, level, 'amb', 0.8);
}
const later = (ms: number, f: () => void) => { const id = window.setTimeout(f, ms); return () => clearTimeout(id); };
const shot = (r: InterviewRoom, s: ShotName) => r.go(s);
/** Back to the desk for vignettes that happen there. */
const desk = (r: InterviewRoom) => { if (r.pipSpot !== 'desk') r.pipTo('desk'); };

// ------------------------------------------------------------------ shared bits

/** A bed pops in on the rug; Pip hops in, snuggles down and dozes. */
function bedScene(r: InterviewRoom, o: { awake?: 'worried' | 'yawn'; quick?: boolean } = {}): Vig {
  const k = 1.35, bedAt = V(SPOT.bed.x, 0, SPOT.bed.z + U(10));
  r.spawn('bed', P.bed, bedAt, { scale: k });
  r.spawn('pillow', () => P.pillow(), V(bedAt.x - U(2), U(8.2 * k), bedAt.z - U(12 * k)), { delay: 0.18, ry: 0.08, scale: k });
  r.spawn('pillow2', () => P.pillow('#f0b8c4'), V(bedAt.x + U(4), U(11 * k), bedAt.z - U(14 * k)), { delay: 0.3, ry: -0.12, scale: 1.05 });
  shot(r, 'bed');
  const offs: (() => void)[] = [];
  let snore = 0;
  offs.push(later(o.quick ? 150 : 350, () => r.pipTo('bed', () => {
    sound.play('fabric', { volume: 0.5 });
    if (o.awake === 'worried') { r.pip.setMood('worried'); r.spinClock(2); r.ticking = true; r.pip.lookAt = SPOT.clock.clone(); return; }
    if (o.awake === 'yawn') { r.pip.play('yawn'); offs.push(later(1500, () => { r.pip.pose = 'sleep'; })); }
    else { r.pip.pose = 'sleep'; r.pip.setMood('love', 1.2); r.fx.burst('hearts', r.pip.headWorld.x, r.pip.headWorld.y, r.pip.headWorld.z, 3); }
  })));
  return {
    update(_t, dt) {
      if (r.pip.pose === 'sleep' && (snore -= dt) <= 0) { snore = 3.2; sound.play('pet_snore', { volume: 0.25, gap: 1000 }); }
    },
    exit() { offs.forEach((f) => f()); r.ticking = false; calm(r); },
  };
}

/** Sheep hopping a fence, one after another; Pip counts them, nodding off. */
function sheepScene(r: InterviewRoom): Vig {
  const c = V(F.x + U(6), 0, F.z - U(6));
  r.spawn('fence', P.fence, c.clone(), { ry: Math.PI / 2 });
  const n = 3, span = 2.6, period = 3.3;
  let hopped = 0;
  for (let i = 0; i < n; i++) {
    let last = -1;
    r.spawn('sheep', P.sheep, c.clone(), {
      delay: i * 0.25, scale: 0.85, ry: Math.PI / 2,
      tick: (o, t) => {
        const ph = ((t / period + i / n) % 1), x = -span / 2 + ph * span;
        const near = Math.max(0, 1 - Math.abs(x) / 0.55);
        o.position.set(c.x + x, Math.sin(near * Math.PI / 2) ** 0.8 * 0.95, c.z + Math.sin(i * 2) * 0.1);
        o.rotation.z = Math.abs(x) < 0.55 ? -x * 0.6 : 0;
        // fade in and out at the ends of the run
        const edge = Math.min(1, ph * 8, (1 - ph) * 8);
        o.scale.setScalar(Math.max(0.001, edge) * 0.85);
        const cycle = Math.floor(t / period + i / n);
        if (x > 0 && last !== cycle) { last = cycle; hopped++; sound.play('pet_jump', { volume: 0.3, rate: 1.3, gap: 200 }); r.pip.play('nod'); r.sparkle(o.position.clone().add(V(0, 0.6, 0)), 2); if (hopped % 4 === 3) r.pip.play('yawn'); }
      },
    });
  }
  r.pipTo(V(F.x - U(20), 0, F.z + U(10)));
  r.pip.setMood('sleepy');
  r.pip.lookAt = c.clone().add(V(0, 0.5, 0));
  shot(r, 'floor');
  return { exit() { calm(r); } };
}

/** The window shows another hour (and weather); Pip turns to look. */
function windowScene(r: InterviewRoom, hour: number | null, weather: Parameters<InterviewRoom['window']>[1], mood: Parameters<InterviewRoom['pip']['setMood']>[0], act?: Parameters<InterviewRoom['pip']['play']>[0], snd?: string, s: ShotName = 'window'): Vig {
  desk(r);
  r.window(hour, weather);
  r.pip.lookAt = SPOT.window.clone();
  r.pip.setMood(mood);
  shot(r, s);
  const offs = [later(900, () => { if (act) r.pip.play(act); if (snd) sound.play(snd, { volume: 0.5 }); })];
  return { exit() { offs.forEach((f) => f()); r.window(null, 'clear'); calm(r); } };
}

/** A phone: tucked into the drawer that shuts, buzzing on the desk, or glowing in Pip's face. */
function phoneScene(r: InterviewRoom, mode: 'drawer' | 'buzz' | 'face'): Vig {
  desk(r);
  const offs: (() => void)[] = [];
  if (mode === 'drawer') {
    shot(r, 'desk');
    let state = 0, t0 = 0;
    const start = V(U(P.DESK.drawerX), DESK_TOP + U(0.2), U(-35));
    const phone = r.spawn('phone', P.phone, start.clone(), {
      ry: 0.2,
      tick: (o, t) => {
        if (state === 0 && t0 === 0) t0 = t;
        const k = t - t0;
        if (state === 0 && k > 0.9) { state = 1; r.drawer(true); }
        if (state === 1 && k > 1.25) {
          const e = Math.min(1, (k - 1.25) / 0.55);
          const end = V(start.x, U(P.DESK.h - 9.4 + 1.1), U(P.DESK.z + P.DESK.d / 2 + 13 - 10));
          o.position.lerpVectors(start, end, e); o.position.y += Math.sin(e * Math.PI) * 0.35;
          o.rotation.x = -e * 0.2;
          if (e >= 1) { state = 2; sound.play('place_item', { volume: 0.4 }); }
        }
        if (state === 2 && k > 2.1) {
          state = 3;
          // ride the drawer shut
          const d = r.scene.getObjectByName('ob-drawer');
          if (d) { const w = o.getWorldPosition(new THREE.Vector3()); d.worldToLocal(w); d.add(o); o.position.copy(w); o.rotation.set(0, 0.2, 0); }
          r.drawer(false);
          r.pip.setMood('proud', 2); r.pip.play('nod');
          r.sparkle(V(start.x, DESK_TOP + 0.2, U(-24)), 5);
        }
      },
    });
    void phone;
    r.pip.lookAt = start.clone();
    return { exit() { offs.forEach((f) => f()); r.drawer(false); calm(r); } };
  }
  if (mode === 'buzz') {
    shot(r, 'desk');
    const at = V(U(18), DESK_TOP, U(-34));
    let next = 0.6;
    r.spawn('phone', P.phone, at, {
      ry: -0.3,
      tick: (o, t, dt) => {
        if ((next -= dt) <= 0) { next = 1.6; sound.play('notify_message', { volume: 0.3, gap: 500 }); r.pip.setMood('curious', 1.2); }
        const buzz = next > 1.25 ? Math.sin(t * 90) * 0.04 : 0;
        o.rotation.y = -0.3 + buzz; o.position.x = at.x + buzz * 0.4;
      },
    });
    r.pip.lookAt = at.clone();
    return { exit() { calm(r); } };
  }
  // late-night scrolling: the room dims and a cold blue glow lights Pip's face
  shot(r, 'close');
  const at = SPOT.desk.clone().add(V(0.12, 0.95, 0.62));
  r.spawn('phone', P.phone, at, { ry: Math.PI, tick: (o, t) => { o.rotation.x = -1.25 + Math.sin(t * 2) * 0.03; } });
  const glow = new THREE.PointLight(0x7fb8ff, 0, 3, 1.5);
  glow.position.copy(at).add(V(0, 0.15, 0.05));
  r.scene.add(glow);
  r.pip.setMood('dizzy');
  r.pip.lookAt = at.clone();
  let ping = 1;
  return {
    update(_t, dt) { glow.intensity += (4 - glow.intensity) * Math.min(1, dt * 3); if ((ping -= dt) <= 0) { ping = 1.3; sound.play('notify_message', { volume: 0.25, rate: 1 + Math.random() * 0.3, gap: 400 }); } },
    exit() { r.scene.remove(glow); glow.dispose(); calm(r); },
  };
}

function micScene(r: InterviewRoom): Vig {
  desk(r);
  const at = DESK_L.clone().add(V(0.05, 0, 0.05));
  r.spawn('mic', P.microphone, at, { ry: 0.25 });
  shot(r, 'desk');
  let wave = 0.4, snore = 1.2;
  const off = later(500, () => { r.pip.pose = 'sleep'; });
  return {
    update(_t, dt) {
      if ((snore -= dt) <= 0) { snore = 2.4; sound.play('pet_snore', { volume: 0.3, gap: 800 }); wave = 0; }
      if ((wave -= dt) <= 0) {
        wave = 0.35;
        for (const k of [0, 1]) r.fx.emit({ x: at.x, y: at.y + U(12), z: at.z, life: 1.1, frame: SPR.ring, color: k ? 0x9be3ff : 0xd6f2ff, size: 0.18, grow: 3.4 + k, fadeOut: 0.6, add: true, delay: k * 0.18 });
      }
    },
    exit() { off(); calm(r); },
  };
}

function mugScene(r: InterviewRoom, kind: 'none' | 'morning' | 'late'): Vig {
  desk(r);
  const at = DESK_R.clone();
  if (kind === 'none') { r.spawn('milk', P.milk, at.clone().add(V(-0.25, 0, 0.1))); r.spawn('teapot', P.teapot, at.clone().add(V(0.35, 0, -0.1)), { delay: 0.15, ry: -0.5 }); }
  else r.spawn('mug', () => P.mug(kind === 'late' ? '#3c5aa8' : '#c94f3f'), at, { ry: -0.4 });
  if (kind !== 'none') r.spawn('beans', P.coffeeBeans, at.clone().add(V(-0.45, 0, 0.15)), { delay: 0.2 });
  r.window(kind === 'late' ? 22.5 : kind === 'morning' ? 8 : null, 'clear');
  shot(r, kind === 'late' ? 'pipR' : 'desk');
  let steam = 0, jitter = 0;
  r.pip.lookAt = at.clone();
  if (kind === 'none') r.pip.setMood('calm');
  if (kind === 'morning') r.pip.setMood('happy');
  if (kind === 'late') r.pip.setMood('dizzy');
  return {
    update(_t, dt) {
      if ((steam -= dt) <= 0) { steam = 0.35; r.fx.emit({ x: at.x + (Math.random() - 0.5) * 0.1, y: at.y + U(7), z: at.z, vy: 0.35, vx: 0.05, life: 1.6, frame: SPR.puff1, frames: 3, fps: 2, color: 0xf6f1e6, size: 0.16, grow: 1.4, fadeIn: 0.3, fadeOut: 0.8, flutter: 0.15 }); }
      if (kind === 'late' && (jitter -= dt) <= 0) { jitter = 1.1; r.pip.play('shiver'); }
    },
    exit() { r.window(null, 'clear'); calm(r); },
  };
}

/** A sound to relax to: the window, a prop and a loop. */
function relaxScene(r: InterviewRoom, id: string): Vig {
  if (id !== 'fire') desk(r);
  const offs: (() => void)[] = [];
  let tick: ((dt: number) => void) | null = null;
  r.pip.setMood('calm');
  switch (id) {
    case 'rain': r.window(null, 'rain'); offs.push(loop('amb_rain')); shot(r, 'window'); r.pip.lookAt = SPOT.window.clone(); break;
    case 'waves': r.window(17.6, 'sea'); offs.push(loop('amb_waves')); shot(r, 'window'); r.pip.lookAt = SPOT.window.clone(); break;
    case 'stream': r.window(10, 'stream'); offs.push(loop('amb_stream')); shot(r, 'window'); r.pip.lookAt = SPOT.window.clone(); break;
    case 'wind': case 'forest': {
      r.window(id === 'forest' ? 22 : 15, 'wind'); offs.push(loop(id === 'forest' ? 'amb_forest_night' : 'amb_wind'));
      shot(r, 'wide');
      let leaf = 0;
      tick = (dt) => {
        if ((leaf -= dt) > 0) return;
        leaf = 0.22;
        const w = SPOT.window;
        r.fx.emit({ x: w.x + 0.3, y: w.y + (Math.random() - 0.5) * 0.6, z: w.z + 0.4, vx: 1.2 + Math.random(), vy: -0.2, vz: 0.6 + Math.random() * 0.6, life: 3.5, frame: SPR.leaf1, frames: 3, fps: 5, color: [0x6cb845, 0x9ad05a, 0xe2b84a][Math.floor(Math.random() * 3)], size: 0.3, gravity: 0.35, drag: 0.5, flutter: 0.6 });
      };
      break;
    }
    case 'fire': {
      const at = V(F.x - U(4), 0, F.z - U(8));
      r.spawn('stove', P.stove, at, { ry: -0.3 });
      const glow = new THREE.PointLight(0xff9a3a, 0, 4, 1.4);
      glow.position.copy(at).add(V(0, 0.4, 0.6));
      r.scene.add(glow);
      offs.push(loop('amb_fire'), () => { r.scene.remove(glow); glow.dispose(); });
      shot(r, 'floor');
      r.pipTo(V(F.x - U(22), 0, F.z + U(12)));
      r.pip.lookAt = at.clone();
      tick = (dt) => {
        glow.intensity += (3 + Math.sin(r.time * 13) * 0.6 - glow.intensity) * Math.min(1, dt * 6);
        if (Math.random() < dt * 5) r.fx.emit({ x: at.x + (Math.random() - 0.5) * 0.3, y: at.y + U(12), z: at.z + 0.3, vy: 0.8, vx: (Math.random() - 0.5) * 0.3, life: 0.9, frame: SPR.spark1, frames: 3, fps: 8, color: 0xffb04a, size: 0.12, add: true });
      };
      break;
    }
    case 'brown': case 'lullaby': {
      const at = DESK_R.clone();
      r.spawn(id === 'brown' ? 'radio' : 'musicbox', id === 'brown' ? P.radio : P.musicBox, at, { ry: -0.35 });
      offs.push(loop(id === 'brown' ? 'amb_brown' : 'music_lullaby', id === 'brown' ? 0.4 : 0.55));
      shot(r, 'desk');
      r.pip.lookAt = at.clone();
      let note = 0;
      tick = (dt) => { if ((note -= dt) <= 0) { note = 0.9; r.fx.burst('notes', at.x, at.y + 0.6, at.z, 1); } };
      if (id === 'lullaby') offs.push(later(600, () => r.pip.play('dance')));
      break;
    }
    case 'breathing': {
      r.pip.pose = 'breathe';
      shot(r, 'close');
      tick = () => { r.pip.breath = 0.5 + Math.sin(r.time * 1.2) * 0.5; };
      offs.push(later(200, () => sound.play('breath_in', { volume: 0.4 })));
      break;
    }
    case 'reading': {
      r.spawn('book', P.bookOpen, DESK_L.clone().add(V(0.25, 0, -0.05)), { ry: 0.1 });
      shot(r, 'pipL');
      r.pip.lookAt = DESK_L.clone();
      let page = 1.4;
      tick = (dt) => { if ((page -= dt) <= 0) { page = 2.6; sound.play('paper_flip', { volume: 0.35 }); r.pip.play('nod'); } };
      break;
    }
    case 'night': r.window(23.5, 'clear'); offs.push(loop('amb_night')); shot(r, 'window'); r.pip.lookAt = SPOT.window.clone(); break;
  }
  return { update(_t, dt) { tick?.(dt); }, exit() { offs.forEach((f) => f()); r.window(null, 'clear'); calm(r); } };
}

/** The pillow tower: one fluffy pillow per hour of sleep; Pip rides on top. */
function towerScene(r: InterviewRoom, hours: number): Vig {
  const base = V(F.x, 0, F.z - U(4));
  const H = U(3.8);
  const stack: THREE.Object3D[] = [];
  const cols = ['#fbf6ea', '#f0b8c4', '#cfe6f2', '#f9e3a6', '#d8f0c8'];
  shot(r, 'tower');
  const set = (n: number) => {
    n = Math.max(4, Math.min(12, Math.round(n)));
    while (stack.length > n) r.despawn(stack.pop()!);
    while (stack.length < n) {
      const i = stack.length;
      stack.push(r.spawn('pillow' + (i % cols.length), () => P.pillow(cols[i % cols.length]), base.clone().add(V((Math.sin(i * 2.3) * 0.06), i * H, Math.cos(i * 1.7) * 0.05)), { ry: Math.sin(i * 1.3) * 0.25, quiet: i > 0 && stack.length > 0, delay: 0.04 }));
      sound.play('fabric', { volume: 0.3, rate: 1 + i * 0.04, gap: 60 });
    }
    r.pipTo(base.clone().add(V(0, n * H + U(0.5), 0)));
    r.pip.setMood(n < 7 ? 'worried' : n < 8 ? 'neutral' : n < 9 ? 'happy' : n < 10 ? 'love' : 'excited', 0);
    if (n >= 10) r.pip.play('flap');
  };
  set(hours);
  return { set, exit() { r.pipTo('desk'); calm(r); } };
}

// ------------------------------------------------------------------ the table

export const VIGNETTES: Record<string, Make> = {
  // goals
  'goals:sleep_better': (r) => bedScene(r),
  'goals:fall_asleep': (r) => sheepScene(r),
  'goals:wake_refreshed': (r) => {
    r.sky.hour = 5;
    const v = windowScene(r, 7.4, 'clear', 'happy', 'stretch', 'bird_chirp', 'window');
    r.spawn('sunflower', P.sunflowerPot, V(SPOT.window.x + 0.35, SPOT.window.y - U(19), SPOT.window.z + 0.45), { ry: 0.7, scale: 0.9 });
    const off = later(2200, () => { r.pip.setMood('joy', 2); r.sparkle(r.pip.headWorld, 6); sound.play('bird_chirp', { volume: 0.45 }); });
    return { exit() { off(); v.exit?.(); } };
  },
  'goals:steady_routine': (r) => {
    desk(r);
    shot(r, 'clock');
    r.spinClock(4); r.ticking = true;
    r.pip.lookAt = SPOT.clock.clone();
    const off = later(1800, () => { r.pip.setMood('proud', 2); r.pip.play('nod'); r.sparkle(SPOT.clock.clone().add(V(0, 0, 0.2)), 8); sound.play('ui_check', { volume: 0.5 }); });
    return { exit() { off(); r.ticking = false; calm(r); } };
  },
  'goals:less_phone': (r) => phoneScene(r, 'drawer'),
  'goals:track_sounds': (r) => micScene(r),
  // falling asleep
  'latency:quick': (r) => bedScene(r, { quick: true }),
  'latency:normal': (r) => bedScene(r, { awake: 'yawn' }),
  'latency:slow': (r) => sheepScene(r),
  'latency:long': (r) => bedScene(r, { awake: 'worried' }),
  // phone in bed
  'phone:never': (r) => phoneScene(r, 'drawer'),
  'phone:sometimes': (r) => phoneScene(r, 'buzz'),
  'phone:nightly': (r) => phoneScene(r, 'face'),
  // early bird or night owl
  'chrono:lark': (r) => { r.sky.hour = 5; return windowScene(r, 6.8, 'clear', 'happy', 'stretch', 'bird_chirp'); },
  'chrono:between': (r) => windowScene(r, 13, 'clear', 'calm', 'nod'),
  'chrono:owl': (r) => {
    const v = windowScene(r, 23.5, 'clear', 'excited', 'dance', 'owl_hoot');
    const off = later(700, () => r.fx.burst('stars', SPOT.window.x + 0.3, SPOT.window.y, SPOT.window.z + 0.3, 8));
    return { exit() { off(); v.exit?.(); } };
  },
  // caffeine
  'caffeine:none': (r) => mugScene(r, 'none'),
  'caffeine:morning': (r) => mugScene(r, 'morning'),
  'caffeine:late': (r) => mugScene(r, 'late'),
  // microphone
  'mic:yes': (r) => micScene(r),
  'mic:no': (r) => { desk(r); shot(r, 'pipL'); r.pip.setMood('happy'); r.pip.play('nod'); return { exit() { calm(r); } }; },
  // hours of sleep (live value)
  'hours:tower': (r) => towerScene(r, 8),
};
for (const id of ['rain', 'waves', 'stream', 'wind', 'forest', 'fire', 'brown', 'lullaby', 'breathing', 'reading', 'night']) VIGNETTES['relax:' + id] = (r) => relaxScene(r, id);
