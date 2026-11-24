// [world] Light and atmosphere. A day/night cycle that follows the real sun (sunrise and sunset from
// the date and the player's rough latitude), a pixel sky dome with the real moon phase, a drifting
// pixel cloud layer, the milky way, aurora on clear cold nights, lightning flashes, crisp pixel stars
// with the odd shooting star, a warm key light with soft shadows, coloured ambient, depth fog and
// sun shafts falling through the canopy. The weather feeds `wx`; the scene calls setHour().
import * as THREE from 'three';
import { guessPlace, moonPhase, skyHour, sunDay, type Place, type SunDay } from './astro.ts';

interface Key { h: number; sun: number; sunI: number; top: number; hor: number; sky: number; ground: number; fog: number; hemiI: number; night: number; rays: number; glow: number; belt: number }
// [look4] "Golden Diorama" skies: clear cerulean days, honey-gold mornings and evenings with a rose belt
// opposite the sun, violet dusk, and deep sapphire moonlit nights (never grey, never black). `glow` is the warm
// horizon glow towards the sun, `belt` the pink band on the far side of the sky at the ends of the day.
const NIGHT: Omit<Key, 'h'> = { sun: 0x9db8f0, sunI: 0.95, top: 0x040c26, hor: 0x1c3468, sky: 0x4466aa, ground: 0x1a2236, fog: 0x1a2d5c, hemiI: 0.95, night: 1, rays: 0, glow: 0, belt: 0 };
const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.7, ...NIGHT, top: 0x061030, hor: 0x22386e },
  { h: 5.5, sun: 0xc4a8e0, sunI: 0.9, top: 0x16245a, hor: 0x9a6e9c, sky: 0x7a80c0, ground: 0x2e2a40, fog: 0x7a5e8e, hemiI: 0.95, night: 0.6, rays: 0.1, glow: 0.4, belt: 0.3 },
  { h: 6.2, sun: 0xffa868, sunI: 1.9, top: 0x3460aa, hor: 0xffb27c, sky: 0xb4a8d0, ground: 0x5c4c44, fog: 0xf0b08a, hemiI: 1.0, night: 0.2, rays: 0.9, glow: 1, belt: 0.8 },
  { h: 7.2, sun: 0xffd29c, sunI: 2.7, top: 0x2f78cc, hor: 0xf4d8b4, sky: 0x9cc4ee, ground: 0x6a7044, fog: 0xd6dcd8, hemiI: 0.85, night: 0.02, rays: 0.9, glow: 0.5, belt: 0.25 },
  { h: 8.6, sun: 0xfff0d6, sunI: 3.0, top: 0x2370d2, hor: 0xa6d6f6, sky: 0x9ccaf4, ground: 0x6c7c46, fog: 0xb2d8f4, hemiI: 0.82, night: 0, rays: 0.65, glow: 0.15, belt: 0 },
  { h: 13, sun: 0xfff6e8, sunI: 3.1, top: 0x1f6ad0, hor: 0xa0d2f6, sky: 0x98c8f4, ground: 0x708248, fog: 0xacd4f4, hemiI: 0.8, night: 0, rays: 0.5, glow: 0.1, belt: 0 },
  { h: 16.6, sun: 0xffe6bc, sunI: 3.0, top: 0x2670cc, hor: 0xbcdcf0, sky: 0xa2c8ee, ground: 0x768248, fog: 0xc4dcec, hemiI: 0.82, night: 0, rays: 0.9, glow: 0.3, belt: 0.05 },
  { h: 17.8, sun: 0xffcc8e, sunI: 2.8, top: 0x3a6cbe, hor: 0xffcc8c, sky: 0x9cb0d8, ground: 0x6e6448, fog: 0xf2c8a0, hemiI: 0.9, night: 0, rays: 1, glow: 0.85, belt: 0.5 },
  { h: 18.6, sun: 0xffac6c, sunI: 2.3, top: 0x34509e, hor: 0xffa66e, sky: 0x9a98c8, ground: 0x5a4a48, fog: 0xe8a48c, hemiI: 0.95, night: 0.12, rays: 1, glow: 1, belt: 0.9 },
  { h: 19.2, sun: 0xe88070, sunI: 1.3, top: 0x22306e, hor: 0xd8707a, sky: 0x8a74a8, ground: 0x3a2c40, fog: 0xb86a80, hemiI: 0.98, night: 0.45, rays: 0.3, glow: 0.7, belt: 0.6 },
  { h: 19.8, sun: 0x9c98e0, sunI: 1.0, top: 0x0e1848, hor: 0x5a4a8a, sky: 0x5260a6, ground: 0x22243e, fog: 0x3c3a74, hemiI: 0.96, night: 0.8, rays: 0, glow: 0.25, belt: 0.15 },
  { h: 20.6, ...NIGHT },
  { h: 24, ...NIGHT },
];

