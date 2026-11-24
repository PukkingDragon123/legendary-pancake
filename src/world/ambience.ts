// [world3] The air of the hollow: a director for small ambient pixel particles (all 2D sprites from fx.ts, in
// the calm palette) that follows the time of day, the season and the weather.
//   day      dust motes turning in the sunbeams, pollen lifting off the flower drifts in spring and summer
//   dawn     dew glints winking in the grass, mist wisps curling off the pond
//   dusk     mist again, moths circling the lit lanterns, embers riding up out of the chimney at night
//   rain     drips falling from the canopy, splashing where they land (the drops themselves live in weather.ts)
//   snow     puffs sliding off the branches, snow kicked up round Pip's feet
//   Pip      little dust puffs as he hops, a stray feather now and then in flight, a puff when he lands
// Rates scale with the quality setting; everything is cheap instanced sprites.
import * as THREE from 'three';
import { SPR } from './fx.ts';
import { POND, pondD } from './layout.ts';
import { SURFACE_Y, surfaceY } from './terrain.ts';
import type { Scene } from './scene.ts';
import { featherColour } from '../owl/model.ts';
import type { Season } from './astro.ts';

const R = (a: number, b: number) => a + Math.random() * (b - a);

export interface AirState { rain: number; snow: number; fog: number; wet: number; cover: number; wind: number; season: Season }

export class Ambience {
  private acc = { mote: 0, pollen: 0, dew: 0, mist: 0, moth: 0, ember: 0, drip: 0, puff: 0, owl: 0 };
  private last = new THREE.Vector3();
  private wasFlying = false;
  private k: number;
  constructor(private sc: Scene) { this.k = sc.quality === 'high' ? 1 : 0.55; }

