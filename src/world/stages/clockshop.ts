// The Clock screen's set: the furniture maker's corner of Barnaby's lodge, where the big carved cuckoo clock hangs on
// the board wall (cuckoo.ts builds the clock and puts this round it). Aged pine shiplap (the same photo-scanned wood as
// the clock, paler and greyer) between oak posts under a heavy beam, floorboards with sawdust and shavings, the tool
// board on the wall behind his bench, the timber rack, an enamel shop lamp hanging over
// the bench, and Barnaby himself at his workbench (workshop.ts: the bench and the plank in his own frame, his craft
// clips drive the plank, the shavings and the sawdust). He keeps the clock: he looks up when it calls, and when the
// player sets a time on its dial he glances over and gives a little nod of approval.
// The stage's frame: the wall is z = 0 (the clock's back), y up, the clock's case bottom at y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sound } from '../../audio/sound.ts';
import { Fx, SPR } from '../fx.ts';
import { Beaver, CRAFT, type WorkClip } from './beaver.ts';
import { M, contactShadow, mat, shavings } from './lodgekit.ts';
import * as K from './cuckookit.ts';
import { BOARD, CUT_X, MORTISE, Plank, sawdustPatch, timberRack, toolBoard, workbench } from './workshop.ts';

/** where things stand (metres, stage frame) */
export const SHOP = {
  floor: -1.3,
  beaver: { x: -1.62, z: 0.45, yaw: 0.42, scale: 1.06 },
  lamp: { x: -1.3, y: 0.52, z: 1.0 },
};
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class ClockShop {
  readonly group = new THREE.Group();
  readonly beaver = new Beaver();
  readonly ready: Promise<void>;
  /** the bulb's light (the stage sets its strength by day and night) */
  readonly lampLight = new THREE.PointLight(0xffcf94, 2.4, 5.5, 1.5);
  private pool = new THREE.SpotLight(0xffd8a4, 6, 4, 0.62, 0.75, 1.4);
  private bulb!: THREE.Mesh;
  private halo!: THREE.Sprite;
  private plank: Plank;
  private fx: Fx;
  private dead = false;
  private lookT = 0;
  private nextGlance = 6;
  private growing = false;
  private disposers: (() => void)[] = [];
  private camPos = new THREE.Vector3(0, 0, 6);
  private wallMat: THREE.MeshStandardMaterial | null = null;
  private beamMat: THREE.MeshStandardMaterial | null = null;

  constructor(fx: Fx) {
    this.fx = fx;
    const G = this.group;
    this.buildRoom();
    // ---- Barnaby at his bench, turned a little toward the clock
    const B = SHOP.beaver, b = this.beaver.node;
    b.position.set(B.x, SHOP.floor, B.z);
    b.rotation.y = B.yaw;
    b.scale.setScalar(B.scale);
    G.add(b);
    b.add(contactShadow(0.9, 0.8, 0.55));
    const bench = workbench();
    b.add(bench);
    this.plank = new Plank(b);
    this.beaver.onCraft = (clip, kind, data) => this.craftEvent(clip, kind, data);
    this.beaver.working = true;
    this.buildLamp();
    this.ready = this.beaver.ready;
  }

  // ---------------------------------------------------------------- the room

  private buildRoom() {
    const G = this.group, F = SHOP.floor;
    // the wall: horizontal shiplap boards, each its own piece (a hair proud or shy, lighter or darker), a dark
    // shadow line between them; oak posts either side and a heavy beam overhead frame the clock's corner
    const boards: K.Part[] = [], frame: K.Part[] = [];
    const rr = K.seeded(23), BH = 0.19;
    for (let y = F, i = 0; y < 3.4; y += BH, i++) boards.push({ geo: K.slab(10.4, BH - 0.007, 0.022, 0.0035), m: K.mtx((rr() - 0.5) * 0.4, y + BH / 2, -0.034 + (rr() - 0.5) * 0.004) });
    const gap = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 5), mat('ck_gap', () => new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 1 })));
    gap.position.set(0, F + 2.5, -0.046);
    G.add(gap);
    for (const x of [-4.05, 1.22]) frame.push({ geo: K.slab(0.16, 3.4 - F, 0.14, 0.012), m: K.mtx(x, (3.4 + F) / 2, -0.02) });
    frame.push({ geo: K.slab(10.4, 0.2, 0.18, 0.014), m: K.mtx(0, 1.86, 0.0) });
    const wallG = K.carveShade(K.merge(boards, 0.55), { lo: 0.72 });
    // a tone per board (vertex colours), so the boards read as separate pieces of old pine
    const col = wallG.attributes.color as THREE.BufferAttribute, pos = wallG.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < col.count; k++) { const row = Math.floor((pos.getY(k) - F + 0.003) / BH), t = 0.82 + K.seeded(row * 13 + 5)() * 0.26; col.setXYZ(k, col.getX(k) * t, col.getY(k) * t, col.getZ(k) * t); }
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0x8c7a6a, vertexColors: true, roughness: 0.78, envMapIntensity: 0.25 });
    this.beamMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, vertexColors: true, roughness: 0.66, envMapIntensity: 0.3 });
    const wall = new THREE.Mesh(wallG, this.wallMat);
    wall.receiveShadow = true;
    const beams = new THREE.Mesh(K.carveShade(K.merge(frame, 0.55), { lo: 0.5 }), this.beamMat);
    beams.receiveShadow = true; beams.castShadow = true;
    G.add(wall, beams);
    // the real wood scans, once they're in (the same ones as the clock's case)
    void K.realWood().then((src) => {
      if (!src || this.dead) return;
      const put = (m: THREE.MeshStandardMaterial, id: string, bright: number, tint: number) => {
        m.map = K.rtex(K.realWoodCanvas(src, id, bright, 512)); m.bumpMap = K.rtex(K.realBumpCanvas(src, K.REAL[id]?.tile ?? 1, 256), false); m.bumpScale = 1.4;
        m.color.setHex(tint); m.needsUpdate = true;
        this.disposers.push(() => { m.map?.dispose(); m.bumpMap?.dispose(); });
      };
      put(this.wallMat!, 'linden', -0.06, 0xc0ab98);
      put(this.beamMat!, 'oak', -0.12, 0xb69a82);
    });
    // floorboards
    const fg = new THREE.PlaneGeometry(10.4, 5);
    const uv = fg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 10.4 / 2, uv.getY(i) * 5 / 2);
    const floor = new THREE.Mesh(fg, M.floor());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, F, 2.3);
    floor.receiveShadow = true;
    G.add(floor);
    // a skirting board along the foot of the wall
    const sk = new THREE.Mesh(new RoundedBoxGeometry(10.4, 0.09, 0.05, 2, 0.012), M.boardDark());
    sk.position.set(0, F + 0.045, 0.0);
    sk.receiveShadow = true;
    G.add(sk);
    // the tool board behind his bench, the timber rack to the right of the clock
    const tb = toolBoard(2.7, 1.3, 0.95);
    tb.group.position.set(-2.45, F - 0.1, -0.01);
    G.add(tb.group);
    const tr = timberRack(2.6, 4);
    tr.position.set(2.55, F, -0.01);
    G.add(tr);
    // sawdust and shavings round the bench and under the clock (Barnaby oils its works here)
    for (const [x, z, s, rot] of [[-1.55, 1.05, 1.1, 0.4], [-0.75, 0.75, 0.7, 2.1], [-2.5, 0.95, 0.8, 1.3], [0.2, 0.55, 0.55, 0.7]] as [number, number, number, number][]) {
      const d = sawdustPatch(s, 0.75);
      d.position.set(x, F + 0.003, z);
      d.rotation.z = rot;
      G.add(d);
      this.disposers.push(() => d.geometry.dispose());
    }
    const sv = shavings([{ x: -1.3, z: 1.15, r: 0.45, n: 16 }, { x: -2.3, z: 0.9, r: 0.35, n: 10 }, { x: -0.6, z: 0.8, r: 0.3, n: 6 }], 17);
    sv.position.y = F;
    G.add(sv);
    this.disposers.push(() => sv.geometry.dispose());
  }

  /** An enamel shop lamp on a cloth cord over the bench: a deep green shade, white inside, a brass cap and a warm bulb. */
  private buildLamp() {
    const L = SHOP.lamp, G = new THREE.Group();
    G.position.set(L.x, L.y, L.z);
    const lathe = (pts: [number, number][], seg = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0.0005, x), y)), seg);
    const shadeOut = mat('ck_shade', () => new THREE.MeshStandardMaterial({ color: 0x2f5a44, roughness: 0.32, metalness: 0.1, envMapIntensity: 1.1 }));
    const shadeIn = mat('ck_shadeIn', () => new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.5, emissive: 0x6a4a20, emissiveIntensity: 0.45, side: THREE.BackSide }));
    const prof: [number, number][] = [[0.03, 0.1], [0.05, 0.085], [0.12, 0.035], [0.2, -0.02], [0.215, -0.035]];
    const out = new THREE.Mesh(lathe(prof), shadeOut);
    out.castShadow = true;
    const inn = new THREE.Mesh(lathe(prof.map(([x, y]) => [x - 0.004, y - 0.002] as [number, number])), shadeIn);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.213, 0.006, 6, 40).rotateX(Math.PI / 2).translate(0, -0.035, 0), M.brass());
    const cap = new THREE.Mesh(lathe([[0.0005, 0.16], [0.022, 0.158], [0.03, 0.13], [0.034, 0.1], [0.026, 0.095]], 16), M.brass());
    cap.castShadow = true;
    this.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 12).scale(1, 1.25, 1).translate(0, 0.02, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(2.6) }));
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 3.2, 6).translate(0, 0.16 + 1.6, 0), mat('ck_cord', () => new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 })));
    const haloTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.25, 'rgba(255,210,150,0.55)'); gr.addColorStop(1, 'rgba(255,180,110,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffc888, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.scale.setScalar(0.5);
    this.halo.position.set(0, -0.01, 0);
    G.add(out, inn, rim, cap, this.bulb, cord, this.halo);
    this.lampLight.position.set(0, -0.02, 0);
    G.add(this.lampLight);
    // a pool of light straight down onto the bench
    this.pool.position.set(0, 0.0, 0);
    this.pool.target.position.set(L.x - 0.05, SHOP.floor + 0.6, L.z - 0.1);
    this.group.add(this.pool.target);
    G.add(this.pool);
    this.group.add(G);
    this.disposers.push(() => { haloTex.dispose(); (this.halo.material as THREE.Material).dispose(); (this.bulb.material as THREE.Material).dispose(); for (const m of [out, inn, rim, cap, this.bulb, cord]) m.geometry.dispose(); });
  }

  // ---------------------------------------------------------------- Barnaby keeps the clock

  /** He looks at `p` for `sec` seconds (null: back to his work). */
  look(p: THREE.Vector3 | null, sec = 2.5) {
    this.beaver.lookAt = p ? p.clone() : null;
    this.lookT = p ? sec : 0;
  }
  /** The player set a time on the dial: a glance at the clock, a pleased face and a nod (a "there you go"). */
  approve(dial: THREE.Vector3) {
    this.look(dial, 3.2);
    this.beaver.setFace('happy', 2.2);
    this.beaver.play('present');
    const h = this.beaver.headWorld();
    this.fx.burst('sparkle', h.x + 0.1, h.y + 0.05, h.z + 0.1, 4);
  }
  /** The owl called from the clock: he looks up, a little surprised the first time. */
  heard(at: THREE.Vector3) {
    this.look(at, 2.6);
    if (Math.random() < 0.35) this.beaver.setFace('sparkly', 1.4);
  }
  /** where the camera is (he glances at the player now and then) */
  setCamera(p: THREE.Vector3) { this.camPos.copy(p); }

  // ---------------------------------------------------------------- the craft (as in the lodge: lodge.ts)

  private craftEvent(clip: WorkClip, kind: string, data: Record<string, number> | undefined) {
    const P = this.plank, fx = this.fx, w = (x: number, y: number, z: number) => P.world(x, y, z);
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    if (kind === 'sawdust') {
      P.sawdust();
      const p = w(CUT_X, BOARD.bottom, (BOARD.near + BOARD.far) / 2);
      for (let i = 0; i < 7; i++) fx.emit({ x: p.x, y: p.y, z: p.z, vx: R(-0.15, 0.15), vy: R(-0.1, 0.25), vz: R(-0.15, 0.2), life: R(0.6, 1.0), frame: SPR.crumb, color: [0xf0d9a8, 0xe2c08a, 0xd2a86c][i % 3], size: R(0.035, 0.055), gravity: 2.2, drag: 1.2, flutter: 0.2, land: true, delay: i * 0.025 });
      sound.play('paper_rustle', { volume: 0.06, rate: 0.62 + Math.random() * 0.1, gap: 150 });
    } else if (kind === 'offcut') {
      P.offcut();
      sound.play('wood_knock', { volume: 0.22, rate: 1.1, gap: 200 });
    } else if (kind === 'chop') {
      P.chop(data?.depth ?? 0.005);
      const p = w(MORTISE.x, BOARD.top + 0.01, MORTISE.z);
      sound.play('wood_knock', { volume: 0.18, rate: 1.4 + Math.random() * 0.2, gap: 80 });
      for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2; fx.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * R(0.2, 0.6), vy: R(0.5, 1.1), vz: Math.sin(a) * R(0.2, 0.6), life: R(0.6, 0.9), frame: SPR.crumb, color: [0xf0d6a0, 0xd8b078][i % 2], size: R(0.05, 0.08), gravity: 5, drag: 0.6, land: true }); }
    } else if (kind === 'dust') {
      const c = this.beaver.craft;
      const x = 0.1 + (c ? 0.075 * Math.sin(((c.t * 24 - 26) / 10) * Math.PI * 2) : 0);
      const p = w(x, BOARD.top + 0.01, (BOARD.near + BOARD.far) / 2);
      for (let i = 0; i < 3; i++) fx.emit({ x: p.x + R(-0.03, 0.03), y: p.y, z: p.z + R(-0.03, 0.03), vx: R(-0.08, 0.08), vy: R(0.06, 0.18), vz: R(0.02, 0.12), life: R(0.9, 1.4), frame: SPR.puff1, frames: 3, fps: 3, color: 0xf3e6c8, size: R(0.06, 0.1), grow: 0.8, drag: 1.5, fadeOut: 0.6, delay: i * 0.05 });
    } else if (kind === 'blow') {
      const h = this.beaver.headWorld();
      const p = w(0, BOARD.top + 0.02, (BOARD.near + BOARD.far) / 2);
      sound.play('wind_gust', { volume: 0.07, rate: 1.4, gap: 300 });
      for (let i = 0; i < 12; i++) fx.emit({ x: p.x + R(-0.35, 0.35), y: p.y + R(0, 0.06), z: p.z + R(-0.05, 0.05), vx: (p.x - h.x) * 0.4 + R(-0.2, 0.2), vy: R(0.1, 0.35), vz: (p.z - h.z) * 1.2 + R(0.2, 0.5), life: R(1.0, 1.6), frame: i % 3 ? SPR.puff1 : SPR.cloud2, frames: i % 3 ? 3 : 1, fps: 3, color: 0xf0e2c2, size: R(0.08, 0.16), grow: 1.4, drag: 1.6, fadeOut: 0.7, delay: i * 0.02 });
      setTimeout(() => { if (!this.dead) P.freshIfShort(); }, 250);
    }
  }
  private craftTick() {
    const P = this.plank, c = this.beaver.craft;
    if (!c) { if (this.growing) { P.releaseShaving(); this.growing = false; } return; }
    const ev = (kind: string) => CRAFT[c.clip].ev.filter((e) => e[1] === kind);
    const prog = (t0: number, t1: number) => THREE.MathUtils.clamp((c.t - t0) / Math.max(1e-3, t1 - t0), 0, 1);
    const sm = (x: number) => x * x * (3 - 2 * x);
    if (c.clip === 'measure') {
      for (const [t0, , d] of ev('slide')) if (c.t >= t0) P.slide(sm(prog(t0, d!.t1)));
      for (const [t0, , d] of ev('line')) if (c.t >= t0) P.drawLine(sm(prog(t0, d!.t1)));
    } else if (c.clip === 'saw') {
      for (const [t0, , d] of ev('kerf')) if (c.t >= t0 && c.t < d!.t1) P.kerf(Math.min(1, sm(prog(t0, d!.t1)) * 1.23));
    } else if (c.clip === 'plane') {
      let on = false;
      for (const [t0, , d] of ev('stroke')) if (c.t >= t0 && c.t < d!.t1) { const k = prog(t0, d!.t1); P.shaving(d!.x0 + (d!.x1 - d!.x0) * sm(k), k); on = true; }
      if (!on && this.growing) P.releaseShaving();
      this.growing = on;
    }
  }

  /** the lamp's share of the light (0 by day .. 1 at night) */
  setNight(n: number) {
    this.lampLight.intensity = 1.5 + n * 1.6;
    this.pool.intensity = 4 + n * 5;
  }

  update(dt: number, t: number) {
    if (this.dead) return;
    if (this.lookT > 0) { this.lookT -= dt; if (this.lookT <= 0) this.beaver.lookAt = null; }
    else if ((this.nextGlance -= dt) <= 0) {
      // now and then he looks up from his work at the player
      this.nextGlance = 9 + Math.random() * 9;
      this.look(this.camPos, 1.6 + Math.random());
    }
    this.beaver.update(dt);
    this.craftTick();
    this.plank.update(dt);
    // the bulb hums: the faintest flicker, the lamp sways a hair on its cord
    const f = 1 + Math.sin(t * 13.1) * 0.012 + Math.sin(t * 2.7) * 0.02;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.5 * f;
    const lamp = this.lampLight.parent!;
    lamp.rotation.z = Math.sin(t * 0.6) * 0.012;
    lamp.rotation.x = Math.sin(t * 0.43 + 1) * 0.008;
  }

  dispose() {
    this.dead = true;
    this.plank.dispose();
    this.beaver.dispose();
    for (const d of this.disposers) d();
    this.wallMat?.dispose(); this.beamMat?.dispose();
    // the shop's code-built geometry (the borrowed GLB shares its own with the cache)
    const own = new Set<THREE.BufferGeometry>();
    this.group.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.geometry && !(m as THREE.SkinnedMesh).isSkinnedMesh) own.add(m.geometry); });
    for (const g of own) g.dispose();
  }
}