/** What the weather asks of the sky. All 0..1. */
export interface SkyWeather {
  /** cloud cover of the pixel cloud layer */
  cloud: number;
  /** grey overcast: dims the sun, greys the sky and light */
  overcast: number;
  /** mist: pulls the fog in and whitens it */
  fog: number;
  /** cold blue cast (snow) */
  cold: number;
  /** lightning flash */
  flash: number;
  /** aurora curtains (clear cold nights) */
  aurora: number;
  /** how high the sun climbs today (0 low winter sun .. 1 high summer sun) */
  sunHeight: number;
}

// ---------------------------------------------------------------- shared GLSL

const NOISE = /* glsl */ `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm2(vec2 p) { float v = 0.0, a = 0.55; for (int i = 0; i < 4; i++) { v += vn(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return v; }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
uniform float uCloud; uniform float uTime;
// a square sky pixel grid in direction space so everything up there stays crisp and stable
vec3 skyPixel(vec3 d, float s) {
  float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.z, d.x);
  float row = floor(el / s) + 0.5;
  float elq = row * s;
  float n = max(1.0, floor(6.2832 * cos(elq) / s));
  float azq = (floor(az / 6.2832 * n) + 0.5) / n * 6.2832;
  return vec3(cos(azq) * cos(elq), sin(elq), sin(azq) * cos(elq));
}
// the cloud layer as seen along a direction: painted billows on a flat ceiling
vec2 cloudUv(vec3 d) { return d.xz / (d.y + 0.06) * 0.85 + vec2(uTime * 0.011, uTime * 0.0045); }
float cloudDensity(vec2 uv) {
  vec2 w = vec2(fbm2(uv * 0.55 + 3.1), fbm2(uv * 0.55 + 7.7)) - 0.5;
  vec2 q = uv + w * 0.9;
  return fbm2(q * 1.05) * 0.85 + fbm2(q * 3.4 + 11.0) * 0.22;
}
float cloudAt(vec3 d) {
  if (d.y <= 0.0 || uCloud <= 0.001) return 0.0;
  float th = mix(0.64, 0.28, uCloud);
  return smoothstep(th, th + 0.1, cloudDensity(cloudUv(d))) * smoothstep(0.004, 0.06, d.y);
}
`;

