// [world] Weather that follows the real world. With the player's permission (never asked on load:
// see enableLiveWeather) it reads the current conditions from Open-Meteo every 30 minutes;
// otherwise, and always inside the artifact, it generates believable weather from the date, hour,
// season and latitude so the sky changes through the day. The Weather class (a scene ticker)
// eases between states and drives everything you can see: pixel rain streaks with splashes and
// ripples, storms with lightning, drifting snow that settles white on every upward surface out in
// the open, mist, a pixel cloud layer, wind in the grass and trees, wet dark ground, a frozen pond.
import * as THREE from 'three';
import { signal } from '@preact/signals';
import { sound } from '../audio/sound.ts';
import { wind } from '../gfx/box.ts';
import { hash } from '../gfx/noise.ts';
import { moonPhase, seasonOf, type Season, type SeasonInfo } from './astro.ts';
import { SPR } from './fx.ts';
import { GRASS } from './grass.ts';
import { groundY, HALF, N, POND, pondD, WATER_Y } from './layout.ts';
import { place, setPlace, today } from './sky.ts';
import type { Scene } from './scene.ts';

export type WeatherKind = 'clear' | 'clouds' | 'rain' | 'storm' | 'snow' | 'fog';
export interface WeatherState {
  kind: WeatherKind;
  /** 0..1 */
  intensity: number;
  /** air temperature, degrees C */
  temp?: number;
  /** wind speed, km/h */
  windKmh?: number;
  source: 'live' | 'seasonal';
}

/** The current weather (what the scene is easing towards). */
export const weather = signal<WeatherState>({ kind: 'clear', intensity: 0.5, temp: 15, source: 'seasonal' });
/** The real season where the player is (or a dev override). */
export const season = signal<SeasonInfo>(seasonOf(new Date(), place().lat));

const LIVE_KEY = 'hoot-hollow:weather';
const IS_ARTIFACT = import.meta.env.MODE === 'artifact';

// ---------------------------------------------------------------- seasonal generator

const PROB: Record<Season, [WeatherKind, number][]> = {
  spring: [['clear', 0.34], ['clouds', 0.3], ['rain', 0.24], ['storm', 0.04], ['fog', 0.08]],
  summer: [['clear', 0.5], ['clouds', 0.24], ['rain', 0.12], ['storm', 0.11], ['fog', 0.03]],
  autumn: [['clear', 0.24], ['clouds', 0.3], ['rain', 0.28], ['storm', 0.03], ['fog', 0.15]],
  winter: [['clear', 0.26], ['clouds', 0.3], ['rain', 0.28], ['storm', 0.01], ['fog', 0.15]],
};
const MEAN: Record<Season, number> = { winter: 1, spring: 11, summer: 21, autumn: 11 };

function pickKind(s: Season, h: number, tropic: boolean): WeatherKind {
  const list = PROB[s];
  let total = 0;
  for (const [k, p] of list) total += tropic && (k === 'rain' || k === 'storm') ? p * 1.6 : p;
  let x = h * total;
  for (const [k, p] of list) { x -= tropic && (k === 'rain' || k === 'storm') ? p * 1.6 : p; if (x <= 0) return k; }
  return 'clear';
}

/** Believable weather for a moment, from the date, hour, season and latitude only. */
export function seasonalWeather(now: Date, lat: number): WeatherState {
  const info = seasonOf(now, lat);
  const day = now.getFullYear() * 400 + Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
  const hr = now.getHours() + now.getMinutes() / 60;
  const block = Math.floor(hr / 3);
  const tropic = Math.abs(lat) < 18;
  const base = pickKind(info.season, hash(day, 1, 0, 77), tropic);
  // weather holds for a few hours at a time, with a fresh roll now and then
  let kind = hash(day, block, 2, 77) < 0.62 ? base : pickKind(info.season, hash(day, block, 3, 77), tropic);
  // misty mornings in the cool half of the year, thunder in summer afternoons
  if ((info.season === 'autumn' || info.season === 'winter') && hr >= 5 && hr < 9.5 && hash(day, 4, 0, 77) < 0.38) kind = 'fog';
  if (info.season === 'summer' && hr >= 14 && hr < 19 && kind === 'rain' && hash(day, 5, 0, 77) < 0.5) kind = 'storm';
  // temperature: season mean, warmer towards the equator, a daily swing and day-to-day noise
  const lt = Math.abs(lat);
  let temp = MEAN[info.season] + (40 - lt) * 0.32 + Math.sin(((hr - 9) / 24) * Math.PI * 2) * 4.5 + (hash(day, 6, 0, 77) - 0.5) * 8;
  if (info.season === 'winter') temp -= info.cold * 6;
  if (tropic) temp = Math.max(temp, 21);
  if (kind === 'rain' && temp <= 1.2) kind = 'snow';
  if (kind === 'storm' && temp <= 1.2) kind = 'snow';
  const intensity = 0.35 + hash(day, block, 7, 77) * 0.6;
  return { kind, intensity, temp: Math.round(temp * 10) / 10, windKmh: Math.round(6 + hash(day, block, 8, 77) * 18 + (kind === 'storm' ? 25 : 0)), source: 'seasonal' };
}

