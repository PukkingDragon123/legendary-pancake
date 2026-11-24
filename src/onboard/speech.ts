// Pip's words, floating in the office: crisp pixel letters (the game's hand-lettered face) in warm cream with an
// ink outline and a stepped 3D extrusion, set on a plane that hangs in the room in front of the camera, tilts a
// little with the shot and bobs gently. No box behind them. Letters appear one by one with a voice blip; the
// old line drops away as the new one arrives. Drawn in the picture's overlay pass, so it is never blurred.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { F } from './fonts.ts';
import { crispText, measure, wrap } from './tex.ts';

const VOICES = ['voice_a', 'voice_b', 'voice_c', 'voice_d', 'voice_e'];
const pause = (c: string) => (c === '.' || c === '!' || c === '?' ? 0.2 : c === ',' || c === ':' ? 0.1 : 0);

interface Word { text: string; em: boolean }
/** words with *emphasis* marked */
function parse(text: string): Word[] {
  const out: Word[] = [];
  let em = false;
  for (const raw of text.split(' ')) {
    let w = raw;
    const open = w.startsWith('*'), close = w.endsWith('*') || w.endsWith('*!') || w.endsWith('*.') || w.endsWith('*?') || w.endsWith('*,');
    if (open) em = true;
    w = w.replace(/\*/g, '');
    out.push({ text: w, em });
    if (close) em = false;
  }
  return out;
}

export class Speech {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private old: THREE.Mesh;
  private cv = document.createElement('canvas');
  private oldCv = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private oldTex: THREE.CanvasTexture;
  private words: Word[] = [];
  private plain = '';
  private shown = 0;
  private wait = 0;
  private lines: { words: Word[] }[] = [];
  private who = '';
  private t = 0;
  private outT = 1;
  private inT = 1;
  /** CSS px per texel of the words (the picture's pixel size) */
  px = 1;
  /** the line is fully out */
  done = true;
  onDone: (() => void) | null = null;
  onTalk: (() => void) | null = null;
  /** where on screen (NDC y of the top of the text block) */
  topNdc = 0.9;
  private live: HTMLElement | null = null;

