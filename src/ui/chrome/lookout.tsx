// [look5] The home view looks into Pip's living room; this little hanging tile takes the camera out through the open
// front to the whole oak and back in. A walnut tile with brass corners and felt like the side tools, hung by a cord at
// the left edge. [icons9] Now just a door you click, hanging from a brass ring (no tile behind it): a round hobbit door
// of green planks in a ring of stones, iron strap hinges and a brass knocker ("Outside"); the same door ajar with warm
// lamplight inside ("Inside"). Painted by the icon bake (src/dev/iconbake.ts, door_out / door_in, with a crisp dark
// outline); the tile with the painted window or lantern stays as the fallback while the icons load. Pinching and the
// mouse wheel do the same (src/world/scene.ts zoomBy).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { phase } from '../../game/night.ts';
import { save } from '../../game/store.ts';
import { haptic } from '../kit.tsx';
import { breathing, panel, sceneRef, tab } from '../state.ts';
import { GOLD, IRON, Real, bevel, box, cached, circle, clamp, cloth, deviceK, dome, glow, hex, metal, mix, polygon, ring, segment, toURL, tubeY, union, wood, type RGB } from '../real/paint.ts';
import { DESK_HUD, hempRope, kFor, toolTile } from './objects.ts';
import { hookArt, hudOverride } from './hud.tsx';
import { uiBurstAt } from './uifx.ts';
import { iconSrc, uiAtlas } from './iconset.ts';

/** An arched window in an oak frame: blue sky, a round leafy tree and a little hill, a brass catch (44 CSS px). */
function windowIcon(zoom: number): string {
  return cached(`look7:win:${zoom}`, () => {
    const r = new Real(44, 44, deviceK(3) * zoom, 0);
    const arch = union(box(6.8, 18, 30.4, 22.4, 1), circle(22, 18, 15.2));
    const glassS = union(box(10.4, 18, 23.2, 19.2, 0.5), circle(22, 18, 11.6));
    r.part(arch, bevel(3, 2.2), wood('oak', { along: 'y' }));
    const sky = (x: number, y: number): RGB => {
      let c = mix(hex('#5aa6e0'), hex('#cfe9f8'), clamp((y - 6) / 26)) as RGB;
      const cl = Math.exp(-(((x - 16) / 6) ** 2 + ((y - 13) / 2.4) ** 2));
      c = mix(c, [250, 252, 255], cl * 0.9) as RGB;
      const hill = y > 33 + Math.sin(x * 0.18) * 2;
      if (hill) c = mix(hex('#5e9a34'), hex('#3f7a2e'), clamp((y - 33) / 6)) as RGB;
      return c;
    };
    r.part(glassS, 0.6, { alb: sky, spec: 0.9, shin: 80, coat: 0.9 });
    r.part(box(23.6, 22, 2.8, 12, 1), tubeY(25, 1.4, 1), wood('walnut', { along: 'y', scale: 4 }));
    r.part(circle(24.8, 18.8, 7.2), dome(24.8, 18.8, 7.2, 6.8, 3, 1.5), { ...cloth('felt', hex('#3f8a3a'), { scale: 5, amt: 1.2 }), spec: 0.15, shin: 10 });
    r.part(union(box(20.8, 6.8, 2.4, 30.8, 0.8), box(10, 24.8, 24, 2.2, 0.8)), 3, wood('oak', { along: 'y', ox: 30 }));
    r.part(box(4.8, 38.8, 34.4, 4.4, 1.5), bevel(3.4, 1.4), wood('walnut', { along: 'x' }));
    r.part(circle(32.4, 29.2, 1.8), dome(32.4, 29.2, 1.8, 1.8, 1.2, 3.4), metal(GOLD, { polish: 0.8 }));
    return r.url({ shadow: { dy: 1.5, blur: 2, a: 0.45 } });
  });
}