/** WMO weather code (Open-Meteo) to our kinds. */
export function fromWmo(code: number, temp?: number, windKmh?: number): WeatherState {
  let kind: WeatherKind = 'clear', intensity = 0.5;
  if (code === 0) { kind = 'clear'; intensity = 0.2; }
  else if (code <= 2) { kind = code === 1 ? 'clear' : 'clouds'; intensity = code === 1 ? 0.6 : 0.45; }
  else if (code === 3) { kind = 'clouds'; intensity = 1; }
  else if (code === 45 || code === 48) { kind = 'fog'; intensity = code === 48 ? 1 : 0.75; }
  else if (code >= 51 && code <= 57) { kind = 'rain'; intensity = 0.25 + (code - 51) * 0.06; }
  else if (code >= 61 && code <= 67) { kind = 'rain'; intensity = code === 61 || code === 66 ? 0.4 : code === 63 ? 0.7 : 1; }
  else if (code >= 71 && code <= 77) { kind = 'snow'; intensity = code === 71 ? 0.4 : code === 73 ? 0.7 : code === 77 ? 0.3 : 1; }
  else if (code >= 80 && code <= 82) { kind = 'rain'; intensity = 0.5 + (code - 80) * 0.25; }
  else if (code === 85 || code === 86) { kind = 'snow'; intensity = code === 85 ? 0.5 : 0.9; }
  else if (code >= 95) { kind = 'storm'; intensity = code === 95 ? 0.75 : 1; }
  return { kind, intensity, temp, windKmh, source: 'live' };
}

