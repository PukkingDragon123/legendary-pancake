// Pip's bedroom at bedtime, as a Stage (world/scene.ts): a cosy room high in the oak, lamplit, with a big arched window
// that shows the real forest outside (the live world rendered from just outside the oak, at the real hour) and the
// moonlight falling through its glazing bars onto the floor. Everything is built in code from real proportions and
// the office's painted materials (onboard/mats.ts): plank floor and wainscot, warm plaster, a beamed ceiling with paper
// stars on threads, velvet curtains, a string of fairy lights round the arch, a walnut bed with a patchwork quilt and a
// moon cut into the headboard, a nightstand with a moon lamp, a brass alarm clock that keeps the real time and Pip's
// phone in its little wooden "phone bed", a record player that spins while a sleep sound is on, a vintage microphone
// on the sill with an on-air lamp (sleep tracking), a floor globe with the real Earth, and a Persian rug.
//
// The bedtime screen (ui/sleepflow.tsx) drives it: hotspots (the things you can tap) report their screen position for
// the 2D controls, `go(shot)` flies the camera, `playLock()` is the phone being put to bed and padlocked (Pip turns the
// key with his beak), `playPack()` puts his backpack on, `playGlobe()` walks him to the globe and spins it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sceneSound, sound } from '../../audio/sound.ts';
import { OwlActor, type OwlFx } from '../../owl/actor.ts';
import { featherColour, type OwlLook } from '../../owl/model.ts';
import { at, Batch, bbox, cyl, lathe } from '../../onboard/kit.ts';
import { instanceGLB, vivid } from '../../gfx/glb.ts';
import { houseTex } from '../house/kit.ts';
import type { OfficeMats } from '../../onboard/mats.ts';
import { ramp, rgb, Tex, vnoise, fbm, hash } from '../../onboard/tex.ts';
import { texCanvas, type TexName } from '../../ui/real/tex.ts';
import { STACK, TITLE_STACK } from '../../ui/font.ts';
import { Fx, SPR } from '../fx.ts';
import type { Look } from '../post.ts';
import type { Stage } from '../scene.ts';
import { HOUSE } from '../layout.ts';

/** The live world, for the real view through the window (world/scene.ts Scene). */
export interface WorldView {
  renderView(camera: THREE.Camera, target: THREE.WebGLRenderTarget): void;
  viewTarget(w: number, h: number): THREE.WebGLRenderTarget;
}

export type BedShot = 'room' | 'lock' | 'pack' | 'globe' | 'window' | 'mic' | 'sound' | 'alarm';
export type Hot = 'mic' | 'sound' | 'alarm' | 'window' | 'globe' | 'bed' | 'phone' | 'lamp';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const PIP_H = 0.7;
// the room (metres): back wall at z = Z0, the open side towards the camera
const X0 = -2.9, X1 = 2.9, Z0 = -2.0, H = 2.8, WALL_T = 0.32;
const WIN = { x: -0.5, w: 1.56, y0: 0.66, spring: 1.52 };
const WIN_TOP = WIN.spring + WIN.w / 2;
const NS = { x: 0.8, z: Z0 + 0.34, w: 0.62, h: 0.5, d: 0.44 };
/** on the nightstand: the phone's box on the left (Pip's side), the moon lamp at the back right, the clock at the front right */
const BOX = { x: NS.x - 0.15, z: NS.z - 0.02, s: 1.5 };
const LAMP = { x: NS.x + 0.17, z: NS.z - 0.09 };
const CLK = { x: NS.x + 0.17, z: NS.z + 0.11 };
const PHONE0 = { x: NS.x + 0.0, z: NS.z + 0.13 };
/** Pip's bed (a model from his house, scaled to this footprint) */
const BED = { x: 2.0, z0: Z0 + 0.18, len: 1.6, w: 1.6, top: 0.5 };
const CAB = { x: -2.15, z: Z0 + 0.3, w: 0.78, h: 0.56, d: 0.44 };
const GLOBE = { x: -1.72, z: -0.1 };
/** the little record player on the window seat, left of the cushion */
const REC = { x: WIN.x - WIN.w / 2 + 0.3, y: WIN.y0, z: Z0 - 0.08, s: 0.72 };
const PIP_HOME = V(0.15, 0, -0.55);
/** beside the nightstand's left end, facing it (his head comes up just over the top) */
const PIP_LOCK = V(NS.x - NS.w / 2 - 0.17, 0, NS.z + 0.03);
const PIP_GLOBE = V(-1.2, 0, 0.05);

const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerpAngle = (a: number, b: number, k: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

/** night 0..1 by the hour (1 = deep night, 0 = full day) */
export function nightAt(h: number) {
  h = ((h % 24) + 24) % 24;
  if (h >= 21 || h < 5) return 1;
  if (h < 7) return 1 - (h - 5) / 2;
  if (h < 18.5) return 0;
  return (h - 18.5) / 2.5;
}

// ------------------------------------------------------------------ painted textures

function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** a photo material tile (src/ui/real/tex: scanned walnut, oak, linen, velvet...) as a repeating texture */
function photo(n: TexName, tint?: string, rep = 2): THREE.Texture | null {
  const c = texCanvas(n, tint);
  if (!c) return null;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rep, rep);
  return t;
}
/** wide oak floorboards from the scanned oak: 1024 px = 2 m, six boards across, staggered butt joints, nails */
function boardsTex(): THREE.Texture {
  return canvasTex(1024, 1024, (g) => {
    const oak = texCanvas('oak');
    const pat = oak ? g.createPattern(oak, 'repeat') : null;
    const bw = 1024 / 6;
    for (let i = 0; i < 6; i++) {
      const x0 = Math.round(i * bw), w = Math.round((i + 1) * bw) - x0, joint = Math.floor(hash(i, 2, 7) * 1024);
      // two lengths of board per column, each cut from a different part of the scan, a touch lighter or darker
      for (const [y0, h, k] of [[0, joint, 0], [joint, 1024 - joint, 1]] as [number, number, number][]) {
        if (h <= 0) continue;
        if (pat) { pat.setTransform(new DOMMatrix().translate(x0 - hash(i, k, 3) * 400, y0 - hash(k, i, 4) * 400)); g.fillStyle = pat; }
        else g.fillStyle = '#a8763e';
        g.fillRect(x0, y0, w, h);
        g.fillStyle = `rgba(${hash(i, k, 9) > 0.5 ? '255,232,196' : '44,22,8'},${0.05 + hash(i, k, 8) * 0.1})`; g.fillRect(x0, y0, w, h);
      }
      // the gaps between boards, a lit edge, the butt joint and its nails
      g.fillStyle = 'rgba(22,11,4,.8)'; g.fillRect(x0, 0, 2, 1024);
      g.fillStyle = 'rgba(255,236,204,.14)'; g.fillRect(x0 + 2, 0, 1, 1024);
      g.fillStyle = 'rgba(22,11,4,.72)'; g.fillRect(x0, joint, w, 2);
      g.fillStyle = '#2a2018';
      for (const nx of [x0 + 14, x0 + w - 16]) for (const ny of [joint + 12, joint - 12]) { g.beginPath(); g.arc(nx, (ny + 1024) % 1024, 2.2, 0, 7); g.fill(); }
    }
  }, true);
}
/** warm limewash plaster with soft trowel marks */
function plasterTex(): THREE.Texture {
  const N = 256, t = new Tex(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tile = (a: number, b: number, p: number) => vnoise(a, b, p);
    const n = tile(x / 22, y / 22, 3) * 0.5 + tile(x / 7, y / 7, 4) * 0.3 + hash(x, y, 2) * 0.2;
    const trowel = Math.sin((x * 0.6 + y * 0.25) * 0.05 + fbm(x * 0.02, y * 0.02, 5) * 6) * 0.03;
    t.set(x, y, ramp([rgb(0xc7ab83), rgb(0xd5bb93), rgb(0xe1cba5), rgb(0xead8b6)], 0.5 + (n - 0.5) * 0.5 + trowel, x, y, 0.2));
  }
  return t.texture({ repeat: true, q: 64 });
}

