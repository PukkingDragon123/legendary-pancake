// [ui5] Your owl, live, in a frame: the portrait on the name sign (and the previews in the dressing room and the
// lodge store's frame wall) is the real 3D owl (species, skin and outfit) with its whole idle life from OwlActor:
// breathing, blinking, glances and head turns, fidgets, a reaction when tapped, asleep at night. It is drawn small
// and pixel-finished (a hard alpha, a coloured outline, chunky art pixels scaled up crisp) on one tiny WebGL canvas
// that moves to whichever portrait is on screen; it renders at about 24 fps and stops when no portrait is visible or
// the page is hidden. The first paint never waits for it: the portrait shows the owl's still until the model is in,
// and keeps the still if WebGL is unavailable.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sceneSound } from '../../audio/sound.ts';
import { bedtimeOf } from '../../game/night.ts';
import { save } from '../../game/store.ts';
import { OwlActor, type OwlFx } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { portrait } from '../portraits.ts';
import { sceneRef } from '../state.ts';
import { FRAME_OPEN, FRAME_D, frameArt, frameSkyOf, portraitSky } from './frameart.ts';
import { uiBurstAt, type UiFxKind } from './uifx.ts';

/** art pixels across the owl's render (shown at about 1.3 CSS px each in the HUD) */
const artPx = () => (window as unknown as { __pipArt?: number }).__pipArt || 48;
const FPS = 24;

interface Host { el: HTMLElement; look: () => OwlLook; visible: boolean; onFx?: (k: OwlFx) => void }

const lookKey = (l: OwlLook) => JSON.stringify([l.skin ?? 'owl', l.species ?? '', l.palette, l.outfit]);

/** Is it the owl's bedtime? (from the player's bedtime to their wake time; the dev ?hour= override counts) */
export function owlBedtime(): boolean {
  const sc = sceneRef.current as unknown as { hourOverride?: number | null } | null;
  const now = new Date();
  const h = (window as unknown as { __pipHour?: number }).__pipHour ?? sc?.hourOverride ?? now.getHours() + now.getMinutes() / 60;
  const sp = save.value.sleep;
  const [bh, bm] = bedtimeOf(sp.wake, sp.goalMin).split(':').map(Number);
  const [wh, wm] = sp.wake.split(':').map(Number);
  const bed = Math.min(bh + bm / 60 - 1, 22.5), wake = wh + wm / 60;
  return bed > wake ? h >= bed || h < wake : h >= bed && h < wake;
}

// ------------------------------------------------------------------ the one live renderer

class OwlCam {
  readonly canvas: HTMLCanvasElement;
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  private rt: THREE.WebGLRenderTarget;
  private post: THREE.Mesh;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private key: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  actor: OwlActor | null = null;
  private key0 = '';
  private framed = false;
  private hosts: Host[] = [];
  private host: Host | null = null;
  private raf = 0;
  private last = 0;
  private tapUntil = 0;
  ready = false;

