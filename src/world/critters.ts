// Small life: butterflies drifting between flower drifts, birds that hop and scatter (BUSHED's rigged
// songbird), koi under the pond surface, dragonflies over it, and the ambient particle emitters.
import * as THREE from 'three';
import type { Rig } from '../gfx/box.ts';
import * as K from './critterkit.ts';
import { Swarm } from './critterkit.ts';
import { instanceGLB } from '../gfx/glb.ts';
import { ramp, tone } from '../gfx/color.ts';
import { smooth, solid } from '../gfx/mats.ts';
import type { Fx } from './fx.ts';
import { SPR } from './fx.ts';
import type { ForestPlan } from './flora.ts';
import { POND } from './layout.ts';
import { SURFACE_Y, surfaceY as groundY } from './terrain.ts';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** [look4] Proxy rigs: invisible nodes the critter logic moves; critterkit's Swarms draw the shaped models there. */
const proxy = () => new THREE.Group();
interface Parts { flyBody: THREE.Object3D[]; flyWing: THREE.Object3D[]; wingCols: THREE.Color[]; koiBody: THREE.Object3D[]; koiTail: THREE.Object3D[]; koiCols: [THREE.Color, THREE.Color][]; dfBody: THREE.Object3D[]; dfWing: THREE.Object3D[] }
function butterfly(c: string, parts: Parts): Rig {
  const root = proxy(), body = proxy(), wingL = proxy(), wingR = proxy(), l = proxy(), r = proxy();
  root.scale.setScalar(2.6);
  root.add(body, wingL, wingR);
  wingL.position.set(-0.003, 0.004, 0.006); wingR.position.set(0.003, 0.004, 0.006);
  l.scale.set(-1, 1, 1); wingL.add(l); wingR.add(r);
  parts.flyBody.push(body); parts.flyWing.push(l, r);
  const col = new THREE.Color(c);
  parts.wingCols.push(col, col);
  return { root, bones: { root, wingL, wingR } } as unknown as Rig;
}
/** [world3] BUSHED's rigged songbird (CC BY 4.0 "Robin Bird" by Assets_Animated, rebuilt and repainted by
 *  BUSHED; see docs/credits/world3.md) with its idle, eat, fly and glide clips; odd birds wear the jay coat. */
