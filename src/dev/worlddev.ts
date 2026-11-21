// [world] Preview page for the world builder: seasons, weather, time of day and the cinematics.
// dev-world.html?hour=22&season=winter&wx=snow&view=home&cine=dep
//   &still=1           draw single frames only (for screenshots; sets window.__ready when drawn)
//   &cam=x,y,z,tx,ty,tz[,fov]  a fixed camera (e.g. a forest floor close-up)
//   &t=seconds         fast-forward the world before the still frame
//   &cineT=seconds     with still=1 and cine=dep|arr: run the cinematic that far, then draw
// In the console: __weather('rain'), __season('autumn', 0.8), go(seconds) to fast-forward and draw.
import * as THREE from 'three';
import { playArrival, playDeparture } from '../world/cinematics.ts';
import { Scene, type View } from '../world/scene.ts';
import type { Season } from '../world/astro.ts';
import type { WeatherKind } from '../world/weather.ts';

const q = new URLSearchParams(location.search);
const t0 = performance.now();
const sc = new Scene(document.getElementById('c') as HTMLCanvasElement, { palette: q.get('pal') ?? 'tabby', outfit: {} }, q.get('q') === 'low' ? 'low' : 'high');
console.log('[w] scene built in ' + Math.round(performance.now() - t0) + 'ms');
const w = window as unknown as Record<string, unknown>;
w.sc = sc;
if (q.get('season')) (w.__season as (s: Season, t?: number) => void)(q.get('season') as Season, q.get('st') ? +q.get('st')! : 0.5);
if (q.get('wx')) (w.__weather as (k: WeatherKind, i?: number) => void)(q.get('wx') as WeatherKind, q.get('wi') ? +q.get('wi')! : 0.85);
else (w.__weather as (k: WeatherKind | null, i?: number) => void)(null);
sc.setView((q.get('view') ?? 'home') as View);
if (q.get('hour')) sc.setHour(+q.get('hour')!);
const cam = q.get('cam')?.split(',').map(Number);
if (cam && cam.length >= 6) {
  const from = new THREE.Vector3(cam[0], cam[1], cam[2]), at = new THREE.Vector3(cam[3], cam[4], cam[5]);
  const d = from.clone().sub(at), dist = d.length();
  sc.director = () => ({ yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y / dist), dist, target: at, fov: cam[6] || undefined, snap: true });
}
sc.snapCamera();
for (let i = 0; i < 30; i++) sc.step(1 / 30, false);
/** Fast-forward the world by `s` seconds at 30 fps, then draw one frame. */
w.go = (s: number) => { for (let i = 0; i < Math.round(s * 30); i++) sc.step(1 / 30, false); sc.step(0.001, true); };
w.dep = () => playDeparture(sc, { onDone: () => console.log('[w] departure done') });
w.arr = () => playArrival(sc, { onLanded: () => console.log('[w] landed'), onDone: () => console.log('[w] arrival done') });
if (q.get('cine') === 'dep') (w.dep as () => void)();
if (q.get('cine') === 'arr') (w.arr as () => void)();

if (q.get('still')) {
  // wait for the hand-made models, then draw a settled frame
  void sc.flora.ready.then(() => {
    const ff = +(q.get('cineT') ?? q.get('t') ?? 1.5);
    (w.go as (s: number) => void)(ff);
    const info = sc.renderer.info.render;
    console.log('[w] still at ' + Math.round(performance.now() - t0) + 'ms, leaf cards ' + sc.flora.foliage.count + ', calls ' + info.calls + ', tris ' + info.triangles);
    w.__ready = true;
  });
} else sc.start();
