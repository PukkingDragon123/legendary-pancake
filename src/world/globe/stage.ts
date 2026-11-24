// The Wide World: a realistic Earth floating in space. It is a Stage (see src/world/scene.ts): the scene shows it
// instead of the forest while the globe panel is open.
//
// The planet wears NASA's Blue Marble (land) and its shaded bathymetry (seas), NASA Black Marble town lights on
// the night side, ETOPO relief as a bump so mountains catch the low sun, a glint of sun on the seas, a cloud deck
// that drifts and throws shadows, and a scattering atmosphere that glows blue on the limb and amber along the
// terminator. The sun is where it really is right now (day and night are true to the minute), and the Milky Way
// and the stars turn with the real sidereal time. Natural Earth borders lie faintly on the land; the country of
// the place you pick is drawn in gold, with a sharp NASA close-up of the place fading in as the camera comes down.
//
// The camera is a rig over a point on the ground (lat, lon), at a distance D from it, tilted towards the horizon
// by tau and turned by psi; flights between rigs swing round the planet and dive (or climb and dive again between
// two places). The stage renders through its own chain at full resolution: MSAA HDR, a wide bloom, a gentle
// tilt-shift blur in the close views, ACES, a warm grade, light grain (see shaders.ts).
// [globe] OWNED BY THE GLOBE BUILDER.
import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Stage } from '../scene.ts';
import { OwlActor } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { flightArc, gmst, latLonToVec3, subsolar } from './earth.ts';
import * as S from './shaders.ts';

const BASE = import.meta.env.BASE_URL;
const D2R = Math.PI / 180;
/** shifts the globe's clock (ms), for previews of other times of day */
export const globeClock = { offset: 0 };
const now = () => Date.now() + globeClock.offset;

export interface PinView { id: string; x: number; y: number; facing: number; depth: number }
export interface SatBox { s: number; n: number; w: number; e: number }
export interface GlobePlace {
  id: string; lat: number; lon: number;
  /** marker colour (css hex) and whether it is open */
  color?: string; open?: boolean;
  /** the close-up: the place's photo sheet and where its satellite tile sits in it (see src/ui/globe/photos.ts) */
  sheet?: string; sat?: SatBox; satRect?: [number, number, number, number];
  /** how much ground the close view shows across (km) */
  span?: number;
}
interface Rig { lat: number; lon: number; D: number; tau: number; psi: number; cx: number; cy: number }
interface Flight { a: Rig; b: Rig; t: number; dur: number; hop: number; done?: () => void }
interface Borders { b: number[][]; c: Record<string, { n: string; l: [number, number]; r: number[][] }> }

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** decode a delta-coded line (hundredths of a degree, lon then lat) */
function decode(a: number[]): [number, number][] {
  const out: [number, number][] = [];
  let x = 0, y = 0;
  for (let i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out.push([x / 100, y / 100]); }
  return out;
}
/** positions for line segments along a lat/lon polyline, split so no chord dips under the ground */
function segs(pts: [number, number][], r: number, out: number[]) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 1; i < pts.length; i++) {
    latLonToVec3(pts[i - 1][1], pts[i - 1][0], 1, a);
    latLonToVec3(pts[i][1], pts[i][0], 1, b);
    const ang = a.angleTo(b), n = Math.max(1, Math.ceil(ang / (0.6 * D2R)));
    p.copy(a);
    for (let k = 1; k <= n; k++) {
      q.copy(a).lerp(b, k / n).normalize();
      out.push(p.x * r, p.y * r, p.z * r, q.x * r, q.y * r, q.z * r);
      p.copy(q);
    }
  }
}

function rt(w: number, h: number, samples = 0, depth = false) {
  return new THREE.WebGLRenderTarget(Math.max(4, w), Math.max(4, h), {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: depth, samples,
  });
}

export class GlobeStage implements Stage {
  /** what the app draws: the stage's final composite (one full-screen quad) */
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
  /** the 3D world and its camera */
  readonly world = new THREE.Scene();
  readonly cam = new THREE.PerspectiveCamera(34, 1, 0.004, 400);
  ready = false;
  /** 0..1: how far down into the close view of a place the camera is */
  closeness = 0;
  /** called every frame with where each place sits on screen (CSS px) */
  onFrame: ((pins: PinView[]) => void) | null = null;
  /** called once when the planet's textures are in */
  onReady: (() => void) | null = null;
  /** a tap on the planet (not on a pin), CSS px */
  onTap: ((x: number, y: number) => void) | null = null;
  onSpin: ((speed: number) => void) | null = null;

