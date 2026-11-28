// The breathing flight, in the real world: Pip, his trail backpack on, circles high over the Hollow at night — the
// great oak with its lit windows, the clearing, the pond and the three belts of forest rolling away to the hills — while
// the player breathes. He rises with full wingbeats on each in-breath and glides on each out-breath; the camera rides
// three-quarters behind him and slowly swings round, so the oak, the moon and the far woods all pass through the frame.
// Drives the camera through scene.director and Pip through scene.owl, like the cinematics; stop() hands both back.
import * as THREE from 'three';
import type { OwlLook } from '../owl/model.ts';
import type { CamShot, Scene } from './scene.ts';
import { HOUSE } from './layout.ts';
import { outerY } from './terrain.ts';
import { SPR } from './fx.ts';

export interface NightFlight {
  /** 0..1 lung fullness */
  setBreath(lung: number): void;
  /** Pip's head on screen (CSS px) */
  pipScreen(): { x: number; y: number };
  stop(): void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function startNightFlight(scene: Scene, trip: OwlLook, home: OwlLook): NightFlight {
  const owl = scene.owl, sky = scene.sky;
  const prev = { hook: scene.interceptor, still: owl.still };
  scene.setStage(null);
  scene.setLook(trip);
  scene.setView('sleep');
  scene.blurOverride = 0.1; // the whole valley stays crisp below him
  scene.setHour(23.2);
  // a clear, still night for the flight (the real weather comes back when he lands)
  scene.weather.hold = { kind: 'clear', intensity: 0.1, source: 'seasonal', temp: 10 };
  scene.weather.snap();
  sky.starBoost = 0.75;
  const moonDir = V(-0.55, 0.42, -0.72).normalize();
  sky.moonOverride = { dir: moonDir, size: 0.085 };
  scene.placeOwl('porch'); // out of the house (inside, he is carried by its floor)
  owl.node.visible = true;
  owl.pose = 'fly';
  owl.still = true;
  owl.lookAt = null;
  owl.setMood('calm');

  let lastYaw: number | null = null;
  let t = 0, breath = 0, breathV = 0, bank = 0, trailT = 0;
  const pos = V(), vel = V(1, 0, 0);
  const R0 = 34, W = 0.085; // radius (blocks) and angular speed: a lap takes about 74 s
  const place = (time: number, out = V()) => {
    const a = time * W, r = R0 + Math.sin(time * 0.045) * 7;
    const x = HOUSE.x + Math.cos(a) * r, z = HOUSE.z + Math.sin(a) * r;
    const ground = Math.max(outerY(x, z), 0);
    return out.set(x, ground + 21 + Math.sin(time * 0.13) * 1.5, z); // well above the crowns (the tallest stand about 12 high)
  };
  place(0, pos);

  const tick = (dt: number) => {
    t += dt;
    const lungV = (breath - breathV) / Math.max(dt, 1e-3);
    breathV += (breath - breathV) * Math.min(1, dt * 4);
    const p = place(t), ahead = place(t + 0.4);
    p.y += breathV * 1.4;
    vel.copy(ahead).sub(p);
    pos.copy(p);
    owl.node.position.copy(pos);
    const yaw = Math.atan2(vel.x, vel.z);
    bank += (0.32 - bank) * Math.min(1, dt * 1.2); // always turning inwards a little: lean into the circle
    owl.node.rotation.set(-0.06 + (0.5 - breathV) * 0.06, yaw, -bank, 'YXZ');
    owl.wingbeat += ((lungV > 0.02 || breath > 0.92 ? 1 : breath < 0.08 ? 0.7 : 0.08) - owl.wingbeat) * Math.min(1, dt * 2.5);
    // a faint trail of moonlit motes behind him
    if ((trailT -= dt) <= 0) {
      trailT = 0.12;
      scene.fx.emit({ x: pos.x + (Math.random() - 0.5) * 0.4, y: pos.y + 0.4, z: pos.z + (Math.random() - 0.5) * 0.4, vy: -0.15, life: 1.4, frame: SPR.spark1, frames: 1, color: 0xcfd8ff, size: 0.09, add: true, fadeOut: 0.8 });
    }
  };
  const director = (): CamShot => {
    const fwd = vel.clone().setY(0).normalize(), out = V(fwd.z, 0, -fwd.x); // the outside of the circle
    const swing = Math.sin(t * 0.05) * 0.6; // the camera slowly works round from behind to the side
    const from = pos.clone().addScaledVector(fwd, -5.4 * Math.cos(swing)).addScaledVector(out, 2.4 + 3.2 * Math.sin(swing) + 1.2).add(V(0, 2.2, 0));
    const at = pos.clone().addScaledVector(fwd, 3.5).addScaledVector(out, -1.2).add(V(0, -0.9, 0));
    const d = from.clone().sub(at), dist = d.length();
    // keep the angle continuous as he circles (the scene eases its camera between shots: a jump of 2 pi would spin it)
    let yaw = Math.atan2(d.x, d.z);
    if (lastYaw !== null) { while (yaw - lastYaw > Math.PI) yaw -= Math.PI * 2; while (yaw - lastYaw < -Math.PI) yaw += Math.PI * 2; }
    lastYaw = yaw;
    return { snap: t < 0.15, yaw, pitch: Math.asin(THREE.MathUtils.clamp(d.y / dist, -0.98, 0.98)), dist, target: at, fov: scene.camera.aspect < 0.8 ? 58 : 44 };
  };
  scene.tickers.add(tick);
  scene.director = director;
  scene.interceptor = () => true;

  return {
    setBreath(l: number) { breath = l; },
    pipScreen() { return scene.screenOf(owl.headWorld); },
    stop() {
      scene.tickers.delete(tick);
      // hand the camera back with its angle wrapped into one turn, so it doesn't unwind the laps
      const cur = (scene as unknown as { cur?: { yaw: number } }).cur;
      if (cur) cur.yaw = Math.atan2(Math.sin(cur.yaw), Math.cos(cur.yaw));
      if (scene.director === director) scene.director = null; // the camera goes back to the view (never to a stale director)
      scene.interceptor = prev.hook;
      owl.still = prev.still;
      owl.pose = 'stand';
      owl.wingbeat = 1;
      owl.node.rotation.set(0, 0, 0);
      scene.weather.hold = null;
      scene.blurOverride = null;
      sky.starBoost = 0;
      sky.moonOverride = null;
      scene.setHour(null);
      scene.setLook(home); // (the view is the app's: the night has usually begun by now)
    },
  };
}