  constructor() {
    const ART = artPx();
    const c = (this.canvas = document.createElement('canvas'));
    c.width = c.height = ART;
    c.className = 'lp-canvas';
    this.R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    this.R.setPixelRatio(1);
    this.R.setSize(ART, ART, false);
    this.R.setClearColor(0x000000, 0);
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.rt = new THREE.WebGLRenderTarget(ART, ART, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    // bright, clean studio light: a big soft sky fill, a warm key from the top left, a cool rim; a dim studio
    // environment for the gleam in the eyes and on the bill
    const pm = new THREE.PMREMGenerator(this.R);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pm.dispose();
    this.hemi = new THREE.HemisphereLight(0xfff4e4, 0xb89c78, 1.7);
    this.key = new THREE.DirectionalLight(0xffecd0, 2.6);
    this.key.position.set(-3, 5, 6);
    const rim = new THREE.DirectionalLight(0xd4e4ff, 0.9);
    rim.position.set(4, 3, -4);
    this.scene.add(this.hemi, this.key, rim);
    // the pixel finish: a hard alpha edge, a dark coloured outline round the silhouette, a little more colour
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.rt.texture }, px: { value: new THREE.Vector2(1 / ART, 1 / ART) }, sat: { value: 1.18 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tex; uniform vec2 px; uniform float sat; varying vec2 vUv;
        vec3 boost(vec3 c){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return max(vec3(0.0), mix(vec3(l), c, sat)); }
        void main(){
          vec4 c = texture2D(tex, vUv);
          if (c.a > 0.45) { gl_FragColor = vec4(boost(c.rgb / max(c.a, 0.001)), 1.0); }
          else {
            vec4 best = vec4(0.0);
            vec4 n0 = texture2D(tex, vUv + vec2(px.x, 0.0)), n1 = texture2D(tex, vUv - vec2(px.x, 0.0));
            vec4 n2 = texture2D(tex, vUv + vec2(0.0, px.y)), n3 = texture2D(tex, vUv - vec2(0.0, px.y));
            if (n0.a > 0.45) best = n0; if (n1.a > 0.45) best = n1; if (n2.a > 0.45) best = n2; if (n3.a > 0.45) best = n3;
            if (best.a > 0.45) { vec3 o = best.rgb / best.a; gl_FragColor = vec4(o * vec3(0.34, 0.3, 0.38) + vec3(0.02, 0.012, 0.035), 1.0); }
            else gl_FragColor = vec4(0.0);
          }
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    }));
    this.postScene.add(this.post);
    document.addEventListener('visibilitychange', () => this.wake());
    this.ready = true;
  }

  /** A portrait asks for the live owl; the newest visible one gets it. */
  attach(h: Host) { this.hosts.push(h); this.pick(); }
  detach(h: Host) { this.hosts = this.hosts.filter((x) => x !== h); if (this.host === h) this.host = null; this.pick(); }
  visibility(h: Host, v: boolean) { h.visible = v; this.pick(); }
  private pick() {
    const h = [...this.hosts].reverse().find((x) => x.visible) ?? null;
    if (h !== this.host) {
      this.host?.el.classList.remove('live');
      this.host = h;
      if (h) { h.el.appendChild(this.canvas); this.setLook(h.look()); }
      else this.canvas.remove();
    }
    this.wake();
  }
  /** keep the actor dressed as the host's owl */
  setLook(l: OwlLook) {
    const k = lookKey(l);
    if (k === this.key0 && this.actor) return;
    this.key0 = k;
    if (!this.actor) {
      this.actor = new OwlActor(l, {
        fx: (kind) => this.host?.onFx?.(kind),
        sound: (id) => { if (performance.now() < this.tapUntil) sceneSound('owl_' + id); },
      });
      this.scene.add(this.actor.node);
    } else this.actor.rebuild(l);
    this.framed = false;
    const a = this.actor;
    void a.ready.then(() => { if (this.actor === a) { this.frameOwl(); this.wake(); } });
  }
  /** frame the head (with its hat or crown) and the top of the chest, at rest */
  private frameOwl() {
    const a = this.actor;
    if (!a || !a.model.loaded) return;
    a.node.rotation.y = 0.32;
    a.node.updateMatrixWorld(true);
    const g = a.model.g, px = 1 / 16;
    // the face fills the opening (a tall hat or crown may be cropped by the frame, as in any portrait)
    const top = (g.headTop + g.headH * 0.32) * px, bottom = (g.headY - g.headH * 0.36) * px;
    const cy = (top + bottom) / 2, span = Math.max(0.2, top - bottom);
    const dist = (span / 2) / Math.tan((this.cam.fov * Math.PI) / 360) * 1.12;
    this.cam.position.set(dist * 0.06, cy - span * 0.1, dist);
    this.cam.lookAt(0, cy, 0);
    this.framed = true;
  }
  /** a tap on the portrait: the owl reacts (hop, ruffle, spin, a hoot...), with its sounds */
  poke() {
    if (!this.actor) return;
    this.tapUntil = performance.now() + 2200;
    this.actor.poke();
    this.wake();
  }
  private wake() {
    if (this.raf || !this.host || document.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
  }
  private loop = (t: number) => {
    this.raf = 0;
    if (!this.host || document.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
    if (t - this.last < 1000 / FPS - 2) return;
    const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 1 / FPS);
    this.last = t;
    this.frame(dt);
  };
  private frame(dt: number) {
    const a = this.actor;
    if (!a || !a.model.loaded) return;
    if (!this.framed) this.frameOwl();
    const asleep = owlBedtime();
    const want = asleep ? 'sleep' : 'stand';
    if (a.pose !== want) { a.pose = want; if (!asleep) a.setMood('happy', 1.5); }
    const night = (sceneRef.current?.sky.night ?? 0) > 0.5;
    a.dark = night ? 0.7 : 0;
    this.hemi.color.setHex(night ? 0xdfe6ff : 0xfff4e4);
    this.key.color.setHex(night ? 0xe4e8ff : 0xffecd0);
    a.node.rotation.y = 0.32;
    // the actor's springs want small steps (the portrait draws at ~24 fps)
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < n; i++) a.update(dt / n);
    const R = this.R;
    R.setRenderTarget(this.rt);
    R.clear();
    R.render(this.scene, this.cam);
    R.setRenderTarget(null);
    R.clear();
    R.render(this.postScene, this.postCam);
    if (this.host && !this.host.el.classList.contains('live')) this.host.el.classList.add('live');
  }
}

let cam: OwlCam | null | undefined;
function owlCam(): OwlCam | null {
  if (cam === undefined) { try { cam = new OwlCam(); } catch (e) { console.warn('live owl portrait unavailable', e); cam = null; } }
  return cam;
}

// ------------------------------------------------------------------ the portrait