  private w = 1; private h = 1;
  private main!: THREE.WebGLRenderTarget;
  private bloom: THREE.WebGLRenderTarget[] = [];
  private soft: THREE.WebGLRenderTarget[] = [];
  private pq = new THREE.Scene();
  private pqMesh: THREE.Mesh;
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private m: Record<string, THREE.ShaderMaterial> = {};
  private comp: THREE.ShaderMaterial;
  private earthMat: THREE.ShaderMaterial;
  private cloudMat: THREE.ShaderMaterial;
  private atmoMat: THREE.ShaderMaterial;
  private skyMat: THREE.ShaderMaterial;
  private starMat: THREE.ShaderMaterial;
  private glowMat: THREE.ShaderMaterial;
  private lineMat: THREE.ShaderMaterial;
  private celestial = new THREE.Group();
  private sunSprite: THREE.Mesh;
  private sunLight = new THREE.DirectionalLight(0xfff4e6, 3.2);
  private glows: THREE.Points | null = null;
  private outline: LineSegments2 | null = null;
  private outlineMat: LineMaterial;
  private outlineId = '';
  private route: LineSegments2 | null = null;
  private routeMat: LineMaterial;
  private borders: Borders | null = null;
  private places: GlobePlace[] = [];
  private tex: THREE.Texture[] = [];
  private tileTex: THREE.Texture | null = null;
  private tileFor = '';
  private sheets = new Map<string, HTMLImageElement>();
  private samples: number;
  private fade = 0;
  private cloudAmt = 0;
  private cloudsIn = false;
  private time = 0;

  // camera rig
  private cur: Rig = { lat: 20, lon: 0, D: 2.6, tau: 0, psi: 0, cx: 0, cy: 0 };
  private flight: Flight | null = null;
  private focusId: string | null = null;
  private overview = { cx: 0, cy: 0, r: 0 };
  private placeFrame = { cx: 0, cy: 0, w: 300 };
  private spinVel = { lat: 0, lon: 0 };
  private idle = 0;
  private drag: { id: number; x: number; y: number; moved: number; t: number; vx: number; vy: number } | null = null;
  private tileMix = 0;
  private outlineA = 0;

  // Pip, circling the planet in the space view
  private owl: OwlActor | null = null;
  private owlPivot = new THREE.Group();
  private owlA = 0;

