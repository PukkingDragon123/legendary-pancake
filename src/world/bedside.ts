// Bedtime in Pip's real house (world/scene.ts): he hops onto his own bed in his living room, the one the player has
// furnished, and the little moments happen right there beside him. A small oak "phone bed" (felt lining, a hinged lid,
// a brass hasp) appears at his side with the phone lit on top; the phone slides in face down, the lid shuts, a padlock
// drops onto the hasp and Pip turns the key with his beak. Then the trail backpack goes on with a spin and a puff.
// Props are built at the bedroom's proportions and scaled to Pip's size in the world; tweens run on scene.tickers.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { OwlLook } from '../owl/model.ts';
import { at, Batch, bbox, cyl } from '../onboard/kit.ts';
import { texCanvas } from '../ui/real/tex.ts';
import type { Scene } from './scene.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
/** Pip's height in the bedroom these props were made for (metres) */
const PIP_REF = 0.7;

function phoneTex(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 180; c.height = 360;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#3a4fa0'); gr.addColorStop(1, '#1b1f4a');
  g.fillStyle = gr; g.fillRect(0, 0, 180, 360);
  g.fillStyle = '#fff'; g.font = '700 44px sans-serif'; g.textAlign = 'center';
  const d = new Date(); g.fillText(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`, 90, 78);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = 'rgba(255,255,255,.86)'; g.fillRect(14, 120 + i * 62, 152, 50);
    g.fillStyle = ['#e5534b', '#4a8af4', '#f2b134'][i]; g.fillRect(24, 132 + i * 62, 26, 26);
    g.fillStyle = 'rgba(30,30,50,.5)'; g.fillRect(58, 136 + i * 62, 90, 7); g.fillRect(58, 150 + i * 62, 64, 6);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function photo(n: 'oak' | 'felt', tint?: string) {
  const c = texCanvas(n, tint);
  if (!c) return undefined;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

export class Bedside {
  private root = new THREE.Group();
  private phone = new THREE.Group();
  private box = new THREE.Group();
  private lid = new THREE.Group();
  private lock = new THREE.Group();
  private shackle = new THREE.Group();
  private key = new THREE.Group();
  private screen: THREE.MeshBasicMaterial;
  private tweens: ((dt: number) => boolean)[] = [];
  private tick = (dt: number) => { for (let i = this.tweens.length - 1; i >= 0; i--) if (this.tweens[i](dt)) this.tweens.splice(i, 1); };
  private disposables: { dispose(): void }[] = [];

  constructor(private scene: Scene) {
    const mat = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.6, ...o }); this.disposables.push(m); return m; };
    const oak = mat({ map: photo('oak'), color: photo('oak') ? 0xffffff : 0xb8864a, roughness: 0.55 });
    const felt = mat({ map: photo('felt', '#2c5a40'), roughness: 1 });
    const brass = mat({ color: 0xd9ae58, metalness: 0.9, roughness: 0.3 });
    const chrome = mat({ color: 0xd8dde2, metalness: 1, roughness: 0.2 });
    const black = mat({ color: 0x14110f, roughness: 0.18, metalness: 0.1 });
    // the phone, lit
    this.phone.add(new THREE.Mesh(bbox(0.075, 0.009, 0.15, { r: 0.006 }), black));
    this.screen = new THREE.MeshBasicMaterial({ map: phoneTex(), toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) });
    this.disposables.push(this.screen, this.screen.map!);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138).rotateX(-Math.PI / 2), this.screen); scr.position.y = 0.0095; this.phone.add(scr);
    this.phone.scale.setScalar(1.3);
    // its bed: an oak box with a felt lining, a hinged lid, a brass hasp and staple
    const bx = new Batch(), bw = 0.12, bh = 0.06, bd = 0.2;
    bx.add(oak, at(bbox(bw, 0.012, bd, { r: 0.003 }), 0, 0, 0));
    bx.add(oak, at(bbox(0.012, bh, bd, { r: 0.003 }), -bw / 2 + 0.006, 0, 0)); bx.add(oak, at(bbox(0.012, bh, bd, { r: 0.003 }), bw / 2 - 0.006, 0, 0));
    bx.add(oak, at(bbox(bw, bh, 0.012, { r: 0.003 }), 0, 0, -bd / 2 + 0.006)); bx.add(oak, at(bbox(bw, bh, 0.012, { r: 0.003 }), 0, 0, bd / 2 - 0.006));
    bx.add(felt, at(bbox(bw - 0.026, 0.004, bd - 0.026), 0, 0.012, 0));
    bx.add(brass, at(bbox(0.016, 0.022, 0.004, { r: 0.002 }), 0, bh - 0.03, bd / 2 + 0.002));
    bx.add(brass, at(new THREE.TorusGeometry(0.008, 0.0022, 8, 16), 0, bh - 0.022, bd / 2 + 0.006));
    this.box.add(bx.build('phonebox'));
    const lb = new Batch();
    lb.add(oak, at(bbox(bw + 0.004, 0.014, bd + 0.004, { r: 0.004 }), 0, 0, bd / 2));
    lb.add(brass, at(bbox(0.018, 0.004, 0.03, { r: 0.002 }), 0, 0.012, bd - 0.004));
    lb.add(brass, at(bbox(0.018, 0.034, 0.004, { r: 0.002 }), 0, -0.022, bd + 0.009));
    this.lid.add(lb.build('lid'));
    this.lid.position.set(0, bh, -bd / 2);
    this.lid.rotation.x = -1.9;
    this.box.add(this.lid);
    // the padlock and its key, waiting out of sight
    this.lock.add(new THREE.Mesh(bbox(0.036, 0.032, 0.014, { r: 0.006, center: true }), brass));
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 10).rotateX(Math.PI / 2), black); hole.position.set(0, -0.004, 0.0075); this.lock.add(hole);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0032, 10, 24, Math.PI), chrome); sh.position.y = 0.016;
    const legL = new THREE.Mesh(cyl(0.0032, 0.012, 8), chrome); legL.position.set(-0.012, 0.004, 0);
    const legR = new THREE.Mesh(cyl(0.0032, 0.02, 8), chrome); legR.position.set(0.012, -0.004, 0);
    this.shackle.add(sh, legL, legR);
    this.shackle.position.y = 0.014;
    this.lock.add(this.shackle);
    const kb = new Batch();
    kb.add(brass, at(new THREE.TorusGeometry(0.008, 0.0025, 8, 18), 0, 0, 0.026, Math.PI / 2));
    kb.add(brass, at(cyl(0.0018, 0.018, 8).rotateX(Math.PI / 2), 0, 0, 0));
    kb.add(brass, at(bbox(0.004, 0.006, 0.003), 0.002, -0.004, 0.004));
    this.key.add(kb.build('key'));
    this.key.position.set(0, -0.004, 0.006);
    this.key.visible = false;
    this.lock.add(this.key);
    this.lock.visible = false;
    this.box.add(this.lock);
    this.box.scale.setScalar(1.5);
    this.root.add(this.box, this.phone);
    this.root.visible = false;
    this.root.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = true; } });
    scene.scene.add(this.root);
    scene.tickers.add(this.tick);
  }

  private wait(sec: number) { return new Promise<void>((r) => setTimeout(r, sec * 1000)); }
  private tween(sec: number, f: (k: number) => void): Promise<void> {
    return new Promise((res) => { let t = 0; this.tweens.push((dt) => { t += dt; const k = Math.min(1, t / sec); f(k); if (k >= 1) { res(); return true; } return false; }); });
  }
  /** Pip's height in world units */
  private pipH() { const o = this.scene.owl; return o.height * o.node.scale.y; }

  /** Pip on his own bed, awake and a little sleepy. Resolves when he is there. */
  goToBed(): Promise<void> {
    const sc = this.scene;
    return new Promise((res) => {
      const done = () => { sc.owl.pose = 'stand'; sc.owl.setMood('sleepy'); res(); };
      try { if (sc.owlPlace === 'bed') done(); else sc.moveOwl('bed', done); } catch { done(); }
      setTimeout(done, 4000);
    });
  }

  /** The phone goes to bed: it appears beside Pip, slides into its box, the lid shuts, the padlock clicks. */
  async playLock() {
    const sc = this.scene, owl = sc.owl, k = this.pipH() / PIP_REF;
    // beside Pip, on the camera's side of him, turned to the camera
    const cam = sc.camera.position, p = owl.node.position.clone();
    const toCam = cam.clone().sub(p).setY(0).normalize(), right = V(toCam.z, 0, -toCam.x);
    this.root.position.copy(p).addScaledVector(right, 0.42 * k).addScaledVector(toCam, 0.22 * k);
    this.root.rotation.y = Math.atan2(toCam.x, toCam.z) + 0.15;
    this.root.scale.setScalar(k);
    this.phone.position.set(0.2, 0, 0.16); this.phone.rotation.set(0, 0.35, 0);
    this.lid.rotation.x = -1.9; this.lock.visible = false; this.key.visible = false; this.shackle.position.y = 0.014; this.key.rotation.z = 0;
    this.root.visible = true;
    const boxW = this.box.getWorldPosition(V());
    sc.fx.burst('puffs', boxW.x, boxW.y + 0.05 * k, boxW.z, 6);
    sound.play('pop_puff', { volume: 0.35 });
    owl.node.rotation.y = Math.atan2(boxW.x - p.x, boxW.z - p.z);
    owl.lookAt = boxW.clone();
    owl.setMood('determined', 3);
    await this.wait(0.5);
    owl.play('peck');
    sound.play('ui_drag', { volume: 0.35 });
    const from = this.phone.position.clone(), r0 = this.phone.rotation.clone();
    await this.tween(0.75, (t) => {
      const e = smooth(t);
      this.phone.position.set(from.x * (1 - e), Math.sin(t * Math.PI) * 0.14 + 0.044 * e, from.z * (1 - e));
      this.phone.rotation.set(r0.x + Math.PI * e, r0.y * (1 - e), 0);
      this.screen.color.setScalar(0.9 * (1 - e));
    });
    sound.play('place_soft', { volume: 0.45 });
    await this.wait(0.15);
    sound.play('drawer_close', { volume: 0.4, rate: 1.3 });
    await this.tween(0.35, (t) => { this.lid.rotation.x = -1.9 * (1 - t * t); });
    const lp = V(0, 0.026, 0.115);
    this.lock.visible = true;
    sound.play('whoosh_soft', { volume: 0.25, rate: 1.4 });
    await this.tween(0.45, (t) => { const e = 1 - (1 - t) ** 3; this.lock.position.lerpVectors(lp.clone().add(V(0, 0.25, 0.04)), lp, e); this.lock.rotation.z = Math.sin(t * 9) * 0.25 * (1 - t); });
    sound.play('place_metal', { volume: 0.5 });
    await this.wait(0.25);
    this.key.visible = true;
    await this.tween(0.25, (t) => { this.key.position.z = 0.03 - 0.024 * t; });
    owl.play('peck');
    await this.wait(0.22);
    sound.play('clock_wind', { volume: 0.5 });
    await this.tween(0.4, (t) => { this.key.rotation.z = (-Math.PI / 2) * smooth(t); });
    await this.tween(0.12, (t) => { this.shackle.position.y = 0.014 * (1 - t); });
    sound.play('stamp', { volume: 0.35, rate: 1.6 });
    setTimeout(() => sound.play('sparkle', { volume: 0.45 }), 120);
    const lw = this.lock.getWorldPosition(V());
    sc.fx.burst('stars', lw.x, lw.y, lw.z, 8);
    sc.fx.burst('glints', lw.x, lw.y, lw.z, 2);
    owl.lookAt = null;
    owl.setMood('proud', 2.5);
    await this.wait(0.3);
    owl.play('nod');
    await this.wait(0.8);
  }

  /** Ready for the trip: a spin, a puff of feathers, and the trail backpack is on. */
  async playPack(trip: OwlLook) {
    const sc = this.scene, owl = sc.owl;
    owl.setMood('excited', 3);
    owl.play('spin');
    sound.play('whoosh_cloth', { volume: 0.45 });
    await this.wait(0.55);
    sc.setLook(trip);
    sc.owl.pose = 'stand';
    const p = sc.owl.node.position, h = this.pipH();
    sc.fx.burst('puffs', p.x, p.y + h * 0.5, p.z, 9);
    sc.fx.burst('sparkle', p.x, p.y + h * 0.6, p.z, 8);
    sound.play('tp_shimmer', { volume: 0.35 });
    sound.play('fabric', { volume: 0.4 });
    await this.wait(0.5);
    sc.owl.play('flap');
    sc.owl.setMood('determined', 2.5);
    await this.wait(1.0);
  }

  dispose() {
    this.scene.tickers.delete(this.tick);
    this.scene.scene.remove(this.root);
    for (const d of this.disposables) { try { d.dispose(); } catch { /* */ } }
    this.root.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.geometry.dispose(); });
  }
}
