// [look5] The home view looks into Pip's living room; this little hanging tile takes the camera out through the open
// front to the whole oak and back in. A walnut tile with brass corners and felt like the side tools, hung by a cord at
// the left edge: a tiny arched window onto a leafy tree ("Outside") or a lit lantern ("Inside"). Pinching and the mouse
// wheel do the same (src/world/scene.ts zoomBy). Kept to one small object, in the same relief-painted style.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { phase } from '../../game/night.ts';
import { save } from '../../game/store.ts';
import { haptic } from '../kit.tsx';
import { breathing, panel, sceneRef, tab } from '../state.ts';
import { and, clamp, disc, dome, ell, flat, hex, MAT, metal, or, PAL, poly, puff, rampAt, rect, Relief, ring, seg, solid, torus, tubeY, vnoise, woodGrain, type Shape } from '../px/relief.ts';
import { cachedRelief, DESK_HUD, hempRope, kFor, toolTile } from './objects.ts';
import { hudOverride } from './hud.tsx';
import { uiBurstAt } from './uifx.ts';

/** An arched window in an oak frame: blue sky, a round leafy tree and a little hill, a brass catch. */
function windowIcon(k: number): string {
  return cachedRelief(`look:win:${k}`, () => {
    const r = new Relief(22, 22, 1, k);
    const arch: Shape = or(rect(3.4, 9, 15.2, 11.2), and(ell(11, 9, 7.6, 7.2), (_x, y) => y <= 9.2));
    const glass: Shape = or(rect(5.2, 9, 11.6, 9.6), and(ell(11, 9, 5.8, 5.4), (_x, y) => y <= 9.2));
    r.fill(arch, flat(2.4), woodGrain(PAL.oak, { seed: 9, base: 0.56, along: 'y' }), MAT.varnish, { id: 1 });
    r.carve(glass, () => -1.6);
    r.paint(glass, (_x, _y, mx, my) => rampAt(PAL.sky, clamp(0.78 - (my - 4) * 0.035 + (vnoise(mx * 0.7, my * 0.7, 5) - 0.5) * 0.08)), MAT.glass);
    // a soft cloud, the hill and the tree
    r.paint(and(glass, ell(8.2, 6.6, 2.6, 1.1)), solid(hex('#f4f8fb'), 0.06), MAT.cloth);
    r.paint(and(glass, ell(11, 20.2, 9, 3.6)), (_x, _y, mx, my) => rampAt(PAL.moss, clamp(0.62 - (my - 17) * 0.05 + (vnoise(mx, my, 3) - 0.5) * 0.12)), MAT.moss);
    r.fill(and(glass, rect(11.6, 11.5, 1.4, 5.6)), tubeY(12.3, 0.7, 1), woodGrain(PAL.walnut, { seed: 3, base: 0.45, along: 'y', scale: 0.4 }), MAT.wood, { id: 2 });
    r.fill(and(glass, disc(12.4, 9.4, 3.6)), puff(12.4, 9.4, 3.6, 3.4, 2.2, 2.4, 0.4), (_x, _y, mx, my) => rampAt(PAL.emerald, clamp(0.6 - (my - 7) * 0.04 + (vnoise(mx * 1.3, my * 1.3, 8) - 0.5) * 0.3)), MAT.moss, { id: 3, seam: true });
    // mullions and the sill
    r.fill(and(glass, or(rect(10.4, 3.4, 1.2, 15.4), rect(5, 12.4, 12, 1.1))), flat(3), woodGrain(PAL.oak, { seed: 4, base: 0.62 }), MAT.varnish, { id: 4, seam: true });
    r.fill(rect(2.4, 19.4, 17.2, 2.2), flat(3.4), woodGrain(PAL.walnut, { seed: 6, base: 0.55 }), MAT.varnish, { id: 5, seam: true });
    r.fill(disc(16.2, 14.6, 0.9), dome(16.2, 14.6, 0.9, 0.9, 0.8, 3.4), metal(PAL.brass, { base: 0.7 }), MAT.brass, { id: 6, seam: true });
    return r.url();
  });
}

/** A little hanging coach lantern, lit: brass cap and ring, warm glass, an iron frame. */
function lanternIcon(k: number): string {
  return cachedRelief(`look:lamp:${k}`, () => {
    const r = new Relief(22, 22, 1, k);
    r.fill(ring(11, 2.4, 1.1, 2.2), torus(11, 2.4, 1.65, 0.55, 1.2, 3), metal(PAL.brass, { base: 0.64 }), MAT.brass, { id: 1 });
    r.fill(poly([[6.4, 7.6], [15.6, 7.6], [13.4, 4.4], [8.6, 4.4]]), (x) => 3 + 1.4 * Math.cos(clamp(Math.abs(x - 11) / 4.6) * 1.5), metal(PAL.brass, { base: 0.6, brush: 'x' }), MAT.brass, { id: 2, seam: true });
    const glass = poly([[7.2, 8], [14.8, 8], [14, 17.2], [8, 17.2]]);
    r.fill(glass, flat(2), (_x, _y, mx, my) => rampAt(PAL.gold, clamp(0.9 - Math.hypot(mx - 11, my - 12.4) * 0.09 + (vnoise(mx, my, 2) - 0.5) * 0.06)), MAT.glow, { id: 3 });
    r.paint(and(glass, ell(11, 12.6, 1.1, 2.1)), solid(hex('#fffbe8')), MAT.glow);
    for (const x of [7.6, 11, 14.4]) r.fill(and(seg(x, 8, x + (x < 11 ? 0.5 : x > 11 ? -0.5 : 0), 17.2, 0.45), all2), flat(3), metal(PAL.iron, { base: 0.5 }), MAT.iron, { id: 4 });
    r.fill(poly([[6.8, 17], [15.2, 17], [14.2, 19.6], [7.8, 19.6]]), flat(3.2), metal(PAL.brass, { base: 0.55 }), MAT.brass, { id: 5, seam: true });
    r.fill(disc(11, 20.4, 1.2), dome(11, 20.4, 1.2, 1, 1, 3), metal(PAL.brass, { base: 0.66 }), MAT.brass, { id: 6, seam: true });
    return r.url();
  });
}
const all2: Shape = () => true;