  constructor(private renderer: THREE.WebGLRenderer, quality: 'high' | 'low' = 'high') {
    this.samples = quality === 'high' ? 4 : 0;
    this.camera.position.z = 1;
    const mk = (fs: string, u: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({ vertexShader: S.quadVS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.m.bright = mk(S.brightFS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1.0 } });
    this.m.down = mk(S.downFS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.m.up = mk(S.upFS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uK: { value: 1 } });
    this.m.up.blending = THREE.AdditiveBlending; this.m.up.transparent = true;
    this.m.half = mk(S.halfFS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.comp = mk(S.compFS, {
      tColor: { value: null }, tBloom: { value: null }, tSoft: { value: null }, uBloom: { value: 0.55 }, uExposure: { value: 1.0 },
      uTilt: { value: 0 }, uFocusY: { value: new THREE.Vector2(0.6, 0.18) }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 0 },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.pqMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.m.down);
    this.pqMesh.frustumCulled = false;
    this.pq.add(this.pqMesh);

    // ---- the sky: the Milky Way and the stars, turning with sidereal time
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: S.skyVS, fragmentShader: S.skyFS, uniforms: { tSky: { value: null }, uSkyI: { value: 0.0 }, uSun: { value: new THREE.Vector3() } }, side: THREE.BackSide, depthWrite: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), this.skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    sky.visible = false;
    this.celestial.add(sky);
    this.starMat = new THREE.ShaderMaterial({ vertexShader: S.starVS, fragmentShader: S.starFS, uniforms: { uPx: { value: 1 } }, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
    const stars = new THREE.Points(this.makeStars(5200), this.starMat);
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    this.celestial.add(stars);
    this.world.add(this.celestial);
    this.sunSprite = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.ShaderMaterial({ vertexShader: S.sunVS, fragmentShader: S.sunFS, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
    this.sunSprite.renderOrder = -8;
    this.world.add(this.sunSprite);

    // ---- the planet, its clouds and its air
    const sea = new THREE.DataTexture(new Uint8Array([10, 24, 52, 255]), 1, 1); sea.needsUpdate = true;
    const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
    const shared = {
      uSun: { value: new THREE.Vector3(1, 0, 0) }, uCloudU: { value: 0 }, uCloudAmt: { value: 0 }, tCL: { value: black },
      uTarget: { value: new THREE.Vector3(1, 0, 0) }, uClear: { value: 0 },
    };
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: S.earthVS, fragmentShader: S.earthFS,
      uniforms: { ...shared, tDay: { value: sea }, tTopo: { value: black }, tTile: { value: black }, uTileBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uTileMix: { value: 0 }, uBump: { value: 0.0065 }, uNear: { value: 0 } },
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 384, 192), this.earthMat);
    this.world.add(earth);
    this.cloudMat = new THREE.ShaderMaterial({ vertexShader: S.earthVS, fragmentShader: S.cloudFS, uniforms: shared, transparent: true, depthWrite: false });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 256, 128), this.cloudMat);
    clouds.renderOrder = 2;
    this.world.add(clouds);
    this.atmoMat = new THREE.ShaderMaterial({ vertexShader: S.atmoVS, fragmentShader: S.atmoFS, uniforms: { uSun: shared.uSun, uGain: { value: 0.9 } }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.065, 128, 64), this.atmoMat);
    atmo.renderOrder = 5;
    this.world.add(atmo);

    // ---- borders, the picked country, the flight path, the place markers
    this.lineMat = new THREE.ShaderMaterial({ vertexShader: S.lineVS, fragmentShader: S.lineFS, uniforms: { uCam: { value: new THREE.Vector3() }, uSun: shared.uSun, uColor: { value: new THREE.Color(1.0, 0.93, 0.78) }, uAlpha: { value: 0.0 } }, transparent: true, depthWrite: false });
    this.outlineMat = new LineMaterial({ color: 0xffd98a, linewidth: 2.4, transparent: true, depthWrite: false, opacity: 0 });
    this.outlineMat.color.setRGB(1.35, 1.0, 0.5);
    this.routeMat = new LineMaterial({ color: 0xffd98a, linewidth: 2.2, transparent: true, depthWrite: false, dashed: true, dashSize: 0.018, gapSize: 0.014, opacity: 0.95 });
    this.routeMat.color.setRGB(2.2, 1.6, 0.8);
    this.glowMat = new THREE.ShaderMaterial({ vertexShader: S.glowVS, fragmentShader: S.glowFS, uniforms: { uPx: { value: 1 }, uCam: { value: new THREE.Vector3() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

    // light for Pip (the planet itself is lit in its shaders)
    this.world.add(this.sunLight, new THREE.HemisphereLight(0xbfd2ff, 0x1a2236, 1.1), this.owlPivot);

    this.load(sky);
  }

  // -------------------------------------------------------------- assets

  private texture(url: string, o: { srgb?: boolean; red?: boolean; repeat?: boolean } = {}): Promise<THREE.Texture> {
    return new Promise((res, rej) => {
      new THREE.TextureLoader().load(url, (t) => {
        t.colorSpace = o.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        if (o.red) t.format = THREE.RedFormat;
        t.wrapS = o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
        this.tex.push(t);
        res(t);
      }, undefined, rej);
    });
  }

  private load(sky: THREE.Mesh) {
    const g = `${BASE}models/globe/`;
    const day = this.texture(g + 'earth_day.webp', { srgb: true, repeat: true }).then((t) => { this.earthMat.uniforms.tDay.value = t; });
    const topo = this.texture(g + 'earth_topo.webp', { red: true, repeat: true }).then((t) => { this.earthMat.uniforms.tTopo.value = t; });
    void Promise.all([day, topo]).then(() => { this.ready = true; this.onReady?.(); }).catch((e) => { console.warn('globe textures', e); this.ready = true; this.onReady?.(); });
    void this.texture(g + 'earth_cl.webp', { red: true, repeat: true }).then((t) => { this.earthMat.uniforms.tCL.value = t; this.cloudsIn = true; }).catch(() => {});
    void this.texture(g + 'sky.webp', { srgb: true, repeat: true }).then((t) => { this.skyMat.uniforms.tSky.value = t; sky.visible = true; }).catch(() => {});
    void fetch(g + 'borders.json').then((r) => r.json()).then((b: Borders) => {
      this.borders = b;
      const pos: number[] = [];
      for (const l of b.b) segs(decode(l), 1.0011, pos);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const lines = new THREE.LineSegments(geo, this.lineMat);
      lines.renderOrder = 1;
      lines.frustumCulled = false;
      this.world.add(lines);
      if (this.focusId) this.setOutline(this.focusId);
      this.onBorders?.();
    }).catch(() => {});
  }
  /** called when the borders (and so the country names) are in */
  onBorders: (() => void) | null = null;

  private makeStars(n: number): THREE.BufferGeometry {
    // galactic latitude crowds towards the plane of the Milky Way; magnitudes mostly faint; colours by temperature
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.44482963, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
    const pos = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3);
    const tint = [[0.72, 0.8, 1.0], [0.88, 0.92, 1.0], [1.0, 1.0, 1.0], [1.0, 0.95, 0.85], [1.0, 0.85, 0.68], [1.0, 0.74, 0.55]];
    for (let i = 0; i < n; i++) {
      const l = rnd() * Math.PI * 2;
      const b = rnd() < 0.45 ? (rnd() + rnd() + rnd() - 1.5) * 0.25 : Math.asin(rnd() * 2 - 1);
      const g = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
      // galactic -> equatorial (the transpose), then to the stage's celestial axes (y = north, RA 0 at +x, east -z)
      const e = [0, 1, 2].map((k) => M[0][k] * g[0] + M[1][k] * g[1] + M[2][k] * g[2]);
      pos.set([e[0] * 150, e[2] * 150, -e[1] * 150], i * 3);
      mag[i] = 6.6 - Math.pow(rnd(), 2.6) * 7.4;
      col.set(tint[Math.min(5, Math.floor(rnd() * 6))], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    return g;
  }

  // -------------------------------------------------------------- layout

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const v = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const W = Math.max(4, Math.round(v.x)), H = Math.max(4, Math.round(v.y));
    for (const t of [this.main, ...this.bloom, ...this.soft]) t?.dispose();
    this.main = rt(W, H, this.samples, true);
    this.bloom = [1, 2, 3, 4, 5, 6].map((i) => rt(W >> i, H >> i));
    this.soft = [rt(W >> 1, H >> 1), rt(W >> 2, H >> 2)];
    this.cam.aspect = w / h;
    // a little wider on tall phones so the whole planet fits across
    this.cam.fov = w < h ? 40 : 34;
    this.cam.updateProjectionMatrix();
    const pr = W / w;
    this.starMat.uniforms.uPx.value = pr;
    this.glowMat.uniforms.uPx.value = pr;
    this.outlineMat.resolution.set(W, H); this.routeMat.resolution.set(W, H);
    this.outlineMat.linewidth = 2.2 * pr; this.routeMat.linewidth = 2.0 * pr;
    this.comp.uniforms.uRes.value.set(W, H);
    if (!this.overview.r) this.setView(w / 2, h / 2, Math.min(w, h) * 0.36);
  }

  /** pixels per radian at the image centre (CSS px) */
  private ppr() { return (this.h / 2) / Math.tan(this.cam.fov * D2R / 2); }
  /** Where the planet sits in the space view: centre and radius on screen, CSS px. */
  setView(cx: number, cy: number, r: number) {
    this.overview = { cx, cy, r };
    if (!this.focusId && !this.flight) { const o = this.spaceRig(); this.cur.D = o.D; this.cur.cx = o.cx; this.cur.cy = o.cy; }
  }
  /** Where the place sits in its close view (CSS px): the clear part of the screen beside or above the card. */
  setPlaceFrame(cx: number, cy: number, w: number) {
    this.placeFrame = { cx, cy, w };
    if (this.focusId && !this.flight) { const p = this.places.find((x) => x.id === this.focusId); if (p) { const r = this.placeRig(p); this.cur.D = r.D; this.cur.cx = r.cx; this.cur.cy = r.cy; } }
  }
  private spaceRig(): Rig {
    const q = this.ppr() / Math.max(40, this.overview.r);
    const dist = Math.sqrt(1 + q * q);
    return { lat: clamp(this.cur.lat, -40, 50), lon: this.cur.lon, D: dist - 1, tau: 0, psi: 0, cx: this.overview.cx, cy: this.overview.cy };
  }
  private placeRig(p: GlobePlace): Rig {
    const span = (p.span ?? 1000) / 6371;
    const D = clamp(span * this.ppr() / Math.max(160, this.placeFrame.w) * 1.05, 0.12, 0.9);
    return { lat: p.lat, lon: p.lon, D, tau: 0.62, psi: 0, cx: this.placeFrame.cx, cy: this.placeFrame.cy };
  }

  setPlaces(p: GlobePlace[]) {
    this.places = p;
    if (this.glows) { this.world.remove(this.glows); this.glows.geometry.dispose(); }
    const n = p.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    const v = new THREE.Vector3(), c = new THREE.Color();
    p.forEach((q, i) => {
      latLonToVec3(q.lat, q.lon, 1.003, v);
      pos.set([v.x, v.y, v.z], i * 3);
      c.set(q.color ?? '#ffd98a');
      const k = q.open === false ? 0.6 : 2.2;
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
      size[i] = q.open === false ? 9 : 14;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.glows = new THREE.Points(g, this.glowMat);
    this.glows.renderOrder = 3;
    this.glows.frustumCulled = false;
    this.world.add(this.glows);
  }

  /** Point the space view at a lat/lon at once (no flight). */
  lookAt(lat: number, lon: number) { this.cur.lat = clamp(lat, -40, 50); this.cur.lon = lon; }

  // -------------------------------------------------------------- flights

  /** Fly down to a place (its close view), or back out to space (null). */
  focus(p: GlobePlace | null, done?: () => void) {
    const from = { ...this.cur };
    this.spinVel.lat = this.spinVel.lon = 0;
    this.focusId = p?.id ?? null;
    let to: Rig;
    if (p) {
      to = this.placeRig(p);
      this.loadTile(p);
      if (this.borders) this.setOutline(p.id);
    } else {
      to = { ...this.spaceRig(), lat: clamp(from.lat, -40, 50), lon: from.lon };
    }
    // the shortest way round
    to.lon = from.lon + wrap180(to.lon - from.lon);
    const ang = latLonToVec3(from.lat, from.lon).angleTo(latLonToVec3(to.lat, to.lon));
    const hop = from.D < 1 && to.D < 1 ? clamp(ang * 1.6, 0, 2.2) : 0;
    const dur = clamp(1.5 + ang * 0.55 + Math.abs(Math.log(to.D / from.D)) * 0.32 + hop * 0.25, 1.4, 3.6);
    this.flight = { a: from, b: to, t: 0, dur, hop, done };
  }
  get flying() { return !!this.flight; }
  /** 0..1 through the current flight (1 when not flying) */
  get flightT() { return this.flight ? this.flight.t : 1; }
  get focused() { return this.focusId; }

  private stepFlight(dt: number) {
    const f = this.flight!;
    f.t = Math.min(1, f.t + dt / f.dur);
    const t = f.t, a = f.a, b = f.b;
    const down = b.D < a.D;
    // turn the planet first and dive after (or climb first and turn after)
    const tMove = down ? smooth(sstep(0, 0.78, t)) : smooth(sstep(0.12, 1, t));
    const tZoom = down ? smooth(sstep(0.18, 1, t)) : smooth(sstep(0, 0.72, t));
    const pa = latLonToVec3(a.lat, a.lon), pb = latLonToVec3(b.lat, b.lon);
    const ang = pa.angleTo(pb);
    const p = ang < 1e-5 ? pa : pa.clone().multiplyScalar(Math.sin((1 - tMove) * ang)).addScaledVector(pb, Math.sin(tMove * ang)).divideScalar(Math.sin(ang));
    p.normalize();
    const c = this.cur;
    c.lat = Math.asin(clamp(p.y, -1, 1)) / D2R;
    // keep the longitude continuous (no jump at the date line)
    c.lon = c.lon + wrap180(Math.atan2(-p.z, p.x) / D2R - c.lon);
    const lift = f.hop * Math.sin(Math.PI * smooth(t));
    c.D = Math.exp(Math.log(a.D) + (Math.log(b.D) - Math.log(a.D)) * tZoom) + lift;
    const tTau = down ? smooth(sstep(0.55, 1, t)) : smooth(sstep(0, 0.45, t));
    c.tau = (a.tau + (b.tau - a.tau) * tTau) * (1 - Math.min(1, f.hop) * Math.sin(Math.PI * t));
    c.psi = a.psi + (b.psi - a.psi) * smooth(t);
    const tc = smooth(sstep(0.1, 0.9, t));
    c.cx = a.cx + (b.cx - a.cx) * tc; c.cy = a.cy + (b.cy - a.cy) * tc;
    if (t >= 1) { this.flight = null; f.done?.(); }
  }

  private loadTile(p: GlobePlace) {
    if (!p.sheet || !p.sat || !p.satRect || this.tileFor === p.id) return;
    this.tileFor = p.id;
    this.tileMix = 0;
    const use = (im: HTMLImageElement) => {
      if (this.tileFor !== p.id) return;
      const [x, y, w, h] = p.satRect!;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(im, x, y, w, h, 0, 0, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      this.tileTex?.dispose();
      this.tileTex = t;
      const s = p.sat!;
      this.earthMat.uniforms.tTile.value = t;
      this.earthMat.uniforms.uTileBox.value.set((s.w + 180) / 360, (s.s + 90) / 180, (s.e + 180) / 360, (s.n + 90) / 180);
    };
    const hit = this.sheets.get(p.sheet);
    if (hit?.complete && hit.naturalWidth) { use(hit); return; }
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => use(im);
    im.src = p.sheet;
    this.sheets.set(p.sheet, im);
  }

  private setOutline(id: string) {
    if (this.outlineId === id) return;
    this.outlineId = id;
    if (this.outline) { this.world.remove(this.outline); this.outline.geometry.dispose(); this.outline = null; }
    const c = this.borders?.c[id];
    if (!c) return;
    const pos: number[] = [];
    for (const r of c.r) segs(decode(r), 1.0016, pos);
    const g = new LineSegmentsGeometry();
    g.setPositions(pos);
    this.outline = new LineSegments2(g, this.outlineMat);
    this.outline.renderOrder = 4;
    this.outline.frustumCulled = false;
    this.world.add(this.outline);
  }
  /** The place's country: its name and where its label goes (null until the borders are in). */
  country(id: string): { name: string; lat: number; lon: number } | null {
    const c = this.borders?.c[id];
    const p = this.places.find((x) => x.id === id);
    if (!c || !p) return null;
    // the country's own label point, pulled in towards the place when that is far off (big countries); never on it
    let lon = c.l[0], lat = c.l[1];
    const d = Math.hypot(wrap180(lon - p.lon) * Math.cos(p.lat * D2R), lat - p.lat);
    if (d > 3) { const k = 3 / d; lon = p.lon + wrap180(lon - p.lon) * k; lat = p.lat + (lat - p.lat) * k; }
    if (d < 1) { lat = p.lat - 1.6; lon = p.lon; }
    return { name: c.n, lat, lon };
  }

  /** The dashed flight path from home to tonight's place (null hides it). */
  setRoute(a: { lat: number; lon: number } | null, b: { lat: number; lon: number } | null) {
    if (this.route) { this.world.remove(this.route); this.route.geometry.dispose(); this.route = null; }
    if (!a || !b) return;
    const pts = flightArc(a, b, 160, 0.09);
    const pos: number[] = [];
    for (let i = 1; i < pts.length; i++) pos.push(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z, pts[i].x, pts[i].y, pts[i].z);
    const g = new LineSegmentsGeometry();
    g.setPositions(pos);
    this.route = new LineSegments2(g, this.routeMat);
    this.route.computeLineDistances();
    this.route.renderOrder = 4;
    this.route.frustumCulled = false;
    this.world.add(this.route);
  }

  /** Let Pip circle the planet in the space view (null: no owl). */
  setOwl(look: OwlLook | null) {
    if (this.owl) { this.owlPivot.remove(this.owl.node); this.owl = null; }
    if (!look) return;
    try {
      const o = new OwlActor(look, {});
      o.pose = 'fly';
      o.node.scale.setScalar(0.06);
      o.node.traverse((n) => { n.castShadow = false; n.receiveShadow = false; });
      this.owlPivot.add(o.node);
      this.owl = o;
    } catch (e) { console.warn('globe owl', e); }
  }

  // -------------------------------------------------------------- input

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, _ray: THREE.Ray, e: PointerEvent): boolean {
    if (type === 'down') {
      this.drag = { id: e.pointerId, x, y, moved: 0, t: performance.now(), vx: 0, vy: 0 };
      this.spinVel.lat = this.spinVel.lon = 0;
      return true;
    }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return false;
    if (type === 'move') {
      const dx = x - d.x, dy = y - d.y;
      d.x = x; d.y = y; d.moved += Math.abs(dx) + Math.abs(dy);
      if (this.flight) return true;
      if (this.focusId) {
        // close view: turn round the place and tip the view a little
        this.cur.psi -= dx * 0.006;
        this.cur.tau = clamp(this.cur.tau - dy * 0.004, 0.15, 0.95);
      } else {
        // space view: roll the planet under the finger
        const R = Math.max(80, this.globeRadiusPx());
        const dLon = -dx / R / D2R, dLat = dy / R / D2R;
        this.cur.lon += dLon; this.cur.lat = clamp(this.cur.lat + dLat, -60, 70);
        d.vx = d.vx * 0.5 + dLon * 30; d.vy = d.vy * 0.5 + dLat * 30;
      }
      if (d.moved > 6) this.idle = 0;
      return true;
    }
    this.drag = null;
    if (d.moved < 8 && performance.now() - d.t < 450) this.onTap?.(x, y);
    else if (!this.focusId) {
      this.spinVel.lon = clamp(d.vx, -120, 120); this.spinVel.lat = clamp(d.vy, -60, 60);
      this.onSpin?.(Math.hypot(this.spinVel.lon, this.spinVel.lat));
    }
    return true;
  }

  /** Screen position (CSS px) of a lat/lon on the planet, and whether it faces the camera (> 0). */
  project(lat: number, lon: number, r = 1.003): { x: number; y: number; facing: number } {
    const v = latLonToVec3(lat, lon, r);
    const facing = v.clone().normalize().dot(this.cam.position.clone().sub(v).normalize());
    const s = v.project(this.cam);
    return { x: (s.x * 0.5 + 0.5) * this.w, y: (-s.y * 0.5 + 0.5) * this.h, facing };
  }
  /** Radius of the planet on screen (CSS px). */
  globeRadiusPx(): number {
    const d = this.cam.position.length();
    return Math.tan(Math.asin(Math.min(1, 1 / d))) * this.ppr();
  }

  // -------------------------------------------------------------- frame

  private placeCamera() {
    const c = this.cur;
    const T = latLonToVec3(c.lat, c.lon);
    const E = new THREE.Vector3(T.z, 0, -T.x);
    if (E.lengthSq() < 1e-8) E.set(0, 0, -1);
    E.normalize();
    const N = new THREE.Vector3().crossVectors(T, E);
    const F = N.clone().multiplyScalar(Math.cos(c.psi)).addScaledVector(E, Math.sin(c.psi));
    const dir = T.clone().multiplyScalar(Math.cos(c.tau)).addScaledVector(F, -Math.sin(c.tau));
    this.cam.position.copy(T).addScaledVector(dir, c.D);
    this.cam.up.copy(F).multiplyScalar(Math.cos(c.tau)).addScaledVector(T, Math.sin(c.tau)).normalize();
    this.cam.lookAt(T);
    this.cam.setViewOffset(this.w, this.h, this.w / 2 - c.cx, this.h / 2 - c.cy, this.w, this.h);
    this.cam.updateMatrixWorld();
    return T;
  }

  update(dt: number, t: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    if (this.flight) this.stepFlight(dt);
    else if (!this.focusId && !this.drag) {
      // coast after a flick, then drift slowly (the Earth turning under us)
      this.cur.lon += this.spinVel.lon * dt; this.cur.lat = clamp(this.cur.lat + this.spinVel.lat * dt, -60, 70);
      const k = Math.exp(-dt * 2.2);
      this.spinVel.lon *= k; this.spinVel.lat *= k;
      this.idle += dt;
      this.cur.lon -= dt * 1.4 * Math.min(1, Math.max(0, this.idle - 2) / 3);
      if (this.idle > 4) this.cur.lat += (clamp(this.cur.lat, -25, 38) - this.cur.lat) * (1 - Math.exp(-dt * 0.4));
    } else if (this.focusId && !this.drag) {
      // the close view breathes: a slow turn back and forth
      this.cur.psi += (Math.sin(this.time * 0.11) * 0.18 - this.cur.psi) * (1 - Math.exp(-dt * 0.25));
    }
    const target = this.placeCamera();
    this.closeness = sstep(1.4, 0.35, this.cur.D);

    // ---- the real sun, the turning sky
    const ss = subsolar(now());
    const sun = latLonToVec3(ss.lat, ss.lon);
    this.earthMat.uniforms.uSun.value.copy(sun);
    this.sunLight.position.copy(sun).multiplyScalar(10);
    this.celestial.rotation.y = -gmst(now());
    this.sunSprite.position.copy(sun).multiplyScalar(150);
    this.sunSprite.quaternion.copy(this.cam.quaternion);
    this.skyMat.uniforms.uSkyI.value = 0.34 * this.fade;

    // ---- clouds, the close-up tile, the outline
    const k = 1 - Math.exp(-dt * 1.6);
    this.cloudAmt += ((this.cloudsIn ? 1 : 0) - this.cloudAmt) * k;
    const u = this.earthMat.uniforms;
    u.uCloudU.value = (this.time * 0.00045 + 0.13) % 1;
    u.uCloudAmt.value = this.cloudAmt * (0.95 - 0.35 * this.closeness);
    u.uTarget.value.copy(this.focusId ? target : new THREE.Vector3(0, 0, 0));
    u.uClear.value = 0.85 * this.closeness;
    u.uNear.value = this.closeness;
    const tileGoal = this.focusId && this.focusId === this.tileFor && this.tileTex ? sstep(1.1, 0.55, this.cur.D) : 0;
    this.tileMix += (tileGoal - this.tileMix) * k;
    u.uTileMix.value = this.tileMix;
    this.outlineA += ((this.focusId ? sstep(1.6, 0.6, this.cur.D) : 0) - this.outlineA) * k;
    this.outlineMat.opacity = this.outlineA * 0.95;
    if (this.outline) this.outline.visible = this.outlineA > 0.01;
    this.lineMat.uniforms.uAlpha.value = (0.16 + 0.2 * this.closeness) * this.fade;
    this.lineMat.uniforms.uCam.value.copy(this.cam.position);
    this.glowMat.uniforms.uCam.value.copy(this.cam.position);
    if (this.route) { this.route.visible = !this.focusId || !!this.flight; this.routeMat.dashOffset = -this.time * 0.035; }
    if (this.glows) {
      // the picked place glows brighter; the rest glow softly and step back in the close view
      const s = this.glows.geometry.getAttribute('aSize') as THREE.BufferAttribute;
      this.places.forEach((p, i) => {
        const on = p.id === this.focusId;
        const base = p.open === false ? 9 : 13;
        s.setX(i, (on ? 22 : base) * (1 + 0.12 * Math.sin(this.time * 2.4 + i)) * (on ? 1 : 1 - 0.35 * this.closeness));
      });
      s.needsUpdate = true;
    }

    // ---- Pip, circling in space
    if (this.owl) {
      const vis = 1 - this.closeness;
      this.owl.node.visible = vis > 0.05;
      if (this.owl.node.visible) {
        this.owlA += dt * 0.22;
        const a = this.owlA, R = 1.2;
        const camDir = this.cam.position.clone().normalize();
        const side = new THREE.Vector3(0, 1, 0).cross(camDir).normalize();
        const up = camDir.clone().cross(side);
        const ring = (q: number) => side.clone().multiplyScalar(Math.cos(q) * R).addScaledVector(camDir, Math.sin(q) * R * 0.55).addScaledVector(up, Math.sin(q) * 0.42 + 0.35);
        const pos = ring(a), ahead = ring(a + 0.05);
        const o = this.owl.node;
        o.position.copy(pos);
        o.lookAt(ahead);
        o.rotateY(Math.PI);
        o.rotateZ(-0.3);
        o.scale.setScalar(0.06 * Math.max(0.05, vis));
        this.owl.dark = 0.2;
        this.owl.update(dt);
      }
    }

    // ---- pins
    if (this.onFrame) {
      const out: PinView[] = [];
      for (const p of this.places) {
        const v = latLonToVec3(p.lat, p.lon, 1.003);
        const facing = v.clone().normalize().dot(this.cam.position.clone().sub(v).normalize());
        const s = v.clone().project(this.cam);
        out.push({ id: p.id, x: (s.x * 0.5 + 0.5) * this.w, y: (-s.y * 0.5 + 0.5) * this.h, facing, depth: s.z });
      }
      this.onFrame(out);
    }

    this.fade = Math.min(1, this.fade + dt * (this.ready ? 1.2 : 0));
    this.render(t);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.pqMesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.pq, this.ortho);
  }

  private render(t: number) {
    const r = this.renderer, prev = r.getRenderTarget(), ac = r.autoClear;
    r.autoClear = true;
    r.setRenderTarget(this.main);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(this.world, this.cam);
    // bloom: bright pass at half size, a mip chain down, then back up adding each level
    const B = this.bloom;
    const set = (m: THREE.ShaderMaterial, src: THREE.WebGLRenderTarget) => { m.uniforms.tSrc.value = src.texture; m.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); };
    set(this.m.bright, this.main);
    this.m.bright.uniforms.uThresh.value = 0.9 + 0.5 * this.closeness;
    this.pass(this.m.bright, B[0]);
    for (let i = 1; i < B.length; i++) { set(this.m.down, B[i - 1]); this.pass(this.m.down, B[i]); }
    r.autoClear = false;
    for (let i = B.length - 1; i > 0; i--) { set(this.m.up, B[i]); this.pass(this.m.up, B[i - 1]); }
    r.autoClear = true;
    // a soft copy for the tilt-shift
    const tilt = 0.55 * this.closeness;
    if (tilt > 0.01) {
      set(this.m.half, this.main); this.pass(this.m.half, this.soft[0]);
      set(this.m.down, this.soft[0]); this.pass(this.m.down, this.soft[1]);
    }
    const u = this.comp.uniforms;
    u.tColor.value = this.main.texture;
    u.tBloom.value = B[0].texture;
    u.tSoft.value = this.soft[1].texture;
    u.uTilt.value = tilt;
    u.uFocusY.value.set(1 - this.cur.cy / this.h, 0.16);
    u.uTime.value = t;
    u.uFade.value = this.fade;
    r.setRenderTarget(prev);
    r.autoClear = ac;
  }

  dispose() {
    for (const t of [this.main, ...this.bloom, ...this.soft]) t?.dispose();
    for (const t of this.tex) t.dispose();
    this.tileTex?.dispose();
    this.world.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
    for (const m of [this.earthMat, this.cloudMat, this.atmoMat, this.skyMat, this.starMat, this.glowMat, this.lineMat, this.outlineMat, this.routeMat, this.comp, ...Object.values(this.m)]) m.dispose();
    this.owl = null;
  }
}