const SKY_VS = /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunDisc; uniform vec3 uSunCol; uniform float uNight; uniform float uDay;
uniform vec3 uMoonDir; uniform float uMoonPhase; uniform float uMoonSize; uniform float uMoonVis; uniform float uHemi;
uniform float uSunSize; uniform float uOvercast; uniform float uFlash; uniform float uAurora; uniform float uMilky;
uniform vec3 uCloudLit; uniform vec3 uCloudDark; uniform vec3 uCloudRim; uniform vec3 uFogCol; uniform float uHaze; uniform vec3 uMilkyN;
uniform vec3 uGlowCol; uniform float uGlow; uniform vec3 uBeltCol; uniform float uBelt;
varying vec3 vDir;
${NOISE}
// [look4] painted cumulus (cloudDensity above), lit from the sun's side with a silver rim, toned in a few painted
// steps with a fine ordered dither between them (crisp at the internal pixel grid)
void main() {
  vec3 d = normalize(vDir);
  float px = bayer4(gl_FragCoord.xy);
  // the base gradient: a deep zenith down to a luminous horizon, with soft painted streaks
  float t = pow(clamp(d.y * 1.25 + 0.04, 0.0, 1.0), 0.55);
  float streak = (fbm2(vec2(atan(d.z, d.x) * 2.0, d.y * 14.0)) - 0.5) * 0.06 * (1.0 - t);
  vec3 col = mix(uHor, uTop, clamp(t + streak, 0.0, 1.0));
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(uSunDir.xz + 1e-5);
  float toSun = dot(dh, sh);
  float low = 1.0 - smoothstep(-0.02, 0.42, d.y);
  // golden glow towards the sun, a rose belt on the far side of the sky (ends of the day)
  col = mix(col, uGlowCol, uGlow * pow(max(toSun, 0.0), 2.2) * low * 0.85);
  float belt = smoothstep(0.0, 0.07, d.y) * (1.0 - smoothstep(0.1, 0.32, d.y));
  col = mix(col, uBeltCol, uBelt * belt * smoothstep(0.1, -0.6, toSun) * 0.7);
  col *= 1.0 + 0.12 * (1.0 - uNight) * low;

  // a dense dust of faint one-pixel stars, thicker along the milky way
  vec3 dq = skyPixel(d, 0.0021);
  if (uNight > 0.3 && dq.y > -0.02) {
    vec2 cell = vec2(atan(dq.z, dq.x), asin(dq.y)) / 0.0021;
    float x = dot(dq, uMilkyN);
    float p = 0.004 + 0.016 * exp(-x * x / 0.02) * uMilky;
    float hs = h21(floor(cell) + 0.5);
    if (hs < p) {
      float tw = 0.55 + 0.45 * sin(uTime * (1.0 + hs * 90.0) + hs * 300.0);
      col += vec3(0.7, 0.75, 0.9) * (0.2 + 0.5 * h21(floor(cell) + 7.5)) * tw * smoothstep(0.3, 0.9, uNight) * (1.0 - uOvercast) * smoothstep(-0.02, 0.04, dq.y);
    }
  }
  // milky way: a dusty band of blue-violet light with a dark lane
  if (uMilky > 0.01 && d.y > -0.05) {
    float x = dot(d, uMilkyN);
    float core = exp(-x * x / 0.03) * (0.5 + 0.9 * fbm2(vec2(atan(d.z, d.x) * 3.0, x * 9.0)));
    float lane = exp(-pow((x + 0.018) / 0.035, 2.0)) * smoothstep(0.35, 0.75, fbm2(vec2(atan(d.z, d.x) * 6.0, 3.0)));
    float g = max(0.0, core - lane * 0.7) * uMilky * smoothstep(-0.06, 0.06, d.y);
    col += mix(vec3(0.12, 0.14, 0.32), vec3(0.42, 0.4, 0.62), clamp(g, 0.0, 1.0)) * g * 0.42;
  }
  // aurora: green curtains with violet tops, rippling slowly over the north
  if (uAurora > 0.01 && d.y > 0.03) {
    vec2 a = d.xz / (d.y + 0.3);
    float x = a.x * 1.4 + sin(a.y * 2.1 + uTime * 0.13) * 0.7 + uTime * 0.02;
    float curtain = pow(0.5 + 0.5 * sin(x * 2.6 + sin(x * 1.3 + uTime * 0.17) * 2.2), 2.5);
    float rays = 0.55 + 0.45 * sin(atan(d.z, d.x) * 260.0 + sin(uTime * 0.6 + x) * 2.0);
    float band = smoothstep(0.06, 0.2, d.y) * (1.0 - smoothstep(0.3, 0.7, d.y)) * smoothstep(0.35, -0.5, d.z);
    float A = curtain * rays * band * uAurora;
    vec3 ac = mix(vec3(0.25, 0.85, 0.5), vec3(0.6, 0.38, 0.85), smoothstep(0.18, 0.5, d.y));
    col += ac * A * 0.6;
  }

  // the sun: a hot pixel disc in a soft glow (the bloom spreads it)
  vec3 s = normalize(uSunDisc);
  float sd = dot(d, s);
  if (uDay > 0.01) {
    float vis = uDay * (1.0 - uOvercast * 0.9);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), s)), u = cross(s, r);
    vec2 p = vec2(dot(d, r), dot(d, u)) / uSunSize;
    vec2 q = (floor(p * 9.0) + 0.5) / 9.0;
    float disc = step(length(q), 1.0) * step(0.0, sd);
    float halo = exp(-max(length(p) - 1.0, 0.0) * 0.9) * step(0.0, sd);
    float mie = pow(max(sd, 0.0), 24.0);
    col += uSunCol * (halo * 0.55 + mie * 0.35) * vis;
    col = mix(col, uSunCol * 7.0 + vec3(1.2, 1.1, 0.9), disc * vis);
  }

  // the moon in its real phase: pixel sphere, maria and craters, earthshine on the dark side, a silver halo
  vec3 m = normalize(uMoonDir);
  if (uMoonVis > 0.01 && dot(d, m) > 0.0) {
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), m)), u = cross(m, r);
    vec2 p = vec2(dot(d, r), dot(d, u)) / uMoonSize;
    float mpx = 15.0 + uMoonSize * 40.0;
    vec2 q = (floor(p * mpx) + 0.5) / mpx;
    float rr = length(q);
    float lit = 0.5 - 0.5 * cos(uMoonPhase * 6.2832);
    float halo = exp(-max(length(p) - 1.0, 0.0) * 1.1);
    col += vec3(0.45, 0.58, 0.9) * halo * 0.5 * uMoonVis * (0.3 + lit);
    if (rr < 1.0) {
      vec3 n = vec3(q, sqrt(1.0 - rr * rr));
      float ang = uMoonPhase * 6.2832;
      vec3 L = vec3(sin(ang) * uHemi, 0.0, -cos(ang));
      float lt = dot(n, L);
      float maria = fbm2(q * 2.3 + 4.0);
      float crater = step(0.86, h21(floor(q * mpx) + 3.0)) * step(rr, 0.85);
      vec3 bright = mix(vec3(1.0, 0.97, 0.88), vec3(0.78, 0.8, 0.84), smoothstep(0.5, 0.66, maria)) - crater * 0.1;
      bright *= (0.86 + 0.14 * n.z) * 2.6;
      vec3 dark = mix(uTop, vec3(0.16, 0.2, 0.32), 0.7) * (1.0 + 0.25 * (1.0 - smoothstep(0.5, 0.66, maria)));
      vec3 mc = lt > 0.02 ? bright : lt > -0.06 ? mix(dark, bright, 0.35) : dark;
      if (rr > 0.9) mc *= 0.86;
      col = mix(col, mc, uMoonVis);
    }
  }

  // painted clouds
  if (uCloud > 0.001 && d.y > 0.0) {
    vec2 uv = cloudUv(d);
    float th = mix(0.64, 0.28, uCloud);
    float n = cloudDensity(uv);
    float dens = smoothstep(th, th + 0.16, n);
    if (dens > 0.0) {
      vec2 sdir = normalize(uSunDir.xz + 1e-4) * 0.16;
      float n2 = cloudDensity(uv + sdir);
      float lit = clamp(0.55 + (n - n2) * 4.5, 0.0, 1.0);
      float shade = clamp(lit * 0.8 + (1.0 - dens) * 0.3 + (uSunDir.y > 0.0 ? 0.05 : 0.0), 0.0, 1.0);
      float lvl = floor(shade * 4.0 + px * 0.999) / 4.0;
      vec3 cc = mix(uCloudDark, uCloudLit, lvl);
      // a silver lining where the cloud thins on the sun's side
      float rim = (1.0 - smoothstep(0.0, 0.45, dens)) * smoothstep(0.45, 0.9, lit);
      cc += uCloudRim * rim;
      // far clouds sink into the horizon haze
      cc = mix(cc, col, (1.0 - smoothstep(0.02, 0.3, d.y)) * 0.55);
      float a = step(px, dens * 1.6) * smoothstep(0.004, 0.06, d.y);
      col = mix(col, cc, a * (0.85 + 0.15 * uCloud));
    }
  }
  // the horizon melts into the aerial haze the far hills sit in
  col = mix(col, uFogCol, (1.0 - smoothstep(-0.03, 0.09, d.y)) * 0.6);
  if (d.y < 0.0) col = mix(col, uFogCol, smoothstep(0.0, -0.08, d.y));
  // haze in the distance (fog weather)
  col = mix(col, uFogCol, uHaze * (1.0 - smoothstep(0.0, 0.5, d.y)));
  col += uFlash * vec3(0.62, 0.66, 0.78) * (0.6 + 0.4 * step(0.0, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- stars

const STAR_VS = /* glsl */ `
attribute float aSize; attribute float aSeed; attribute vec3 aCol;
uniform float uNight; uniform float uPR; uniform float uClear; uniform vec2 uRes;
varying vec3 vCol; varying float vA; varying float vSize;
${NOISE}
void main() {
  vec3 d = normalize(position);
  float tw = 0.62 + 0.38 * sin(uTime * (1.3 + aSeed * 3.1) + aSeed * 41.0);
  vA = uNight * uClear * (1.0 - cloudAt(d)) * smoothstep(-0.01, 0.035, d.y) * tw;
  vCol = aCol;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // snap to the pixel grid so stars stay crisp squares
  vec2 hp = uRes * 0.5 / uPR;
  gl_Position.xy = (floor(gl_Position.xy / gl_Position.w * hp) + 0.5) / hp * gl_Position.w;
  vSize = aSize;
  gl_PointSize = aSize * uPR;
}`;
const STAR_FS = /* glsl */ `
varying vec3 vCol; varying float vA; varying float vSize;
void main() {
  if (vA < 0.02) discard;
  vec2 c = (gl_PointCoord - 0.5) * vSize;
  float a = vA;
  if (vSize > 2.5) {
    // a little plus-shaped twinkle for the bright ones
    if (abs(c.x) > 0.5 && abs(c.y) > 0.5) discard;
    if (abs(c.x) > 0.5 || abs(c.y) > 0.5) a *= 0.55;
  }
  gl_FragColor = vec4(vCol * a, 1.0);
}`;

const SHOOT_VS = /* glsl */ `
attribute float aA; uniform float uPR; uniform vec2 uRes;
varying float vA;
void main() {
  vA = aA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec2 hp = uRes * 0.5 / uPR;
  gl_Position.xy = (floor(gl_Position.xy / gl_Position.w * hp) + 0.5) / hp * gl_Position.w;
  gl_PointSize = (aA > 0.9 ? 3.0 : 2.0) * uPR;
}`;
const SHOOT_FS = /* glsl */ `varying float vA; void main() { if (vA < 0.03) discard; gl_FragColor = vec4(vec3(0.96, 0.92, 0.8) * vA, 1.0); }`;

const RAY_FS = /* glsl */ `
uniform vec3 uCol; uniform float uAlpha; uniform float uTime; uniform float uSeed;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  // soft stripes drifting sideways, quantised into bands
  float st = 0.6 + 0.4 * sin(vUv.x * 9.0 + uSeed * 6.0 + uTime * 0.25);
  float a = floor(min(1.0, across * along * st * 1.7) * 5.0) / 5.0;
  gl_FragColor = vec4(uCol * a * uAlpha, 1.0);
}`;
const RAY_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export type SkyMode = 'clock' | 'day' | 'golden' | 'night';

const STAR_R = 150;
const tmpA = new THREE.Color(), tmpB = new THREE.Color();

export class Sky {
  readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  readonly fog = new THREE.Fog(0xcfe9f1, 90, 320);
  readonly dome: THREE.Mesh;
  readonly stars: THREE.Points;
  private shoot: THREE.Points;
  private shootPos: Float32Array; private shootA: Float32Array;
  private shooting: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number } | null = null;
  private nextShoot = 6;
  private rays: { mesh: THREE.Mesh; base: THREE.Vector3; mat: THREE.ShaderMaterial }[] = [];
  private domeMat: THREE.ShaderMaterial;
  private starMat: THREE.ShaderMaterial;
  private shootMat: THREE.ShaderMaterial;
  /** 0 by day, 1 at night */
  night = 0;
  rayPower = 0;
  hour = 13;
  readonly sunDir = new THREE.Vector3(0.4, 0.8, 0.45);
  /** where the moon hangs in the sky (not where the night light comes from) */
  readonly moonDir = new THREE.Vector3(0.25, 0.5, -1).normalize();
  readonly ambient = new THREE.Color(1, 1, 1);
  /** today's real moon phase (0 new .. 0.5 full) */
  moonPhase = moonPhase(new Date());
  /** what the weather asks of the sky (see SkyWeather) */
  wx: SkyWeather = { cloud: 0.25, overcast: 0, fog: 0, cold: 0, flash: 0, aurora: 0, sunHeight: 0.7 };
  /** cinematics: hang a big moon somewhere specific */
  moonOverride: { dir: THREE.Vector3; size: number } | null = null;
  /** cinematics: force the milky way / stars to full strength */
  starBoost = 0;
  /** cinematics: fade the moon out and in (0..1) */
  moonFade = 1;
  /** cinematics: draw the sun disc somewhere visible (the light keeps its own direction) */
  sunDisc: { dir: THREE.Vector3; size: number } | null = null;
  /** [look4] world distance where the far haze starts and where it is complete (the scene sets them per view) */
  baseFogNear = 90; baseFogFar = 320;
  /** [look4] the horizon colour (the vista and the fog lean on it) */
  readonly horizon = new THREE.Color();
  /** [look4] set when the sky changed enough to re-bake the environment light */
  envDirty = true;

  constructor(scene: THREE.Scene, shadowSize: number, quality: 'low' | 'high' = 'high') {
    scene.fog = this.fog;
    scene.add(this.sun, this.sun.target, this.hemi);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -19, right: 19, top: 19, bottom: -19, near: 4, far: 90 });
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.2;

    const shared = { uTime: { value: 0 }, uCloud: { value: 0.25 } };
    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        ...shared,
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: this.sunDir }, uSunDisc: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
        uNight: { value: 0 }, uDay: { value: 1 }, uMoonDir: { value: new THREE.Vector3().copy(this.moonDir) }, uMoonPhase: { value: this.moonPhase }, uMoonSize: { value: 0.05 },
        uMoonVis: { value: 0 }, uHemi: { value: 1 }, uSunSize: { value: 0.04 }, uOvercast: { value: 0 }, uFlash: { value: 0 }, uAurora: { value: 0 }, uMilky: { value: 0 },
        uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() }, uCloudRim: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() }, uHaze: { value: 0 },
        uGlowCol: { value: new THREE.Color() }, uGlow: { value: 0 }, uBeltCol: { value: new THREE.Color() }, uBelt: { value: 0 },
        // the band rises from the trees left of the house and arcs up past where the cinematic moon hangs
        uMilkyN: { value: new THREE.Vector3(-0.474, 0.852, 0.217).normalize() },
      },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // stars: a crisp pixel point field, a third of it crowded into the milky way
    const n = quality === 'high' ? 5200 : 2600;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n), colr = new Float32Array(n * 3);
    const N = (this.domeMat.uniforms.uMilkyN.value as THREE.Vector3).clone();
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    a.crossVectors(N, new THREE.Vector3(0, 1, 0)).normalize(); b.crossVectors(N, a).normalize();
    let s = 12345;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    // [world3] cream, frost, lamp-gold, rose and lavender stars
    const palette = [[0.96, 0.93, 0.85], [0.82, 0.88, 0.9], [0.95, 0.85, 0.65], [0.9, 0.75, 0.72], [0.78, 0.76, 0.88]];
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) {
        const ang = rnd() * Math.PI * 2, off = (rnd() + rnd() + rnd() - 1.5) * 0.12;
        v.copy(a).multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)).addScaledVector(N, off).normalize();
      } else if (i % 5 === 1) {
        // extra stars low over the trees, where the home view looks
        const az = rnd() * Math.PI * 2, el = rnd() * rnd() * 0.32;
        v.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      } else {
        v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
        if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue; }
        v.normalize();
      }
      if (v.y < -0.05) v.y = -v.y;
      pos.set([v.x * STAR_R, v.y * STAR_R, v.z * STAR_R], i * 3);
      const m = rnd();
      size[i] = m > 0.985 ? 3 : m > 0.86 ? 2 : 1;
      seed[i] = rnd();
      const c = palette[Math.floor(rnd() * palette.length)], br = size[i] > 1 ? 1 : 0.5 + rnd() * 0.45;
      colr.set([c[0] * br, c[1] * br, c[2] * br], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    sg.setAttribute('aCol', new THREE.BufferAttribute(colr, 3));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { ...shared, uNight: { value: 0 }, uPR: { value: 1 }, uClear: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
    });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    scene.add(this.stars);

    // shooting stars: a head and a fading pixel trail
    this.shootPos = new Float32Array(18 * 3); this.shootA = new Float32Array(18);
    const shg = new THREE.BufferGeometry();
    shg.setAttribute('position', new THREE.BufferAttribute(this.shootPos, 3).setUsage(THREE.DynamicDrawUsage));
    shg.setAttribute('aA', new THREE.BufferAttribute(this.shootA, 1).setUsage(THREE.DynamicDrawUsage));
    this.shootMat = new THREE.ShaderMaterial({
      vertexShader: SHOOT_VS, fragmentShader: SHOOT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uPR: this.starMat.uniforms.uPR, uRes: this.starMat.uniforms.uRes },
    });
    this.shoot = new THREE.Points(shg, this.shootMat);
    this.shoot.frustumCulled = false;
    this.shoot.renderOrder = -8;
    this.shoot.visible = false;
    scene.add(this.shoot);

    // shafts of light landing at fixed spots around the clearing
    const spots: [number, number, number][] = [[-5.5, -3.5, 2.6], [1.5, -5.5, 2.0], [-7.5, 3.5, 2.2], [5.5, -1.5, 1.8], [-1.5, 3.2, 3.0], [8.5, 7.0, 2.2], [-3, -7.5, 1.7]];
    spots.forEach(([x, z, w], i) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: RAY_VS, fragmentShader: RAY_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uCol: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uSeed: { value: i * 1.7 } },
      });
      const geo = new THREE.PlaneGeometry(w, 15);
      geo.translate(0, 7.5, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.rays.push({ mesh, base: new THREE.Vector3(x, 0, z), mat });
    });
    this.setHour(13);
  }

  /** Set the sky hour (6.2 = sunrise, 12.6 = noon, 18.8 = sunset) and apply the weather on top. */
  setHour(h: number) {
    this.hour = ((h % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= this.hour) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = (this.hour - a.h) / (b.h - a.h);
    const mix = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), t);
    const num = (x: number, y: number) => x + (y - x) * t;
    const w = this.wx, U = this.domeMat.uniforms;
    this.night = num(a.night, b.night);
    const day = 1 - this.night;
    // grey towards an overcast sky (keeping some of the hue: rain clouds are blue-grey, not concrete), cool it for snow
    const grey = (c: THREE.Color, k: number, dark = 1) => { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; return c.lerp(tmpA.setRGB(l * dark * 0.93, l * dark * 0.98, l * dark * 1.1), k * 0.85); };
    const cold = (c: THREE.Color) => c.lerp(tmpB.setRGB(c.r * 0.86, c.g * 0.95, Math.min(1, c.b * 1.12 + 0.03)), w.cold);
    const oc = w.overcast;
    this.rayPower = num(a.rays, b.rays) * (1 - Math.max(oc, w.fog * 0.7, w.cloud * 0.5));
    this.sun.color.copy(cold(grey(mix(a.sun, b.sun), oc * 0.7)));
    const seasonal = 0.86 + 0.14 * w.sunHeight;
    this.sun.intensity = num(a.sunI, b.sunI) * (1 - oc * 0.7 - w.fog * 0.25) * (this.night > 0.5 ? 1 : seasonal) + w.flash * 4;
    this.hemi.color.copy(cold(grey(mix(a.sky, b.sky), oc * 0.5)));
    this.hemi.groundColor.copy(cold(grey(mix(a.ground, b.ground), oc * 0.3, 0.9)));
    this.hemi.intensity = num(a.hemiI, b.hemiI) * (1 + oc * 0.25) + w.flash * 1.5;
    const top = cold(grey(mix(a.top, b.top), oc * 0.7, 0.85 + day * 0.2));
    const hor = cold(grey(mix(a.hor, b.hor), oc * 0.6, 0.95));
    // the fog is the colour of the horizon the far woods melt into (never a grey veil)
    const fogC = cold(grey(mix(a.fog, b.fog), oc * 0.6)).lerp(hor, 0.35);
    fogC.lerp(tmpA.setRGB(0.78, 0.82, 0.86).multiplyScalar(0.2 + 0.8 * day), w.fog * 0.6);
    this.fog.color.copy(fogC);
    this.horizon.copy(hor);
    // the fog only reaches the far woods and hills; mist weather pulls it in a little
    this.fog.near = this.baseFogNear * (1 - w.fog * 0.55) * (1 - oc * 0.2);
    this.fog.far = this.baseFogFar * (1 - w.fog * 0.45) * (1 - oc * 0.15);
    U.uTop.value.copy(top);
    U.uHor.value.copy(hor);
    U.uSunCol.value.copy(this.sun.color).lerp(tmpA.set(0xffffff), 0.25);
    U.uNight.value = this.night;
    U.uDay.value = Math.max(0, 1 - this.night * 1.6);
    U.uOvercast.value = oc;
    U.uFlash.value = w.flash;
    U.uCloud.value = Math.max(w.cloud, oc * 0.95);
    U.uAurora.value = w.aurora * this.night * (1 - oc);
    U.uMilky.value = Math.max(this.starBoost, this.night * (1 - oc) * (1 - w.fog * 0.8)) * (1 - Math.max(w.cloud - 0.5, 0) * 1.6);
    U.uHaze.value = w.fog;
    U.uFogCol.value.copy(this.fog.color).lerp(hor, 0.5);
    const clear = 1 - Math.max(oc, w.fog * 0.6);
    U.uGlow.value = num(a.glow, b.glow) * clear;
    U.uGlowCol.value.copy(this.sun.color).lerp(tmpA.setRGB(1, 0.78, 0.45), 0.4).multiplyScalar(1.15);
    U.uBelt.value = num(a.belt, b.belt) * clear;
    U.uBeltCol.value.setRGB(0.98, 0.64, 0.7);
    // clouds: sun-tinted lit sides, sky-tinted shadow sides (lavender by day, rose-violet at dusk, ink-blue at night)
    const litC = new THREE.Color().copy(this.sun.color).lerp(tmpA.setRGB(1, 1, 1), 0.45 - num(a.glow, b.glow) * 0.25).multiplyScalar(0.95 + day * 0.25);
    const darkC = new THREE.Color().copy(this.hemi.color).lerp(top, 0.25).lerp(tmpA.setRGB(0.7, 0.62, 0.78), 0.25 * day).multiplyScalar(0.7 + day * 0.25);
    if (this.night > 0.5) {
      const k = THREE.MathUtils.smoothstep(this.night, 0.5, 1);
      litC.lerp(tmpA.setRGB(0.36, 0.45, 0.7), k);
      darkC.lerp(tmpA.setRGB(0.07, 0.1, 0.22), k);
    }
    U.uCloudLit.value.copy(grey(litC, oc * 0.7, 0.78)).multiplyScalar(1 - oc * 0.2);
    U.uCloudDark.value.copy(grey(darkC, oc * 0.6, 0.78)).multiplyScalar(1 - oc * 0.25);
    U.uCloudRim.value.copy(this.sun.color).multiplyScalar((0.35 + num(a.glow, b.glow) * 0.6) * clear * (this.night > 0.5 ? 0.4 : 1));
    if (w.flash > 0) { (U.uCloudLit.value as THREE.Color).lerp(tmpA.setRGB(0.95, 0.96, 1), w.flash); (U.uCloudDark.value as THREE.Color).lerp(tmpA.setRGB(0.6, 0.62, 0.75), w.flash); }

    // the sun arcs from one side of the clearing to the other, low and golden at the ends of the day (higher in
    // summer); at night the light comes from a fixed moonlit angle in front of the house
    const isDay = this.hour > 5.6 && this.hour < 19.6;
    const k = isDay ? (this.hour - 5.6) / 14 : 0.35;
    const peak = 0.5 + 0.6 * w.sunHeight;
    const az = -0.9 + k * 1.8, el = isDay ? 0.4 + Math.sin(k * Math.PI) * (peak - 0.4) : 0.9;
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el) * 0.8 + 0.3).normalize();
    if (!isDay) this.sunDir.set(-0.32, 0.78, 0.54).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(60);
    this.sun.target.position.set(0, 0, 0);
    this.ambient.copy(this.hemi.color).multiplyScalar(0.45 * this.hemi.intensity).add(this.sun.color.clone().multiplyScalar(0.22 * this.sun.intensity));
    U.uSunDisc.value.copy(this.sunDisc ? this.sunDisc.dir : this.sunDir).normalize();
    U.uSunSize.value = this.sunDisc ? this.sunDisc.size : 0.035;

    // the visible moon drifts across the sky in front of the clearing through the night
    const nh = this.hour < 12 ? this.hour + 24 : this.hour;
    const nk = THREE.MathUtils.clamp((nh - 18) / 13, 0, 1);
    // kept low and to the right of the tree house, where the home and sleep views can see it
    const maz = 0.34 - nk * 0.6, mel = 0.13 + Math.sin(nk * Math.PI) * 0.1;
    this.moonDir.set(Math.sin(maz) * Math.cos(mel), Math.sin(mel), -Math.cos(maz) * Math.cos(mel)).normalize();
    const mo = this.moonOverride;
    U.uMoonDir.value.copy(mo ? mo.dir : this.moonDir).normalize();
    U.uMoonSize.value = mo ? mo.size : 0.055;
    U.uMoonPhase.value = this.moonPhase;
    // a new moon is (nearly) invisible; the cinematic moon always shows
    const litFrac = 0.5 - 0.5 * Math.cos(this.moonPhase * Math.PI * 2);
    U.uMoonVis.value = (mo ? 1 : THREE.MathUtils.smoothstep(this.night, 0.2, 0.7) * Math.min(1, 0.25 + litFrac * 3)) * this.moonFade;
    this.starMat.uniforms.uNight.value = Math.max(this.starBoost, THREE.MathUtils.smoothstep(this.night, 0.35, 0.95));
    this.starMat.uniforms.uClear.value = (1 - oc) * (1 - w.fog * 0.85);
    this.envDirty = true;
  }

  /** Southern hemisphere players see the moon lit from the other side. */
  setHemisphere(south: boolean) { this.domeMat.uniforms.uHemi.value = south ? -1 : 1; }

  /** Send a shooting star across the sky (directions default to a random arc in front). */
  shootingStar(from?: THREE.Vector3, to?: THREE.Vector3, dur = 0.9) {
    const r = () => Math.random();
    const f = from?.clone().normalize() ?? new THREE.Vector3(r() * 1.4 - 0.7, 0.35 + r() * 0.4, -1).normalize();
    const t = to?.clone().normalize() ?? f.clone().add(new THREE.Vector3((r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.2), -0.12 - r() * 0.1, 0)).normalize();
    this.shooting = { from: f, to: t, t: 0, dur };
  }

  update(time: number, camera: THREE.Camera, dt = 1 / 60) {
    this.domeMat.uniforms.uTime.value = time;
    this.starMat.uniforms.uTime.value = time;
    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.shoot.position.copy(camera.position);

    // shooting stars on clear nights
    const clear = this.starMat.uniforms.uClear.value as number;
    if (!this.shooting && this.night > 0.8 && clear > 0.6 && (this.nextShoot -= dt) <= 0) { this.nextShoot = 9 + Math.random() * 22; this.shootingStar(); }
    const sh = this.shooting;
    if (sh) {
      sh.t += dt;
      const k = sh.t / sh.dur, n = this.shootA.length, p = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const kk = k - i * 0.022;
        const a = kk < 0 || kk > 1 ? 0 : (1 - i / n) * Math.sin(Math.min(1, k) * Math.PI) ** 0.5;
        p.copy(sh.from).lerp(sh.to, THREE.MathUtils.clamp(kk, 0, 1)).normalize().multiplyScalar(STAR_R * 0.95);
        this.shootPos.set([p.x, p.y, p.z], i * 3);
        this.shootA[i] = a;
      }
      (this.shoot.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.shoot.geometry.attributes.aA as THREE.BufferAttribute).needsUpdate = true;
      this.shoot.visible = true;
      if (k > 1.6) { this.shooting = null; this.shoot.visible = false; }
    }

    const axis = this.sunDir, toCam = new THREE.Vector3(), x = new THREE.Vector3(), zv = new THREE.Vector3(), m = new THREE.Matrix4();
    this.rays.forEach((r, i) => {
      const flick = 0.75 + 0.25 * Math.sin(time * 0.35 + i * 2.1);
      r.mat.uniforms.uAlpha.value = this.rayPower * 0.06 * flick; // [world3] soft beams under the post grade
      r.mat.uniforms.uTime.value = time;
      r.mat.uniforms.uCol.value.copy(this.sun.color);
      r.mesh.visible = this.rayPower > 0.02;
      // stand the plane along the sun direction and swivel it to face the camera
      toCam.copy(camera.position).sub(r.base);
      x.crossVectors(axis, toCam).normalize();
      zv.crossVectors(x, axis).normalize();
      m.makeBasis(x, axis, zv);
      r.mesh.quaternion.setFromRotationMatrix(m);
      r.mesh.position.copy(r.base).addScaledVector(axis, -1.5);
    });
  }

  /** Tell the star shader the canvas size (in CSS px) and pixel ratio. */
  setViewport(w: number, h: number, pr: number) {
    this.starMat.uniforms.uRes.value.set(w * pr, h * pr);
    this.starMat.uniforms.uPR.value = Math.max(1, Math.round(pr));
  }
}

