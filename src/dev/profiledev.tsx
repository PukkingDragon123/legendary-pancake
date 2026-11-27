// [profile] Dev page for the profile and its photo studio without the forest (dev-profile.html): a light stand-in for
// world/scene.ts's Scene (the renderer, the post chain, setStage), the material kit and the Profile panel.
//   ?tab=studio|frames|friends|ranks   the tab to open on      ?friends=1   add two sample friends      ?photo=1  keep a sample photo
import * as THREE from 'three';
import { render } from 'preact';
import { Post } from '../world/post.ts';
import type { Stage } from '../world/scene.ts';
import { panel, sceneRef } from '../ui/state.ts';
import '../ui/style.css';
import { fontReady } from '../ui/font.ts';
import { installText3D } from '../ui/text3d.tsx';
import { installRealSkin } from '../ui/real/skin.ts';
import { loadTextures } from '../ui/real/tex.ts';
import { installIconSet } from '../ui/chrome/iconset.ts';
import { installArtPx } from '../gfx/artpx.ts';
import { Toasts } from '../ui/kit.tsx';

const q = new URLSearchParams(location.search);
const W = window as unknown as Record<string, unknown>;
installArtPx();
await loadTextures();
installRealSkin();
await Promise.race([installIconSet(), new Promise((r) => setTimeout(r, 2500))]);
await fontReady();
installText3D();

if (q.get('frames')) {
  // ?frames=1: every portrait frame at the name sign's size and big, over a backdrop plate (crisp, at device size)
  const { FRAME_ART_IDS } = await import('../ui/chrome/frameart.ts');
  const { Framed } = await import('../ui/profile/faces.tsx');
  const { backdropSwatch } = await import('../world/stages/backdrops.ts');
  await import('../ui/profile/profile.tsx');
  document.body.style.overflow = 'auto';
  document.body.style.background = q.get('bg') ?? '#6b4a30';
  const ids = (q.get('ids') ?? FRAME_ART_IDS.join(',')).split(',');
  const big = +(q.get('big') ?? 170);
  render(<div style="display:flex;flex-wrap:wrap;gap:14px;padding:12px">{ids.map((id, i) => <div style="display:flex;align-items:flex-end;gap:6px;font:11px monospace;color:#f3e4c8"><Framed src={backdropSwatch(['meadow', 'forest', 'sage', 'dusk', 'rose', 'stars', 'cream'][i % 7], 256)} frame={id} size={78} photo /><Framed src={backdropSwatch(['meadow', 'forest', 'sage', 'dusk', 'rose', 'stars', 'cream'][i % 7], 256)} frame={id} size={big} photo />{id}</div>)}</div>, document.getElementById('ui')!);
  W.__ready = 1;
  await new Promise(() => { /* stay */ });
}
const cv = document.getElementById('world') as HTMLCanvasElement;
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
R.setPixelRatio(Math.min(2, devicePixelRatio));
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.NoToneMapping;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
const stand = {
  renderer: R, stage: null as Stage | null, post: new Post(R, q.get('q') === 'high' ? 'high' : 'low'), sky: { night: 0 },
  setStage(st: Stage | null) { if (this.stage === st) return; this.stage?.dispose?.(); this.stage = st; st?.resize?.(innerWidth, innerHeight); },
};
stand.post.enabled = q.get('post') !== '0';
(sceneRef as { current: unknown }).current = stand;
W.stand = stand;
const ray = new THREE.Raycaster();
const fwd = (type: 'down' | 'move' | 'up') => (e: PointerEvent) => {
  const st = stand.stage;
  if (!st) return;
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), st.camera);
  st.pointer?.(type, e.clientX, e.clientY, ray.ray.clone(), e);
};
cv.addEventListener('pointerdown', fwd('down')); addEventListener('pointermove', fwd('move')); addEventListener('pointerup', fwd('up'));
const resize = () => { R.setSize(innerWidth, innerHeight, false); stand.post.resize(innerWidth, innerHeight); stand.stage?.resize?.(innerWidth, innerHeight); };
addEventListener('resize', resize);
resize();
let last = performance.now(), t = 0;
const loop = (now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  const st = stand.stage;
  if (st) { R.shadowMap.autoUpdate = true; st.update(dt, t); stand.post.render(st.scene, st.camera, t, st.look ?? {}); }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

const { save, edit } = await import('../game/store.ts');
if (q.get('friends')) {
  const { encodeCode } = await import('../game/social.ts');
  const { addFriendCode } = await import('../game/friends.ts');
  const now = Date.now();
  addFriendCode(encodeCode({ v: 1, id: 'wren01', name: 'Wren', look: { skin: 'owl', species: 'snowy', palette: 'snowy', outfit: { head: 'beret' } }, frame: 'laurel', stats: { level: 6, streak: 9, best: 21, score: 84, hours: 7.6, nights: 14 }, at: now - 2 * 86400_000 }));
  addFriendCode(encodeCode({ v: 1, id: 'ash002', name: 'Ash', look: { skin: 'owl', species: 'barn', palette: 'barn', outfit: {} }, frame: 'moss', stats: { level: 3, streak: 4, best: 4, score: 71, hours: 6.9, nights: 5 }, at: now - 86400_000 }));
}
if (q.get('streak')) edit((s) => { s.streak = +q.get('streak')!; s.bestStreak = Math.max(s.bestStreak, s.streak); s.xp = 900; });
W.save = save;
const { Profile, profileTab } = await import('../ui/profile/profile.tsx');
if (q.get('tab')) profileTab.value = q.get('tab') as never;
panel.value = 'profile';
const ui = document.getElementById('ui')!;
render(<div class="layer"><Profile /><Toasts /></div>, ui);
W.hh = { save, panel };
setTimeout(() => { W.__ready = 1; }, 500);
