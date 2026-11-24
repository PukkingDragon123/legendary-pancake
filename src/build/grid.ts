// The blueprint grid drawn on the floor in build mode: chalk lines on every cell, a heavier line
// every two, the room's edge, hatching over fixed fittings (ladders, hatches, the door), and the
// footprint of whatever is being moved in green (fits) or red (doesn't).
import * as THREE from 'three';
import { PX } from '../gfx/box.ts';
import { CELL, cellKey, floorCells, FLOOR_Y, GN, R_IN, type FloorId } from '../world/house/plan.ts';

const N = GN * 2 * CELL; // texels across (1 per px)

export class BlueprintGrid {
  readonly mesh: THREE.Mesh;
  private tex: THREE.DataTexture;
  private data: Uint8Array<ArrayBuffer>;
  private base: Uint8Array;
  private fid: FloorId = 'f1';
  private mat: THREE.MeshBasicMaterial;
  private k = 0;

  constructor() {
    this.data = new Uint8Array(N * N * 4);
    this.base = new Uint8Array(N * N * 4);
    this.tex = new THREE.DataTexture(this.data, N, N, THREE.RGBAFormat);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
    const g = new THREE.PlaneGeometry(N * PX, N * PX);
    g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 3;
    this.mesh.name = 'blueprint-grid';
    this.paintBase('f1');
  }

  /** Repaint the chalk grid for a floor. */
  paintBase(fid: FloorId) {
    this.fid = fid;
    const cells = floorCells(fid), b = this.base;
    b.fill(0);
    const put = (x: number, y: number, r: number, g: number, bl: number, a: number) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const i = (y * N + x) * 4; b[i] = r; b[i + 1] = g; b[i + 2] = bl; b[i + 3] = a; };
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
      // texel -> house px (texture v runs towards -z after the plane is laid flat)
      const px = tx - N / 2 + 0.5, pz = N / 2 - ty - 0.5;
      const d = Math.hypot(px, pz);
      const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
      const inCell = cells.has(cellKey(cx, cz));
      const lx = ((px % CELL) + CELL) % CELL, lz = ((pz % CELL) + CELL) % CELL;
      const onLine = lx < 1 || lz < 1, major = (onLine && ((lx < 1 && ((cx % 2) + 2) % 2 === 0) || (lz < 1 && ((cz % 2) + 2) % 2 === 0)));
      if (Math.abs(d - (R_IN - 1)) < 0.8) { put(tx, ty, 244, 238, 221, 235); continue; }
      if (d > R_IN - 1) continue;
      if (inCell) {
        if (onLine) put(tx, ty, 244, 238, 221, major ? 190 : 105);
        else put(tx, ty, 70, 89, 106, 52);
      } else if (((tx + ty) % 5) < 1) put(tx, ty, 220, 200, 160, 120);
      else put(tx, ty, 46, 43, 36, 60);
    }
    this.data.set(b);
    this.tex.needsUpdate = true;
    this.mesh.position.set(0, (FLOOR_Y[fid] + 0.35) * PX, 0);
  }

  /** Paint a footprint (cells) over the grid; null clears it. */
  footprint(rect: { x: number; z: number; w: number; d: number } | null, ok = true) {
    this.data.set(this.base);
    if (rect) {
      const [r, g, b] = ok ? [167, 196, 120] : [214, 122, 104];
      for (let cz = rect.z; cz < rect.z + rect.d; cz++) for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
        for (let j = 0; j < CELL; j++) for (let i = 0; i < CELL; i++) {
          const px = cx * CELL + i, pz = cz * CELL + j;
          const tx = Math.round(px + N / 2 - 0.5), ty = Math.round(N / 2 - pz - 0.5);
          if (tx < 0 || ty < 0 || tx >= N || ty >= N) continue;
          const edge = i === 0 || j === 0 || i === CELL - 1 || j === CELL - 1;
          const k = (ty * N + tx) * 4;
          this.data[k] = r; this.data[k + 1] = g; this.data[k + 2] = b; this.data[k + 3] = edge ? 240 : (i + j) % 3 === 0 ? 150 : 95;
        }
      }
    }
    this.tex.needsUpdate = true;
  }

  get floor() { return this.fid; }
  /** fade the grid in/out (0..1 target), called every frame */
  fade(target: number, dt: number) { this.k += (target - this.k) * Math.min(1, dt * 6); this.mat.opacity = this.k; this.mesh.visible = this.k > 0.01; }
}
