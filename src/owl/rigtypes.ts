// The shape of an owl model's rig sheet (src/owl/rig.gen.ts, written by art/blender/owls/rigdata.py).
// Units: toy millimetres in the game frame (x right, y up, z toward the viewer: the owl's front).
export type V3 = [number, number, number];

export interface OwlRigData {
  /** joint pivots (the GLB's joint node positions), absolute */
  pivots: Record<string, V3>;
  parents: Record<string, string>;
  /** outfit anchors: where, on which joint, and the wearer's size there (1 = a tawny) */
  anchors: Record<string, { at: V3; bone: string; scale: number }>;
  /** the eye decals: centre on the head's facets, facing, the dot radius and the patch's half size */
  eyes: Record<string, { at: V3; axis: V3; r: number; patch: number }>;
  min: V3;
  max: V3;
  height: number;
  /** a few measurements of the build (Blender frame: z up, the face toward -y; faceY is the face's depth) */
  dims: { bodyZ0: number; bodyZ1: number; bodyW: number; bodyD: number; headZ: number; headW: number; headH: number; headD: number; faceY: number; eyeX: number; eyeZ: number; tuftTop: number };
  tris?: number;
  /** still portraits shipped beside the GLB (public/models/owls/<id>.<shot>.webp), shown while the model loads */
  shots?: ('face' | 'full')[];
}
