// The interview's desk work, all in 3D: each form slides out of the in-tray onto the leather, curling a little and
// casting a soft shadow; the fountain pen follows the ink as it draws ticks, loops and handwriting; the brass
// marker slides along the hours scale; the brass carriage clock turns for the wake-up time; when a page is done the
// rubber stamp lifts off its pad, swings over and thumps RECEIVED onto it (with a splat of ink), and the page is
// filed into the client folder. A sticky note on the desk offers to skip the paperwork.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { SPR } from '../world/fx.ts';
import { DESK, DESK_TOP, type Office } from './office.ts';
import { PAPER_POSE } from './desk.ts';
import { Form, PAPER_H, PAPER_W, PH, PW, type Region } from './paper.ts';
import { hoursX } from './forms.ts';
import { F } from './fonts.ts';
import { mat } from './kit.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const T = DESK_TOP;
const play = (id: string, volume = 0.5, rate = 1) => { try { sound.play(id, { volume, rate, gap: 40 }); } catch { /* */ } };
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface DeskHandlers {
  region(r: Region): void;
  hours(v: number): void;
  clock(min12: number): void;
  file(): void;
  skip(): void;
  /** a tap that hit nothing on the desk */
  tap(): void;
}

interface Page { form: Form; mesh: THREE.Mesh; geo: THREE.PlaneGeometry; base: Float32Array; curl: number; bow: number; lift: number }

export class Desk {
  page: Page | null = null;
  private filed = 0;
  private anims: { t: number; dur: number; f: (k: number) => void; done?: () => void }[] = [];
  private penTip = new THREE.Vector3();
  private penRest: THREE.Vector3;
  private penQRest: THREE.Quaternion;
  private stampRest: THREE.Vector3;
  private stampBusy = false;
  private ready = false;
  private readyT = 0;
  private rider: THREE.Group;
  private riderOn = false;
  private drag: 'hours' | 'clock' | null = null;
  private clockPrev = 0;
  private stickyMode: 'skip' | 'ask' = 'skip';
  private hoverMesh = false;
  enabled = false;
  /** pages that arrive with a pictured transition (the pen writes even when the camera looks elsewhere) */
  private raycaster = new THREE.Raycaster();

