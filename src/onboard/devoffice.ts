// Dev preview of Hollow & Co.'s office without the forest (dev-office.html; the window shows its painted view).
//   ?shot=establish|pip|form|...   just the office, a camera shot     ?hour=9.5   time of day     ?species=barn
//   ?intro=1&ob=<step>&obsel=...    the real interview on a light stand-in scene (same dev params as the app)
//   ?intro=1&boot=1                 the whole opening: the loading clock, the dive, the pull-back
import * as THREE from 'three';
import { h, render } from 'preact';
import { Office, type ShotName } from './office.ts';
import { sceneRef } from '../ui/state.ts';
import { Post } from '../world/post.ts';
import type { Stage } from '../world/scene.ts';

const q = new URLSearchParams(location.search);
const cv = document.getElementById('c') as HTMLCanvasElement;
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
R.setPixelRatio(Math.min(2, devicePixelRatio));
R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
const W = window as unknown as Record<string, unknown>;

if (q.has('talk')) {
  // ?talk=<line>|<line>&size=26&w=560&voice=pip|barnaby&scrim=0.2   the dialogue engine (ui/talk.ts) on its own;
  // window.talkAt(t, i) shows line i as it is t seconds after it started (deterministic frames for screenshots)
  const { TalkView } = await import('../ui/talk.ts');
  const { fontsReady } = await import('./fonts.ts');
  await fontsReady();
  cv.style.display = 'none';
  document.body.style.background = q.get('bg') ?? 'repeating-linear-gradient(90deg,#0d4a34 0 22px,#0a3a29 22px 26px,#c9a040 26px 27px,#0d4a34 27px 44px)';
  const lines = q.get('talk')!.split('|');
  const mk = () => {
    const v = new TalkView({ size: Number(q.get('size') ?? 26), maxWidth: Number(q.get('w') ?? Math.min(innerWidth - 12, 560)), anchor: 'top', voice: (q.get('voice') as 'pip') ?? 'pip', scrim: Number(q.get('scrim') ?? 0.2), tag: true });
    Object.assign(v.canvas.style, { position: 'fixed', left: '0', top: '40px' });
    document.body.appendChild(v.canvas);
    return v;
  };
  let v = mk();
  const place = () => { v.canvas.style.left = Math.round((innerWidth - v.cssW) / 2) + 'px'; };
  W.talkAt = (t: number, i = 0, prev = -1) => {
    v.dispose(); v = mk();
    if (prev >= 0) { v.say(lines[prev], { who: 'PIP · HEAD OF SLEEP', instant: true }); for (let k = 0; k < 60; k++) v.step(1 / 60); }
    v.say(lines[i], { who: 'PIP · HEAD OF SLEEP' });
    for (let k = 0; k < Math.round(t * 60); k++) v.step(1 / 60);
    place();
    return v.text;
  };
  if (!q.has('still')) {
    v.say(lines[0], { who: 'PIP · HEAD OF SLEEP' });
    let last = performance.now(), i = 0;
    const loop = (now: number) => { const dt = (now - last) / 1000; last = now; if (!W.frozen) { v.step(dt); place(); if (!v.typing && v.text && (W.auto ?? true)) { W.autoT = (W.autoT as number ?? 0) + dt; if ((W.autoT as number) > 2) { W.autoT = 0; i = (i + 1) % lines.length; v.say(lines[i], { who: 'PIP · HEAD OF SLEEP' }); } } } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  W.talk = () => v;
  W.__ready = true;
} else if (q.has('ink')) {
  // ?ink=RECEIVED,APPROVED&w=160&h=60   rubber-stamp impressions (ink.ts) on the form's paper: wet, half dry, dry
  const { fontsReady } = await import('./fonts.ts');
  await fontsReady();
  const { inkStamp } = await import('./ink.ts');
  const { sheetURL } = await import('./panelart.ts');
  cv.style.display = 'none';
  const w = Number(q.get('w') ?? 160), h = Number(q.get('h') ?? 60);
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(3,${w + 40}px);gap:8px;padding:12px;background:#3a2414 url(${sheetURL(220, 160, 3)}) 0 0/100% 100%;width:max-content`;
  document.body.appendChild(grid);
  q.get('ink')!.split(',').forEach((word, wi) => {
    for (const dry of [1e9, 2200, 1]) {
      const cell = document.createElement('div');
      cell.style.cssText = `position:relative;width:${w}px;height:${h}px;margin:20px;transform:rotate(-4deg)`;
      cell.appendChild(inkStamp(word, 'HOLLOW & CO.', { w, h, seed: wi * 3 + 1 + (dry === 1 ? 1 : 0), dryMs: dry }));
      grid.appendChild(cell);
    }
  });
  setTimeout(() => { W.__ready = true; }, 1200);
} else if (q.has('props') || q.has('phone')) {
  // ?props=drink:coffee,tape:rain,deck,...  a sheet of answer objects on paper (&cols=4&pen=1)
  // ?phone=1&t=6.5                            the fake phone at a moment of its film
  const { fontsReady } = await import('./fonts.ts');
  await fontsReady();
  cv.style.display = 'none';
  document.body.style.background = '#e9dcc0';
  if (q.has('phone')) {
    const { FakePhone } = await import('../ui/phone/phone.tsx');
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;gap:24px;padding:16px;flex-wrap:wrap';
    document.body.appendChild(root);
    const ts = (q.get('t') ?? '2,6.6,9.8').split(',').map(Number);
    render(h('div', { style: 'display:flex;gap:18px' }, ts.map((t) => h(FakePhone, { k: Number(q.get('k') ?? 2), wake: '07:00', hour12: false, paused: t }))), root);
  } else {
    const { Overlay3D } = await import('./overlay3d.ts');
    const { CardModels } = await import('./cards.ts');
    const { officeMats } = await import('./mats.ts');
    const ov = new Overlay3D();
    ov.setScale(Number(q.get('k') ?? 2));
    const cm = new CardModels(officeMats(), (sp) => ({ skin: 'owl', species: sp, palette: sp, outfit: {} }));
    await cm.ready;
    const keys = q.get('props')!.split(',');
    const cols = Number(q.get('cols') ?? 4), size = Number(q.get('size') ?? 160);
    const grid = document.createElement('div');
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},${size}px);gap:10px;padding:10px;font:14px monospace;color:#3a2a1a`;
    document.body.appendChild(grid);
    keys.forEach((k, i) => {
      const cell = document.createElement('div');
      cell.style.cssText = `height:${size}px;position:relative;border:1px dashed #b8a47a`;
      const lab = document.createElement('span'); lab.textContent = k; lab.style.cssText = 'position:absolute;left:2px;top:0';
      cell.appendChild(lab);
      grid.appendChild(cell);
      const m = cm.model(k);
      if (m) ov.setSlot('s' + i, cell, m.obj, m.opts);
      if (q.get('on')?.split(',').includes(k)) ov.setState('s' + i, 'on');
    });
    if (q.has('pen')) {
      const { FloatingPen } = await import('./pen.ts');
      const pen = new FloatingPen(ov);
      pen.len = Number(q.get('pen')) || 150;
      pen.rest = { x: innerWidth * 0.5, y: innerHeight * 0.5 };
      addEventListener('pointermove', (e) => pen.follow(e.clientX, e.clientY));
      W.pen = pen;
    }
    let last = performance.now();
    const loop = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; ov.update(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    W.ov = ov; W.cm = cm;
    setTimeout(() => { W.__ready = true; }, 1500);
  }
} else if (q.has('intro')) {
  // a stand-in for world/scene.ts's Scene: just what the interview uses
  const stand = {
    renderer: R, quality: 'high' as const, stage: null as Stage | null, post: new Post(R, 'high'),
    setStage(st: Stage | null) { if (this.stage === st) return; this.stage?.dispose?.(); this.stage = st; st?.resize?.(innerWidth, innerHeight); },
    setView() { /* */ }, snapCamera() { /* */ }, owl: { play() { /* */ } },
  };
  stand.post.enabled = true;
  (sceneRef as { current: unknown }).current = stand;
  W.stand = stand;
  const ray = new THREE.Raycaster();
  const fwd = (type: 'down' | 'move' | 'up') => (e: PointerEvent) => {
    const st = stand.stage;
    if (!st) return;
    if (type === 'down') cv.setPointerCapture(e.pointerId);
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), st.camera);
    st.pointer?.(type, e.clientX, e.clientY, ray.ray.clone(), e);
  };
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', fwd('down')); cv.addEventListener('pointermove', fwd('move')); cv.addEventListener('pointerup', fwd('up'));
  const resize = () => { R.setSize(innerWidth, innerHeight, false); stand.stage?.resize?.(innerWidth, innerHeight); };
  addEventListener('resize', resize);
  resize();
  // ?warp=N runs N simulation steps per drawn frame (slow software GL in screenshots)
  const warp = Math.max(1, Number(q.get('warp') ?? 1));
  let last = performance.now(), t = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const st = stand.stage as (Stage & { step?: (dt: number, t: number) => void }) | null;
    if (st) {
      for (let i = 1; i < warp; i++) { t += 1 / 30; st.step?.(1 / 30, t); }
      t += dt; st.update(dt, t); R.setRenderTarget(null); R.render(st.scene, st.camera);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // the loading clock (copied from index.html) for the opening
  if (q.has('boot')) {
    const html = await (await fetch('/index.html')).text();
    const a = html.indexOf('<!-- boot:begin'), z = html.indexOf('<!-- boot:end -->');
    const box = document.createElement('div');
    box.innerHTML = html.slice(a, z);
    document.body.append(...Array.from(box.childNodes));
    // [clock12] scripts set by innerHTML don't run: run the block's painter
    { const sc = document.querySelector('#boot + script'); if (sc) { const n = document.createElement('script'); n.textContent = sc.textContent; sc.replaceWith(n); } }
    const b = document.getElementById('boot')!;
    b.classList.add('hold');
    await import('./boot.ts');
    setTimeout(() => b.classList.add('gone'), 1500);
  }
  const { Intro } = await import('./intro.tsx');
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(h(Intro, {}), root);
} else {
  const species = q.get('species') ?? 'tawny';
  const office = new Office({ skin: 'owl', species, palette: species, outfit: {} }, R, 'high', null);
  const resize = () => { R.setSize(innerWidth, innerHeight, false); office.resize(innerWidth, innerHeight); };
  addEventListener('resize', resize);
  resize();
  if (q.get('hour')) office.window(Number(q.get('hour')));
  office.cut((q.get('shot') as ShotName) ?? 'establish');
  W.office = office;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    office.update(dt, now / 1000);
    R.setRenderTarget(null);
    R.render(office.scene, office.camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  void office.ready.then(() => { setTimeout(() => { W.__ready = true; }, 1500); });
}