/** A little hanging coach lantern, lit: brass cap and ring, warm glass, an iron frame (44 CSS px). */
function lanternIcon(zoom: number): string {
  return cached(`look7:lamp:${zoom}`, () => {
    const r = new Real(44, 44, deviceK(3) * zoom, 0);
    const brass = metal(GOLD, { polish: 0.8 });
    r.part(ring(22, 4.8, 2.2, 4.4), (x, y) => 4 + 1.2 * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - 22, y - 4.8) - 3.3) / 1.1) ** 2)), brass);
    r.part(polygon([[12.8, 15.2], [31.2, 15.2], [26.8, 8.8], [17.2, 8.8]]), (x) => 3 + 2.6 * Math.cos(clamp(Math.abs(x - 22) / 9.2) * 1.5), brass);
    const glassS = polygon([[14.4, 16], [29.6, 16], [28, 34.4], [16, 34.4]]);
    r.part(glassS, 2, glow((x, y) => mix(hex('#fff6d0'), hex('#e8a030'), clamp(Math.hypot(x - 22, y - 24.8) / 11)) as RGB));
    for (const x of [15.2, 22, 28.8]) r.part(segment(x, 16, x + (x < 22 ? 1 : x > 22 ? -1 : 0), 34.4, 0.7), 3, metal(IRON, { polish: 0.4 }));
    r.part(polygon([[13.6, 34], [30.4, 34], [28.4, 39.2], [15.6, 39.2]]), bevel(2, 1.2, 2.4), brass);
    r.part(circle(22, 40.8, 2.4), dome(22, 40.8, 2.4, 2, 1.4, 3), brass);
    const c = r.canvas({ shadow: { dy: 1.5, blur: 2, a: 0.45 } });
    const g = c.getContext('2d')!, k = deviceK(3) * zoom;
    g.globalCompositeOperation = 'destination-over';
    const gr = g.createRadialGradient(22 * k, 25 * k, 0, 22 * k, 25 * k, 22 * k);
    gr.addColorStop(0, 'rgba(255,210,120,.55)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    return toURL(c);
  });
}

const STYLE = `
.hh-look { position: absolute; left: 8px; bottom: calc(274px + var(--safe-b, 0px)); z-index: 4; width: 60px; transition: transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1) 0.1s; pointer-events: none; }
.hh-look.away { transform: translateX(-110px); transition: transform 0.4s cubic-bezier(0.55, -0.3, 0.75, 0.4); }
.hh-look .hh-lookcord { position: absolute; left: 27px; top: -26px; width: 6px; height: 30px; background-repeat: repeat-y; background-size: 6px 8px; filter: drop-shadow(1px 2px 1.5px rgba(30, 18, 8, 0.4)); }
.hh-look .hh-lookhang { position: relative; display: flex; flex-direction: column; align-items: center; transform-origin: 30px 0; animation: hhLookSway 5.5s ease-in-out infinite; }
.hh-look button { position: relative; width: 52px; height: 60px; isolation: isolate; pointer-events: auto; transition: scale 0.15s; }
.hh-look button::before { content: ''; position: absolute; inset: -4px; z-index: -1; background: var(--art) 0 0 / 100% 100% no-repeat; }
.hh-look button:active { scale: 0.92 1.04; }
.hh-look button img { position: absolute; left: 4px; top: 13px; width: 44px; height: 44px; filter: drop-shadow(1px 2px 3px rgba(20, 10, 6, 0.5)); }
.hh-look button.flip img { animation: hhLookFlip 0.45s ease-in-out; }
.hh-look .hh-looklabel { margin-top: 1px; padding: 2px 5px; font-family: var(--font-display); font-size: var(--t1); line-height: 1; white-space: nowrap; color: #2a1a10; background: var(--tx-paper) 0 0 / 200px, #f6ead0; border-radius: 4px; box-shadow: 0 1px 1px rgba(30, 16, 6, 0.35), 0 3px 6px rgba(30, 16, 6, 0.3), inset 0 1px 1px rgba(255, 252, 240, 0.8), inset 0 -1px 2px rgba(140, 100, 50, 0.25); pointer-events: none; }
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
  .hh-look .hh-looklabel { font-size: calc(var(--t1) / 1.5); } /* [font6] one art pixel per font pixel after the 1.5x scale */
}
`;
let styled = false;

/** The tile that steps outside to see the whole oak, and back into the living room. */
export function LookOut() {
  if (!styled && typeof document !== 'undefined') { styled = true; const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st); }
  const [out, setOut] = useState(() => !!sceneRef.current?.outside);
  const [flip, setFlip] = useState(0);
  const k = useMemo(() => kFor(DESK_HUD), []);
  const [, setAtlas] = useState(0);
  useEffect(() => { void uiAtlas().then(() => setAtlas(1)); }, []);
  // [icons9] the door at its device size: the tile is zoomed 1.5x on desktops (k), so that is 44 x dpr x k
  const dpr = Math.min(4, Math.max(1, Math.round((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1)));
  const door = iconSrc(out ? 'door_in' : 'door_out', Math.round(44 * dpr * k), dpr);
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
        <button class={flip % 2 ? 'flip' : ''} key={flip} style={{ '--art': `url("${door ? hookArt() : toolTile(52, out ? 'rose' : 'sky', k, 1, 7)}")` } as Record<string, string>} onClick={go} aria-label={out ? 'Go back inside the living room' : 'Step outside to see the whole tree'}>
          <img src={door ?? (out ? lanternIcon(k) : windowIcon(k))} alt="" draggable={false} />
        </button>
        <span class="hh-looklabel">{label}</span>
      </div>
    </div>
  );
}