/** a hand-stitched patchwork quilt: squares of faded indigo, cream, rust and sage with tiny stars, quilting lines */
function quiltTex(): THREE.Texture {
  return canvasTex(512, 512, (g) => {
    const cols = ['#2f4a78', '#e9dcc0', '#a8553a', '#6f8a6a', '#3d5f8f', '#d9b98a', '#8a3f36', '#c8cfb6'];
    const n = 8, s = 512 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = cols[(x * 3 + y * 5 + ((x * y) % 3)) % cols.length];
      g.fillStyle = c; g.fillRect(x * s, y * s, s, s);
      // print: dots, stars or a check, in a lighter or darker shade of the patch
      g.save(); g.beginPath(); g.rect(x * s, y * s, s, s); g.clip();
      const kind = (x + y * 2) % 4;
      g.fillStyle = (x + y) % 2 ? 'rgba(255,248,230,.22)' : 'rgba(20,16,30,.16)';
      if (kind === 0) for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(x * s + ((i % 4) + 0.5) * s / 4, y * s + (Math.floor(i / 4) + 0.5) * s / 4, 2, 0, 7); g.fill(); }
      if (kind === 1) for (let i = 0; i < 5; i++) star(g, x * s + 10 + ((i * 23) % (s - 20)), y * s + 11 + ((i * 35) % (s - 22)), 5);
      if (kind === 2) for (let i = 0; i < 8; i++) g.fillRect(x * s + i * s / 8, y * s, s / 16, s);
      if (kind === 3) { g.beginPath(); g.arc(x * s + s / 2, y * s + s / 2, s * 0.28, 0, 7); g.lineWidth = 3; g.strokeStyle = g.fillStyle as string; g.stroke(); }
      g.restore();
      // seams: a dark crease and a running stitch
      g.fillStyle = 'rgba(30,20,20,.35)'; g.fillRect(x * s, y * s, s, 2); g.fillRect(x * s, y * s, 2, s);
      g.setLineDash([4, 3]); g.strokeStyle = 'rgba(250,240,215,.55)'; g.lineWidth = 1;
      g.strokeRect(x * s + 5, y * s + 5, s - 10, s - 10); g.setLineDash([]);
    }
    // the cotton's weave over it all
    const lin = texCanvas('linen', '#808080');
    if (lin) { g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5; g.drawImage(lin, 0, 0, 512, 512); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  });
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
/** soft linen with a fine weave */
function linenTex(base: string): THREE.Texture {
  return photo('linen', base, 3) ?? canvasTex(64, 64, (g) => { g.fillStyle = base; g.fillRect(0, 0, 64, 64); }, true);
}
/** deep velvet: vertical pile with a sheen */
function velvetTex(): THREE.Texture {
  const v = photo('velvet', '#28306a', 2);
  if (v) return v;
  return canvasTex(256, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, '#1d2350'); gr.addColorStop(0.5, '#2b3470'); gr.addColorStop(1, '#1d2350');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 3 + Math.random() * 6); }
  }, true);
}
/** the moon lamp's face: maria and craters */
function moonTex(): THREE.Texture {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 9; i++) { const x = (i * 131) % 512, y = 40 + ((i * 67) % 170), r = 26 + (i % 4) * 14; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(160,140,110,.45)'); gr.addColorStop(1, 'rgba(160,140,110,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 60; i++) { const x = Math.random() * 512, y = Math.random() * 256, r = 2 + Math.random() * 7; g.strokeStyle = 'rgba(120,100,80,.28)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
  });
}
/** the alarm clock's dial: cream enamel, a minute track, Arabic numerals, a little luminous moon */
function dialTex(): THREE.Texture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#f3ead6'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    g.strokeStyle = '#2a2420';
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, r0 = i % 5 ? 112 : 104; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); g.lineTo(128 + Math.sin(a) * 120, 128 - Math.cos(a) * 120); g.stroke(); }
    g.fillStyle = '#2a2420'; g.font = `700 30px ${TITLE_STACK}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(String(i), 128 + Math.sin(a) * 84, 130 - Math.cos(a) * 84); }
    g.fillStyle = '#c9a23c'; g.beginPath(); g.arc(128, 172, 13, 0, 7); g.fill(); g.fillStyle = '#f3ead6'; g.beginPath(); g.arc(134, 168, 11, 0, 7); g.fill();
  });
}
/** the phone's lock screen (lit) */
function phoneTex(): THREE.Texture {
  return canvasTex(180, 360, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#3a4fa0'); gr.addColorStop(1, '#1b1f4a');
    g.fillStyle = gr; g.fillRect(0, 0, 180, 360);
    g.fillStyle = '#fff'; g.font = `600 44px ${STACK}`; g.textAlign = 'center'; g.fillText('11:02', 90, 78);
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.86)'; roundRect(g, 14, 120 + i * 62, 152, 50, 12); g.fill(); g.fillStyle = ['#e5534b', '#4a8af4', '#f2b134'][i]; roundRect(g, 24, 132 + i * 62, 26, 26, 7); g.fill(); g.fillStyle = 'rgba(30,30,50,.5)'; g.fillRect(58, 136 + i * 62, 90, 7); g.fillRect(58, 150 + i * 62, 64, 6); }
  });
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** a record label */
function labelTex(): THREE.Texture {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#121014'; g.fillRect(0, 0, 128, 128);
    for (let r = 20; r < 64; r += 1.5) { g.strokeStyle = `rgba(255,255,255,${0.03 + (r % 3) * 0.015})`; g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); }
    g.fillStyle = '#b8463a'; g.beginPath(); g.arc(64, 64, 20, 0, 7); g.fill();
    g.fillStyle = '#f0d9a8'; g.beginPath(); g.arc(64, 64, 2.5, 0, 7); g.fill();
    g.fillStyle = '#f0d9a8'; g.font = `700 7px ${STACK}`; g.textAlign = 'center'; g.fillText('LULLABY', 64, 56);
  });
}

// painted once per session and kept: reopening the bedroom is instant
type BedMats = Pick<OfficeMats, 'walnut' | 'oak' | 'brass' | 'chrome' | 'blackLacquer' | 'mahoganyDark' | 'felt' | 'chairPlain' | 'soil' | 'rug' | 'glass' | 'gilt' | 'deskLeather' | 'ceramic'>;
let MATS: BedMats | null = null;
/** an oriental rug: a madder field, an indigo medallion, a rosette border, drawn in a few dozen strokes */
function rugTex(): THREE.Texture {
  return canvasTex(768, 512, (g) => {
    const W = 768, H = 512;
    g.fillStyle = '#6e1c18'; g.fillRect(0, 0, W, H);
    const band = (i: number, c: string) => { g.fillStyle = c; g.fillRect(i, i, W - 2 * i, H - 2 * i); };
    band(0, '#c8b894'); band(6, '#2a120c'); band(10, '#842a22'); band(20, '#c8b894'); band(24, '#1d2350'); band(70, '#2a120c'); band(74, '#a47e3a'); band(80, '#6e1c18');
    // rosettes round the border
    for (let x = 48; x < W - 30; x += 46) for (const y of [47, H - 47]) { g.fillStyle = '#c8b894'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.fillStyle = '#842a22'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
    for (let y = 94; y < H - 60; y += 46) for (const x of [47, W - 47]) { g.fillStyle = '#c8b894'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.fillStyle = '#842a22'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
    // a lattice of small flowers over the field
    g.fillStyle = 'rgba(200,184,148,.55)';
    for (let y = 100; y < H - 90; y += 28) for (let x = 100 + ((y / 28) % 2) * 14; x < W - 90; x += 28) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    // the medallion
    g.save(); g.translate(W / 2, H / 2);
    for (const [r, c] of [[150, '#2a120c'], [144, '#1d2350'], [110, '#a47e3a'], [104, '#6e1c18'], [60, '#c8b894'], [52, '#1d2350'], [18, '#a47e3a']] as [number, string][]) {
      g.fillStyle = c; g.beginPath(); g.moveTo(-r * 1.4, 0); g.lineTo(0, -r * 0.8); g.lineTo(r * 1.4, 0); g.lineTo(0, r * 0.8); g.closePath(); g.fill();
    }
    g.restore();
    // the weave: wool knots and a soft wear in the middle
    const lin = texCanvas('felt', '#808080');
    if (lin) { g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6; for (let x = 0; x < W; x += 256) for (let y = 0; y < H; y += 256) g.drawImage(lin, x, y, 256, 256); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    const wear = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.5); wear.addColorStop(0, 'rgba(255,240,220,.1)'); wear.addColorStop(1, 'rgba(0,0,0,.12)');
    g.fillStyle = wear; g.fillRect(0, 0, W, H);
  });
}
function bedMats(): BedMats {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
  const wood = (n: TexName, tint: string | undefined, rough: number, fallback: number) => { const t = photo(n, tint, 2); return std({ map: t ?? undefined, color: t ? 0xffffff : fallback, roughness: rough }); };
  return {
    walnut: wood('walnut', undefined, 0.48, 0x5a3a22),
    oak: wood('oak', undefined, 0.55, 0xa8763e),
    mahoganyDark: wood('walnut', '#7a3a2a', 0.5, 0x4a1e14),
    felt: std({ map: photo('felt', '#2c5a40', 2) ?? undefined, roughness: 1 }),
    chairPlain: std({ map: photo('leather', '#8a2e22', 2) ?? undefined, roughness: 0.5 }),
    deskLeather: std({ map: photo('leather', '#2e5a3a', 2) ?? undefined, roughness: 0.5 }),
    brass: std({ color: 0xd9ae58, metalness: 0.9, roughness: 0.3, map: photo('brushed', '#d9b060', 2) ?? undefined }),
    gilt: std({ color: 0xd9ab4a, metalness: 0.9, roughness: 0.35 }),
    chrome: std({ color: 0xd8dde2, metalness: 1, roughness: 0.2 }),
    blackLacquer: std({ color: 0x14110f, roughness: 0.18, metalness: 0.1 }),
    ceramic: std({ color: 0x3e6e8a, roughness: 0.25 }),
    soil: std({ color: 0x2e1f12, roughness: 1 }),
    rug: std({ map: rugTex(), roughness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe8f2ee, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, specularIntensity: 1, envMapIntensity: 1.4, depthWrite: false }),
  } as unknown as BedMats;
}
const TEX: Record<string, THREE.Texture> = {};
const once = (k: string, f: () => THREE.Texture) => (TEX[k] ??= f());

// ------------------------------------------------------------------ the stage

interface Hop { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; face: number; done: () => void; hops: number }

export class BedroomStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
  look: Look = { exposure: 1.06, contrast: 1.04, saturation: 1.08, warm: 0.22, vignette: 0.34, grain: 0.012, bloom: 0.75, bloomThreshold: 0.95, focus: 0, focusRange: 1.6, blur: 0.22, outline: 0.8 };
  /** resolves when the room is furnished */
  readonly ready: Promise<void>;
  /** a hotspot was tapped */
  onPick: (id: Hot) => void = () => {};
  /** the pointer is over a hotspot (or not) */
  onHover: (id: Hot | null) => void = () => {};

  private m: BedMats;
  private fx = new Fx(900);
  private pmrem: THREE.PMREMGenerator | null = null;
  private disposers: (() => void)[] = [];
  private time = 0;
  private hour = new Date().getHours() + new Date().getMinutes() / 60;
  private night = 1;
  // light
  private moon: THREE.SpotLight;
  private hemi: THREE.HemisphereLight;
  private lampLight: THREE.PointLight;
  private fairyLight: THREE.PointLight;
  private fill: THREE.PointLight;
  private recordLight: THREE.PointLight;
  private dim = 0;
  private dimWant = 0;
  // the window
  private winRT: THREE.WebGLRenderTarget | null = null;
  private winCam = new THREE.PerspectiveCamera(48, 0.95, 0.3, 900);
  private winT = 0;
  private viewMat!: THREE.MeshBasicMaterial;
  // things that move
  private record: THREE.Object3D | null = null;
  private tonearm: THREE.Object3D | null = null;
  private spin = 0;
  private spinWant = 0;
  private airLamp: THREE.MeshStandardMaterial | null = null;
  private micOn = true;
  private hands: { h: THREE.Object3D; m: THREE.Object3D } | null = null;
  private stars: { o: THREE.Object3D; ph: number }[] = [];
  private bulbs: THREE.InstancedMesh | null = null;
  private bulbMat: THREE.MeshBasicMaterial | null = null;
  private moonLamp: THREE.Mesh | null = null;
  private globeBall: THREE.Object3D | null = null;
  private globeSpin = 0.12;
  // the phone, its bed and the padlock
  private phone = new THREE.Group();
  private phoneScreen: THREE.MeshBasicMaterial | null = null;
  private box = new THREE.Group();
  private lid = new THREE.Group();
  private lock = new THREE.Group();
  private shackle = new THREE.Group();
  private key = new THREE.Group();
  // Pip
  private actors: OwlActor[] = [];
  private pip: OwlActor;
  private packed: OwlActor | null = null;
  private hop: Hop | null = null;
  private face = 0;
  private faceWant = 0;
  // hotspots: invisible hit boxes, and where their labels sit
  private hits: { id: Hot; mesh: THREE.Object3D; label: THREE.Vector3 }[] = [];
  private hover: Hot | null = null;
  private down: { x: number; y: number } | null = null;
  // camera
  private cam = { target: V(0, 1, -0.6), yaw: 0, pitch: 0.12, dist: 6 };
  private want = { target: V(0, 1, -0.6), yaw: 0, pitch: 0.12, dist: 6 };
  private shotName: BedShot = 'room';
  private moveK = 1.8;
  /** screen area left free by the 2D controls, as a fraction of the screen: the subject is framed in it */
  free = { x0: 0, x1: 1, y0: 0, y1: 1 };
  private quality: 'low' | 'high';

  constructor(renderer: THREE.WebGLRenderer, look: OwlLook, private world: WorldView | null, quality: 'low' | 'high' = 'high') {
    this.quality = quality;
    const s = this.scene;
    s.background = new THREE.Color(0x0d0a12);
    this.m = MATS ??= bedMats();
    try {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      const env = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      s.environment = env;
      (s as unknown as { environmentIntensity: number }).environmentIntensity = 0.22;
      this.disposers.push(() => env.dispose());
    } catch { /* plain lights */ }
    s.add(this.fx.group);

    // ---- light: moonlight through the window, the moon lamp, the fairy lights, a low warm fill
    this.hemi = new THREE.HemisphereLight(0x8a9cc8, 0x2a1a12, 0.3);
    s.add(this.hemi);
    this.moon = new THREE.SpotLight(0xa9bdf0, 26, 0, Math.PI / 6.5, 0.5, 0);
    this.moon.position.set(WIN.x - 1.4, 3.9, Z0 - 3.6);
    this.moon.target.position.set(WIN.x + 0.5, 0, 0.4);
    this.moon.castShadow = true;
    const sz = quality === 'high' ? 2048 : 1024;
    this.moon.shadow.mapSize.set(sz, sz);
    this.moon.shadow.camera.near = 1.5; this.moon.shadow.camera.far = 12;
    this.moon.shadow.bias = -0.0005; this.moon.shadow.normalBias = 0.02; this.moon.shadow.radius = 3;
    s.add(this.moon, this.moon.target);
    this.lampLight = new THREE.PointLight(0xffc98a, 2.6, 5.5, 1.6);
    this.lampLight.position.set(LAMP.x, NS.h + 0.28, LAMP.z);
    this.lampLight.castShadow = quality === 'high';
    this.lampLight.shadow.mapSize.set(512, 512); this.lampLight.shadow.bias = -0.002; this.lampLight.shadow.camera.near = 0.08;
    s.add(this.lampLight);
    this.fairyLight = new THREE.PointLight(0xffb870, 1.2, 3.4, 1.8);
    this.fairyLight.position.set(WIN.x, WIN_TOP + 0.1, Z0 + 0.25);
    s.add(this.fairyLight);
    this.fill = new THREE.PointLight(0xffd6a8, 1.1, 10, 1.3);
    this.fill.position.set(0.4, 2.3, 2.2);
    s.add(this.fill);
    this.recordLight = new THREE.PointLight(0xffb870, 0, 1.4, 2);
    this.recordLight.position.set(WIN.x - WIN.w / 2 + 0.3, WIN.y0 + 0.4, Z0 + 0.15);
    s.add(this.recordLight);

    // ---- Pip (and his packed self, ready for the trip)
    this.pip = this.makeActor(look);
    this.pip.node.position.copy(PIP_HOME);
    s.add(this.pip.node);
    this.pip.setMood('sleepy');

    this.ready = this.build();
    this.go('room', true);
  }

  // ---------------------------------------------------------------- building

  private async build() {
    const idle = () => new Promise<void>((r) => setTimeout(r, 0));
    // each piece on its own: one that fails never keeps the rest of the room (or its controls) away
    const steps: [string, () => void][] = [['shell', () => this.buildShell()], ['window', () => this.buildWindow()], ['bed', () => this.buildBed()], ['nightstand', () => this.buildNightstand()],
      ['cabinet', () => this.buildCabinet()], ['globe', () => this.buildGlobe()], ['decor', () => this.buildDecor()], ['phone', () => this.buildPhoneBed()], ['hotspots', () => this.hotspots()]];
    // one yield so the veil is up, then the whole room in one go (the painting is light now: photo tiles)
    await idle();
    for (const [name, f] of steps) {
      try { f(); } catch (e) { console.error('bedroom: ' + name + ' failed', e); }
    }
    // the room's own studio light for metal and glass, refreshed for the shadows
    this.scene.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh && me.userData.noShadow !== true) { me.castShadow = me.castShadow ?? true; me.receiveShadow = true; } });
  }

  private add(o: THREE.Object3D) { this.scene.add(o); return o; }

  private buildShell() {
    const m = this.m, b = new Batch();
    const floorMat = new THREE.MeshStandardMaterial({ map: once('boards', boardsTex), roughness: 0.62 });
    const plaster = new THREE.MeshStandardMaterial({ map: houseTex('planks'), color: 0xd8c2a6, roughness: 0.85 });
    this.disposers.push(() => { floorMat.dispose(); plaster.dispose(); });
    // floor (world-scaled UVs: 2 m a tile)
    const fl = new THREE.PlaneGeometry(X1 - X0, 5.6).rotateX(-Math.PI / 2);
    fl.translate((X0 + X1) / 2, 0, Z0 + 2.8);
    { const uv = fl.attributes.uv as THREE.BufferAttribute, p = fl.attributes.position as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getZ(i) / 2); }
    const floor = new THREE.Mesh(fl, floorMat); floor.receiveShadow = true; this.add(floor);
    // the back wall: plaster with the arched window opening cut through, extruded so the reveal is real
    const shape = new THREE.Shape();
    shape.moveTo(X0, 0); shape.lineTo(X1, 0); shape.lineTo(X1, H); shape.lineTo(X0, H); shape.lineTo(X0, 0);
    const hole = new THREE.Path();
    const hx0 = WIN.x - WIN.w / 2, hx1 = WIN.x + WIN.w / 2;
    hole.moveTo(hx0, WIN.y0); hole.lineTo(hx1, WIN.y0); hole.lineTo(hx1, WIN.spring);
    hole.absarc(WIN.x, WIN.spring, WIN.w / 2, 0, Math.PI, false);
    hole.lineTo(hx0, WIN.y0);
    shape.holes.push(hole);
    const wall = new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false, curveSegments: 40 });
    wall.translate(0, 0, Z0 - WALL_T);
    { const uv = wall.attributes.uv as THREE.BufferAttribute, p = wall.attributes.position as THREE.BufferAttribute, n = wall.attributes.normal as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) { const nz = Math.abs(n.getZ(i)); uv.setXY(i, (nz > 0.5 ? p.getX(i) : p.getX(i) + p.getZ(i)) / 1.4, (Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i)) / 1.4); } }
    const wallM = new THREE.Mesh(wall, plaster); wallM.receiveShadow = true; wallM.castShadow = true; this.add(wallM);
    // side walls (only their inner faces show)
    for (const sx of [X0, X1]) {
      const g = new THREE.PlaneGeometry(5.6, H);
      g.rotateY(sx < 0 ? Math.PI / 2 : -Math.PI / 2);
      g.translate(sx, H / 2, Z0 + 2.8);
      const uv = g.attributes.uv as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) / 1.4, p.getY(i) / 1.4);
      const w = new THREE.Mesh(g, plaster); w.receiveShadow = true; this.add(w);
    }
    // ceiling and beams
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 5.6).rotateX(Math.PI / 2).translate(0, H, Z0 + 2.8), m.walnut);
    this.add(ceil);
    for (let i = 0; i < 4; i++) b.add(m.walnut, at(bbox(X1 - X0, 0.2, 0.18, { r: 0.012 }), 0, H - 0.2, Z0 + 0.35 + i * 1.25));
    // wainscot: tongue-and-groove oak boards to dado height with a cap rail, and a skirting board
    const dado = 0.82;
    for (let x = X0; x < X1 - 0.01; x += 0.14) {
      const inWin = x + 0.14 > hx0 - 0.02 && x < hx1 + 0.02 && dado > WIN.y0;
      const top = inWin ? WIN.y0 - 0.1 : dado;
      b.add(m.oak, at(bbox(0.132, top, 0.022, { r: 0.004, along: 'y' }), x + 0.07, 0, Z0 + 0.011));
    }
    b.add(m.walnut, at(bbox(hx0 - 0.08 - X0, 0.05, 0.06, { r: 0.008 }), (X0 + hx0 - 0.08) / 2, dado, Z0 + 0.03));
    b.add(m.walnut, at(bbox(X1 - hx1 - 0.08, 0.05, 0.06, { r: 0.008 }), (X1 + hx1 + 0.08) / 2, dado, Z0 + 0.03));
    b.add(m.walnut, at(bbox(X1 - X0, 0.12, 0.035, { r: 0.006 }), 0, 0, Z0 + 0.03));
    for (const sx of [X0, X1]) b.add(m.walnut, at(bbox(0.035, 0.12, 5.6, { r: 0.006 }), sx + (sx < 0 ? 0.017 : -0.017), 0, Z0 + 2.8));
    this.add(b.build('shell'));
    // the oak itself: bark-clad posts where the walls meet, a great limb across under the ceiling, moss in the joints
    const bark = new THREE.MeshStandardMaterial({ map: houseTex('bark'), roughness: 0.95 });
    const moss = new THREE.MeshStandardMaterial({ map: houseTex('moss'), roughness: 1 });
    for (const sx of [X0 + 0.16, X1 - 0.16]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, H, 14, 6), bark);
      const pp = post.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), a2 = Math.atan2(pp.getZ(i), pp.getX(i)); const k = 1 + Math.sin(a2 * 5 + y * 3) * 0.06 + Math.sin(y * 7) * 0.03; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
      post.geometry.computeVertexNormals();
      post.position.set(sx, H / 2, Z0 + 0.16);
      this.add(post);
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), moss);
      tuft.scale.set(1.3, 0.45, 1.2); tuft.position.set(sx, 0, Z0 + 0.3); this.add(tuft);
    }
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, X1 - X0, 14, 8).rotateZ(Math.PI / 2), bark);
    { const lp = limb.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < lp.count; i++) { const x = lp.getX(i); lp.setY(i, lp.getY(i) + Math.sin(x * 1.3) * 0.06); } limb.geometry.computeVertexNormals(); }
    limb.position.set(0, H - 0.32, Z0 + 1.2); this.add(limb);
    this.disposers.push(() => { bark.dispose(); moss.dispose(); });
    // bunting strung along the limb, as in Pip's living room
    const flagCols = [0xb8463a, 0xe0b84c, 0x6f9a5a, 0x4a6aa8, 0xd8a0a8, 0xe8dcc0];
    const flagMats = flagCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
    const flagG = new THREE.BufferGeometry().setFromPoints([V(-0.11, 0, 0), V(0.11, 0, 0), V(0, -0.24, 0)]); flagG.computeVertexNormals();
    for (const z of [Z0 + 1.05, Z0 + 2.4]) for (let i = 0; i < 22; i++) {
      const x = X0 + 0.4 + i * ((X1 - X0 - 0.8) / 21), sag = Math.sin((i / 21) * Math.PI) * 0.28;
      const f = new THREE.Mesh(flagG, flagMats[(i + (z > 0 ? 2 : 0)) % flagMats.length]);
      f.position.set(x, H - 0.5 - sag, z); f.rotation.y = 0.1 * Math.sin(i); this.add(f);
      this.swing.push({ o: f, ph: i * 0.7, k: 0.12 });
    }
    // a hanging lantern over the rug
    const lant = new THREE.Group();
    const cage = new THREE.MeshStandardMaterial({ color: 0x2c2420, metalness: 0.7, roughness: 0.4 });
    lant.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 4).translate(0, 0.45, 0), cage));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 8).translate(0, 0, 0), cage); lant.add(top);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8).translate(0, -0.15, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.7) }));
    glass.userData.noShadow = true; glass.castShadow = false; lant.add(glass);
    for (let i = 0; i < 4; i++) { const a2 = (i / 4) * Math.PI * 2; const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.012).translate(Math.cos(a2) * 0.095, -0.15, Math.sin(a2) * 0.095), cage); lant.add(bar); }
    lant.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.04, 8).translate(0, -0.27, 0), cage));
    lant.position.set(-0.4, H - 0.95, -0.3);
    this.add(lant);
    this.swing.push({ o: lant, ph: 3.3, k: 0.04 });
    const ll = new THREE.PointLight(0xffb868, 1.6, 4.5, 1.6); ll.position.set(-0.4, H - 1.12, -0.3); this.add(ll);
    this.lanternLight = ll;
  }
  private lanternLight: THREE.PointLight | null = null;
  /** bunting and the lantern stir in the warm air */
  private swing: { o: THREE.Object3D; ph: number; k: number }[] = [];

  private buildWindow() {
    const m = this.m, b = new Batch();
    const hx0 = WIN.x - WIN.w / 2, hx1 = WIN.x + WIN.w / 2, r = WIN.w / 2;
    // the view: the real forest rendered from just outside the oak, on a plane behind the glass
    if (this.world) {
      const hi = this.quality === 'high';
      this.winRT = this.world.viewTarget(hi ? 360 : 220, hi ? 400 : 244);
      const d = new THREE.Vector3(0.42, 0, 1).normalize();
      this.winCam.position.set(HOUSE.x + d.x * (HOUSE.r + 0.8), 7.4, HOUSE.z + d.z * (HOUSE.r + 0.8));
      this.winCam.lookAt(this.winCam.position.clone().addScaledVector(d, 10).add(V(0, 0.6, 0)));
      this.winCam.updateMatrixWorld();
      this.viewMat = new THREE.MeshBasicMaterial({ map: this.winRT.texture, toneMapped: false });
      this.disposers.push(() => this.winRT?.dispose());
    } else {
      this.viewMat = new THREE.MeshBasicMaterial({ map: canvasTex(256, 280, (g) => { const gr = g.createLinearGradient(0, 0, 0, 280); gr.addColorStop(0, '#0e1638'); gr.addColorStop(1, '#2a3a6a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 280); }), toneMapped: false });
    }
    const vh = WIN_TOP - WIN.y0 + 0.5;
    const view = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w + 0.7, vh), this.viewMat);
    view.position.set(WIN.x, WIN.y0 + vh / 2 - 0.25, Z0 - WALL_T - 0.4);
    view.userData.noShadow = true;
    view.castShadow = false;
    this.add(view);
    // sash: an arched frame with glazing bars (a fan in the arch), set back in the reveal
    const fz = Z0 - WALL_T + 0.08;
    const fr = (g: THREE.BufferGeometry) => b.add(m.walnut, g);
    fr(at(bbox(WIN.w, 0.06, 0.06, { r: 0.008 }), WIN.x, WIN.y0, fz));
    fr(at(bbox(0.06, WIN.spring - WIN.y0, 0.06, { r: 0.008 }), hx0 + 0.03, WIN.y0, fz));
    fr(at(bbox(0.06, WIN.spring - WIN.y0, 0.06, { r: 0.008 }), hx1 - 0.03, WIN.y0, fz));
    const ring = new THREE.Shape(); ring.absarc(0, 0, r, 0, Math.PI, false); ring.absarc(0, 0, r - 0.06, Math.PI, 0, true);
    fr(at(new THREE.ExtrudeGeometry(ring, { depth: 0.06, bevelEnabled: false, curveSegments: 40 }), WIN.x, WIN.spring, fz - 0.03));
    // glazing bars: a centre mullion, a transom at the springing, three in the fan, two lights below
    fr(at(bbox(0.035, WIN_TOP - WIN.y0 - 0.04, 0.035, { r: 0.004 }), WIN.x, WIN.y0, fz));
    fr(at(bbox(WIN.w, 0.035, 0.035, { r: 0.004 }), WIN.x, WIN.spring - 0.017, fz));
    fr(at(bbox(WIN.w, 0.03, 0.03, { r: 0.004 }), WIN.x, WIN.y0 + (WIN.spring - WIN.y0) * 0.5, fz));
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) fr(at(bbox(0.03, r - 0.04, 0.03, { r: 0.004 }), WIN.x, WIN.spring, fz, 0, 0, a - Math.PI / 2));
    // a deep sill with a cushion along it (a window seat for an owl)
    b.add(m.oak, at(bbox(WIN.w + 0.24, 0.06, WALL_T + 0.22, { r: 0.012 }), WIN.x, WIN.y0 - 0.06, Z0 - WALL_T / 2 + 0.11));
    b.add(m.walnut, at(bbox(WIN.w + 0.12, 0.09, 0.03, { r: 0.008 }), WIN.x, WIN.y0 - 0.15, Z0 + 0.2));
    // an architrave round the opening, on the room face
    const arch = new THREE.Shape(); arch.absarc(0, 0, r + 0.11, 0, Math.PI, false); arch.absarc(0, 0, r, Math.PI, 0, true);
    b.add(m.walnut, at(new THREE.ExtrudeGeometry(arch, { depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 40 }), WIN.x, WIN.spring, Z0 + 0.0));
    b.add(m.walnut, at(bbox(0.11, WIN.spring - WIN.y0 + 0.02, 0.045, { r: 0.008 }), hx0 - 0.055, WIN.y0 - 0.02, Z0 + 0.02));
    b.add(m.walnut, at(bbox(0.11, WIN.spring - WIN.y0 + 0.02, 0.045, { r: 0.008 }), hx1 + 0.055, WIN.y0 - 0.02, Z0 + 0.02));
    // keystone
    b.add(m.oak, at(bbox(0.16, 0.2, 0.06, { r: 0.01 }), WIN.x, WIN_TOP + 0.02, Z0 + 0.02));
    this.add(b.build('window'));
    const glass = new THREE.Mesh(new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(hx0, WIN.y0); sh.lineTo(hx1, WIN.y0); sh.lineTo(hx1, WIN.spring); sh.absarc(WIN.x, WIN.spring, r, 0, Math.PI, false); sh.lineTo(hx0, WIN.y0); return sh; })(), 40), m.glass);
    glass.position.z = fz + 0.035;
    glass.renderOrder = 3;
    glass.userData.noShadow = true; glass.castShadow = false;
    this.add(glass);
    // a seat cushion on the sill
    const cushMat = new THREE.MeshStandardMaterial({ map: linenTex('#6d7fb0'), roughness: 0.95 });
    const cush = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, WIN.w - 0.95, 6, 16).rotateZ(Math.PI / 2), cushMat);
    cush.scale.set(1, 0.7, 1.6); cush.position.set(WIN.x + 0.12, WIN.y0 + 0.035, Z0 - 0.04);
    this.add(cush);
    // velvet curtains on a brass pole, tied back
    const velvet = new THREE.MeshPhysicalMaterial({ map: velvetTex(), roughness: 0.7, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.5, 0.55, 0.9) });
    const pole = new THREE.Mesh(cyl(0.022, WIN.w + 1.3, 16).rotateZ(Math.PI / 2).translate((WIN.w + 1.3) / 2, 0, 0), m.brass);
    pole.position.set(WIN.x, WIN_TOP + 0.26, Z0 + 0.14); this.add(pole);
    for (const sx of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), m.brass); knob.position.set(WIN.x + sx * (WIN.w / 2 + 0.66), WIN_TOP + 0.26, Z0 + 0.14); this.add(knob);
      const cw = 0.62, ch = WIN_TOP + 0.24, g = new THREE.PlaneGeometry(cw, ch, 28, 30);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const u = (p.getX(i) + cw / 2) / cw, v = (p.getY(i) + ch / 2) / ch; // v 0 bottom .. 1 top
        // gathered towards the tie-back at 45% height, folds deepening down the drop
        const tie = Math.exp(-((v - 0.42) ** 2) / 0.02);
        const inner = sx < 0 ? u : 1 - u;
        const pull = tie * inner * 0.42 + (v < 0.42 ? inner * 0.22 * (1 - v / 0.42) : 0);
        const x = (p.getX(i) + (sx < 0 ? -1 : 1) * pull * cw * 0.9) * (1 - tie * 0.35);
        const fold = Math.sin(u * Math.PI * 7 + v * 0.6) * (0.03 + 0.02 * (1 - v)) * (1 - tie * 0.5);
        p.setXYZ(i, x, p.getY(i), fold);
      }
      g.computeVertexNormals();
      const c = new THREE.Mesh(g, velvet);
      c.position.set(WIN.x + sx * (WIN.w / 2 + 0.28), ch / 2 + 0.02, Z0 + 0.12);
      c.castShadow = true;
      this.add(c);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 20), m.brass);
      tie.position.set(WIN.x + sx * (WIN.w / 2 + 0.36), ch * 0.42, Z0 + 0.15); tie.scale.set(1.3, 0.8, 1);
      this.add(tie);
    }
    this.disposers.push(() => { velvet.map?.dispose(); velvet.dispose(); cushMat.map?.dispose(); cushMat.dispose(); });
    // fairy lights: a warm string draped round the arch
    const n = 34, pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), a = Math.PI * (1 - k);
      const rr = r + 0.18;
      const sag = Math.sin(k * Math.PI * 6) * 0.03;
      pts.push(V(WIN.x + Math.cos(a) * rr * 1.08, WIN.spring + Math.sin(a) * rr - Math.abs(sag), Z0 + 0.07));
    }
    // and down the sides of the reveal
    const side = (sx: number) => { for (let i = 1; i < 8; i++) pts.push(V(WIN.x + sx * (r + 0.19) * 1.08, WIN.spring - i * 0.12, Z0 + 0.07 + Math.sin(i) * 0.01)); };
    side(-1); side(1);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, n)), 120, 0.003, 4), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.6 }));
    this.add(wire);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.38).multiplyScalar(3.2), toneMapped: true });
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.013, 10, 8).scale(1, 1.3, 1), this.bulbMat, pts.length);
    const dm = new THREE.Object3D();
    pts.forEach((p, i) => { dm.position.copy(p).add(V(0, -0.012, 0.004)); dm.updateMatrix(); this.bulbs!.setMatrixAt(i, dm.matrix); this.bulbs!.setColorAt(i, new THREE.Color(1, 1, 1)); });
    this.bulbs.userData.noShadow = true; this.bulbs.castShadow = false;
    this.add(this.bulbs);
    // the microphone on the sill: a vintage capsule with a grille on a little stand, and an on-air lamp
    const mic = new THREE.Group();
    const grille = new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#3a3a3e'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d8d8dc'; for (let y = 0; y < 64; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 64; x += 4) g.fillRect(x, y, 2, 2); }, true), metalness: 0.8, roughness: 0.35 });
    grille.map!.repeat.set(3, 2);
    const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.07, 8, 20), grille); cap.position.y = 0.2; mic.add(cap);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.022, 24), m.chrome); band.position.y = 0.2; mic.add(band);
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.007, 8, 24, Math.PI), m.chrome); yoke.rotation.z = Math.PI; yoke.position.y = 0.2; mic.add(yoke);
    const stem = new THREE.Mesh(cyl(0.008, 0.15, 10), m.chrome); stem.position.y = 0.03; mic.add(stem);
    const base = new THREE.Mesh(lathe([[0, 0], [0.07, 0], [0.072, 0.012], [0.05, 0.03], [0.012, 0.04], [0, 0.04]], 28), m.blackLacquer); mic.add(base);
    this.airLamp = new THREE.MeshStandardMaterial({ color: 0x3a0a08, emissive: new THREE.Color(1, 0.16, 0.1), emissiveIntensity: 2.4, roughness: 0.3 });
    const air = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), this.airLamp); air.position.set(0.045, 0.03, 0.03); mic.add(air);
    mic.position.set(WIN.x + WIN.w / 2 - 0.2, WIN.y0, Z0 - 0.02);
    mic.rotation.y = -0.4;
    mic.name = 'mic';
    this.add(mic);
    this.disposers.push(() => { grille.map?.dispose(); grille.dispose(); });
  }

  /** Pip's own bed from his house (the twig nest bed unless another bed is placed), with a quilt-soft glow */
  private buildBed() {
    const g = new THREE.Group();
    g.position.set(BED.x, 0, BED.z0 + BED.len / 2);
    g.rotation.y = -0.35;
    this.add(g);
    this.bedGroup = g;
    void this.loadBed(this.bedModel);
  }
  private bedGroup: THREE.Group | null = null;
  private bedModel = 'items/nestbed.glb';
  /** show a different bed (the one placed in Pip's house) */
  setBed(model: string) { if (model && model !== this.bedModel) { this.bedModel = model; void this.loadBed(model); } }
  private async loadBed(model: string) {
    const g = this.bedGroup;
    if (!g) return;
    try {
      const { root } = await instanceGLB(model);
      if (this.bedModel !== model) return;
      vivid(root);
      const bb = new THREE.Box3().setFromObject(root), size = bb.getSize(V(0, 0, 0)), c = bb.getCenter(V(0, 0, 0));
      const k = BED.w / Math.max(size.x, size.z);
      root.scale.setScalar(k);
      root.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
      root.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = true; } });
      g.clear();
      g.add(root);
    } catch (e) { console.warn('bed model failed', model, e); }
  }

  private buildNightstand() {
    const m = this.m, b = new Batch(), { x, z, w, h, d } = NS;
    b.add(m.walnut, at(bbox(w, 0.035, d, { r: 0.01 }), x, h - 0.035, z));
    b.add(m.walnut, at(bbox(w - 0.04, h - 0.12, d - 0.04, { r: 0.006 }), x, 0.08, z));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(m.walnut, at(bbox(0.045, 0.1, 0.045, { r: 0.008, along: 'y' }), x + sx * (w / 2 - 0.04), 0, z + sz * (d / 2 - 0.04)));
    // a drawer with a brass knob, a shelf with two books
    b.add(m.oak, at(bbox(w - 0.08, 0.13, 0.02, { r: 0.006 }), x, h - 0.19, z + d / 2 - 0.01));
    b.add(m.brass, at(new THREE.SphereGeometry(0.018, 14, 10), x, h - 0.125, z + d / 2 + 0.012));
    b.add(m.mahoganyDark, at(bbox(0.05, 0.16, 0.26, { r: 0.004 }), x - 0.12, 0.1, z));
    b.add(m.chairPlain, at(bbox(0.04, 0.18, 0.24, { r: 0.004 }), x - 0.07, 0.1, z));
    this.add(b.build('nightstand'));
    // the moon lamp: a glowing moon on a little walnut stand
    const moonMat = new THREE.MeshStandardMaterial({ map: moonTex(), emissiveMap: null, emissive: new THREE.Color(1, 0.86, 0.6), emissiveIntensity: 1.7, roughness: 0.9 });
    this.disposers.push(() => { moonMat.map?.dispose(); moonMat.dispose(); });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 40, 28), moonMat);
    lamp.position.set(LAMP.x, h + 0.2, LAMP.z);
    lamp.userData.noShadow = true; lamp.castShadow = false;
    this.moonLamp = lamp;
    this.add(lamp);
    const stand = new THREE.Mesh(lathe([[0, 0], [0.07, 0], [0.072, 0.02], [0.03, 0.03], [0.012, 0.08], [0, 0.08]], 24), m.walnut);
    stand.position.set(LAMP.x, h, LAMP.z); this.add(stand);
    this.lampLight.position.copy(lamp.position);
    // the alarm clock: brass, twin bells and a hammer, a cream dial with hands that keep the real time
    const clock = new THREE.Group();
    const body = new THREE.Mesh(cyl(0.07, 0.04, 32).rotateX(Math.PI / 2).translate(0, 0, -0.02), m.brass); clock.add(body);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.062, 40), new THREE.MeshStandardMaterial({ map: dialTex(), roughness: 0.4 })); dial.position.z = 0.0205; clock.add(dial);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.006, 8, 40), m.brass); rim.position.z = 0.021; clock.add(rim);
    for (const sx of [-1, 1]) {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.brass); bell.position.set(sx * 0.045, 0.07, -0.01); bell.rotation.z = -sx * 0.5; clock.add(bell);
      const leg = new THREE.Mesh(cyl(0.006, 0.05, 8), m.brass); leg.position.set(sx * 0.045, -0.085, 0); leg.rotation.z = sx * 0.35; clock.add(leg);
    }
    const hamBar = new THREE.Mesh(cyl(0.004, 0.06, 6), m.brass); hamBar.position.set(0, 0.065, -0.01); clock.add(hamBar);
    const hand = (len: number, wd: number) => { const g = new THREE.Group(); const me = new THREE.Mesh(new THREE.BoxGeometry(wd, len, 0.002).translate(0, len / 2 - 0.006, 0), new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 0.4 })); g.add(me); g.position.z = 0.024; clock.add(g); return g; };
    this.hands = { h: hand(0.036, 0.006), m: hand(0.052, 0.004) };
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12).rotateX(Math.PI / 2), m.brass); cap.position.z = 0.027; clock.add(cap);
    clock.position.set(CLK.x, h + 0.11, CLK.z); clock.rotation.y = -0.25;
    clock.name = 'alarm';
    this.add(clock);
  }

  private buildPhoneBed() {
    const m = this.m;
    // the phone, lit, lying on the nightstand's front right corner
    const shell = new THREE.Mesh(bbox(0.075, 0.009, 0.15, { r: 0.006 }), m.blackLacquer);
    this.phone.add(shell);
    this.phoneScreen = new THREE.MeshBasicMaterial({ map: phoneTex(), toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85) });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138).rotateX(-Math.PI / 2), this.phoneScreen); scr.position.y = 0.0095; this.phone.add(scr);
    this.phone.position.set(PHONE0.x, NS.h, PHONE0.z);
    this.phone.rotation.y = 0.35;
    this.phone.scale.setScalar(1.3);
    this.phone.name = 'phone';
    this.add(this.phone);
    // its bed: a little oak box with a felt lining, a hinged lid, a brass hasp and staple
    const bx = new Batch(), bw = 0.12, bh = 0.06, bd = 0.2;
    bx.add(m.oak, at(bbox(bw, 0.012, bd, { r: 0.003 }), 0, 0, 0));
    bx.add(m.oak, at(bbox(0.012, bh, bd, { r: 0.003 }), -bw / 2 + 0.006, 0, 0)); bx.add(m.oak, at(bbox(0.012, bh, bd, { r: 0.003 }), bw / 2 - 0.006, 0, 0));
    bx.add(m.oak, at(bbox(bw, bh, 0.012, { r: 0.003 }), 0, 0, -bd / 2 + 0.006)); bx.add(m.oak, at(bbox(bw, bh, 0.012, { r: 0.003 }), 0, 0, bd / 2 - 0.006));
    bx.add(m.felt, at(bbox(bw - 0.026, 0.004, bd - 0.026), 0, 0.012, 0));
    bx.add(m.brass, at(bbox(0.016, 0.022, 0.004, { r: 0.002 }), 0, bh - 0.03, bd / 2 + 0.002));
    bx.add(m.brass, at(new THREE.TorusGeometry(0.008, 0.0022, 8, 16), 0, bh - 0.022, bd / 2 + 0.006));
    this.box.add(bx.build('phonebox'));
    const lb = new Batch();
    lb.add(m.oak, at(bbox(bw + 0.004, 0.014, bd + 0.004, { r: 0.004 }), 0, 0, bd / 2));
    lb.add(m.brass, at(bbox(0.018, 0.004, 0.03, { r: 0.002 }), 0, 0.012, bd - 0.004));
    lb.add(m.brass, at(bbox(0.018, 0.034, 0.004, { r: 0.002 }), 0, -0.022, bd + 0.009));
    this.lid.add(lb.build('lid'));
    this.lid.position.set(0, bh, -bd / 2);
    this.lid.rotation.x = -1.9; // open
    this.box.add(this.lid);
    // the padlock (waiting above, out of sight until it is needed)
    const body = new THREE.Mesh(bbox(0.036, 0.032, 0.014, { r: 0.006, center: true }), m.brass); this.lock.add(body);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 10).rotateX(Math.PI / 2), m.blackLacquer); hole.position.set(0, -0.004, 0.0075); this.lock.add(hole);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0032, 10, 24, Math.PI), m.chrome); sh.position.y = 0.016;
    const legL = new THREE.Mesh(cyl(0.0032, 0.012, 8), m.chrome); legL.position.set(-0.012, 0.004, 0);
    const legR = new THREE.Mesh(cyl(0.0032, 0.02, 8), m.chrome); legR.position.set(0.012, -0.004, 0);
    this.shackle.add(sh, legL, legR);
    this.shackle.position.y = 0.014; // open: lifted
    this.lock.add(this.shackle);
    const kb = new Batch();
    kb.add(m.brass, at(new THREE.TorusGeometry(0.008, 0.0025, 8, 18), 0, 0, 0.026, Math.PI / 2));
    kb.add(m.brass, at(cyl(0.0018, 0.018, 8).rotateX(Math.PI / 2), 0, 0, 0.0));
    kb.add(m.brass, at(bbox(0.004, 0.006, 0.003), 0.002, -0.004, 0.004));
    this.key.add(kb.build('key'));
    this.key.position.set(0, -0.004, 0.006);
    this.key.visible = false;
    this.lock.add(this.key);
    this.lock.visible = false;
    this.box.add(this.lock);
    this.box.position.set(BOX.x, NS.h, BOX.z);
    this.box.rotation.y = 0.12;
    this.box.scale.setScalar(BOX.s);
    this.box.name = 'phonebox';
    this.add(this.box);
  }

  private buildCabinet() {
    const m = this.m, b = new Batch(), { x, z, w, h, d } = CAB;
    b.add(m.walnut, at(bbox(w, h - 0.08, d, { r: 0.012 }), x, 0.08, z));
    b.add(m.walnut, at(bbox(w + 0.03, 0.03, d + 0.03, { r: 0.008 }), x, h - 0.01, z));
    for (const sx of [-1, 1]) {
      b.add(m.oak, at(bbox(w / 2 - 0.04, h - 0.2, 0.02, { r: 0.008 }), x + sx * (w / 4), 0.12, z + d / 2));
      b.add(m.brass, at(new THREE.SphereGeometry(0.014, 12, 8), x + sx * 0.04, h / 2 + 0.02, z + d / 2 + 0.014));
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(m.walnut, at(bbox(0.05, 0.09, 0.05, { r: 0.01, along: 'y' }), x + sx * (w / 2 - 0.05), 0, z + sz * (d / 2 - 0.05)));
    // a stack of records leaning beside it
    for (let i = 0; i < 4; i++) b.add([m.mahoganyDark, m.chairPlain, m.felt, m.walnut][i], at(bbox(0.012, 0.3, 0.3, { r: 0.003 }), x + w / 2 + 0.06 + i * 0.014, 0, z + 0.04, 0, 0, -0.12 - i * 0.02));
    this.add(b.build('cabinet'));
    // the record player: a walnut plinth, a platter with a spinning record, a brass tonearm, a horn speaker
    const rp = new THREE.Group(), pb = new Batch();
    pb.add(m.walnut, at(bbox(0.46, 0.09, 0.36, { r: 0.012 }), 0, 0, 0));
    pb.add(m.brass, at(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), 0.17, 0.1, 0.12));
    pb.add(m.brass, at(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), 0.12, 0.1, 0.12));
    rp.add(pb.build('player'));
    const platter = new THREE.Group();
    const plat = new THREE.Mesh(cyl(0.15, 0.012, 48), m.chrome); platter.add(plat);
    const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.004, 64), [new THREE.MeshStandardMaterial({ color: 0x121014, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: labelTex(), roughness: 0.25, metalness: 0.1 }), new THREE.MeshStandardMaterial({ color: 0x121014 })]);
    vinyl.position.y = 0.016;
    platter.add(vinyl);
    platter.position.set(-0.05, 0.09, 0);
    rp.add(platter);
    this.record = platter;
    const arm = new THREE.Group();
    const post = new THREE.Mesh(cyl(0.012, 0.05, 12), m.brass); arm.add(post);
    const rod = new THREE.Mesh(cyl(0.005, 0.2, 8).rotateZ(Math.PI / 2).translate(-0.1, 0.045, 0), m.brass); arm.add(rod);
    const head = new THREE.Mesh(bbox(0.024, 0.012, 0.018, { r: 0.003 }), m.blackLacquer); head.position.set(-0.2, 0.034, 0); arm.add(head);
    arm.position.set(0.15, 0.09, -0.1);
    arm.rotation.y = 0.5;
    rp.add(arm);
    this.tonearm = arm;
    // the horn
    const horn = new THREE.Mesh(lathe([[0.01, 0], [0.012, 0.08], [0.025, 0.16], [0.06, 0.24], [0.13, 0.3], [0.135, 0.305]], 32), new THREE.MeshStandardMaterial({ color: 0xb8863c, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }));
    horn.rotation.set(-0.9, 0, 0.5); horn.position.set(0.14, 0.12, -0.08);
    rp.add(horn);
    const neck = new THREE.Mesh(cyl(0.012, 0.1, 10), m.brass); neck.position.set(0.15, 0.09, -0.1); rp.add(neck);
    rp.position.set(REC.x, REC.y, REC.z);
    rp.scale.setScalar(REC.s);
    rp.rotation.y = 0.3;
    rp.name = 'sound';
    this.add(rp);
    // a picture above it: the night sky over the oak, in a gilt frame
    const pic = canvasTex(320, 240, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#0f1840'); gr.addColorStop(0.7, '#3a4a80'); gr.addColorStop(1, '#6a6a8a');
      g.fillStyle = gr; g.fillRect(0, 0, 320, 240);
      for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,250,230,${Math.random() * 0.8})`; g.fillRect(Math.random() * 320, Math.random() * 170, 1.5, 1.5); }
      g.fillStyle = '#f4e8c0'; g.beginPath(); g.arc(240, 60, 22, 0, 7); g.fill();
      g.fillStyle = '#1a2a24'; g.beginPath(); g.moveTo(0, 240); for (let x2 = 0; x2 <= 320; x2 += 10) g.lineTo(x2, 200 - Math.sin(x2 * 0.04) * 14 - (x2 > 120 && x2 < 200 ? 50 * Math.sin((x2 - 120) / 80 * Math.PI) : 0)); g.lineTo(320, 240); g.fill();
      g.fillStyle = '#ffd27a'; g.fillRect(156, 168, 5, 6);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshStandardMaterial({ map: pic, roughness: 0.6 }));
    face.position.set(x, 1.62, Z0 + 0.03);
    this.add(face);
    const fb = new Batch();
    for (const [w2, h2, xx, yy] of [[0.7, 0.05, 0, 0.25], [0.7, 0.05, 0, -0.25], [0.05, 0.55, -0.325, 0], [0.05, 0.55, 0.325, 0]] as [number, number, number, number][]) fb.add(m.gilt, at(bbox(w2, h2, 0.03, { r: 0.008, center: true }), x + xx, 1.62 + yy, Z0 + 0.035));
    this.add(fb.build('frame'));
  }

  private buildGlobe() {
    const m = this.m, g = new THREE.Group(), b = new Batch();
    // a tripod of turned walnut legs, a brass meridian ring, the real Earth
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; b.add(m.walnut, at(cyl(0.022, 0.62, 10, { r2: 0.014 }), Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17, Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28)); }
    b.add(m.walnut, at(new THREE.TorusGeometry(0.2, 0.018, 10, 40).rotateX(Math.PI / 2), 0, 0.3, 0));
    b.add(m.walnut, at(lathe([[0, 0], [0.06, 0], [0.05, 0.05], [0.02, 0.09], [0, 0.09]], 20), 0, 0.56, 0));
    g.add(b.build('globestand'));
    const ball = new THREE.Group();
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}models/globe/earth_day.webp`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; });
    this.disposers.push(() => tex.dispose());
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.27, 64, 40), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0.5, 0.46, 0.38), emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.05, color: 0xf0e4c8 }));
    ball.add(earth);
    ball.rotation.z = 0.41; // the Earth's tilt
    ball.position.y = 0.96;
    g.add(ball);
    this.globeBall = earth;
    const mer = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 10, 60, Math.PI * 1.3), m.brass); mer.position.y = 0.96; mer.rotation.set(0, Math.PI / 2, 0.41 - 0.6); g.add(mer);
    g.position.set(GLOBE.x, 0, GLOBE.z);
    g.name = 'globe';
    this.add(g);
  }

  private buildDecor() {
    const m = this.m;
    // the rug
    const rug = new THREE.Mesh(bbox(2.6, 0.012, 1.74, { r: 0.004, center: true }), m.rug);
    { const uv = rug.geometry.attributes.uv as THREE.BufferAttribute, p = rug.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2.6 + 0.5, p.getZ(i) / 1.74 + 0.5); }
    rug.position.set(0.0, 0.006, -0.2);
    this.add(rug);
    // paper stars on threads from the beams
    const starMat = new THREE.MeshStandardMaterial({ color: 0xf3dc9a, roughness: 0.6, metalness: 0.2, emissive: new THREE.Color(0.5, 0.36, 0.12), emissiveIntensity: 0.25, side: THREE.DoubleSide });
    const thread = new THREE.MeshBasicMaterial({ color: 0xc8b890 });
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.032 : 0.075; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
    const spots: [number, number, number][] = [[-1.3, 0.75, -1.1], [-0.2, 0.5, -0.6], [0.9, 0.62, -0.2], [1.7, 0.85, 0.4], [-0.9, 0.95, 0.5], [0.3, 1.05, 0.6], [2.3, 0.6, -1.2]];
    spots.forEach(([x, drop, z], i) => {
      const holder = new THREE.Group();
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, drop, 4).translate(0, -drop / 2, 0), thread); holder.add(th);
      const st = new THREE.Mesh(sg, starMat); st.position.y = -drop - 0.06; st.scale.setScalar(i % 3 ? 0.8 : 1.1); holder.add(st);
      holder.position.set(x, H - 0.2, z);
      this.add(holder);
      this.stars.push({ o: holder, ph: i * 1.7 });
    });
    // a little bookshelf on the right wall above the bed's foot and books on the cabinet
    const b = new Batch();
    b.add(m.walnut, at(bbox(0.05, 0.04, 0.9, { r: 0.006 }), X1 - 0.03, 1.45, -0.6));
    const bookMats = [m.chairPlain, m.mahoganyDark, m.felt, m.deskLeather, m.walnut];
    for (let i = 0; i < 12; i++) { const hh = 0.18 + hash(i, 3, 1) * 0.08; b.add(bookMats[i % bookMats.length], at(bbox(0.16, hh, 0.035, { r: 0.004, along: 'y' }), X1 - 0.1, 1.49, -1.0 + i * 0.045, i === 11 ? 0.3 : 0)); }
    this.add(b.build('decor'));
    // a firefly jar on the cabinet (a warm glow that breathes)
    const jar = new THREE.Mesh(lathe([[0, 0], [0.06, 0], [0.065, 0.02], [0.065, 0.14], [0.045, 0.17], [0.045, 0.19], [0, 0.19]], 24), new THREE.MeshPhysicalMaterial({ color: 0xdfeee6, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false }));
    jar.position.set(CAB.x + 0.3, CAB.h + 0.02, CAB.z - 0.08);
    jar.userData.noShadow = true; jar.castShadow = false;
    this.add(jar);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.4) }));
    glow.position.copy(jar.position).add(V(0, 0.08, 0)); glow.userData.noShadow = true; glow.castShadow = false;
    glow.name = 'jarglow';
    this.add(glow);
    // potted plants in the corners
    const pot = (x: number, z: number, s: number) => {
      const pb = new Batch();
      pb.add(m.ceramic, at(lathe([[0, 0], [0.14, 0], [0.17, 0.26], [0.18, 0.28], [0, 0.28]], 24), x, 0, z));
      pb.add(m.soil, at(new THREE.CircleGeometry(0.165, 20).rotateX(-Math.PI / 2), x, 0.27, z));
      this.add(pb.build('pot'));
      const leaf = new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 0.6, side: THREE.DoubleSide });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + hash(i, 1, x) * 0.5, len = (0.34 + hash(i, 2, z) * 0.28) * s;
        const lg = new THREE.PlaneGeometry(0.09 * s, len, 1, 6);
        const p = lg.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) { const v = (p.getY(k) + len / 2) / len; p.setX(k, p.getX(k) * Math.sin(Math.min(1, v * 1.2) * Math.PI) * 1.2); p.setZ(k, -v * v * 0.25 * s); }
        lg.translate(0, len / 2, 0); lg.computeVertexNormals();
        const me = new THREE.Mesh(lg, leaf);
        me.position.set(x, 0.27, z); me.rotation.set(-0.35 - hash(i, 4, 2) * 0.4, a, 0, 'YXZ');
        this.add(me);
      }
    };
    pot(X0 + 0.35, Z0 + 0.45, 1.3);
    pot(X1 - 0.4, 1.0, 1.1);
  }

  /** invisible hit volumes for the things you can tap, and where their labels sit */
  private hotspots() {
    const hit = (id: Hot, size: [number, number, number], pos: THREE.Vector3, label: THREE.Vector3) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ visible: false }));
      me.position.copy(pos);
      me.userData.noShadow = true; me.castShadow = false;
      this.add(me);
      this.hits.push({ id, mesh: me, label });
    };
    hit('mic', [0.26, 0.36, 0.3], V(WIN.x + WIN.w / 2 - 0.2, WIN.y0 + 0.16, Z0 - 0.02), V(WIN.x + WIN.w / 2 - 0.2, WIN.y0 + 0.34, Z0));
    hit('sound', [0.42, 0.42, 0.42], V(REC.x, REC.y + 0.16, REC.z), V(REC.x - 0.05, REC.y + 0.4, REC.z));
    hit('alarm', [0.2, 0.24, 0.18], V(CLK.x, NS.h + 0.11, CLK.z), V(CLK.x + 0.04, NS.h + 0.24, CLK.z));
    hit('phone', [0.34, 0.12, 0.34], V((BOX.x + PHONE0.x) / 2, NS.h + 0.05, NS.z + 0.04), V(BOX.x, NS.h + 0.16, BOX.z));
    hit('lamp', [0.24, 0.3, 0.24], V(LAMP.x, NS.h + 0.18, LAMP.z), V(LAMP.x, NS.h + 0.36, LAMP.z));
    hit('globe', [0.7, 1.3, 0.7], V(GLOBE.x, 0.65, GLOBE.z), V(GLOBE.x, 1.34, GLOBE.z));
    hit('window', [WIN.w, WIN_TOP - WIN.y0, 0.2], V(WIN.x, (WIN.y0 + WIN_TOP) / 2 + 0.1, Z0 - 0.1), V(WIN.x - 0.3, WIN_TOP - 0.2, Z0));
    hit('bed', [BED.w, 0.7, BED.len], V(BED.x, 0.35, BED.z0 + BED.len / 2), V(BED.x, 0.85, BED.z0 + BED.len * 0.6));
  }

  // ---------------------------------------------------------------- Pip

  private makeActor(look: OwlLook) {
    const a = new OwlActor(look, { fx: (k, at2, n) => this.owlFx(k, at2, n), sound: (id) => sceneSound('owl_' + id) });
    a.node.scale.setScalar(PIP_H / Math.max(0.3, a.height));
    this.actors.push(a);
    return a;
  }
  /** Get the backpacked Pip ready (built in the background so the swap has no pop). */
  prepareTrip(look: OwlLook) {
    if (this.packed) return;
    const trip: OwlLook = { ...look, outfit: { ...(look.outfit ?? {}), back: 'backpack' } };
    this.packed = this.makeActor(trip);
  }
  private swapTo(next: OwlActor) {
    const old = this.pip;
    if (next === old) return;
    next.node.position.copy(old.node.position);
    next.node.rotation.copy(old.node.rotation);
    next.pose = old.pose; next.lookAt = old.lookAt;
    next.setMood(old.mood);
    this.scene.remove(old.node);
    this.scene.add(next.node);
    this.pip = next;
  }
  get owl() { return this.pip; }
  private owlFx(k: OwlFx, at2: THREE.Vector3, n = 3) {
    if (k === 'sparkle') this.burst('sparkle', at2, n);
    else if (k === 'feather') this.burst('feathers', at2, n);
    else if (k === 'dust') this.burst('puffs', at2, n);
    else if (k === 'zzz') this.burst('zzz', at2, Math.max(2, n));
  }
  burst(kind: 'sparkle' | 'puffs' | 'feathers' | 'zzz' | 'stars' | 'glint', at2: THREE.Vector3, n = 4, k = 1) {
    const fx = this.fx, R = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      switch (kind) {
        case 'sparkle': fx.emit({ x: at2.x + R(-0.1, 0.1) * k, y: at2.y + R(-0.04, 0.12) * k, z: at2.z + R(-0.08, 0.08) * k, life: R(0.4, 0.8), frame: SPR.spark1, frames: 3, fps: 8, color: 0xffe2a0, size: R(0.04, 0.07) * k, add: true, delay: i * 0.05 }); break;
        case 'glint': fx.emit({ x: at2.x, y: at2.y, z: at2.z, life: 0.5, frame: SPR.spark1, color: 0xfff2c8, size: 0.12 * k, add: true, grow: 0.6, fadeOut: 0.3 }); break;
        case 'stars': fx.emit({ x: at2.x, y: at2.y, z: at2.z, vx: Math.cos(a) * R(0.12, 0.3) * k, vy: R(0.2, 0.45) * k, vz: Math.sin(a) * R(0.12, 0.3) * k, life: R(0.7, 1.1), frame: SPR.star, color: i % 2 ? 0xf0c050 : 0xffe8a0, size: R(0.04, 0.07) * k, gravity: 0.9 * k, drag: 1.2, add: true }); break;
        case 'puffs': fx.emit({ x: at2.x, y: at2.y, z: at2.z, vx: Math.cos(a) * R(0.12, 0.26) * k, vy: R(0.04, 0.14) * k, vz: Math.sin(a) * R(0.12, 0.26) * k, life: R(0.5, 0.8), frame: SPR.puff1, frames: 3, fps: 7, color: 0xf4eedd, size: R(0.05, 0.08) * k, grow: 0.8, drag: 3, fadeOut: 0.3 }); break;
        case 'feathers': fx.emit({ x: at2.x, y: at2.y, z: at2.z, vx: Math.cos(a) * 0.18 * k, vy: R(0.1, 0.25) * k, vz: Math.sin(a) * 0.18 * k, life: R(1.4, 2.2), frame: SPR.feather1, frames: 3, fps: 3, color: featherColour(this.pip.model.look.palette), size: 0.04 * k, gravity: 0.25 * k, drag: 2.2, flutter: 0.1 * k }); break;
        case 'zzz': fx.emit({ x: at2.x + i * 0.02, y: at2.y + i * 0.02, z: at2.z, vx: 0.02, vy: 0.05, life: 1.8, frame: SPR.zed, color: 0xe4dcff, size: 0.05 + i * 0.015, fadeIn: 0.2, delay: i * 0.5, add: true }); break;
      }
    }
  }
  /** Hop Pip to a spot on the floor (a few little hops), turning to face `face` (radians, 0 = the camera) at the end. */
  hopTo(to: THREE.Vector3, face: number, dur = 1.1): Promise<void> {
    return new Promise((res) => {
      const from = this.pip.node.position.clone();
      const d = from.distanceTo(to);
      this.faceWant = Math.atan2(to.x - from.x, to.z - from.z);
      this.hop = { from, to: to.clone(), t: 0, dur: Math.max(0.35, dur * Math.min(1, d / 1.2)), face, hops: Math.max(1, Math.round(d / 0.35)), done: res };
    });
  }
  private stepHop(dt: number) {
    const h = this.hop;
    if (!h) { this.face = lerpAngle(this.face, this.faceWant, Math.min(1, dt * 9)); this.pip.node.rotation.y = this.face; return; }
    h.t += dt;
    const k = Math.min(1, h.t / h.dur);
    const p = this.pip.node.position;
    p.lerpVectors(h.from, h.to, smooth(k));
    const ph = (k * h.hops) % 1;
    p.y = h.from.y + (h.to.y - h.from.y) * k + Math.sin(ph * Math.PI) * 0.07;
    if (ph < 0.08 && k < 0.98 && Math.random() < 0.3) sound.play('hop_wood', { volume: 0.18, gap: 160 });
    this.face = lerpAngle(this.face, this.faceWant, Math.min(1, dt * 8));
    this.pip.node.rotation.y = this.face;
    if (k >= 1) { this.hop = null; this.faceWant = h.face; sound.play('hop_wood', { volume: 0.22 }); h.done(); }
  }

  // ---------------------------------------------------------------- the moments

  private wait(sec: number) { return new Promise<void>((r) => setTimeout(r, sec * 1000)); }
  private tween(sec: number, f: (k: number) => void): Promise<void> {
    return new Promise((res) => {
      let t = 0;
      this.tweens.push((dt) => { t += dt; const k = Math.min(1, t / sec); f(k); if (k >= 1) { res(); return true; } return false; });
    });
  }
  private tweens: ((dt: number) => boolean)[] = [];

  /** The phone goes to bed: Pip hops over, the phone slides into its box, the lid shuts, a padlock drops onto the hasp,
   * Pip turns the key with his beak and the shackle snaps shut. */
  async playLock() {
    const p = this.pip;
    this.go('lock');
    p.setMood('determined', 3);
    await this.hopTo(PIP_LOCK, Math.PI / 2, 0.9);
    this.faceWant = Math.atan2(BOX.x - PIP_LOCK.x, BOX.z - PIP_LOCK.z);
    p.lookAt = this.phone.getWorldPosition(V(0, 0, 0));
    await this.wait(0.35);
    p.play('peck');
    sound.play('ui_drag', { volume: 0.35 });
    // the phone: lifts, turns face down and settles into the box
    const from = this.phone.position.clone(), r0 = this.phone.rotation.clone();
    const box = this.box.position;
    await this.tween(0.75, (k) => {
      const e = smooth(k);
      this.phone.position.set(from.x + (box.x - from.x) * e, from.y + Math.sin(k * Math.PI) * 0.14 + 0.044 * e, from.z + (box.z - from.z) * e);
      this.phone.rotation.set(r0.x + Math.PI * e, r0.y + (this.box.rotation.y - r0.y) * e, 0);
      if (this.phoneScreen) this.phoneScreen.color.setScalar(0.85 * (1 - e));
    });
    sound.play('place_soft', { volume: 0.45 });
    await this.wait(0.15);
    // the lid swings shut
    sound.play('drawer_close', { volume: 0.4, rate: 1.3 });
    await this.tween(0.35, (k) => { this.lid.rotation.x = -1.9 * (1 - k * k); });
    this.burst('puffs', this.box.getWorldPosition(V(0, 0, 0)).add(V(0, 0.07, 0)), 4, 0.6);
    // the padlock drops onto the hasp with its shackle open
    const lp = V(0, 0.026, 0.115);
    this.lock.visible = true;
    this.lock.position.copy(lp).add(V(0, 0.25, 0.04));
    sound.play('whoosh_soft', { volume: 0.25, rate: 1.4 });
    await this.tween(0.45, (k) => { const e = 1 - (1 - k) ** 3; this.lock.position.lerpVectors(lp.clone().add(V(0, 0.25, 0.04)), lp, e); this.lock.rotation.z = Math.sin(k * 9) * 0.25 * (1 - k); });
    sound.play('place_metal', { volume: 0.5 });
    await this.wait(0.25);
    // the key slides in, Pip pecks it round
    this.key.visible = true;
    await this.tween(0.25, (k) => { this.key.position.z = 0.03 - 0.024 * k; });
    p.play('peck');
    await this.wait(0.22);
    sound.play('clock_wind', { volume: 0.5 });
    await this.tween(0.4, (k) => { this.key.rotation.z = -Math.PI / 2 * smooth(k); });
    // click: the shackle snaps down
    await this.tween(0.12, (k) => { this.shackle.position.y = 0.014 * (1 - k); });
    sound.play('stamp', { volume: 0.35, rate: 1.6 });
    setTimeout(() => sound.play('sparkle', { volume: 0.45 }), 120);
    const lw = this.lock.getWorldPosition(V(0, 0, 0));
    this.burst('glint', lw.clone().add(V(0.01, 0.02, 0.02)), 1, 1);
    this.burst('stars', lw, 8, 0.8);
    this.lid.position.y -= 0.001;
    this.tweens.push(this.jolt(this.box, 0.25));
    p.lookAt = null;
    p.setMood('proud', 2.5);
    await this.wait(0.3);
    p.play('nod');
    this.faceWant = 0;
    await this.wait(0.8);
  }
  private jolt(o: THREE.Object3D, sec: number) {
    let t = 0;
    const y = o.position.y;
    return (dt: number) => { t += dt; const k = t / sec; o.position.y = y - Math.sin(Math.min(1, k) * Math.PI) * 0.004; return k >= 1; };
  }

  /** Pip gets ready to go out: a spin, a puff, and his trail backpack is on. */
  async playPack(look: OwlLook) {
    this.prepareTrip(look);
    const p = this.pip;
    this.go('pack');
    await this.hopTo(V(-0.25, 0, -0.35), 0, 0.8);
    this.faceWant = 0;
    p.setMood('excited', 3);
    await this.wait(0.3);
    p.play('spin');
    sound.play('whoosh_cloth', { volume: 0.45 });
    await this.wait(0.55);
    if (this.packed) { try { await Promise.race([this.packed.ready, this.wait(1.5)]); } catch { /* model still loading */ } this.swapTo(this.packed); }
    const at2 = this.pip.node.position.clone().add(V(0, PIP_H * 0.5, 0.05));
    this.burst('puffs', at2, 9, 1.2);
    this.burst('sparkle', at2, 8, 1.3);
    sound.play('tp_shimmer', { volume: 0.35 });
    sound.play('fabric', { volume: 0.4 });
    await this.wait(0.5);
    this.pip.play('flap');
    this.pip.setMood('determined', 2.5);
    await this.wait(1.0);
  }

  /** Pip hops to the globe and gives it a spin; the camera pushes in on the Earth. */
  async playGlobe() {
    this.go('globe');
    await this.hopTo(PIP_GLOBE, -Math.PI / 2 + 0.6, 0.9);
    this.faceWant = Math.atan2(GLOBE.x - PIP_GLOBE.x, GLOBE.z - PIP_GLOBE.z);
    this.pip.lookAt = V(GLOBE.x, 0.96, GLOBE.z);
    await this.wait(0.3);
    this.pip.play('wave');
    sound.play('globe_spin', { volume: 0.5 });
    this.globeSpin = 7;
    await this.wait(1.2);
  }

  /** back to how it was (the screen was reopened) */
  reset(look: OwlLook) {
    this.hop = null;
    this.tweens.length = 0;
    const base = this.actors[0];
    this.swapTo(base);
    void look;
    this.pip.node.position.copy(PIP_HOME);
    this.faceWant = 0;
    this.pip.lookAt = null;
    this.phone.position.set(PHONE0.x, NS.h, PHONE0.z); this.phone.rotation.set(0, 0.35, 0);
    if (this.phoneScreen) this.phoneScreen.color.setScalar(0.85);
    this.lid.rotation.x = -1.9; this.lock.visible = false; this.key.visible = false; this.shackle.position.y = 0.014; this.key.rotation.z = 0; this.key.position.z = 0.006;
    this.go('room');
  }

  // ---------------------------------------------------------------- the controls' state in the room

  setMic(on: boolean) { this.micOn = on; }
  setSound(on: boolean) { this.spinWant = on ? 1 : 0; }
  /** 0 lamps on .. 1 lights out */
  setDim(k: number) { this.dimWant = k; }

  // ---------------------------------------------------------------- camera

  private shot(name: BedShot) {
    const P = this.camera.aspect < 0.9;
    switch (name) {
      case 'room': return P ? { target: V(0.35, 0.95, -0.95), yaw: 0.08, pitch: 0.12, fit: [2.5, 3.3] as [number, number] } : { target: V(0.05, 1.12, -0.85), yaw: 0.02, pitch: 0.11, fit: [5.1, 2.9] as [number, number] };
      case 'lock': return { target: V(NS.x - 0.22, NS.h + 0.08, NS.z + 0.02), yaw: 0.42, pitch: 0.3, fit: (P ? [0.55, 0.8] : [1.05, 0.56]) as [number, number] };
      case 'pack': return { target: V(-0.25, PIP_H * 0.62, -0.35), yaw: 0.1, pitch: 0.12, fit: (P ? [1.2, 1.7] : [2.6, 1.4]) as [number, number] };
      case 'globe': return { target: V(GLOBE.x + 0.1, 0.92, GLOBE.z), yaw: 0.32, pitch: 0.08, fit: (P ? [0.9, 1.3] : [1.9, 1.05]) as [number, number] };
      case 'window': return { target: V(WIN.x, (WIN.y0 + WIN_TOP) / 2 + 0.1, Z0), yaw: 0.0, pitch: 0.03, fit: (P ? [1.7, 2.6] : [3.2, 1.8]) as [number, number] };
      case 'mic': return { target: V(WIN.x + WIN.w / 2 - 0.2, WIN.y0 + 0.15, Z0), yaw: -0.2, pitch: 0.12, fit: (P ? [0.9, 1.3] : [1.9, 1.05]) as [number, number] };
      case 'sound': return { target: V(REC.x + 0.1, REC.y + 0.15, REC.z), yaw: 0.25, pitch: 0.2, fit: (P ? [0.9, 1.3] : [1.9, 1.05]) as [number, number] };
      case 'alarm': return { target: V(NS.x + 0.05, NS.h + 0.1, NS.z), yaw: -0.25, pitch: 0.25, fit: (P ? [0.8, 1.2] : [1.7, 0.95]) as [number, number] };
    }
  }
  /** fly the camera to a shot */
  go(name: BedShot, cut = false) {
    this.shotName = name;
    const s = this.shot(name);
    const fovV = THREE.MathUtils.degToRad(this.camera.fov), tv = Math.tan(fovV / 2);
    // fit the frame inside the free part of the screen
    const fw = Math.max(0.3, this.free.x1 - this.free.x0), fh = Math.max(0.3, this.free.y1 - this.free.y0);
    const dist = Math.max(s.fit[1] / fh / 2 / tv, s.fit[0] / fw / 2 / (tv * this.camera.aspect));
    this.want = { target: s.target.clone(), yaw: s.yaw, pitch: s.pitch, dist };
    this.moveK = name === 'room' ? 1.4 : 1.9;
    if (cut) { this.cam = { target: this.want.target.clone(), yaw: this.want.yaw, pitch: this.want.pitch, dist: this.want.dist }; }
  }
  get shotNow() { return this.shotName; }
  private applyCamera(dt: number) {
    const k = 1 - Math.exp(-dt * this.moveK), c = this.cam, w = this.want;
    c.target.lerp(w.target, k); c.yaw += (w.yaw - c.yaw) * k; c.pitch += (w.pitch - c.pitch) * k; c.dist += (w.dist - c.dist) * k;
    const t = this.time, drift = 0.012;
    const yaw = c.yaw + Math.sin(t * 0.23) * drift, pitch = c.pitch + Math.sin(t * 0.17 + 1) * drift * 0.6;
    const cam = this.camera;
    cam.position.set(c.target.x + Math.sin(yaw) * Math.cos(pitch) * c.dist, c.target.y + Math.sin(pitch) * c.dist, c.target.z + Math.cos(yaw) * Math.cos(pitch) * c.dist);
    cam.lookAt(c.target);
    // off-axis: put the subject in the middle of the free part of the screen
    const cx = (this.free.x0 + this.free.x1) / 2 - 0.5, cy = (this.free.y0 + this.free.y1) / 2 - 0.5;
    const W = innerWidth, Hh = innerHeight;
    if (Math.abs(cx) > 0.002 || Math.abs(cy) > 0.002) cam.setViewOffset(W, Hh, -cx * W, -cy * Hh, W, Hh); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  /** refit the current shot (after the free area or the screen changed) */
  refit() { this.go(this.shotName); }

  /** screen position (CSS px) of a world point */
  screenOf(v: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, behind: p.z > 1 };
  }
  /** where each hotspot's label sits on screen */
  anchors(): Record<Hot, { x: number; y: number; on: boolean }> {
    const out = {} as Record<Hot, { x: number; y: number; on: boolean }>;
    for (const h of this.hits) { const s = this.screenOf(h.label); out[h.id] = { x: s.x, y: s.y, on: !s.behind && s.x > -40 && s.x < innerWidth + 40 && s.y > -40 && s.y < innerHeight + 40 }; }
    return out;
  }
  /** Pip's head on screen (for his words) */
  pipScreen() { return this.screenOf(this.pip.headWorld); }

  // ---------------------------------------------------------------- input

  private ray = new THREE.Raycaster();
  private pick(ray: THREE.Ray): Hot | null {
    this.ray.ray.copy(ray);
    const hits = this.ray.intersectObjects(this.hits.map((h) => h.mesh), false);
    if (!hits.length) return null;
    return this.hits.find((h) => h.mesh === hits[0].object)?.id ?? null;
  }
  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray): boolean {
    const id = this.pick(ray);
    if (type === 'move') {
      if (id !== this.hover) { this.hover = id; this.onHover(id); document.body.style.cursor = id ? 'pointer' : ''; }
      return true;
    }
    if (type === 'down') { this.down = { x, y }; return true; }
    if (type === 'up' && this.down) {
      const moved = Math.hypot(x - this.down.x, y - this.down.y);
      this.down = null;
      if (moved < 10 && id) this.onPick(id);
      else if (moved < 10 && !id && this.shotName === 'room') { /* a tap in the room pokes Pip if he's under it */ }
      return true;
    }
    return false;
  }
  /** a gentle poke: Pip reacts */
  poke() { this.pip.poke(); }

  // ---------------------------------------------------------------- frame

  update(dt: number, t: number) {
    void t;
    this.time += dt;
    for (let i = this.tweens.length - 1; i >= 0; i--) if (this.tweens[i](dt)) this.tweens.splice(i, 1);
    this.stepHop(dt);
    this.stepLight(dt);
    // the window: refresh the real view now and then
    if (this.world && this.winRT && (this.winT -= dt) <= 0) {
      this.winT = this.quality === 'high' ? 0.35 : 0.8;
      try { this.world.renderView(this.winCam, this.winRT); } catch { /* world busy */ }
    }
    // the record turns (and the arm swings onto it) while a sound plays
    this.spin += (this.spinWant - this.spin) * Math.min(1, dt * 1.5);
    if (this.record) this.record.rotation.y -= dt * 3.5 * this.spin;
    if (this.tonearm) this.tonearm.rotation.y = 0.5 + this.spin * 0.42;
    this.recordLight.intensity = this.spin * 0.25 * (1 - this.dim * 0.5);
    if (this.spin > 0.5 && Math.random() < dt * 0.6) { const rp = this.record!.getWorldPosition(V(0, 0, 0)); this.fx.emit({ x: rp.x + 0.15, y: rp.y + 0.2, z: rp.z, vy: 0.09, vx: 0.02, life: 2.2, frame: SPR.note, color: 0xf2d38a, size: 0.035, flutter: 0.04, fadeIn: 0.3, add: true }); }
    // the on-air lamp
    if (this.airLamp) { const pulse = 0.75 + Math.sin(this.time * 2.4) * 0.25; this.airLamp.emissiveIntensity = this.micOn ? 2.6 * pulse : 0; this.airLamp.color.setHex(this.micOn ? 0x5a0c08 : 0x2a1a18); }
    // the clock keeps the real time
    if (this.hands) { const d = new Date(), mn = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + mn / 60; this.hands.m.rotation.z = -(mn / 60) * Math.PI * 2; this.hands.h.rotation.z = -(hr / 12) * Math.PI * 2; }
    // paper stars sway, the globe turns
    for (const w of this.swing) { w.o.rotation.x = Math.sin(this.time * 0.8 + w.ph) * w.k; w.o.rotation.z = Math.sin(this.time * 0.55 + w.ph * 1.3) * w.k * 0.5; }
    for (const s of this.stars) { s.o.rotation.z = Math.sin(this.time * 0.6 + s.ph) * 0.05; s.o.rotation.y = Math.sin(this.time * 0.3 + s.ph) * 0.6; }
    this.globeSpin += (0.12 - this.globeSpin) * Math.min(1, dt * 0.6);
    if (this.globeBall) this.globeBall.rotation.y += dt * this.globeSpin;
    // fairy lights twinkle
    if (this.bulbs) { const c = new THREE.Color(); for (let i = 0; i < this.bulbs.count; i++) { const tw = 0.7 + 0.3 * Math.sin(this.time * (1.3 + (i % 5) * 0.37) + i * 2.1); c.setScalar(tw); this.bulbs.setColorAt(i, c); } if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true; }
    // dust motes in the moonlight, now and then
    if (Math.random() < dt * (this.quality === 'high' ? 6 : 2)) {
      const x = WIN.x - 0.4 + Math.random() * 1.6, y = 0.2 + Math.random() * 1.6, z = Z0 + 0.2 + Math.random() * 1.6;
      this.fx.emit({ x, y, z, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.4) * 0.02, vz: (Math.random() - 0.5) * 0.02, life: 5 + Math.random() * 3, frame: SPR.mote, color: this.night > 0.5 ? 0xc8d8ff : 0xffe8b8, size: 0.01 + Math.random() * 0.012, add: true, fadeIn: 1.2, fadeOut: 2, flutter: 0.02 });
    }
    for (const a of [this.pip]) { a.dark = this.night * 0.4 + this.dim * 0.3; a.update(dt); }
    this.fx.update(dt, this.time);
    this.applyCamera(dt);
    this.look.focus = this.camera.position.distanceTo(this.cam.target);
  }

  private stepLight(dt: number) {
    this.hour = new Date().getHours() + new Date().getMinutes() / 60;
    const n = nightAt(this.hour);
    this.night += (n - this.night) * Math.min(1, dt * 2);
    this.dim += (this.dimWant - this.dim) * Math.min(1, dt * 1.8);
    const day = 1 - this.night, d = this.dim;
    // moonlight (cool) by night, sunlight (warm) by day, through the window
    this.moon.color.setRGB(0.52 + day * 0.48, 0.64 + day * 0.28, 1.0 - day * 0.3);
    this.moon.intensity = (5.5 + day * 40) * (1 - d * 0.15);
    this.hemi.color.setRGB(0.5 + day * 0.4, 0.58 + day * 0.32, 0.8 + day * 0.1);
    this.hemi.intensity = (0.2 + day * 0.5) * (1 - d * 0.5);
    const flick = 1 + Math.sin(this.time * 7.3) * 0.015 + Math.sin(this.time * 17) * 0.01;
    this.lampLight.intensity = (2.4 + this.night * 0.8) * flick * (1 - d * 0.7);
    if (this.moonLamp) (this.moonLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 * (1 - d * 0.55);
    this.fairyLight.intensity = (0.9 + this.night * 0.6) * (1 - d * 0.35);
    if (this.bulbMat) this.bulbMat.color.setRGB(3.2, 2.3, 1.2).multiplyScalar(1 - d * 0.3);
    this.fill.intensity = (0.8 + day * 0.6) * (1 - d * 0.75);
    if (this.lanternLight) this.lanternLight.intensity = 1.6 * flick * (1 - d * 0.6);
    this.look.exposure = 1.04 + this.night * 0.12 - d * 0.18;
    this.look.warm = 0.2 + day * 0.05 - d * 0.1;
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.refit();
  }

  dispose() {
    document.body.style.cursor = '';
    for (const a of this.actors) { try { a.model.dispose(); } catch { /* */ } }
    for (const f of this.disposers) { try { f(); } catch { /* */ } }
    this.pmrem?.dispose();
    this.scene.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh || (me as unknown as THREE.InstancedMesh).isInstancedMesh) me.geometry?.dispose(); });
  }
}