let styled = false;
function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'hh-livepip';
  st.textContent = `
.lp{position:relative;display:block;flex:none;image-rendering:pixelated}
.lp>.lp-sky,.lp>.lp-slot{position:absolute;clip-path:var(--lp-clip);overflow:hidden}
.lp>.lp-sky{image-rendering:pixelated}
.lp-slot>img,.lp-slot>canvas{position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated}
.lp-slot>img.still{object-fit:cover;transform:translateY(6%) scale(1.08)}
.lp-slot.live>img.still{visibility:hidden}
.lp>.lp-frame{position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none}
.lp.tapped>.lp-frame{animation:lpBump .36s steps(4)}
@keyframes lpBump{40%{transform:scale(1.06,.95)}70%{transform:scale(.97,1.03)}}
`;
  document.head.appendChild(st);
}
/** a stepped (pixel) circle clip, `n` steps per quarter */
const clipCircle = (() => {
  const pts: string[] = [], n = 28;
  for (let i = 0; i < n * 4; i++) {
    const a = (i / (n * 4)) * Math.PI * 2, x = 50 + Math.cos(a) * 50, y = 50 + Math.sin(a) * 50;
    pts.push(`${(Math.round(x * 0.44) / 0.44).toFixed(2)}% ${(Math.round(y * 0.44) / 0.44).toFixed(2)}%`);
  }
  return `polygon(${pts.join(',')})`;
})();

const FX: Partial<Record<OwlFx, UiFxKind>> = { heart: 'hearts', zzz: 'motes', feather: 'puff', note: 'sparkle', sparkle: 'sparkle' };

/**
 * The owl in its frame. `size` CSS px square; `frame` a frame id (src/assets/frames.ts); `look` the owl to show
 * (default: yours). `live` false shows the still. Tapping it (`tappable`) makes the owl react.
 */
export function OwlPortrait(p: { size: number; frame: string; look?: OwlLook; live?: boolean; tappable?: boolean; class?: string; night?: boolean; pokeKey?: number }) {
  installStyles();
  const host = useRef<HTMLSpanElement>(null);
  const slot = useRef<HTMLSpanElement>(null);
  const look = p.look ?? save.value.look;
  const lookRef = useRef(look);
  lookRef.current = look;
  const [tapped, setTapped] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(id); }, []);
  const hRef = useRef<Host | null>(null);
  const live = p.live !== false;
  // the still (shown until the live owl is in, and as the fallback)
  const [still, setStill] = useState('');
  useEffect(() => { let u = ''; try { u = portrait(look); } catch { u = ''; } setStill(u); }, [lookKey(look)]);
  useEffect(() => {
    if (!live) return;
    const c = owlCam();
    if (!c || !slot.current) return;
    const h: Host = {
      el: slot.current, look: () => lookRef.current, visible: false,
      onFx: (k) => { const kind = FX[k]; if (kind && host.current) uiBurstAt(host.current, kind, k === 'zzz' ? 1 : 3); },
    };
    hRef.current = h;
    c.attach(h);
    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver((es) => { for (const e of es) c.visibility(h, e.isIntersecting && e.intersectionRatio > 0.2); }, { threshold: [0, 0.2, 0.6] });
      io.observe(host.current!);
    } catch { c.visibility(h, true); }
    return () => { io?.disconnect(); c.detach(h); hRef.current = null; };
  }, [live]);
  // dress the live owl when the look changes
  useEffect(() => { if (live && hRef.current?.visible) cam?.setLook(look); }, [lookKey(look)]);
  // the owner of the sign pokes the owl (a tap anywhere on the sign)
  useEffect(() => { if (p.pokeKey) { cam?.poke(); setTapped((n) => n + 1); } }, [p.pokeKey]);
  const night = p.night ?? frameSkyOf(p.frame) === 'night';
  const S = p.size, open = (FRAME_OPEN / FRAME_D) * S, inset = (S - open * 2) / 2 - 0.5;
  const art = Math.max(24, Math.round(S / 1.33));
  const tap = p.tappable ? (e: MouseEvent) => { e.stopPropagation(); cam?.poke(); setTapped((n) => n + 1); } : undefined;
  const box = { left: `${inset}px`, top: `${inset}px`, width: `${S - inset * 2}px`, height: `${S - inset * 2}px` };
  return (
    <span ref={host} class={'lp ' + (p.class ?? '') + (tapped % 2 ? ' tapped' : tapped ? ' tapped2' : '')} style={{ width: `${S}px`, height: `${S}px`, '--lp-clip': clipCircle } as Record<string, string>} onClick={tap}>
      <img class="lp-sky" src={portraitSky(night || (sceneRef.current?.sky.night ?? 0) > 0.5, Math.round(art * 0.7))} style={box} alt="" draggable={false} />
      <span class="lp-slot" ref={slot} style={box}>{still && <img class="still" src={still} alt="" draggable={false} />}</span>
      <img class="lp-frame" src={frameArt(p.frame, art)} alt="" draggable={false} />
    </span>
  );
}

/** For the dev page and screenshots. */
export const livePip = { cam: () => owlCam(), bedtime: owlBedtime };
if (typeof window !== 'undefined') (window as unknown as { __livePip: unknown }).__livePip = livePip;
