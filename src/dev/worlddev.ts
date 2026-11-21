// [world] Preview page for the world builder: seasons, weather, time of day and the cinematics.
// dev-world.html?hour=22&season=winter&wx=snow&view=home&cine=dep
// In the console: __weather('rain'), __season('autumn', 0.8), go(seconds) to fast-forward and draw.
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
sc.setFurniture({ g_back: 'nestbed', g_left: 'moonlamp', g_right: 'bookshelf', g_mid: 'roundrug', w_back: 'cuckoo', g_frontL: 'fernpot' });
if (q.get('season')) (w.__season as (s: Season, t?: number) => void)(q.get('season') as Season, q.get('st') ? +q.get('st')! : 0.5);
if (q.get('wx')) (w.__weather as (k: WeatherKind, i?: number) => void)(q.get('wx') as WeatherKind, q.get('wi') ? +q.get('wi')! : 0.85);
sc.setView((q.get('view') ?? 'home') as View);
if (q.get('hour')) sc.setHour(+q.get('hour')!);
sc.snapCamera();
for (let i = 0; i < 30; i++) sc.step(1 / 30, false);
/** Fast-forward the world by `s` seconds at 30 fps, then draw one frame. */
w.go = (s: number) => { for (let i = 0; i < Math.round(s * 30); i++) sc.step(1 / 30, false); sc.step(0.001, true); };
w.dep = () => playDeparture(sc, { onDone: () => console.log('[w] departure done') });
w.arr = () => playArrival(sc, { onLanded: () => console.log('[w] landed'), onDone: () => console.log('[w] arrival done') });
if (q.get('cine') === 'dep') (w.dep as () => void)();
if (q.get('cine') === 'arr') (w.arr as () => void)();
sc.start();
