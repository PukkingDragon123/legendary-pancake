// Physical surfaces for the panels, painted by the realistic material kit (src/ui/real/) at device resolution:
//   9-slice frames (shown with border-image, so they fit any size without repainting): a walnut cabinet frame
//   with brass corner brackets, thin oak / walnut / brass / iron mouldings, a carved sign board, a brass
//   plate, deckled paper notes, a stitched leather frame;
//   material tiles: draped velvet, linen, cork, cyanotype blueprint paper with its chalk grid, pebbled leather,
//   wall planks; and small parts: an enamel pushpin, a brass drawing pin, masking tape, a brass hanging rail.
// installSurfaces() writes one <style> that dresses the app's classes in them.
import {
  leatherFrame as leatherNine, panelFrame, paperNote as noteNine, plaqueFrame, signBoard as signNine, thinFrame as thinNine, type Nine,
} from '../real/kit.ts';
import {
  BRASS_OLD, GOLD, Real, bevel, box, cached, circle, deviceK, dome, enamel, hex, matte, metal, polygon, segment, toURL, tubeX, wood,
} from '../real/paint.ts';
import { loadTextures, tileURL } from '../real/tex.ts';

export type { Nine };

/** A walnut (oak, cherry) cabinet frame with brass corner brackets; the opening is clear. */
export const cabinetFrame = (kind: 'walnut' | 'oak' | 'cherry' = 'walnut', t = 14, plates = true): Nine => panelFrame(kind, t, { brass: plates, r: 12 });
/** A thin picture-frame moulding (opening clear). */
export const thinFrame = (kind: 'oak' | 'walnut' | 'brass' | 'iron', t = 7): Nine => thinNine(kind, t);
/** A carved sign board (filled), four brass screws. */
export const signBoard = (kind: 'walnut' | 'oak' = 'walnut'): Nine => signNine(kind);
/** A brass plate (filled), engraved border, two screws. */
export const brassPlate = (): Nine => plaqueFrame();
/** A sheet of note paper with deckled edges and a soft curl shadow (filled). */
export const paperNote = (tint: 'cream' | 'blue' | 'yellow' = 'cream', seed = 1): Nine => noteNine(tint, seed);
/** A tooled leather frame: stitched, with a gilt fillet (opening clear). */
export const leatherFrame = (hue: 'emerald' | 'leather' | 'sapphire' = 'emerald', t = 14): Nine => leatherNine(hue === 'emerald' ? '#2c6b43' : hue === 'sapphire' ? '#2b4b86' : '#7a2a24', t);

// ------------------------------------------------------------------ tiles (CSS backgrounds)

const VEL: Record<string, string> = { plum: '#5b2a63', emerald: '#1e4d33', sapphire: '#22345e', leather: '#6e1c22' };
/** Velvet (photo tile, tinted). Show at ~260 px. */
export const velvetTile = (hue: 'plum' | 'emerald' | 'sapphire' | 'leather' = 'plum'): string => tileURL('velvet', VEL[hue], 384);
/** Natural linen (the backing inside display frames). Show at ~200 px. */
export const linenTile = (): string => tileURL('linen', '#ecdfc2', 384);
/** Cork. Show at ~256 px. */
export const corkTile = (): string => tileURL('cork');
/** Wall planks: show at 512 x 128 px (four boards). */
export function plankTile(kind: 'walnut' | 'oak' = 'walnut', dark = 0.38): string {
  return cached(`plank:${kind}:${dark}`, () => {
    const k = 1, W = 512, H = 128, r = new Real(W, H, k, 0);
    for (let i = 0; i < 4; i++) {
      r.part(box(-2, i * 32 + 0.6, W + 4, 31.4, 1.5), bevel(2, 1.5), wood(kind, { along: 'x', oy: i * 97, ox: i * 211, varnish: 0.3 }));
    }
    const c = r.canvas({ shadow: false, ambient: 0.5 - dark * 0.2 });
    const g = c.getContext('2d')!;
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#1a0d06'; g.fillRect(0, 0, W, H);
    return toURL(c, 0.86);
  });
}
/** A chalk grid (fine 8 px, bold 32 px) on clear: lay it over blueprintPaper(). Show at 128 px. */
export function blueprintTile(): string {
  return cached('bp', () => {
    const N = 128, k = deviceK(2), c = document.createElement('canvas');
    c.width = c.height = Math.round(N * k);
    const g = c.getContext('2d')!;
    g.scale(k, k);
    g.strokeStyle = 'rgba(232,240,244,0.16)'; g.lineWidth = 0.6;
    for (let x = 8; x < N; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, N); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(N, x); g.stroke(); }
    g.strokeStyle = 'rgba(232,240,244,0.42)'; g.lineWidth = 1;
    for (let x = 0; x <= N; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, N); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(N, x); g.stroke(); }
    return c.toDataURL('image/png');
  });
}
/** the blueprint paper itself (a tinted paper tile) under the grid */
export const blueprintPaper = (): string => tileURL('paper', '#3a6fae', 512, 0.72);
/** Pebbled leather (passport covers). Show at ~220 px. */
export const leatherTile = (hue: 'emerald' | 'leather' | 'sapphire' = 'emerald'): string => tileURL('pebble', hue === 'emerald' ? '#2c6b43' : hue === 'sapphire' ? '#2b4b86' : '#7a2a24', 384);
/** A brass hanging rod (tiles along x): show 64 x 12 px. */
export function railTile(): string {
  return cached('railtile', () => {
    const r = new Real(64, 12, deviceK(3), 0);
    r.part(box(-2, 3.5, 68, 5, 2.5), tubeX(6, 2.5, 1), metal(GOLD, { along: 'x', polish: 0.8 }));
    return r.url({ shadow: { dy: 2, blur: 2, a: 0.35 } });
  });
}