  constructor(private office: Office, private h: DeskHandlers) {
    this.penRest = office.pen.position.clone();
    this.penQRest = office.pen.quaternion.clone();
    this.penTip.copy(this.penRest);
    this.stampRest = office.stamp.position.clone();
    // the brass marker that rides on the hours scale
    this.rider = new THREE.Group();
    const brass = office.mats.brass;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.005, 0.026), brass);
    body.position.y = 0.0025;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.01, 10), brass);
    knob.position.y = 0.009;
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.008, 4), brass);
    point.rotation.x = Math.PI / 2; point.position.set(0, 0.002, -0.016);
    for (const m of [body, knob, point]) { m.castShadow = true; this.rider.add(m); }
    this.rider.visible = false;
    office.room.add(this.rider);
    this.drawSticky();
    office.tickers.add((dt) => this.update(dt));
    office.onPointer = (type, x, y, ray, e) => this.pointer(type, x, y, ray, e);
  }

  // ---------------------------------------------------------------- pages

  /** Slide a new form out of the in-tray onto the desk. Resolves when it has landed. */
  present(form: Form, o: { sticky?: boolean } = {}): Promise<void> {
    const geo = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 12, 16);
    geo.rotateX(-Math.PI / 2);
    const base = Float32Array.from(geo.attributes.position.array as Float32Array);
    const m = new THREE.MeshStandardMaterial({ map: form.texture, roughness: 0.88, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: form.texture, emissiveIntensity: 0.1 });
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = 'page';
    const page: Page = { form, mesh, geo, base, curl: 0.0, bow: 0, lift: 0 };
    const from = DESK.trays.clone().add(V(0, 0.2, 0)), to = this.paperAt();
    mesh.rotation.order = 'YXZ';
    mesh.position.copy(from);
    mesh.rotation.y = -0.12;
    this.office.room.add(mesh);
    // the skip note, stuck to the top-right corner of the form
    const note = this.office.sticky.mesh;
    note.parent?.remove(note);
    if (o.sticky !== false) {
      note.position.set((326 / PW - 0.5) * PAPER_W, 0.0008, (16 / PH - 0.5) * PAPER_H);
      note.rotation.set(-Math.PI / 2, 0, -0.1);
      mesh.add(note);
      this.stickyMode = 'skip'; this.drawSticky();
    }
    const prev = this.page;
    this.page = page;
    form.render();
    play('paper_rustle', 0.45, 1.05);
    return new Promise((done) => {
      this.anim(0.62, (k) => {
        const e = ease(k);
        mesh.position.lerpVectors(from, to, e);
        mesh.position.y = to.y + (from.y - to.y) * (1 - e) + Math.sin(e * Math.PI) * 0.05;
        mesh.rotation.y = -0.12 * (1 - e) + this.paperYaw * e;
        mesh.rotation.x = PAPER_POSE.rotX * ease(Math.max(0, (k - 0.35) / 0.65));
        page.curl = Math.sin(e * Math.PI) * 0.6;
        page.lift = (1 - e) * 0.4;
      }, () => {
        page.curl = 0; page.lift = 0;
        play('place_paper', 0.5);
        if (prev && prev !== page) this.drop(prev);
        done();
      });
    });
  }
  private paperYaw = 0.015;
  private paperAt() { return PAPER_POSE.pos.clone(); }

  /** Stamp the page, then file it into the folder. */
  async stampAndFile(text = 'RECEIVED', sub?: string): Promise<void> {
    const p = this.page;
    if (!p || this.stampBusy) return;
    this.stampBusy = true;
    this.setReady(false);
    const box = p.form.region('file');
    const tx = box ? box.x + box.w / 2 : PW - 70, ty = box ? box.y + box.h / 2 + 2 : PH - 64;
    await this.stampAt(tx, ty, () => p.form.stamp(text, tx, ty, { sub, ang: -0.1 + (Math.random() - 0.5) * 0.08 }));
    await wait(260);
    await this.fileAway(p);
    this.stampBusy = false;
  }
  /** Just the stamp (the plan: APPROVED stays on the agreement). */
  async stampOnly(text: string, sub?: string, color?: string): Promise<void> {
    const p = this.page;
    if (!p || this.stampBusy) return;
    this.stampBusy = true;
    this.setReady(false);
    const box = p.form.region('file');
    const tx = box ? box.x + box.w / 2 : PW - 70, ty = box ? box.y + box.h / 2 + 2 : PH - 64;
    await this.stampAt(tx, ty, () => p.form.stamp(text, tx, ty, { sub, color, ang: -0.14 }));
    this.stampBusy = false;
  }
  private stampAt(tx: number, ty: number, hit: () => void): Promise<void> {
    const s = this.office.stamp, rest = this.stampRest.clone(), up = rest.clone().add(V(0, 0.13, 0));
    const target = this.texelWorld(tx, ty);
    const over = target.clone().add(V(0, 0.12, 0));
    play('pickup_item', 0.4, 0.9);
    return new Promise((done) => {
      this.anim(0.22, (k) => { s.position.lerpVectors(rest, up, ease(k)); s.rotation.z = Math.sin(k * Math.PI) * 0.1; });
      this.anim(0.34, (k) => { const e = ease(k); s.position.lerpVectors(up, over, e); s.position.y += Math.sin(e * Math.PI) * 0.04; s.rotation.y = -0.2 + e * 0.1; }, undefined, 0.22);
      this.anim(0.09, (k) => { s.position.lerpVectors(over, target.clone().add(V(0, 0.0018, 0)), k * k); s.rotation.x = PAPER_POSE.rotX * k; }, () => {
        hit();
        play('stamp', 0.85);
        try { navigator.vibrate?.(25); } catch { /* */ }
        this.office.bump(1);
        this.splat(target);
        if (this.page) this.page.bow = 0.5;
      }, 0.56);
      this.anim(0.24, (k) => { s.position.lerpVectors(target, over, ease(k)); s.rotation.x = PAPER_POSE.rotX * (1 - k); }, undefined, 0.8);
      this.anim(0.4, (k) => { const e = ease(k); s.position.lerpVectors(over, rest, e); s.position.y += Math.sin(e * Math.PI) * 0.05; s.rotation.y = -0.1 - e * 0.1; }, () => { play('place_wood', 0.3); done(); }, 1.04);
    });
  }
  /** ink droplets bursting from under the stamp */
  private splat(at: THREE.Vector3) {
    const fx = this.office.fx;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.08 + Math.random() * 0.16;
      fx.emit({ x: at.x, y: at.y + 0.004, z: at.z, vx: Math.cos(a) * v, vy: 0.15 + Math.random() * 0.25, vz: Math.sin(a) * v, life: 0.25 + Math.random() * 0.2, frame: SPR.pixel, color: i % 3 ? 0x8a1218 : 0xc0242a, size: 0.006 + Math.random() * 0.006, gravity: 3.5, drag: 1.2 });
    }
    for (let i = 0; i < 6; i++) fx.emit({ x: at.x + (Math.random() - 0.5) * 0.06, y: at.y + 0.01, z: at.z + (Math.random() - 0.5) * 0.04, vy: 0.08, life: 0.5, frame: SPR.puff1, frames: 3, fps: 8, color: 0xf2e8d4, size: 0.03, grow: 0.8, drag: 2, fadeOut: 0.3 });
  }
  private fileAway(p: Page): Promise<void> {
    const f = this.office.folder, from = p.mesh.position.clone();
    // peel the note off before the page goes into the folder
    const note = this.office.sticky.mesh;
    if (note.parent === p.mesh) { const n0 = note.position.clone(); this.anim(0.18, (k) => { note.position.y = n0.y + k * 0.03; note.scale.setScalar(1 - k); }, () => { p.mesh.remove(note); note.scale.setScalar(1); }); }
    const to = f.group.position.clone().add(V(0.004, 0.004 + this.filed * 0.0012, 0.004));
    play('whoosh_soft', 0.3, 1.3);
    return new Promise((done) => {
      // the folder's cover swings open, the page slides in, the cover closes on it
      this.anim(0.32, (k) => { f.cover.rotation.z = ease(k) * 2.9; }, () => play('paper_flip', 0.35, 1.2));
      this.anim(0.5, (k) => {
        const e = ease(k);
        p.mesh.position.lerpVectors(from, to, e);
        p.mesh.position.y += Math.sin(e * Math.PI) * 0.06;
        p.mesh.rotation.y = this.paperYaw + (f.group.rotation.y - this.paperYaw) * e;
        p.mesh.rotation.x = PAPER_POSE.rotX * (1 - ease(Math.min(1, k * 1.6)));
        p.curl = Math.sin(e * Math.PI) * 0.45;
      }, () => { p.curl = 0; play('place_paper', 0.45); }, 0.2);
      this.anim(0.34, (k) => { f.cover.rotation.z = (1 - ease(k)) * 2.9; }, () => {
        play('files', 0.35);
        this.filed++;
        f.stack.visible = true;
        f.stack.scale.y = 0.0012 * this.filed;
        f.stack.position.y = 0.0015 + f.stack.scale.y / 2;
        f.cover.position.y = 0.003 + f.stack.scale.y;
        if (this.page === p) this.page = null;
        this.drop(p);
        done();
      }, 0.76);
    });
  }
  private drop(p: Page) { p.mesh.parent?.remove(p.mesh); p.geo.dispose(); (p.mesh.material as THREE.Material).dispose(); p.form.texture.dispose(); }

  /** the page can be filed: the stamp lifts a little and the office box glows */
  setReady(on: boolean) {
    this.ready = on;
    if (this.page) this.page.form.hint = on ? 'file' : null;
  }
  get isReady() { return this.ready; }
  /** show or hide the brass hours marker */
  setRider(on: boolean) { this.riderOn = on; this.rider.visible = on; }

  // ---------------------------------------------------------------- texel <-> world

  texelWorld(tx: number, ty: number, page = this.page): THREE.Vector3 {
    const mesh = page?.mesh;
    const lx = (tx / PW - 0.5) * PAPER_W, lz = (ty / PH - 0.5) * PAPER_H;
    if (!mesh) return this.paperAt().add(V(lx, 0, lz));
    return mesh.localToWorld(V(lx, 0.0012, lz));
  }

  // ---------------------------------------------------------------- the frame

  private anim(dur: number, f: (k: number) => void, done?: () => void, delay = 0) { this.anims.push({ t: -delay, dur, f, done }); }

  private update(dt: number) {
    // animations
    for (const a of [...this.anims]) {
      a.t += dt;
      if (a.t < 0) continue;
      const k = Math.min(1, a.t / a.dur);
      a.f(k);
      if (k >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.done?.(); }
    }
    const p = this.page;
    if (p) {
      const busy = p.form.step(dt);
      p.form.render();
      p.bow *= Math.exp(-dt * 6);
      this.deform(p);
      // the pen follows the ink, or goes back to rest
      const at = p.form.penAt();
      const pen = this.office.pen;
      if (at && busy) {
        const w = this.texelWorld(at.x, at.y);
        this.penTip.lerp(w, 1 - Math.exp(-dt * 30));
        pen.position.copy(this.penTip).add(V(0, 0.001, 0));
        const dir = V(0.42, 0.78, 0.46).normalize();
        pen.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dir), 1 - Math.exp(-dt * 14));
        if (Math.random() < dt * 9) play('scribble', 0.16, 0.9 + Math.random() * 0.3);
      } else {
        this.penTip.lerp(this.penRest, 1 - Math.exp(-dt * 6));
        pen.position.copy(this.penTip);
        pen.quaternion.slerp(this.penQRest, 1 - Math.exp(-dt * 7));
      }
      // the hours marker sits on the scale
      if (this.riderOn) {
        const v = (this as unknown as { hoursV?: number }).hoursV ?? 8;
        const w = this.texelWorld(hoursX(v), 232);
        this.rider.position.lerp(w, 1 - Math.exp(-dt * 18));
        this.rider.quaternion.copy(p.mesh.quaternion);
      }
    }
    // the stamp invites a press when the page is ready
    if (!this.stampBusy) {
      this.readyT += dt;
      const s = this.office.stamp;
      const lift = this.ready ? 0.012 + Math.sin(this.readyT * 4) * 0.006 : 0;
      s.position.y += (this.stampRest.y + lift - s.position.y) * Math.min(1, dt * 10);
      s.rotation.z = this.ready ? Math.sin(this.readyT * 4) * 0.05 : s.rotation.z * 0.9;
    }
  }
  set hoursValue(v: number) { (this as unknown as { hoursV?: number }).hoursV = v; }

  /** bend the sheet: a lifted corner, a bow from the stamp's blow, a curl while it travels */
  private deform(p: Page) {
    const pos = p.geo.attributes.position as THREE.BufferAttribute, b = p.base;
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3] / (PAPER_W / 2), z = b[i * 3 + 2] / (PAPER_H / 2);
      // the visitor's right corner curls up a little, always; the sheet arcs while it moves
      const corner = Math.max(0, (x + z) * 0.5 - 0.55) ** 2 * 0.012;
      const curl = p.curl * (1 - z * z) * 0.012 + p.curl * Math.max(0, -z) * 0.02;
      const bow = p.bow * Math.cos(x * 1.4) * Math.cos(z * 1.4) * -0.002;
      pos.setY(i, b[i * 3 + 1] + corner + curl + bow + p.lift * 0.01);
    }
    pos.needsUpdate = true;
    p.geo.computeVertexNormals();
  }

  // ---------------------------------------------------------------- input

  private pick(ray: THREE.Ray, objs: THREE.Object3D[]) {
    this.raycaster.ray.copy(ray);
    return this.raycaster.intersectObjects(objs, true)[0] ?? null;
  }
  private pointer(type: 'down' | 'move' | 'up', _x: number, _y: number, ray: THREE.Ray, e: PointerEvent): boolean {
    const o = this.office, p = this.page;
    if (type === 'move') {
      if (this.drag === 'hours' && p) {
        const hit = this.pick(ray, [p.mesh]);
        if (hit?.uv) this.h.hours(Math.max(5, Math.min(11, Math.round((5 + ((hit.uv.x * PW - 44) / (316 - 44)) * 6) * 2) / 2)));
        return true;
      }
      if (this.drag === 'clock') { this.turnClock(ray); return true; }
      if (e.pointerType === 'mouse' && p && this.enabled) {
        const hit = this.pick(ray, [p.mesh]);
        const r = hit?.uv ? p.form.hit(hit.uv.x * PW, (1 - hit.uv.y) * PH) : null;
        const id = r?.id ?? null;
        if (id !== p.form.hover) { p.form.hover = id; p.form.dirty = true; }
        const overTool = !!this.pick(ray, o.sticky.mesh.parent ? [o.stamp, o.sticky.mesh, o.deskClock.group] : [o.stamp, o.deskClock.group]);
        const want = !!r || overTool;
        if (want !== this.hoverMesh) { this.hoverMesh = want; try { (e.target as HTMLElement).style.cursor = want ? 'pointer' : ''; } catch { /* */ } }
      }
      return false;
    }
    if (type === 'up') {
      const was = this.drag;
      this.drag = null;
      if (was) return true;
      return false;
    }
    // down
    if (!this.enabled) { this.h.tap(); return true; }
    // the sticky note (skip)
    const sh = o.sticky.mesh.parent ? this.pick(ray, [o.sticky.mesh]) : null;
    if (sh?.uv) { this.stickyTap(sh.uv); return true; }
    if (this.stickyMode === 'ask') { this.stickyMode = 'skip'; this.drawSticky(); }
    // the stamp
    if (this.pick(ray, [o.stamp, o.pad])) { if (this.ready) { this.h.file(); return true; } this.wiggle(o.stamp); play('wood_knock', 0.3, 1.4); return true; }
    // the desk clock (turn it)
    if (this.pick(ray, [o.deskClock.group])) { this.drag = 'clock'; this.clockPrev = NaN; this.turnClock(ray); return true; }
    // the page
    if (p) {
      const hit = this.pick(ray, [p.mesh]);
      if (hit?.uv) {
        const tx = hit.uv.x * PW, ty = (1 - hit.uv.y) * PH, r = p.form.hit(tx, ty);
        if (r?.kind === 'scale') { this.drag = 'hours'; this.h.hours(Math.max(5, Math.min(11, Math.round((5 + ((tx - 44) / (316 - 44)) * 6) * 2) / 2))); return true; }
        if (r?.kind === 'file') { if (this.ready) this.h.file(); else { play('ui_error', 0.25); } return true; }
        if (r) { this.h.region(r); return true; }
        play('tick_paper', 0.2);
        return true;
      }
    }
    this.h.tap();
    return true;
  }
  private wiggle(obj: THREE.Object3D) { this.anim(0.3, (k) => { obj.rotation.z = Math.sin(k * Math.PI * 4) * 0.08 * (1 - k); }); }

  /** turning the carriage clock: the angle of the pointer round its face sets the time (12 hours a turn) */
  private turnClock(ray: THREE.Ray) {
    const c = this.office.deskClock, face = c.face.getWorldPosition(V(0, 0, 0));
    const n = V(0, 0, 1).applyQuaternion(c.group.getWorldQuaternion(new THREE.Quaternion()));
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, face);
    const pt = ray.intersectPlane(plane, V(0, 0, 0));
    if (!pt) return;
    const local = c.group.worldToLocal(pt.clone()).sub(c.group.worldToLocal(face.clone()));
    let a = Math.atan2(local.x, local.y);
    if (a < 0) a += Math.PI * 2;
    const min12 = Math.round(((a / (Math.PI * 2)) * 720) / 15) * 15 % 720;
    if (min12 !== this.clockPrev) { this.clockPrev = min12; this.h.clock(min12); }
  }

  private stickyTap(uv: THREE.Vector2) {
    if (this.stickyMode === 'skip') { this.stickyMode = 'ask'; this.drawSticky(); play('paper_flip', 0.35, 1.3); return; }
    // ask mode: YES on the left, NO on the right of the bottom row
    if (uv.y < 0.42) {
      if (uv.x < 0.5) { play('ui_confirm', 0.4); this.h.skip(); }
      else { this.stickyMode = 'skip'; this.drawSticky(); play('ui_back', 0.35); }
    }
  }
  private drawSticky() {
    const s = this.office.sticky;
    if (this.stickyMode === 'skip') s.draw([{ t: 'Been here', y: 28, font: F.hand(16) }, { t: 'before?', y: 46, font: F.hand(16) }, { t: 'SKIP  >', y: 74, font: F.caps(12), color: '#8a2a1a', box: true }]);
    else s.draw([{ t: 'Skip forms?', y: 22, font: F.hand(12) }, { t: 'Pip picks', y: 38, font: F.small(16) }, { t: 'cozy defaults', y: 50, font: F.small(16) }, { t: 'YES   NO', y: 76, font: F.caps(12), color: '#8a2a1a' }]);
  }
  hideSticky() { const n = this.office.sticky.mesh; n.parent?.remove(n); }

  dispose() {
    if (this.page) this.drop(this.page);
    this.rider.parent?.remove(this.rider);
    this.office.onPointer = null;
  }
}
export const _deskMat = mat;
export { T as DESK_Y };