  constructor() {
    const mk = (cv: HTMLCanvasElement) => {
      cv.width = 8; cv.height = 8;
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      return t;
    };
    this.tex = mk(this.cv); this.oldTex = mk(this.oldCv);
    const mat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(this.tex));
    this.old = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(this.oldTex));
    this.mesh.renderOrder = 10; this.old.renderOrder = 9;
    this.mesh.visible = this.old.visible = false;
    this.group.add(this.old, this.mesh);
    try {
      const d = document.createElement('div');
      d.setAttribute('aria-live', 'polite');
      Object.assign(d.style, { position: 'fixed', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' });
      document.body.appendChild(d);
      this.live = d;
    } catch { /* no DOM */ }
  }

  /** Say a line (null clears). `instant` shows it at once. */
  say(text: string | null, who = 'PIP', instant = false) {
    // the current line drops away
    if (this.mesh.visible && this.lines.length) {
      this.oldCv.width = this.cv.width; this.oldCv.height = this.cv.height;
      this.oldCv.getContext('2d')!.drawImage(this.cv, 0, 0);
      this.oldTex.dispose();
      this.oldTex.image = this.oldCv; this.oldTex.needsUpdate = true;
      this.old.scale.copy(this.mesh.scale);
      this.old.visible = true;
      this.outT = 0;
    }
    if (!text) { this.mesh.visible = false; this.lines = []; this.done = true; return; }
    this.words = parse(text);
    this.plain = this.words.map((w) => w.text).join(' ');
    this.who = who;
    this.shown = instant ? this.plain.length : 0;
    this.wait = 0.12;
    this.done = instant;
    this.inT = 0;
    this.layout();
    this.draw();
    this.mesh.visible = true;
    if (this.live) this.live.textContent = this.plain;
    if (instant) this.onDone?.();
  }
  /** Show the whole line now (a tap while it types). */
  finish() { if (!this.done) { this.shown = this.plain.length; this.draw(); this.done = true; this.onDone?.(); } }
  get typing() { return !this.done; }

  private font() { return F.hand(24); }
  private layout() {
    const maxCss = Math.min(innerWidth * 0.92, 820);
    const maxTex = Math.floor(maxCss / this.px);
    const font = this.font();
    const lines = wrap(this.plain, font, maxTex - 12);
    // map wrapped lines back onto words (keeping emphasis)
    this.lines = [];
    let wi = 0;
    for (const l of lines) {
      const n = l.split(' ').length;
      this.lines.push({ words: this.words.slice(wi, wi + n) });
      wi += n;
    }
  }
  private draw() {
    const font = this.font(), lh = 28, tagH = 16;
    const widths = this.lines.map((l) => measure(l.words.map((w) => w.text).join(' '), font));
    const W = Math.ceil(Math.max(...widths, 40)) + 12, H = this.lines.length * lh + tagH + 10;
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; this.tex.dispose(); this.tex.image = this.cv; }
    const g = this.cv.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    // the speaker's name tag: small gold caps
    const tag = this.who;
    crispText(g, tag, W / 2 + 1, 11, F.small(16), '#2a1608', { align: 'center' });
    crispText(g, tag, W / 2, 10, F.small(16), '#f2c766', { align: 'center' });
    let n = 0;
    this.lines.forEach((l, li) => {
      const text = l.words.map((w) => w.text).join(' ');
      let x = Math.round((W - widths[li]) / 2), y = tagH + 4 + li * lh + 20;
      for (const w of l.words) {
        const left = Math.max(0, Math.min(w.text.length, this.shown - n));
        const s = w.text.slice(0, left);
        if (s) {
          // extrusion (two steps down), outline, face
          const face = w.em ? '#ffd27a' : '#fff4dc';
          for (let k = 2; k >= 1; k--) crispText(g, s, x, y + k, font, k === 2 ? '#1a0d06' : '#5a2e14');
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) crispText(g, s, x + dx, y + dy, font, '#1a0d06');
          crispText(g, s, x, y, font, face);
        }
        n += w.text.length + 1;
        x += measure(w.text + ' ', font);
      }
      void text;
    });
    this.tex.needsUpdate = true;
  }

  update(dt: number, cam: THREE.PerspectiveCamera) {
    this.t += dt;
    if (!this.done) {
      this.wait -= dt;
      while (this.wait <= 0 && this.shown < this.plain.length) {
        this.shown++;
        const c = this.plain[this.shown - 1] ?? '';
        if (/[a-z0-9]/i.test(c) && this.shown % 2 === 1) {
          const code = c.toLowerCase().charCodeAt(0);
          try { sound.play(VOICES[code % VOICES.length], { volume: 0.15, rate: 1.25 + ((code * 7) % 13) / 34, gap: 34 }); } catch { /* */ }
        }
        if (this.shown % 3 === 1) this.onTalk?.();
        this.wait += 0.03 + pause(c);
        this.draw();
      }
      if (this.shown >= this.plain.length) { this.done = true; this.onDone?.(); }
    }
    this.inT = Math.min(1, this.inT + dt * 4);
    this.outT = Math.min(1, this.outT + dt * 3.5);
    // place the plane in front of the camera so one texel = `px` CSS px, its top at topNdc
    const D = 0.5;
    const worldPerCss = (2 * D * Math.tan((cam.fov * Math.PI) / 360)) / innerHeight;
    const place = (m: THREE.Mesh, cv: HTMLCanvasElement, drop: number, alpha: number) => {
      const w = cv.width * this.px * worldPerCss, h = cv.height * this.px * worldPerCss;
      m.scale.set(w, h, 1);
      const hNdc = (cv.height * this.px * 2) / innerHeight;
      const bob = Math.sin(this.t * 1.3) * 0.004 + drop;
      const p = new THREE.Vector3(0, this.topNdc - hNdc / 2 - bob, 0.5).unproject(cam);
      const dir = p.clone().sub(cam.position).normalize();
      m.position.copy(cam.position).addScaledVector(dir, D);
      m.quaternion.copy(cam.quaternion);
      m.rotateX(-0.08 + Math.sin(this.t * 0.9) * 0.012);
      m.rotateZ(Math.sin(this.t * 0.7) * 0.006);
      (m.material as THREE.MeshBasicMaterial).opacity = alpha;
    };
    if (this.mesh.visible) { const e = 1 - (1 - this.inT) ** 3; place(this.mesh, this.cv, (1 - e) * 0.04, Math.min(1, this.inT * 2)); }
    if (this.old.visible) { place(this.old, this.oldCv, -this.outT * 0.08, 1 - this.outT); if (this.outT >= 1) this.old.visible = false; }
  }
  /** bounds of the text on screen (CSS px), for keeping taps on it from hitting the scene */
  get height() { return this.mesh.visible ? this.cv.height * this.px : 0; }
  dispose() { this.tex.dispose(); this.oldTex.dispose(); this.live?.remove(); }
}