// ------------------------------------------------------------------ small parts

const PIN: Record<string, string> = { rose: '#c8384a', sapphire: '#2f58b0', emerald: '#2f8a52', gold: '#e0a832' };
/** An enamel pushpin seen from above-front (18 x 20 px). */
export function pushpin(hue: 'rose' | 'sapphire' | 'emerald' | 'gold' = 'rose'): string {
  return cached('pin:' + hue, () => {
    const r = new Real(18, 20, deviceK(3), 0);
    r.part(segment(10, 12, 12.5, 19, 0.7), 1, metal([200, 204, 210], { polish: 0.8 }));
    r.part(polygon([[4, 10], [14, 10], [12, 14], [6, 14]]), (x, y) => 2 + dome(9, 12, 6, 3, 1.5)(x, y, 0), enamel(hex(PIN[hue])));
    r.part(circle(9, 7.5, 5.2), dome(9, 7.5, 5.2, 5.2, 4, 3), enamel(hex(PIN[hue])));
    return r.url({ shadow: false });
  });
}
/** A brass drawing-pin (16 x 16 px): a domed, spun-brass head. */
export function thumbtack(): string {
  return cached('tack', () => {
    const r = new Real(16, 16, deviceK(3), 0);
    r.part(circle(8, 8, 6.8), dome(8, 8, 6.8, 6.8, 2.4, 1), metal(GOLD, { polish: 0.8 }));
    r.part(circle(8, 8, 2.2), dome(8, 8, 2.2, 2.2, 1.4, 3.2), metal(GOLD, { polish: 0.9 }));
    return r.url({ shadow: false });
  });
}
/** A strip of masking tape (w x 14 px): crinkled, translucent, torn ends. */
export function tape(w = 52): string {
  return cached('tape:' + w, () => {
    const H = 14, r = new Real(w, H, deviceK(3), 0);
    const pts: [number, number][] = [];
    for (let y = 1; y <= H - 1; y += 1.5) pts.push([1 + Math.abs(Math.sin(y * 2.3)) * 2, y]);
    for (let y = H - 1; y >= 1; y -= 1.5) pts.push([w - 1 - Math.abs(Math.cos(y * 1.9)) * 2, y]);
    r.part(polygon(pts), (x, y) => 1 + Math.sin(x * 0.7 + y * 0.3) * 0.18, matte((x) => [232 + Math.sin(x * 0.4) * 4, 220, 186] as [number, number, number], { spec: 0.15, shin: 20 }));
    const c = r.canvas({ shadow: false });
    const g = c.getContext('2d')!;
    const im = g.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < im.data.length; i += 4) im.data[i] = Math.round(im.data[i] * 0.86);
    g.putImageData(im, 0, 0);
    return toURL(c);
  });
}
/** A brass hanging rail (w x 12 px) with turned walnut end brackets: the wardrobe's rod. */
export function brassRail(w: number): string {
  return cached('rail:' + w, () => {
    const H = 12, r = new Real(w, H, deviceK(3), 0);
    r.part(box(4, 3.8, w - 8, 4.6, 2.3), tubeX(6.1, 2.3, 3), metal(GOLD, { along: 'x', polish: 0.8 }));
    for (const x of [0, w - 7]) {
      r.part(box(x, 0, 7, 12, 2), bevel(3, 2.5, 2), wood('walnut', { along: 'y' }));
      r.part(circle(x + 3.5, 6.1, 2.4), dome(x + 3.5, 6.1, 2.4, 2.4, 1.6, 5), metal(BRASS_OLD));
    }
    return r.url({ shadow: { dy: 1.5, blur: 2, a: 0.35 } });
  });
}