// ---------------------------------------------------------------- where and when

const GEO_KEY = 'hoot-hollow:geo';
let placeCache: Place | null = null;

/** The player's rough location: shared geolocation (cached by the weather), else a timezone guess. */
export function place(): Place {
  if (placeCache) return placeCache;
  try {
    const raw = localStorage.getItem(GEO_KEY);
    if (raw) { const g = JSON.parse(raw) as { lat: number; lon: number }; if (Number.isFinite(g.lat) && Number.isFinite(g.lon)) return (placeCache = { lat: g.lat, lon: g.lon, source: 'geo' }); }
  } catch { /* storage blocked */ }
  let tz: string | undefined;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* old browser */ }
  return (placeCache = guessPlace(tz, typeof navigator !== 'undefined' ? navigator.language : undefined));
}
/** Remember a real location (from geolocation). */
export function setPlace(lat: number, lon: number) {
  placeCache = { lat, lon, source: 'geo' };
  try { localStorage.setItem(GEO_KEY, JSON.stringify({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 })); } catch { /* storage blocked */ }
}

let sunCache: { key: string; day: SunDay } | null = null;
/** Today's sunrise/sunset for the player's place. */
export function today(now = new Date()): SunDay {
  const p = place(), key = `${now.toDateString()}|${p.lat}|${p.lon}`;
  if (sunCache?.key !== key) sunCache = { key, day: sunDay(now, p.lat, p.lon) };
  return sunCache.day;
}

/** Sky hour for a sky mode: the clock mode follows the real sun. */
export function hourFor(mode: SkyMode, now = new Date()): number {
  if (mode === 'day') return 11;
  if (mode === 'golden') return 17.2;
  if (mode === 'night') return 22;
  return skyHour(now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600, today(now));
}