const STYLE = `
.hh-look { position: absolute; left: 8px; bottom: calc(274px + var(--safe-b, 0px)); z-index: 4; width: 60px; transition: transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1) 0.1s; image-rendering: pixelated; pointer-events: none; }
.hh-look.away { transform: translateX(-110px); transition: transform 0.4s cubic-bezier(0.55, -0.3, 0.75, 0.4); }
.hh-look .hh-lookcord { position: absolute; left: 27px; top: -26px; width: 6px; height: 30px; background-repeat: repeat-y; background-size: 6px 6px; box-shadow: 2px 0 0 rgba(40, 34, 27, 0.25); }
.hh-look .hh-lookhang { position: relative; display: flex; flex-direction: column; align-items: center; transform-origin: 30px 0; animation: hhLookSway 5.5s ease-in-out infinite; }
.hh-look button { position: relative; width: 52px; height: 60px; background-size: 100% 100%; background-repeat: no-repeat; image-rendering: pixelated; filter: drop-shadow(2px 3px 0 rgba(26, 14, 8, 0.45)); pointer-events: auto; transition: scale 0.15s; }
.hh-look button:active { scale: 0.92 1.04; }
.hh-look button img { position: absolute; left: 4px; top: 13px; width: 44px; height: 44px; image-rendering: pixelated; filter: drop-shadow(1px 2px 0 rgba(20, 10, 6, 0.55)); }
.hh-look button.flip img { animation: hhLookFlip 0.45s steps(5); }
.hh-look .hh-looklabel { margin-top: 1px; padding: 2px 5px; font-family: var(--font-display); font-size: 13px; line-height: 1; white-space: nowrap; color: #2a1a10; background: #f6ead0; box-shadow: inset 0 2px 0 #fffaf0, inset 0 -2px 0 #dcc497, 0 0 0 2px #3a2414, 2px 4px 0 2px rgba(26, 14, 8, 0.35); pointer-events: none; }
@keyframes hhLookSway { 0%, 100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes hhLookFlip { 0% { transform: scale(1); } 40% { transform: scale(0.2, 1.1); } 100% { transform: scale(1); } }
html.hh-still .hh-look .hh-lookhang { animation: none; }
/* short screens (a phone on its side): just under the name sign, clear of the ticket in the middle */
@media (max-height: 600px) {
  .hh-look { bottom: auto; top: calc(var(--safe-t, 0px) + 112px); }
}
@media (min-width: 900px) {
  .hh-look { left: 20px; bottom: auto; top: calc(var(--safe-t, 0px) + 318px); }
}
@media (min-width: 900px) and (min-height: 640px) {
  .hh-look { scale: 1.5; transform-origin: 0 0; }
}
`;
let styled = false;

/** The tile that steps outside to see the whole oak, and back into the living room. */
export function LookOut() {
  if (!styled && typeof document !== 'undefined') { styled = true; const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st); }
  const [out, setOut] = useState(() => !!sceneRef.current?.outside);
  const [flip, setFlip] = useState(0);
  const k = useMemo(() => kFor(DESK_HUD), []);
  useEffect(() => {
    let off: (() => void) | null = null, id = 0;
    const hook = () => {
      const sc = sceneRef.current;
      if (!sc) { id = window.setTimeout(hook, 300); return; }
      setOut(sc.outside);
      off = sc.on((e) => { if (e.type === 'outside') { setOut(e.on); setFlip((n) => n + 1); } });
    };
    hook();
    return () => { clearTimeout(id); off?.(); };
  }, []);
  const ov = hudOverride.value;
  const away = ov === 'none' || (ov !== 'all' && (phase.value !== 'day' || !!breathing.value || !save.value.onboarded || !!panel.value || tab.value !== 'home'));
  const go = (e: MouseEvent) => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setOutside(!sc.outside);
    sound.play(sc.outside ? 'door_creak' : 'wood_knock', { volume: sc.outside ? 0.18 : 0.35, rate: 1.2, gap: 120 });
    sound.play('ui_open', { volume: 0.3, gap: 80 });
    haptic(6);
    uiBurstAt(e.currentTarget as Element, sc.outside ? 'leaves' : 'sparkle', 6);
  };
  const label = out ? 'Inside' : 'Outside';
  return (
    <div class={'hh-look' + (away ? ' away' : '')}>
      <i class="hh-lookcord" style={{ backgroundImage: `url("${hempRope()}")` }} />
      <div class="hh-lookhang">
        <button class={flip % 2 ? 'flip' : ''} key={flip} style={{ backgroundImage: `url("${toolTile(26, out ? 'rose' : 'sky', k, 1, 7)}")` }} onClick={go} aria-label={out ? 'Go back inside the living room' : 'Step outside to see the whole tree'}>
          <img src={out ? lanternIcon(k) : windowIcon(k)} alt="" draggable={false} />
        </button>
        <span class="hh-looklabel">{label}</span>
      </div>
    </div>
  );
}