// ------------------------------------------------------------------ CSS

/** CSS for a 9-slice frame on an element (border-image at device resolution) */
export const b9 = (n: Nine, fill = n.fill, rep: 'stretch' | 'round' = 'stretch') =>
  `border-style:solid;border-color:transparent;border-width:${n.bw.map((v) => v + 'px').join(' ')};border-image-source:url("${n.url}");border-image-slice:${n.s.map((v) => Math.round(v * n.k)).join(' ')}${fill ? ' fill' : ''};border-image-width:${n.s.map((v) => v + 'px').join(' ')};border-image-outset:${n.o}px;border-image-repeat:${rep}`;

let done = false;
/** Dress the app's panels in the physical surfaces (call once at boot; waits for the material tiles). */
export function installSurfaces() {
  if (done || typeof document === 'undefined') return;
  done = true;
  void loadTextures().then(() => {
    const note = paperNote('cream', 2);
    const css = `
.sheet.sheet .grab{display:none}
.sheet.sheet .sheet-head{padding-top:2px}
/* carved signs, and dark walnut cabinets with plank backs */
.hh-wood-sm.hh-wood-sm,.hh-wood.hh-wood{${b9(signBoard('walnut'), true)};background:none}
.hh-wood-dark.hh-wood-dark,.hh-wood-dark-sm.hh-wood-dark-sm{${b9(cabinetFrame('walnut', 14))};background:url("${plankTile('walnut', 0.34)}") 0 0/512px 128px;background-clip:padding-box}
/* the quest board: an oak-framed cork board with pinned notes */
.sheet.qb{${b9(cabinetFrame('oak', 14))};background:url("${corkTile()}") 0 0/256px 256px,#a87a4c;background-clip:padding-box}
.sheet.qb .sheet-head h2,.sheet.qb .sheet-head .muted{color:#fff4dc;text-shadow:0 1px 0 #2a1408,0 2px 4px rgba(0,0,0,.6)}
.sheet.qb .quest.card{${b9(note, true, 'stretch')};background:none;padding:4px 6px 6px 4px;border-radius:0;box-shadow:none}
.sheet.qb .quest.card::before{content:'';position:absolute;left:50%;top:-16px;width:18px;height:20px;margin-left:-9px;background:url("${pushpin('rose')}") 0 0/18px 20px;z-index:2;filter:drop-shadow(1px 3px 2px rgba(30,14,6,.45))}
.sheet.qb .quest.card:nth-child(2n){transform:rotate(-0.6deg)}
.sheet.qb .quest.card:nth-child(2n+1){transform:rotate(0.5deg)}
.sheet.qb .quest.card:nth-child(2n)::before{background-image:url("${pushpin('sapphire')}")}
.sheet.qb .quest.card:nth-child(3n)::before{background-image:url("${pushpin('emerald')}")}
.sheet.qb > .sheet-body > p{color:#fff4dc;text-shadow:0 1px 0 #2a1408,0 2px 4px rgba(0,0,0,.6)}
.sheet.qb .quest.claimed{${b9(paperNote('yellow', 5), true, 'stretch')}}
@media (min-width: 900px) { .sheet.short.wd, .sheet.short.qb { max-height: calc(100% - 120px); } }
.hh-brass-plate{${b9(brassPlate(), true)};background:none}
`;
    const st = document.createElement('style');
    st.id = 'hh-surfaces';
    st.textContent = css;
    document.head.appendChild(st);
  });
}
