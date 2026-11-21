// Boot: fonts and materials, the 3D scene, sound, the night engine, and the glue that keeps the
// scene in step with the save (look, furniture, unlocked rooms, time of day, what's open).
import { effect } from '@preact/signals';
import { render } from 'preact';
import { sceneSound, sound } from './audio/sound.ts';
import { connectBlocker, notePeek, phase, pushBlockerConfig, resumeNight, setupReminders, snooze, endNight } from './game/night.ts';
import { dayKey, edit, save, zones } from './game/store.ts';
import { consumeLaunchAction, onSWMessage, registerSW } from './sleep/index.ts';
import { App } from './ui/app.tsx';
import { flyReward, watchLevel } from './ui/fx.tsx';
import { progress } from './game/quests.ts';
import { IcoAcorn, IcoMoon, IcoSparkle, IcoStone } from './ui/icons.tsx';
import { toast } from './ui/kit.tsx';
import { breathing, lines, panel, say, sceneRef, tab } from './ui/state.ts';
import './ui/style.css';
import { installPixelSkin } from './ui/pxskin.ts';
import { Scene } from './world/scene.ts';
import { bindHome } from './build/home-sync.ts'; // [house]

async function boot() {
  installPixelSkin();
  try { await document.fonts.load('20px "TBME Body"'); } catch { /* font loads later */ }
  const q = new URLSearchParams(location.search);
  const pref = save.value.settings.quality;
  const weak = (navigator.hardwareConcurrency ?? 4) < 6 || /Android|iPhone|iPad/i.test(navigator.userAgent) && (devicePixelRatio || 1) > 2.5;
  const quality = q.get('q') === 'low' || pref === 'low' ? 'low' : pref === 'high' ? 'high' : weak ? 'low' : 'high';
  const canvas = document.getElementById('world') as HTMLCanvasElement;
  const scene = new Scene(canvas, save.value.look, quality);
  sceneRef.current = scene;
  (window as unknown as { hh: unknown }).hh = { scene, save, phase, tab, panel };
  bindHome(scene); // [house] rooms, moving boxes and boarded-up floors follow save.home
  scene.setZones(zones.value);
  if (phase.value === 'sleeping') scene.placeOwl('away');
  // settle springs, particles and the camera before the first visible frame
  for (let i = 0; i < 40; i++) scene.step(1 / 30, false);
  scene.snapCamera();
  scene.start();
  addEventListener('resize', () => scene.resize());

  // ---- sound
  await sound.init();
  const st = save.value.settings;
  sound.volumes({ sfx: st.sfx, music: st.music, amb: st.ambience });
  scene.on((e) => {
    if (e.type === 'sound') sceneSound(e.id);
    if (e.type === 'catch') {
      sound.play('sparkle', { volume: 0.5 });
      edit((x) => { x.coins += 1; });
      flyReward('acorn', 10, { x: e.x, y: e.y });
      if (progress('catch')) toast('Quest done: fireflies caught!', IcoSparkle);
    }
    if (e.type === 'pet' && phase.value === 'day') {
      scene.owl.setMood('love', 1.6);
      scene.owl.play('nod');
      sound.play('pet_purr', { volume: 0.35, gap: 900 });
      const o = scene.owl.node.position; scene.fx.burst('hearts', o.x, o.y + 1.3, o.z, 2);
      if (progress('pet')) toast('Quest done: Pip feels very loved', IcoSparkle);
    }
    if (e.type === 'tapGround' && phase.value === 'day' && !breathing.value && !panel.value && tab.value === 'home') {
      if (scene.hopTo(e.x, e.z)) { progress('hop'); sound.play('rustle_grass', { volume: 0.3, gap: 300 }); }
    }
    if (e.type === 'tapOwl' && phase.value === 'day' && !breathing.value) {
      scene.owl.poke();
      say(lines.poke());
      if (save.value.daily.pets < 5) { edit((x) => { x.daily.pets++; x.coins += 2; }); }
    }
  });

  render(<App />, document.getElementById('ui')!);

  // ---- keep the scene in step with the save
  let lookKey = JSON.stringify(save.value.look), furnKey = JSON.stringify(save.value.furniture), zoneKey = JSON.stringify(zones.value), blockKey = '';
  effect(() => {
    const s = save.value;
    const lk = JSON.stringify(s.look), fk = JSON.stringify(s.furniture), zk = JSON.stringify(zones.value), bk = JSON.stringify({ ...s.blocker, mascot: s.look.skin ?? 'owl' });
    if (lk !== lookKey && panel.value !== 'wardrobe') { lookKey = lk; scene.setLook(s.look); }
    else if (lk !== lookKey) lookKey = lk;
    if (fk !== furnKey) { furnKey = fk; scene.setFurniture(s.furniture); }
    if (zk !== zoneKey) {
      const before = JSON.parse(zoneKey) as Record<string, boolean>;
      zoneKey = zk; scene.setZones(zones.value);
      for (const [k, v] of Object.entries(zones.value)) if (v && !before[k] && k === 'garden') toast( // [house] floors announce themselves (home-sync)
        'New room unlocked: the Garden!', IcoSparkle, 4200);
    }
    if (bk !== blockKey) { blockKey = bk; edit((x) => { x.blocker.mascot = x.look.skin ?? 'owl'; }); void pushBlockerConfig(); }
  });
  // camera framing follows what's open
  effect(() => {
    const ph = phase.value, t = tab.value, p = panel.value, b = breathing.value;
    const wide = innerWidth >= 900;
    if (ph === 'sleeping') { scene.setView('sleep'); scene.shift = 0; sound.music(null); return; }
    if (ph === 'ringing' || ph === 'morning') { scene.setView('wake'); scene.shift = wide ? 0 : 0.42; sound.music(null); return; }
    if (b) { scene.shift = 0; return; }
    if (p === 'wardrobe' || p === 'decorate') { scene.shift = wide ? 0 : 0.5; return; }
    if (p === 'map' || p === 'settings') { scene.shift = wide ? 0 : 0.3; return; }
    if (t === 'breathe') { if (scene.view !== 'home') scene.setView('home'); scene.shift = wide ? 0 : 0.5; }
    else { if (scene.view !== 'home') scene.setView('home'); if (scene.owlPlace === 'log' || scene.owlPlace === 'away') scene.moveOwl('porch'); scene.shift = t === 'home' || wide ? 0 : 0.34; }
    sound.music(t === 'home' ? 'music_cozy' : null);
  });

  // ---- the night engine
  setupReminders((k) => {
    sound.play('notify_soft', { volume: 0.6 });
    scene.owl.play('yawn');
    toast(k === 'winddown' ? 'Time to wind down. Dim the lights?' : 'It’s bedtime. Goodnight soon!', IcoMoon, 5000);
    say(lines.evening());
  });
  if (phase.value === 'sleeping') void resumeNight();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && phase.value === 'sleeping') notePeek(); });
  void connectBlocker();
  if (import.meta.env.MODE !== 'artifact') void registerSW();
  watchLevel();
  // a #breathe link (from the bedtime blocker) opens the breathing exercise
  const route = () => { if (location.hash === '#breathe' && save.value.onboarded && phase.value === 'day') { tab.value = 'breathe'; panel.value = null; } };
  route();
  addEventListener('hashchange', route);
  onSWMessage((m) => { if (m.action === 'snooze') snooze(9); else if (m.action === 'dismiss') void endNight(); });
  const la = consumeLaunchAction();
  if (la?.action === 'snooze') snooze(9);

  // ---- small daily kindnesses
  const today = dayKey();
  if (save.value.daily.day !== today) {
    edit((x) => { x.daily = { day: today, gift: true, pets: 0 }; x.coins += 25; });
    if (save.value.onboarded) setTimeout(() => toast('+25 coins: a little gift from Pip', IcoAcorn), 1600);
  }
  const plus = save.value.plus;
  if (plus.active && Date.now() - (plus.lastStipend ?? 0) > 7 * 86400_000) {
    edit((x) => { x.gems += 50; x.plus.lastStipend = Date.now(); });
    setTimeout(() => toast('+50 moonstones: your weekly Plus thank-you', IcoStone), 2600);
  }
  if (phase.value === 'day' && save.value.onboarded) setTimeout(() => { const h = new Date().getHours(); say(h >= 20 || h < 4 ? lines.evening() : lines.day()); }, 2200);
  document.getElementById('boot')?.classList.add('gone');
}

void boot();