function readCache(): { at: number; state: WeatherState } | null {
  try { const raw = localStorage.getItem(LIVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeCache(state: WeatherState) {
  try { localStorage.setItem(LIVE_KEY, JSON.stringify({ at: Date.now(), state })); } catch { /* storage blocked */ }
}

async function fetchLive(lat: number, lon: number): Promise<WeatherState | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=weather_code,temperature_2m,wind_speed_10m`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json() as { current?: { weather_code?: number; temperature_2m?: number; wind_speed_10m?: number } };
    const c = j.current;
    if (!c || typeof c.weather_code !== 'number') return null;
    const st = fromWmo(c.weather_code, c.temperature_2m, c.wind_speed_10m);
    writeCache(st);
    return st;
  } catch { return null; }
}

function position(): Promise<GeolocationPosition | null> {
  return new Promise((res) => {
    try { navigator.geolocation.getCurrentPosition((p) => res(p), () => res(null), { maximumAge: 3 * 3600_000, timeout: 15_000 }); }
    catch { res(null); }
  });
}

let liveOn = false;
/** Ask for the player's location and switch to their real weather. Resolves true when it worked. */
export async function enableLiveWeather(): Promise<boolean> {
  if (IS_ARTIFACT || typeof navigator === 'undefined' || !navigator.geolocation) return false;
  const p = await position();
  if (!p) return false;
  setPlace(p.coords.latitude, p.coords.longitude);
  try { localStorage.setItem(LIVE_KEY + ':on', '1'); } catch { /* storage blocked */ }
  liveOn = true;
  const st = await fetchLive(p.coords.latitude, p.coords.longitude);
  if (st) weather.value = st;
  season.value = seasonOf(new Date(), p.coords.latitude);
  return !!st;
}
/** Whether live weather was switched on before (and permission is still there). */
async function liveAllowed(): Promise<boolean> {
  if (IS_ARTIFACT || typeof navigator === 'undefined') return false;
  let on = false;
  try { on = localStorage.getItem(LIVE_KEY + ':on') === '1'; } catch { /* storage blocked */ }
  if (!on) {
    // the player may have granted location to the app for something else: use it, never prompt
    try { const s = await navigator.permissions?.query({ name: 'geolocation' as PermissionName }); on = s?.state === 'granted'; } catch { on = false; }
  }
  return on;
}

// ---------------------------------------------------------------- snow & wet on every surface

/** Shared uniforms for the weather patch on lit materials. */
export const WX = {
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uSnowCol: { value: new THREE.Color(0xf2f6ff) },
  uSnowMap: { value: null as THREE.Texture | null },
  uSnowMapOn: { value: 0 },
};

const WX_VERT_PARS = /* glsl */ `varying vec3 vWxN; varying vec3 vWxP;`;
const WX_VERT = /* glsl */ `
vWxN = normalize(inverseTransformDirection(transformedNormal, viewMatrix));
{ vec4 wxp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wxp = instanceMatrix * wxp;
#endif
  vWxP = (modelMatrix * wxp).xyz; }`;
const WX_FRAG_PARS = /* glsl */ `
varying vec3 vWxN; varying vec3 vWxP;
uniform float uSnow; uniform float uWet; uniform vec3 uSnowCol; uniform sampler2D uSnowMap; uniform float uSnowMapOn;
float wxh(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }`;
const WX_FRAG = /* glsl */ `
if (uSnow > 0.001 || uWet > 0.001) {
  float up = vWxN.y;
  float open = 1.0, rim = 0.0;
  if (uSnowMapOn > 0.5) {
    // sample the column this surface belongs to (a hair inside it)
    vec2 sp = vWxP.xz - vWxN.xz * 0.05;
    vec2 suv = vec2((sp.x + ${HALF.toFixed(1)}) / ${N.toFixed(1)}, (${HALF.toFixed(1)} - sp.y) / ${N.toFixed(1)});
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
      float top = 40.0 - (0.5 + texture2D(uSnowMap, suv).r * 59.5);
      open = step(top - 0.14, vWxP.y);
      // a lip of snow along the top edge of every exposed side face
      rim = (1.0 - step(0.35, abs(up))) * step(top - 0.09, vWxP.y) * step(vWxP.y, top + 0.02);
    }
  }
  vec3 q = floor(vWxP * 16.0 + 0.001);
  float n = wxh(q) * 0.5 + wxh(floor(q / 3.0)) * 0.5;
  float snow = uSnow * max(open * smoothstep(0.3, 0.75, up), rim * 0.95) * step(n * 0.85, uSnow * 1.15 - 0.05);
  float wet = uWet * open * smoothstep(0.15, 0.7, up);
  diffuseColor.rgb *= 1.0 - wet * 0.32;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol * (0.9 + 0.1 * wxh(q + 7.0)), snow);
}`;

/** Add the snow/wet patch to a lit material (keeps any patch already on it). */
export function patchWeather(m: THREE.Material) {
  if (m.userData.wx) return;
  const ok = (m as THREE.MeshLambertMaterial).isMeshLambertMaterial || (m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshPhongMaterial).isMeshPhongMaterial;
  m.userData.wx = true;
  if (!ok || (m.transparent && m.opacity < 0.6)) return;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, WX);
    const vert = sh.vertexShader.includes('#include <defaultnormal_vertex>') ? WX_VERT : WX_VERT.replace('normalize(inverseTransformDirection(transformedNormal, viewMatrix))', 'vec3(0.0, 1.0, 0.0)');
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + WX_VERT_PARS)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + vert);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WX_FRAG_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + WX_FRAG);
  };
  const base = prevKey.call(m);
  m.customProgramCacheKey = () => base + '|wx';
  m.needsUpdate = true;
}

/** Top-down depth of everything solid, so snow only settles where the sky can see. */
class SnowMap {
  readonly target: THREE.WebGLRenderTarget;
  private cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.5, 60);
  private depthMat = new THREE.MeshDepthMaterial();
  constructor() {
    this.target = new THREE.WebGLRenderTarget(512, 512, { depthBuffer: true });
    this.target.depthTexture = new THREE.DepthTexture(512, 512);
    this.target.depthTexture.minFilter = this.target.depthTexture.magFilter = THREE.NearestFilter;
    this.cam.position.set(0, 40, 0);
    this.cam.up.set(0, 0, -1);
    this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld();
  }
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) return;
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      const first = Array.isArray(m) ? m[0] : m;
      if ((o as THREE.Points).isPoints || (o as THREE.Light).isLight || o.userData.noSnowMap || (first && ((first as THREE.ShaderMaterial).isShaderMaterial || first.transparent || (first as THREE.MeshBasicMaterial).isMeshBasicMaterial))) { o.visible = false; hidden.push(o); }
    });
    const prevTarget = renderer.getRenderTarget(), prevOverride = scene.overrideMaterial, prevAuto = renderer.shadowMap.autoUpdate;
    scene.overrideMaterial = this.depthMat;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.cam);
    renderer.setRenderTarget(prevTarget);
    scene.overrideMaterial = prevOverride;
    renderer.shadowMap.autoUpdate = prevAuto;
    for (const o of hidden) o.visible = true;
    WX.uSnowMap.value = this.target.depthTexture;
    WX.uSnowMapOn.value = 1;
  }
}

// ---------------------------------------------------------------- rain and snow

const PRECIP_VS = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox; uniform vec2 uDrift; uniform float uFall; uniform float uLen;
uniform float uSnow; uniform vec2 uRes; uniform float uPx;
varying float vA;
void main() {
  float fall = uFall * (0.75 + aSeed.w * 0.5);
  vec3 sp = aSeed.xyz * uBox + vec3(uDrift.x * uTime, -fall * uTime, uDrift.y * uTime);
  if (uSnow > 0.5) sp.xz += vec2(sin(uTime * 0.9 + aSeed.w * 31.0), cos(uTime * 0.7 + aSeed.w * 17.0)) * 0.35;
  vec3 p = mod(sp - uCenter + uBox * 0.5, uBox) + uCenter - uBox * 0.5;
  vec3 dir = normalize(vec3(uDrift.x, -fall, uDrift.y));
  vec4 a = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec4 b = projectionMatrix * viewMatrix * vec4(p - dir * uLen, 1.0);
  vec2 px = uRes * 0.5;
  if (uSnow > 0.5) {
    float s = (aSeed.w > 0.8 ? 3.0 : aSeed.w > 0.35 ? 2.0 : 1.0) * uPx;
    vec2 ctr = (floor(a.xy / a.w * px) + 0.5) / px;
    vec2 off = vec2(position.x, position.y * 2.0 - 1.0) * s * 0.5 / px;
    gl_Position = vec4((ctr + off) * a.w, a.zw);
  } else {
    vec4 c = mix(a, b, position.y);
    vec2 sa = a.xy / a.w * px, sb = b.xy / b.w * px;
    vec2 d = sb - sa;
    vec2 perp = length(d) > 0.001 ? normalize(vec2(-d.y, d.x)) : vec2(1.0, 0.0);
    c.xy += perp * position.x * uPx * 0.5 / px * c.w;
    gl_Position = c;
  }
  // fade towards the edges of the box and right at the camera
  vec3 e = abs(p - uCenter) / (uBox * 0.5);
  float edge = 1.0 - smoothstep(0.7, 1.0, max(e.x, max(e.y, e.z)));
  float near = smoothstep(0.8, 2.6, a.w);
  vA = edge * near * (0.55 + aSeed.w * 0.45);
}`;
const PRECIP_FS = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha;
varying float vA;
void main() {
  float a = vA * uAlpha;
  if (a < 0.02) discard;
  gl_FragColor = vec4(uCol, a);
}`;

class Precip {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  constructor(readonly max: number, snow: boolean) {
    const g = (this.geo = new THREE.InstancedBufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const seed = new Float32Array(max * 4);
    let s = snow ? 991 : 313;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < max * 4; i++) seed[i] = rnd();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PRECIP_VS, fragmentShader: PRECIP_FS, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: snow ? new THREE.Vector3(22, 13, 22) : new THREE.Vector3(24, 15, 24) },
        uDrift: { value: new THREE.Vector2() }, uFall: { value: snow ? 1.1 : 13 }, uLen: { value: snow ? 0 : 0.55 }, uSnow: { value: snow ? 1 : 0 },
        uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 }, uCol: { value: new THREE.Color(snow ? 0xffffff : 0xc6dcff) }, uAlpha: { value: snow ? 1 : 0.55 },
      },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.userData.noSnowMap = true;
  }
  set amount(k: number) { this.geo.instanceCount = Math.round(this.max * Math.max(0, Math.min(1, k))); this.mesh.visible = this.geo.instanceCount > 0; }
}

// ---------------------------------------------------------------- the weather director

interface Vis { cloud: number; overcast: number; fog: number; rain: number; snow: number; storm: number; wind: number; cold: number; wet: number; cover: number; aurora: number; ice: number }

function targetFor(w: WeatherState, info: SeasonInfo, auroraNight: boolean): Omit<Vis, 'wet' | 'cover'> {
  const i = w.intensity, cold = (w.temp ?? 10) < 1 ? 0.45 : 0;
  const v = { cloud: 0.18, overcast: 0, fog: 0, rain: 0, snow: 0, storm: 0, wind: 0.32, cold, aurora: 0, ice: (w.temp ?? 10) < -1.5 ? 1 : 0 };
  switch (w.kind) {
    case 'clear': v.cloud = 0.02 + i * 0.14; v.aurora = auroraNight ? 1 : 0; break;
    case 'clouds': v.cloud = 0.42 + i * 0.5; v.overcast = Math.max(0, i - 0.55) * 0.9; v.wind = 0.45; break;
    case 'rain': v.cloud = 0.9; v.overcast = 0.5 + i * 0.35; v.rain = 0.35 + i * 0.65; v.wind = 0.5 + i * 0.35; break;
    case 'storm': v.cloud = 1; v.overcast = 0.85 + i * 0.12; v.rain = 1; v.storm = 0.5 + i * 0.5; v.wind = 1 + i * 0.4; break;
    case 'snow': v.cloud = 0.85; v.overcast = 0.42 + i * 0.25; v.snow = 0.35 + i * 0.65; v.cold = 0.85; v.wind = 0.28; break;
    case 'fog': v.cloud = 0.3; v.overcast = 0.3; v.fog = 0.55 + i * 0.4; v.wind = 0.08; break;
  }
  if (w.windKmh !== undefined) v.wind = Math.max(v.wind * 0.6, Math.min(1.5, w.windKmh / 28));
  if (info.season === 'winter' && v.cold < 0.3) v.cold = 0.25;
  return v;
}

export class Weather {
  readonly vis: Vis = { cloud: 0.2, overcast: 0, fog: 0, rain: 0, snow: 0, storm: 0, wind: 0.32, cold: 0, wet: 0, cover: 0, aurora: 0, ice: 0 };
  private rain: Precip;
  private snowP: Precip;
  private snowMap = new SnowMap();
  private mapT = 0;
  private override: WeatherState | null = null;
  private seasonForced: Season | null = null;
  private refreshT = 0;
  private liveT = 0;
  private flash = 0;
  private strikeT = 3;
  private bolt: THREE.Mesh;
  private boltT = 0;
  private patchT = 0;
  private splashT = 0;
  private lastSeason = '';
  private rainSound = false;
  private snapNext = true;
  /** cinematics: look like this for a while without touching the real weather */
  hold: WeatherState | null = null;
  constructor(private sc: Scene) {
    const q = sc.quality === 'high';
    this.rain = new Precip(q ? 2400 : 1000, false);
    this.snowP = new Precip(q ? 1700 : 800, true);
    const bm = new THREE.MeshBasicMaterial({ color: 0xeef4ff, fog: false, transparent: true, depthWrite: false });
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), bm);
    this.bolt.frustumCulled = false; this.bolt.visible = false; this.bolt.renderOrder = -7; this.bolt.userData.noSnowMap = true;
    sc.scene.add(this.rain.mesh, this.snowP.mesh, this.bolt);
    sc.owl.node.userData.noSnowMap = true;
    sc.critters.group.userData.noSnowMap = true;
    this.patchAll();
    this.refresh();
    sc.tickers.add((dt, t) => this.tick(dt, t));
    void this.startLive();
    exposeDev(this);
  }

  /** Force a weather (dev / previews); null returns to the real weather. */
  set(kind: WeatherKind | null, intensity = 0.85, temp?: number) {
    this.override = kind ? { kind, intensity, temp: temp ?? (kind === 'snow' ? -3 : kind === 'clear' ? 12 : 9), source: 'seasonal' } : null;
    this.refresh();
  }
  /** Force a season (dev / previews); null returns to the real one. */
  setSeason(s: Season | null, t = 0.5) {
    this.seasonForced = s;
    season.value = s ? { season: s, t, cold: s === 'winter' ? 0.8 : 0 } : seasonOf(new Date(), place().lat);
  }
  /** Jump straight to the target look (screenshots, scene start). */
  snap(cover?: number) { this.snapNext = true; if (cover !== undefined) this.vis.cover = cover; }

  private refresh() {
    if (this.override) { weather.value = this.override; return; }
    const cache = readCache();
    if (liveOn && cache && Date.now() - cache.at < 3 * 3600_000) { weather.value = cache.state; return; }
    weather.value = seasonalWeather(new Date(), place().lat);
    if (!this.seasonForced) {
      const s = seasonOf(new Date(), place().lat);
      if (s.season !== season.value.season || Math.abs(s.t - season.value.t) > 0.02) season.value = s;
    }
  }

  private async startLive() {
    if (!(await liveAllowed())) return;
    liveOn = true;
    const cache = readCache();
    if (cache && Date.now() - cache.at < 30 * 60_000) { this.refresh(); return; }
    let p = place();
    if (p.source !== 'geo') {
      const pos = await position();
      if (!pos) { liveOn = false; return; }
      setPlace(pos.coords.latitude, pos.coords.longitude);
      p = place();
    }
    const st = await fetchLive(p.lat, p.lon);
    if (st && !this.override) weather.value = st;
  }

  /** Find lit materials the patch hasn't seen yet (new furniture, the house...). */
  patchAll() {
    this.sc.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      if (Array.isArray(m)) m.forEach(patchWeather); else patchWeather(m);
    });
  }

  private applySeason() {
    const s = season.value, key = s.season + s.t.toFixed(2);
    if (key === this.lastSeason) return;
    this.lastSeason = key;
    this.sc.flora.setSeason(s);
    this.sc.critters.setSeason(s.season, s.t);
    const tint: Record<Season, [number, number, number]> = { spring: [0.98, 1.06, 0.92], summer: [1, 1, 1], autumn: [1.1, 0.95, 0.72], winter: [0.9, 0.9, 0.86] };
    GRASS.uTint.value.setRGB(...tint[s.season]);
    // the painted ground follows along: golden leaf litter in autumn, faded in winter
    const ground = this.sc.terrain.group.getObjectByName('ground') as THREE.Mesh | undefined;
    const gt: Record<Season, number> = { spring: 0xf4fff0, summer: 0xffffff, autumn: 0xfff0d8, winter: 0xe8ece6 };
    if (ground) (ground.material as THREE.MeshLambertMaterial).color.setHex(gt[s.season]);
  }

  private tick(dt: number, t: number) {
    const sc = this.sc;
    if ((this.refreshT -= dt) <= 0) { this.refreshT = 60; this.refresh(); }
    if (liveOn && !this.override && (this.liveT += dt) > 30 * 60) { this.liveT = 0; const p = place(); void fetchLive(p.lat, p.lon).then((st) => { if (st && !this.override) weather.value = st; }); }
    if ((this.patchT -= dt) <= 0) { this.patchT = 2; this.patchAll(); }
    this.applySeason();

    const w = this.hold ?? weather.value, info = season.value;
    const night = sc.sky.night;
    const aurora = night > 0.5 && (info.season === 'winter' || Math.abs(place().lat) > 52 || (w.temp ?? 10) < -2) && hash(Math.floor(Date.now() / 86400000), 9, 0, 77) < 0.45;
    const tg = targetFor(w, info, aurora);
    const v = this.vis;
    const k = this.snapNext ? 1 : 1 - Math.exp(-dt / 5);
    for (const key of Object.keys(tg) as (keyof typeof tg)[]) v[key] += (tg[key] - v[key]) * k;
    // the ground darkens while it rains and dries slowly; snow builds up and melts
    const wetGoal = Math.max(v.rain, v.snow * 0.3 * (v.cover < 0.2 ? 1 : 0));
    v.wet += (wetGoal - v.wet) * (this.snapNext ? 1 : 1 - Math.exp(-dt / (wetGoal > v.wet ? 14 : 90)));
    const temp = w.temp ?? 10;
    if (v.snow > 0.05) v.cover = Math.min(1, v.cover + dt * v.snow / 40);
    else if (temp > 1.5) v.cover = Math.max(0, v.cover - dt / 240);
    if (this.snapNext && w.kind === 'snow') v.cover = Math.max(v.cover, 0.85);
    if (this.snapNext && info.season === 'winter' && temp < 0 && hash(Math.floor(Date.now() / 86400000), 3, 0, 5) < 0.6) v.cover = Math.max(v.cover, 0.7);
    this.snapNext = false;

    // lightning: a flicker of flashes and a pixel bolt far off in the storm
    if (v.storm > 0.3 && (this.strikeT -= dt) <= 0) { this.strikeT = 3 + Math.random() * 9 / v.storm; this.strike(); }
    this.boltT -= dt;
    this.bolt.visible = this.boltT > 0;
    this.flash = Math.max(0, this.flash - dt * 5);
    const fl = this.boltT > 0 ? this.flash * (0.65 + 0.35 * Math.sin(t * 60)) : this.flash;

    // the sky
    const sky = sc.sky;
    sky.wx.cloud = v.cloud; sky.wx.overcast = v.overcast; sky.wx.fog = v.fog; sky.wx.cold = v.cold * 0.8; sky.wx.flash = fl; sky.wx.aurora = v.aurora;
    sky.wx.sunHeight = THREE.MathUtils.clamp((today().maxEl - 10) / 60, 0, 1);
    sky.moonPhase = moonPhase(new Date());
    sky.setHemisphere(place().lat < 0);
    sc.applySky();

    // surfaces
    WX.uSnow.value = v.cover;
    WX.uWet.value = v.wet * (1 - v.cover);
    GRASS.uSnow.value = v.cover;
    GRASS.uWet.value = v.wet;
    const water = sc.terrain.water.uniforms;
    if (water.uIce) water.uIce.value = v.ice * Math.max(v.cover, info.season === 'winter' ? 1 : 0);
    if (v.cover > 0.01 && (this.mapT -= dt) <= 0) { this.mapT = 6; this.snowMap.render(sc.renderer, sc.scene); }

    // precipitation follows the camera
    const cam = sc.camera, fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const ctr = cam.position.clone().addScaledVector(fwd, 9);
    const size = sc.renderer.getSize(new THREE.Vector2()), pr = sc.renderer.getPixelRatio();
    const wx = wind.uWind.value.x, wz = wind.uWind.value.y;
    for (const p of [this.rain, this.snowP]) {
      const u = p.mat.uniforms;
      u.uTime.value = t; u.uCenter.value.copy(ctr); u.uRes.value.set(size.x * pr, size.y * pr); u.uPx.value = Math.max(1, Math.round(pr));
      u.uDrift.value.set(wx, wz).multiplyScalar(p === this.rain ? 1.5 + v.wind * 3 : 0.4 + v.wind * 1.2);
    }
    sc.critters.shelter = v.rain > 0.25 || v.snow > 0.3 || v.storm > 0.2;
    this.rain.amount = v.rain * (sc.stage ? 0 : 1);
    this.snowP.amount = v.snow * (sc.stage ? 0 : 1);
    const lightC = sky.ambient.clone().multiplyScalar(1.3).add(new THREE.Color(0.08, 0.09, 0.12));
    (this.rain.mat.uniforms.uCol.value as THREE.Color).setRGB(0.74, 0.84, 1).multiply(lightC).addScalar(fl * 0.5);
    (this.snowP.mat.uniforms.uCol.value as THREE.Color).setRGB(1, 1, 1).multiply(lightC).addScalar(0.05 + fl * 0.4);
    this.rain.mat.uniforms.uAlpha.value = 0.45 + v.storm * 0.15;

    // splashes on the ground and rings on the pond
    if (v.rain > 0.05) {
      this.splashT += dt * v.rain * (sc.quality === 'high' ? 70 : 35);
      const gx = ctr.x, gz = ctr.z;
      while (this.splashT >= 1) {
        this.splashT -= 1;
        const x = gx + (Math.random() - 0.5) * 18, z = gz + (Math.random() - 0.5) * 14;
        if (pondD(x, z) < 0.95) { sc.fx.ripple(x, WATER_Y, z); continue; }
        if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) continue;
        const y = groundY(x, z);
        sc.fx.emit({ x, y: y + 0.03, z, life: 0.28, frame: SPR.splat1, frames: 3, fps: 11, color: 0xd8e8ff, size: 0.26 });
        if (Math.random() < 0.18) sc.fx.emit({ x, y: y + 0.02, z, life: 0.8, frame: SPR.ring, color: 0xc9dcf0, size: 0.18, grow: 2.2, fadeOut: 0.5, flat: true });
      }
      if (Math.random() < dt * v.rain * 10) sc.fx.ripple(POND.x + (Math.random() - 0.5) * POND.rx * 1.4, WATER_Y, POND.z + (Math.random() - 0.5) * POND.rz * 1.3);
    }

    // a quiet rain ambience while the hollow is in view during the day
    const dayView = !sc.stage && sc.view !== 'sleep' && sc.view !== 'breathe' && sc.view !== 'wake';
    // (at night the sleep soundscape owns the ambience, so leave it alone then)
    const want = v.rain > 0.3;
    if (dayView && want !== this.rainSound) { void sound.loop('amb_rain', want, 0.18 + v.storm * 0.12, 'amb', 3); this.rainSound = want; }
  }

  private strike() {
    this.flash = 1;
    this.boltT = 0.22;
    const cam = this.sc.camera, fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const base = cam.position.clone().addScaledVector(fwd, 55).addScaledVector(side, (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 22));
    // a jagged pixel bolt built from short quads facing the camera, with a branch or two
    const pos: number[] = [];
    const seg = (a: THREE.Vector3, b: THREE.Vector3, wdt: number) => {
      const d = b.clone().sub(a), toCam = cam.position.clone().sub(a).normalize();
      const s = d.clone().cross(toCam).normalize().multiplyScalar(wdt);
      pos.push(a.x - s.x, a.y - s.y, a.z - s.z, a.x + s.x, a.y + s.y, a.z + s.z, b.x + s.x, b.y + s.y, b.z + s.z);
      pos.push(a.x - s.x, a.y - s.y, a.z - s.z, b.x + s.x, b.y + s.y, b.z + s.z, b.x - s.x, b.y - s.y, b.z - s.z);
    };
    const walk = (from: THREE.Vector3, steps: number, wdt: number, branch: boolean) => {
      let p = from.clone();
      for (let i = 0; i < steps; i++) {
        const n = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, -2.4 - Math.random() * 2, (Math.random() - 0.5) * 2));
        seg(p, n, wdt);
        if (branch && Math.random() < 0.18) walk(n, 3 + Math.floor(Math.random() * 3), wdt * 0.6, false);
        p = n;
        if (p.y < 0) break;
      }
    };
    walk(new THREE.Vector3(base.x, 30, base.z), 18, 0.5, true);
    this.bolt.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.bolt.geometry = g;
  }
}

function exposeDev(w: Weather) {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;
  win.__weather = (kind?: WeatherKind | null, intensity?: number, temp?: number) => { w.set(kind ?? null, intensity, temp); w.snap(kind === 'snow' ? 1 : kind ? 0 : undefined); return weather.value; };
  win.__season = (s?: Season | null, t?: number) => { w.setSeason(s ?? null, t); return season.value; };
  win.__wx = w;
  win.__WX = WX;
}
