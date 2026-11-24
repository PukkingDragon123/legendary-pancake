// [audio3] Wires sound into the game from the outside, so the modules that own the scenes and panels
// do not have to change: installed once from main.tsx with installAudioWiring(scene).
//
//   ambience   beds for the hour and the weather (dawn chorus, thrushes at dusk, peepers at night,
//              rain, wind, snow hush, the creek), the room tone and crackling stove inside the oak,
//              rain on the roof, the icy boutique; one-shots on top (birds by the hour, distant owls of
//              other species at night, frogs, wind gusts with the oak creaking, thunder after lightning)
//   Pip        hops sound like the ground under him (grass, the oak's wooden floors and porch, snow,
//              wet grass) and he calls with his own species' voice (sound.ts sceneSound)
//   build      furniture sounds like what it is when set down (wood, cushions, glass, metal, paper, pots)
//   panels     the shop door bell, the book's cover and thud, the globe's creak and pin taps, the clock chime
//   shop       the till rings in the shop; a gacha pull shimmers like a shooting star and reveals with chimes
//   particles  sparkle and puff bursts in the world give a tiny pop
//   anything   an element with data-sfx="id" (and optional data-sfx-vol) plays that sound when pressed
import { effect } from '@preact/signals';
import { ITEMS } from '../assets/registry.ts';
import { phase } from '../game/night.ts';
import { save } from '../game/store.ts';
import { breathing, panel } from '../ui/state.ts';
import { groundY } from '../world/layout.ts';
import type { Scene } from '../world/scene.ts';
import { season, weather } from '../world/weather.ts';
import { BEDS, bedLevels, dryness, materialOf, PLACE_SOUND, twilight, warmth, type AmbMode, type AmbState, type Bed } from './ambience.ts';
import { owlCall, setSceneContext, sound, type Surface } from './sound.ts';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const INSIDE_VIEWS = new Set(['interior', 'loft', 'attic']);
let installed = false;