interface SongBird { rig: Rig; mixer: THREE.AnimationMixer; act: Record<string, THREE.AnimationAction>; cur: string }
async function songbird(coat: number): Promise<SongBird | null> {
  try {
    const { root: model, clips } = await instanceGLB('world/songbird.glb');
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const k = 0.42 / Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(k);
    model.position.y -= box.min.y * k;
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true;
      if (coat) { const t = coatTex(); mat.map = t; }
      m.material = mat;
    });
    const root = new THREE.Group();
    root.add(model);
    const mixer = new THREE.AnimationMixer(model), act: Record<string, THREE.AnimationAction> = {};
    for (const c of clips) act[c.name] = mixer.clipAction(c);
    const dummy = new THREE.Group();
    const rig = { root, bones: { root, wingL: dummy, wingR: dummy.clone() }, dispose() { mixer.stopAllAction(); } } as unknown as Rig;
    act.idle2?.play();
    return { rig, mixer, act, cur: 'idle2' };
  } catch { return null; }
}
let coatT: THREE.Texture | null = null;
function coatTex() {
  if (coatT) return coatT;
  coatT = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/bushed/coat_jay.webp`);
  coatT.colorSpace = THREE.SRGBColorSpace; coatT.flipY = false;
  return coatT;
}
function koiFish(c: number, patch: number, parts: Parts): Rig {
  const root = proxy(), body = proxy(), tail = proxy();
  tail.position.z = -0.15;
  root.add(body, tail);
  parts.koiBody.push(body); parts.koiTail.push(tail);
  parts.koiCols.push([new THREE.Color(c), new THREE.Color(patch)]);
  return { root, bones: { root, tail } } as unknown as Rig;
}
function dragonfly(parts: Parts): Rig {
  const root = proxy(), body = proxy(), wingL = proxy(), wingR = proxy(), l = proxy(), r = proxy();
  root.add(body, wingL, wingR);
  wingL.position.set(-0.004, 0.012, 0.01); wingR.position.set(0.004, 0.012, 0.01);
  l.scale.set(-1, 1, 1); wingL.add(l); wingR.add(r);
  parts.dfBody.push(body); parts.dfWing.push(l, r);
  return { root, bones: { root, wingL, wingR } } as unknown as Rig;
}

interface Flyer { rig: Rig; pos: THREE.Vector3; vel: THREE.Vector3; goal: THREE.Vector3; t: number; flap: number; kind: 'butterfly' | 'bee' }
interface Bird { rig: Rig; pos: THREE.Vector3; home: THREE.Vector3; state: 'perch' | 'flee' | 'away' | 'return'; t: number; from: THREE.Vector3; to: THREE.Vector3; yaw: number; hop: number; song?: SongBird }

export class Critters {
  readonly group = new THREE.Group();
  private flyers: Flyer[] = [];
  private birds: Bird[] = [];
  private fish: { rig: Rig; a: number; r: number; speed: number; depth: number; jump: number; wait: number }[] = [];
  private flies: { rig: Rig; pos: THREE.Vector3; goal: THREE.Vector3; t: number; hover: number }[] = [];
  private bugs: { mesh: THREE.Object3D; a: number }[] = [];
  private acc = { leaf: 0, mote: 0, fly: 0, gust: 0 };
  // [world] seasons and weather
  /** falling-leaf rate multiplier and colours (null = each tree's own colour) */
  private leafRate = 1;
  private leafCols: number[] | null = null;
  private petals = false;
  private winter = false;
  /** rain or snow: butterflies, bees and dragonflies take cover, dust motes settle */
  shelter = false;
  /** glow-bugs at night (not in winter or rain) */
  fireflies = true;

  private swarms: Swarm[] = [];
  private proxies = new THREE.Group();
  constructor(private plan: ForestPlan, private fx: Fx, quality: 'low' | 'high', private sound: (id: string, at?: THREE.Vector3) => void) {
    const parts: Parts = { flyBody: [], flyWing: [], wingCols: [], koiBody: [], koiTail: [], koiCols: [], dfBody: [], dfWing: [] };
    // [world3] calm palette: terracotta, lake, honey, rose, lilac and paper wings
    const cols = ['#c0866a', '#86a9b0', '#dcb072', '#d9aca4', '#b4a9c9', '#f4eedd'];
    const nFly = quality === 'high' ? 7 : 4;
    for (let i = 0; i < nFly; i++) {
      const isBee = false;
      const rig = butterfly(cols[i % cols.length], parts);
      const f = pick(plan.flowers);
      const pos = new THREE.Vector3(f.x + rand(-1, 1), rand(0.8, 1.6), f.z + rand(-1, 1));
      this.proxies.add(rig.root);
      this.flyers.push({ rig, pos, vel: new THREE.Vector3(), goal: pos.clone(), t: rand(0, 3), flap: rand(0, 6), kind: isBee ? 'bee' : 'butterfly' });
    }
    plan.perches.slice(0, quality === 'high' ? 4 : 2).forEach((p, i) => {
      // [world3] BUSHED's rigged songbird; nothing shows until it has loaded
      const holder = new THREE.Group(), dummy = new THREE.Group();
      const rig = { root: holder, bones: { root: holder, wingL: dummy, wingR: dummy }, dispose() { /* empty */ } } as unknown as Rig;
      const b: Bird = { rig, pos: p.clone(), home: p.clone(), state: 'perch', t: rand(1, 4), from: p.clone(), to: p.clone(), yaw: rand(0, 6.28), hop: 0 };
      this.birds.push(b);
      void songbird(i % 2).then((sb) => {
        if (!sb) return;
        sb.rig.root.position.copy(holder.position); sb.rig.root.rotation.copy(holder.rotation);
        b.rig = sb.rig; b.song = sb;
        this.group.add(sb.rig.root);
      });
    });
    const koiCols = ['#c0866a', '#dcb072', '#a66c55', '#eae0c8', '#c59a52', '#9e5f66', '#46596a', '#c0866a'];
    for (let i = 0; i < (quality === 'high' ? 8 : 5); i++) {
      const rig = koiFish(new THREE.Color(koiCols[i]).getHex(), i % 3 ? 0xeae0c8 : 0x2e2b24, parts);
      this.proxies.add(rig.root);
      this.fish.push({ rig, a: rand(0, 6.28), r: rand(0.25, 0.72), speed: rand(0.22, 0.5) * (i % 2 ? 1 : -1), depth: rand(0.18, 0.42), jump: -1, wait: rand(6, 20) });
    }
    // dragonflies: long thin bodies, glassy wings, darting between hover points over the water
    for (let i = 0; i < (quality === 'high' ? 3 : 2); i++) {
      const rig = dragonfly(parts);
      this.proxies.add(rig.root);
      const p = new THREE.Vector3(POND.x + rand(-2, 2), SURFACE_Y + rand(0.8, 1.4), POND.z + rand(-1.5, 1.5));
      this.flies.push({ rig, pos: p, goal: p.clone(), t: rand(0, 2), hover: rand(0, 6) });
    }
    // [look4] the shaped models: one draw call per part for every animal of a kind
    this.proxies.visible = true;
    this.group.add(this.proxies);
    const sw = (geo: THREE.BufferGeometry, mat: THREE.Material, nodes: THREE.Object3D[], name: string) => { const s = new Swarm(geo, mat, nodes, name); this.swarms.push(s); this.group.add(s.mesh); return s; };
    const wings = sw(K.butterflyWing(), K.butterflyWingMaterial(), parts.flyWing, 'butterfly-wings');
    parts.wingCols.forEach((c, i) => wings.mesh.setColorAt(i, c));
    sw(K.butterflyBody(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), parts.flyBody, 'butterflies');
    const koiMat = K.koiMaterial();
    const body = sw(K.koiBody(), koiMat, parts.koiBody, 'koi'), tail = sw(K.koiTail(), koiMat, parts.koiTail, 'koi-tails');
    const patch = new Float32Array(Math.max(1, parts.koiCols.length) * 3);
    parts.koiCols.forEach(([c, p], i) => { body.mesh.setColorAt(i, c); tail.mesh.setColorAt(i, c); patch.set([p.r, p.g, p.b], i * 3); });
    body.mesh.geometry.setAttribute('iPatch', new THREE.InstancedBufferAttribute(patch, 3));
    tail.mesh.geometry.setAttribute('iPatch', new THREE.InstancedBufferAttribute(patch.slice(), 3));
    sw(K.dragonflyBody(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25 }), parts.dfBody, 'dragonflies');
    sw(K.dragonflyWings(), K.dragonflyWingMaterial(), parts.dfWing, 'dragonfly-wings');
  }

  /** [world] Seasonal life: autumn leaf fall, spring petals, no butterflies in winter. */
  setSeason(s: 'spring' | 'summer' | 'autumn' | 'winter', t = 0.5) {
    this.winter = s === 'winter';
    this.petals = s === 'spring';
    this.leafRate = s === 'autumn' ? 2.6 + t * 1.6 : s === 'spring' ? 0.9 : s === 'summer' ? 0.45 : 0;
    this.leafCols = s === 'autumn' ? [0xc59a52, 0xb0703f, 0xd0a860, 0x9c6a42, 0xa66c55, 0x8a8a4a] : s === 'spring' ? [0xe8b4ae, 0xf4eedd, 0xd9aca4, 0xa7b788] : null;
  }

  /** [world3] Cross-fade a songbird to a clip. */
  private clip(sb: SongBird, name: string) {
    if (sb.cur === name || !sb.act[name]) return;
    const next = sb.act[name], prev = sb.act[sb.cur];
    next.reset().play();
    if (name === 'eat') { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
    if (prev) next.crossFadeFrom(prev, 0.25, false);
    sb.cur = name;
  }

  /** The nearest butterfly, for animals that feel like chasing one. */
  nearestButterfly(p: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null, bd = 9;
    for (const f of this.flyers) { const d = f.pos.distanceTo(p); if (f.kind === 'butterfly' && d < bd) { bd = d; best = f.pos; } }
    return best;
  }

  update(dt: number, t: number, animals: THREE.Vector3[], night: number, windX: number, windZ: number, gust: number) {
    const day = night < 0.5;
    const out = day && !this.shelter && !this.winter;
    for (const f of this.flyers) {
      f.rig.root.visible = out;
      if (!out) continue;
      f.t -= dt;
      const scared = animals.find((a) => a.distanceTo(f.pos) < 1.3);
      if (f.t <= 0 || scared) {
        const fl = pick(this.plan.flowers);
        f.goal.set(fl.x + rand(-1.4, 1.4), rand(0.7, f.kind === 'bee' ? 1.2 : 2.3), fl.z + rand(-1.4, 1.4));
        if (scared) f.goal.set(f.pos.x + (f.pos.x - scared.x) * 3, 2.6, f.pos.z + (f.pos.z - scared.z) * 3);
        f.t = rand(2.5, 6);
      }
      const sp = f.kind === 'bee' ? 2.2 : 1.3;
      f.vel.lerp(f.goal.clone().sub(f.pos).clampLength(0, sp), Math.min(1, dt * 2));
      f.pos.addScaledVector(f.vel, dt);
      f.flap += dt * (f.kind === 'bee' ? 60 : 16);
      const bob = f.kind === 'bee' ? Math.sin(t * 9 + f.flap) * 0.04 : Math.sin(f.flap) * 0.09;
      f.rig.root.position.set(f.pos.x, Math.max(groundY(f.pos.x, f.pos.z) + 0.4, f.pos.y) + bob, f.pos.z);
      if (f.vel.lengthSq() > 0.01) f.rig.root.rotation.y = Math.atan2(f.vel.x, f.vel.z);
      const w = f.kind === 'bee' ? Math.sin(f.flap) * 0.5 : Math.abs(Math.sin(f.flap)) * 1.25 - 0.2;
      f.rig.bones.wingL.rotation.z = -w; f.rig.bones.wingR.rotation.z = w;
    }

    for (const b of this.birds) {
      b.t -= dt;
      const near = animals.some((a) => a.distanceTo(b.pos) < 1.9);
      if (b.state === 'perch') {
        if (near) {
          b.state = 'flee'; b.t = 1.6; b.from.copy(b.pos);
          const a = Math.atan2(b.pos.z, b.pos.x) + rand(-0.5, 0.5);
          b.to.set(Math.cos(a) * 15, 6.5, Math.sin(a) * 15);
          this.sound('bird_flap', b.pos);
        } else if (b.t <= 0) { b.t = rand(1.2, 4); b.yaw += rand(-1.4, 1.4); b.hop = 0.25; if (Math.random() < 0.3 && day) this.sound('bird_chirp', b.pos); }
        b.hop = Math.max(0, b.hop - dt);
        b.rig.root.position.set(b.pos.x, b.pos.y + Math.sin((b.hop / 0.25) * Math.PI) * 0.14, b.pos.z);
        b.rig.bones.wingL.rotation.z = b.rig.bones.wingR.rotation.z = 0;
        if (b.song && b.hop > 0.2 && Math.random() < 0.4) this.clip(b.song, 'eat');
        else if (b.song && b.song.cur !== 'eat') this.clip(b.song, 'idle2');
      } else if (b.state === 'flee' || b.state === 'return') {
        const len = b.state === 'flee' ? 1.6 : 2.2, k = 1 - Math.max(0, b.t) / len, e = k * k * (3 - 2 * k);
        b.pos.lerpVectors(b.from, b.to, e); b.pos.y += Math.sin(k * Math.PI) * 1.6;
        b.yaw = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
        const w = Math.sin(t * 28) * 1.1;
        b.rig.bones.wingL.rotation.z = -w - 0.3; b.rig.bones.wingR.rotation.z = w + 0.3;
        b.rig.root.position.copy(b.pos);
        if (b.song) this.clip(b.song, k > 0.8 && b.state === 'return' ? 'glide' : 'fly');
        if (b.t <= 0) { if (b.state === 'flee') { b.state = 'away'; b.t = rand(6, 14); } else { b.state = 'perch'; b.t = 2; b.pos.copy(b.home); } }
      } else if (b.t <= 0 && !animals.some((a) => a.distanceTo(b.home) < 2.5)) { b.state = 'return'; b.t = 2.2; b.from.copy(b.pos); b.to.copy(b.home); }
      b.rig.root.rotation.y = b.yaw;
      b.rig.root.visible = b.state !== 'away';
      if (b.song) { b.song.mixer.update(dt); if (b.song.cur === 'eat' && (b.song.act.eat?.time ?? 0) > (b.song.act.eat?.getClip().duration ?? 1) * 0.95) this.clip(b.song, 'idle2'); }
    }

    for (const f of this.fish) {
      f.a += f.speed * dt;
      const x = POND.x + Math.cos(f.a) * POND.rx * f.r, z = POND.z + Math.sin(f.a) * POND.rz * f.r;
      const yaw = Math.atan2(-Math.sin(f.a) * POND.rx * Math.sign(f.speed), Math.cos(f.a) * POND.rz * Math.sign(f.speed));
      let y = SURFACE_Y - f.depth, pitch = 0;
      // now and then a fish leaps clear of the water in an arc and splashes back in
      if (f.jump < 0 && (f.wait -= dt) <= 0 && day) { f.jump = 0; this.fx.burst('splash', x, SURFACE_Y + 0.05, z, 6); this.fx.ripple(x, SURFACE_Y, z); this.sound('water_plop', new THREE.Vector3(x, SURFACE_Y, z)); }
      if (f.jump >= 0) {
        f.jump += dt / 0.85;
        const k = Math.min(1, f.jump);
        y = SURFACE_Y - 0.1 + Math.sin(k * Math.PI) * 0.9; pitch = (0.5 - k) * 2.2;
        if (f.jump >= 1) { f.jump = -1; f.wait = rand(10, 28); this.fx.burst('splash', x, SURFACE_Y + 0.05, z, 8); this.fx.ripple(x, SURFACE_Y, z); this.sound('water_plop', new THREE.Vector3(x, SURFACE_Y, z)); }
      } else if (Math.random() < dt * 0.15) this.fx.ripple(x, SURFACE_Y, z);
      f.rig.root.position.set(x, y, z);
      f.rig.root.rotation.set(pitch, yaw, 0, 'YXZ');
      f.rig.bones.tail.rotation.y = Math.sin(t * (f.jump >= 0 ? 16 : 6) + f.a) * 0.6;
    }
    for (const d of this.flies) {
      d.rig.root.visible = out;
      if (!out) continue;
      d.t -= dt;
      if (d.t <= 0) {
        d.t = rand(0.8, 2.6);
        d.goal.set(POND.x + rand(-POND.rx, POND.rx) * 1.1, SURFACE_Y + rand(0.5, 1.6), POND.z + rand(-POND.rz, POND.rz) * 1.1);
      }
      // dart quickly, then hang almost still
      const to = d.goal.clone().sub(d.pos), dist = to.length();
      if (dist > 0.05) { d.pos.addScaledVector(to, Math.min(1, dt * 6)); d.rig.root.rotation.y = Math.atan2(to.x, to.z); }
      d.hover += dt;
      d.rig.root.position.set(d.pos.x, d.pos.y + Math.sin(d.hover * 3) * 0.03, d.pos.z);
      const w = Math.sin(t * 70 + d.hover) * 0.5;
      d.rig.bones.wingL.rotation.z = -w; d.rig.bones.wingR.rotation.z = w;
    }

    // [look4] copy the proxies into the instanced models
    this.proxies.updateMatrixWorld(true);
    for (const sw of this.swarms) sw.sync();

    // ---- ambient particles
    const fx = this.fx, a = this.acc;
    if (this.leafRate > 0 && (a.leaf -= dt) <= 0 && this.plan.leafSources.length) {
      a.leaf = rand(0.18, 0.5) / (0.6 + gust * 3) / this.leafRate;
      const s = pick(this.plan.leafSources), ang = rand(0, 6.28), d = Math.sqrt(Math.random()) * s.r, pink = s.color === 0xe2bab8 || (this.petals && Math.random() < 0.5);
      const c = this.leafCols ? pick(this.leafCols) : s.color;
      fx.emit({ x: s.x + Math.cos(ang) * d, y: s.y + rand(-0.8, 0.6), z: s.z + Math.sin(ang) * d, vy: -0.25, life: rand(6, 9), frame: pink ? SPR.petal : SPR.leaf1, frames: pink ? 1 : 3, fps: 3.5, size: rand(0.26, 0.4), color: c, gravity: 0.32, drag: 0.7, wind: 0.9, flutter: 0.7, land: true, fadeOut: 1.2 });
    }
    if (out && (a.mote -= dt) <= 0) {
      a.mote = 0.16;
      fx.emit({ x: rand(-9, 9), y: rand(0.4, 3.4), z: rand(-8, 7), vy: rand(0.03, 0.14), life: rand(4, 7), frame: SPR.mote, size: rand(0.12, 0.2), color: 0xf1d39a, wind: 0.25, flutter: 0.15, add: true, fadeIn: 1.2, fadeOut: 1.4 });
    }
    if (night > 0.4 && this.fireflies && (a.fly -= dt) <= 0) {
      a.fly = 0.14;
      const x = rand(-11, 11), z = rand(-10, 9);
      fx.emit({ x, y: groundY(x, z) + rand(0.35, 2.4), z, vx: rand(-0.2, 0.2), vy: rand(-0.05, 0.12), vz: rand(-0.2, 0.2), life: rand(2.6, 4.6), frame: SPR.glow, size: rand(0.16, 0.24), color: Math.random() < 0.6 ? 0xf1d39a : 0xd8dca0, flutter: 0.35, add: true, fadeIn: 0.9, fadeOut: 1.1 });
    }
    if (gust > 0.115 && (a.gust -= dt) <= 0) {
      a.gust = rand(0.15, 0.4);
      fx.emit({ x: rand(-11, 6), y: rand(0.5, 2.6), z: rand(-8, 7), vx: windX * 5.5, vz: windZ * 5.5, life: 0.9, frame: SPR.streak, size: rand(0.5, 0.9), color: 0xdfe9ea, fadeIn: 0.25, fadeOut: 0.5 });
    }
  }
}