  tick(dt: number, a: AirState) {
    const sc = this.sc, fx = sc.fx, sky = sc.sky, h = sky.hour, night = sky.night, k = this.k, acc = this.acc;
    if (sc.stage) return;
    const day = night < 0.4, wet = a.rain > 0.1 || a.snow > 0.1;
    const dawn = h > 5.4 && h < 8.6, dusk = h > 17.8 && h < 21.5;
    const cam = sc.camera.position, fwd = new THREE.Vector3();
    sc.camera.getWorldDirection(fwd);
    // a spot on the ground in front of the camera
    const near = (spread: number) => { const d = R(3, 10); const x = cam.x + fwd.x * d + R(-spread, spread), z = cam.z + fwd.z * d + R(-spread, spread); return [x, z] as const; };

    // dust motes turning in the sunbeams
    if (day && sky.rayPower > 0.15 && !wet && (acc.mote -= dt) <= 0) {
      acc.mote = 0.09 / k / sky.rayPower;
      const [x, z] = near(5);
      fx.emit({ x, y: surfaceY(x, z) + R(0.6, 3.6), z, vx: R(-0.05, 0.05), vy: R(-0.03, 0.06), life: R(4, 7), frame: SPR.mote, size: R(0.06, 0.11), color: 0xf6e6bf, wind: 0.15, flutter: 0.12, add: true, fadeIn: 1.4, fadeOut: 1.6 });
    }
    // pollen off the flower drifts
    if (day && !wet && (a.season === 'spring' || a.season === 'summer') && sc.plan.flowers.length && (acc.pollen -= dt) <= 0) {
      acc.pollen = 0.22 / k;
      const f = sc.plan.flowers[Math.floor(Math.random() * sc.plan.flowers.length)];
      const x = f.x + R(-1.4, 1.4), z = f.z + R(-1.4, 1.4);
      fx.emit({ x, y: surfaceY(x, z) + R(0.3, 0.8), z, vy: R(0.08, 0.22), life: R(3, 5), frame: SPR.pollen, size: R(0.08, 0.13), color: Math.random() < 0.7 ? 0xe8d49a : 0xf4eedd, wind: 0.35, flutter: 0.25, fadeIn: 0.6, fadeOut: 1.2 });
    }
    // dew glints at dawn
    if (dawn && !wet && a.cover < 0.2 && (acc.dew -= dt) <= 0) {
      acc.dew = 0.12 / k;
      const [x, z] = near(4);
      fx.burst('dew', x, surfaceY(x, z) + 0.12, z, 1);
    }
    // mist wisps over the pond (and the meadow on foggy mornings)
    if (a.fog > 0.35 && (acc.mist -= dt) <= 0) { // [look4] only in real fog: little curls, not blocks
      acc.mist = (0.7 - a.fog * 0.4) / k;
      const onPond = Math.random() < 0.7;
      const an = R(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * 0.85;
      const x = onPond ? POND.x + Math.cos(an) * POND.rx * rr : R(-9, 9), z = onPond ? POND.z + Math.sin(an) * POND.rz * rr : R(-6, 9);
      const y = onPond ? SURFACE_Y + R(0.05, 0.3) : surfaceY(x, z) + R(0.1, 0.5);
      const col = new THREE.Color(sky.fog.color).lerp(new THREE.Color(0xdfe9ea), night > 0.5 ? 0.25 : 0.55).getHex();
      fx.emit({ x, y, z, vx: R(0.03, 0.1), vy: R(0.0, 0.04), life: R(6, 9), frame: Math.random() < 0.5 ? SPR.wisp : SPR.wisp2, size: R(0.32, 0.55), grow: 0.4, color: col, wind: 0.08, fadeIn: 2.2, fadeOut: 2.6 });
    }
    // moths round the lit lanterns, embers out of the chimney
    if (night > 0.5 && a.rain < 0.2 && a.season !== 'winter' && (acc.moth -= dt) <= 0) {
      acc.moth = 1.4 / k;
      const L = sc.house.lampAt;
      fx.emit({ x: L.x + R(-0.6, 0.6), y: L.y + R(-0.3, 0.5), z: L.z + R(0.2, 0.9), vx: R(-0.4, 0.4), vz: R(-0.4, 0.4), life: R(3, 5), frame: SPR.moth1, frames: 2, fps: 12, size: R(0.12, 0.18), color: 0xd8ccb0, tx: L.x, ty: L.y + 0.2, tz: L.z + 0.4, pull: 0.5, swirl: 2.4, fadeIn: 0.5, fadeOut: 0.8 });
    }
    if (night > 0.45 && a.rain < 0.4 && (acc.ember -= dt) <= 0) {
      acc.ember = R(0.5, 1.2) / k;
      const c = sc.house.chimneyTop;
      fx.burst('embers', c.x, c.y + 0.05, c.z, Math.random() < 0.3 ? 2 : 1);
    }
    // drips from the canopy while (and after) it rains; snow sliding off the branches
    const srcs = sc.plan.leafSources;
    if (srcs.length && (a.wet > 0.3 || a.rain > 0.1) && a.cover < 0.3 && (acc.drip -= dt) <= 0) {
      acc.drip = 0.12 / k / Math.max(0.3, a.wet);
      const s = srcs[Math.floor(Math.random() * srcs.length)], an = R(0, Math.PI * 2), d = Math.sqrt(Math.random()) * s.r;
      fx.emit({ x: s.x + Math.cos(an) * d, y: s.y - R(0.8, 1.6), z: s.z + Math.sin(an) * d, vy: -0.5, life: 2.2, frame: SPR.drop, size: R(0.1, 0.14), color: 0xc8dade, gravity: 9, land: true, fadeOut: 0.2 });
    }
    if (srcs.length && a.cover > 0.4 && (acc.puff -= dt) <= 0) {
      acc.puff = R(0.6, 1.6) / k / Math.max(0.4, a.wind + a.snow);
      const s = srcs[Math.floor(Math.random() * srcs.length)], an = R(0, Math.PI * 2), d = Math.sqrt(Math.random()) * s.r;
      const x = s.x + Math.cos(an) * d, y = s.y - R(0, 1.2), z = s.z + Math.sin(an) * d;
      for (let i = 0; i < 6; i++) fx.emit({ x: x + R(-0.2, 0.2), y: y + R(-0.1, 0.1), z: z + R(-0.2, 0.2), vx: R(-0.2, 0.2), vy: R(-0.6, -0.2), vz: R(-0.2, 0.2), life: R(1.2, 2), frame: i % 2 ? SPR.flake : SPR.puff1, frames: i % 2 ? 1 : 3, fps: 3, size: R(0.14, 0.3), color: 0xf5f7f2, gravity: 1.6, drag: 1.2, wind: 0.5, land: true, fadeOut: 0.6 });
    }

    // Pip: little puffs as he hops, a stray feather in flight, a puff when he lands
    const owl = sc.owl.node;
    if (owl.visible) {
      const p = owl.position, moved = p.distanceTo(this.last) / Math.max(dt, 1e-3);
      const flying = sc.owl.pose === 'fly';
      if ((acc.owl -= dt) <= 0 && moved > 0.4) {
        if (flying) {
          acc.owl = R(0.25, 0.6);
          if (Math.random() < 0.45) fx.emit({ x: p.x, y: p.y + 0.6, z: p.z, vx: R(-0.3, 0.3), vy: R(-0.1, 0.3), vz: R(-0.3, 0.3), life: R(1.8, 2.6), frame: SPR.feather1, frames: 3, fps: 3, color: featherColour(sc.owl.model.look.palette), size: R(0.14, 0.2), gravity: 0.9, drag: 2.2, flutter: 0.6, land: true });
        } else if (Math.abs(p.y - surfaceY(p.x, p.z)) < 0.15 || p.y < 0.2) {
          acc.owl = R(0.18, 0.3);
          const ground = a.cover > 0.4 ? 0xf5f7f2 : pondD(p.x, p.z) < 1.1 ? 0xdfe9ea : 0xd2c4a6;
          fx.emit({ x: p.x + R(-0.12, 0.12), y: p.y + 0.04, z: p.z + R(-0.12, 0.12), vx: R(-0.3, 0.3), vy: R(0.15, 0.35), vz: R(-0.3, 0.3), life: R(0.35, 0.55), frame: SPR.puff1, frames: 3, fps: 7, color: ground, size: R(0.16, 0.24), drag: 2.4 });
        }
      }
      if (this.wasFlying && !flying) fx.burst('puffs', p.x, p.y + 0.08, p.z, 5, a.cover > 0.4 ? 0xf5f7f2 : 0xeae0c8);
      this.wasFlying = flying;
      this.last.copy(p);
    }
  }
}