export function installAudioWiring(scene: Scene) {
  if (installed) return;
  installed = true;
  const sc = scene;
  const vis = () => sc.weather?.vis;

  // ---------------------------------------------------------------- what Pip stands on, who he is
  const surface = (): Surface => {
    const p = sc.owl.node.position;
    if (p.y - groundY(p.x, p.z) > 0.25 || INSIDE_VIEWS.has(sc.view)) return 'wood'; // the porch, the floors of the oak
    const v = vis();
    if (v && v.cover > 0.35) return 'snow';
    if (v && (v.wet > 0.35 || v.rain > 0.2)) return 'wet';
    return 'grass';
  };
  setSceneContext({ surface, species: () => save.value.look.species ?? 'tawny', night: () => sc.sky.night });

  // ---------------------------------------------------------------- the ambience director
  const modeNow = (): AmbMode => {
    const ph = phase.value, p = panel.value;
    if (ph === 'sleeping' || breathing.value || sc.view === 'sleep' || sc.view === 'breathe') return 'off';
    if (sc.stage) return p === 'shop' ? 'shop' : p === 'map' ? 'globe' : 'stage';
    if (p === 'build' || p === 'decorate' || INSIDE_VIEWS.has(sc.view)) return 'inside';
    return 'outside';
  };
  const stateNow = (mode: AmbMode): AmbState => {
    const v = vis();
    return {
      mode, night: sc.sky.night, hour: sc.sky.hour,
      rain: v?.rain ?? 0, storm: v?.storm ?? 0, wind: v?.wind ?? 0.3, snow: v?.snow ?? 0, cover: v?.cover ?? 0,
      temp: weather.value.temp ?? 12, winter: season.value.season === 'winter',
    };
  };
  sound.claim(['amb_rain']); // weather.ts's own day rain loop: the director plays bed_rain instead
  sound.setBeds(BEDS);
  const last = new Map<Bed, number>();
  let lastMode: AmbMode | null = null;
  let mode: AmbMode = 'off';
  const T = { bird: 4, owl: 18, frog: 6, gust: 8, creak: 20 };
  const tick = () => {
    mode = modeNow();
    sound.bedsOn = mode === 'outside' || mode === 'inside';
    const s = stateNow(mode);
    const L = bedLevels(s);
    const switched = mode !== lastMode;
    for (const b of BEDS) {
      const want = L[b], had = last.get(b) ?? 0;
      if (Math.abs(want - had) < 0.03 && (want > 0.01) === (had > 0.01) && !switched) continue;
      if (want <= 0.01 && had <= 0.01) { last.set(b, 0); continue; }
      void sound._loop(b, want > 0.01, want, 'amb', switched ? 0.7 : 2.5);
      last.set(b, want > 0.01 ? want : 0);
    }
    lastMode = mode;
    if (mode === 'outside' || mode === 'inside') oneShots(s, 0.5);
  };

  // birds by the hour, owls far off at night, frogs, gusts and the creaking oak
  const amb = (id: string, volume: number, rate = 1) => sound.play(id, { volume, rate, bus: 'amb', gap: 400 });
  const oneShots = (s: AmbState, dt: number) => {
    const inside = s.mode === 'inside', muff = inside ? 0.35 : 1, dry = dryness(s), warm = warmth(s);
    const day = 1 - s.night, tw = twilight(s.night), evening = s.hour >= 12;
    if ((T.bird -= dt) <= 0) {
      T.bird = rnd(7, 16);
      if (dry > 0.5 && evening && tw > 0.4) amb('bird_thrush', rnd(0.12, 0.24) * muff, rnd(0.95, 1.05));
      else if (dry > 0.5 && day > 0.55) { if (Math.random() < 0.2) amb('woodpecker', 0.12 * muff); else amb('bird_song', rnd(0.1, 0.2) * muff, rnd(0.92, 1.08)); }
    }
    if ((T.owl -= dt) <= 0) {
      T.owl = rnd(25, 60);
      if (s.night > 0.65 && dry > 0.4) {
        const mine = owlCall(save.value.look.species ?? 'tawny')[0];
        const others = ['owl_tawny', 'owl_barred', 'owl_longeared', 'owl_horned', 'owl_kewick'].filter((x) => x !== mine);
        amb(pick(others), rnd(0.08, 0.16) * muff, rnd(0.97, 1.03));
      }
    }
    if ((T.frog -= dt) <= 0) {
      T.frog = rnd(6, 14);
      if (!inside && s.night > 0.5 && warm > 0.5 && dry > 0.5) amb('frog_peep', rnd(0.06, 0.12), rnd(0.95, 1.08));
    }
    const windy = s.wind > 0.55 || s.storm > 0.3;
    if ((T.gust -= dt) <= 0) {
      T.gust = rnd(9, 22);
      if (windy) amb('wind_gust', rnd(0.25, 0.45) * (inside ? 0.5 : 1), rnd(0.9, 1.1));
    }
    if ((T.creak -= dt) <= 0) {
      T.creak = rnd(14, 34);
      if (windy || (inside && Math.random() < 0.25)) amb('tree_creak', rnd(0.15, 0.3) * (inside ? 1.2 : 0.8), rnd(0.9, 1.05));
    }
  };
  window.setInterval(tick, 500);
  tick();

  // thunder rolls in a moment after each lightning flash (the flash is the sky's, see weather.ts)
  let flashWas = 0;
  sc.tickers.add(() => {
    const f = sc.sky.wx.flash;
    if (f > 0.5 && flashWas < 0.3 && (mode === 'outside' || mode === 'inside')) {
      const delay = rnd(300, 2600), near = delay < 1300;
      window.setTimeout(() => sound.play(near ? 'thunder' : 'thunder_far', { volume: (near ? 0.55 : 0.42) * (mode === 'inside' ? 0.7 : 1), rate: rnd(0.92, 1.05), bus: 'amb', gap: 1500 }), delay);
    }
    flashWas = f;
  });

  // ---------------------------------------------------------------- furniture: the last thing set down
  let lastPlaced: { id: string; at: number } | null = null;
  let homeKey: Map<string, string> | null = null;
  effect(() => {
    const floors = save.value.home.floors;
    const now = new Map<string, string>();
    for (const r of Object.values(floors)) for (const p of r?.items ?? []) now.set(p.uid, `${p.id}|${p.x}|${p.z}|${p.rot}`);
    if (homeKey) for (const [uid, k] of now) if (homeKey.get(uid) !== k) lastPlaced = { id: k.split('|')[0], at: performance.now() };
    homeKey = now;
  });
  const placeFor = (): string => {
    const lp = lastPlaced && performance.now() - lastPlaced.at < 600 ? lastPlaced : null;
    if (!lp) return 'place_wood';
    return PLACE_SOUND[materialOf(lp.id, ITEMS[lp.id]?.cat)];
  };
  sound.route('place_item', () => placeFor());
  sound.route('drawer', () => (panel.value === 'build' ? 'drawer_close' : null));
  // a tap on the meadow: Pip's first hop sounds like where he stands
  sound.route('rustle_grass', () => { if (panel.value || sc.stage) return null; const s = surface(); return s === 'grass' ? null : `hop_${s}`; });

  // ---------------------------------------------------------------- the book, the shop and the gacha
  const later = (ms: number, f: () => void) => window.setTimeout(f, ms);
  let pullAt = -1e9;
  const inPull = () => panel.value === 'shop' && performance.now() - pullAt < 15000;
  sound.route('paper_flip', () => (panel.value === 'book' ? 'page_turn' : null));
  sound.route('ui_buy', () => {
    if (panel.value === 'shop') return 'till';
    // bought straight into a room in build mode: the coins, then the piece set down
    if (panel.value === 'build' && lastPlaced && performance.now() - lastPlaced.at < 600) later(70, () => sound.play(placeFor(), { volume: 0.55, gap: 60 }));
    return null;
  });
  sound.route('tp_shimmer', () => { if (panel.value !== 'shop') return null; pullAt = performance.now(); return 'star_shimmer'; });
  sound.route('reward_levelup', () => (inPull() ? 'reveal_epic' : null));
  sound.route('reward_unlock', () => (inPull() ? 'reveal_rare' : null));
  sound.route('ui_page', () => (inPull() ? 'reveal_common' : null));
  sound.route('sparkle', () => (inPull() ? 'chime_sweep' : null));

  let was: string | null = panel.value;
  effect(() => {
    const p = panel.value, from = was;
    was = p;
    if (p === from) return;
    if (p === 'shop') later(520, () => { if (panel.value === 'shop') sound.play('shop_bell', { volume: 0.45 }); });
    if (p === 'book') later(560, () => { if (panel.value === 'book') sound.play('book_open', { volume: 0.5 }); });
    if (from === 'book') later(260, () => sound.play('book_close', { volume: 0.55 }));
    if (p === 'map') later(700, () => { if (panel.value === 'map') sound.play('globe_spin', { volume: 0.3 }); });
    if (p === 'clock') later(600, () => { if (panel.value === 'clock') sound.play('clock_chime', { volume: 0.3 }); });
    if (p === 'build') later(300, () => sound.play('paper_rustle', { volume: 0.35 }));
    if (p === 'wardrobe') later(250, () => sound.play('whoosh_cloth', { volume: 0.35 }));
    // into the oak and out again: the little door
    if (p === 'build' && from !== 'decorate') later(120, () => sound.play('door_open', { volume: 0.25, rate: 1.1 }));
    if (from === 'build' && p !== 'decorate') later(200, () => sound.play('door_close', { volume: 0.22, rate: 1.1 }));
  });

  // the globe: a creaking spin when flicked, a pin tapped in when a place is picked (duck-typed GlobeStage)
  let gv = 0, gf: unknown = null;
  window.setInterval(() => {
    const st = sc.stage as unknown as { spinVel?: number; focusId?: string | null } | null;
    if (!st || typeof st.spinVel !== 'number') { gv = 0; gf = null; return; }
    const v = Math.abs(st.spinVel);
    if (v > 0.9 && gv < 0.5) sound.play('globe_spin', { volume: 0.22 + Math.min(4, v) * 0.06, rate: 0.9 + Math.min(4, v) * 0.04, gap: 450 });
    gv = v;
    const f = st.focusId ?? null;
    if (f && f !== gf) sound.play('pin_tap', { volume: 0.5, rate: rnd(0.95, 1.08), gap: 150 });
    gf = f;
  }, 90);

  // ---------------------------------------------------------------- particles: tiny pops with the bursts
  const fx = sc.fx as unknown as { burst?: (...a: unknown[]) => unknown };
  const burst = fx.burst?.bind(sc.fx);
  if (burst) {
    fx.burst = (...a: unknown[]) => {
      const r = burst(...a);
      try {
        const kind = a[0] as string, n = (a[4] as number) ?? 6;
        if (mode !== 'off' && !sc.stage) {
          if (kind === 'sparkle' || kind === 'stars') sound.play('pop_sparkle', { volume: Math.min(0.22, 0.08 + n * 0.008), rate: rnd(0.9, 1.25), gap: 220 });
          else if (kind === 'dust' || kind === 'puff' || kind === 'smoke') sound.play('pop_puff', { volume: Math.min(0.2, 0.06 + n * 0.008), rate: rnd(0.85, 1.15), gap: 260 });
          else if (kind === 'hearts') sound.play('pop_sparkle', { volume: 0.08, rate: 1.4, gap: 300 });
          else if (kind === 'leaves') sound.play('leaf_rustle', { volume: 0.18, rate: rnd(0.95, 1.1), gap: 300 });
        }
      } catch { /* never let a sound break a burst */ }
      return r;
    };
  }

  // ---------------------------------------------------------------- data-sfx on any element
  addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.('[data-sfx]') as HTMLElement | null;
    if (!el) return;
    const id = el.dataset.sfx!, vol = parseFloat(el.dataset.sfxVol ?? '') || 0.5;
    sound.play(id, { volume: vol, rate: rnd(0.96, 1.04), gap: 60 });
  }, { passive: true, capture: true });

  // dev: window.__sfx.recent lists the last sounds played
  if (import.meta.env.DEV) (window as unknown as { __sfx: unknown }).__sfx = sound;
}
