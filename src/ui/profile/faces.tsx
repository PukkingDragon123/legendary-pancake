// [profile] Portraits in their frames, for the profile's lists: a photo or an owl render (src/ui/portraits.ts) in a
// portrait frame (frameart.ts) over its little painted sky, or a neighbour's silhouette cameo (cameo.ts).
import { save } from '../../game/store.ts';
import type { Critter } from '../../game/social.ts';
import type { OwlLook } from '../../owl/model.ts';
import { FRAME_D, FRAME_OPEN, frameArt, frameSkyOf, portraitSky } from '../chrome/frameart.ts';
import { texReady } from '../real/tex.ts';
import { useOwlIcon } from '../portraits.ts';
import { cameoArt } from './cameo.ts';

/** An image in a portrait frame, `size` CSS px across. `photo`: an opaque square photo (no sky behind it). */
export function Framed(p: { src: string; frame: string; size: number; photo?: boolean; night?: boolean; class?: string }) {
  void texReady.value; // repaint once the wood and metal photo tiles are in
  const S = p.size, open = (FRAME_OPEN / FRAME_D) * S, inset = (S - open * 2) / 2 - 0.5;
  const box = { left: `${inset}px`, top: `${inset}px`, width: `${S - inset * 2}px`, height: `${S - inset * 2}px` };
  const night = p.night ?? frameSkyOf(p.frame) === 'night';
  return (
    <span class={'pf-framed ' + (p.class ?? '')} style={{ width: `${S}px`, height: `${S}px` }}>
      {!p.photo && <img class="sky" src={portraitSky(night, Math.round(S * 1.4))} style={box} alt="" draggable={false} />}
      {p.src && <img class={p.photo ? 'pic photo' : 'pic'} src={p.src} style={box} alt="" draggable={false} />}
      <img class="frm" src={frameArt(p.frame, Math.round(S))} alt="" draggable={false} />
    </span>
  );
}

/** An owl's face (a render of its 3D toy) in a frame. */
export function OwlFace(p: { look: OwlLook; frame: string; size: number }) {
  const src = useOwlIcon(p.look, 'face');
  return <Framed src={src} frame={p.frame} size={p.size} />;
}

/** Your portrait as the HUD shows it: the studio photo when it is on, else your owl. `frame` overrides yours. */
export function MyFace(p: { size: number; frame?: string }) {
  const s = save.value, frame = p.frame ?? s.frame;
  if (s.photo?.on && s.photo.url) return <Framed src={s.photo.url} frame={frame} size={p.size} photo />;
  return <OwlFace look={s.look} frame={frame} size={p.size} />;
}

/** A neighbour's cut-paper silhouette in its ebony ring. */
export function Cameo(p: { critter: Critter; size: number }) {
  void texReady.value;
  return <img class="pf-cameo" src={cameoArt(p.critter, p.size)} style={{ width: `${p.size}px`, height: `${p.size}px` }} alt="" draggable={false} />;
}
