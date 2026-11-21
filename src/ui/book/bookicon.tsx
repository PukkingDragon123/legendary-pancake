// The Book's icon for the main buttons: a chunky little pixel copy of Pip's book (midnight leather,
// brass owl medallion, red ribbon, a page with a hypnogram scribble underneath). The cover lifts
// when hovered or pressed, the ribbon wiggles, and now and then the cover peeks open by itself.
//   <BookIcon size={44} />     (size = CSS px tall; the sprite set also has <Px name="bigbook" />)
import { HUD_BOOK, hudBase, hudCover, hudRibbon } from '../px/bookart.js';

let injected = false;
function css() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const st = document.createElement('style');
  st.id = 'bk-icon-css';
  st.textContent = `
.bk-icon { position: relative; display: inline-block; flex: none; image-rendering: pixelated; filter: drop-shadow(0 2px 0 rgba(7, 8, 26, .45)); }
.bk-icon img { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; max-width: none; pointer-events: none; }
.bk-icon .bk-icov { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 0 50%; transition: transform .32s cubic-bezier(.3, 1.5, .5, 1); animation: bk-icon-peek 7s ease-in-out 2s infinite; }
.bk-icon .bk-irib { transform-origin: 50% 0; animation: bk-icon-sway 3.2s ease-in-out infinite; }
@keyframes bk-icon-peek { 0%, 90%, 100% { transform: none; } 93% { transform: perspective(140px) rotateY(-28deg); } 96% { transform: perspective(140px) rotateY(-6deg); } }
@keyframes bk-icon-sway { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(8deg); } }
@media (hover: hover) { *:hover > .bk-icon .bk-icov, .bk-icon:hover .bk-icov { transform: perspective(140px) rotateY(-38deg); animation: none; } *:hover > .bk-icon .bk-irib { animation: bk-icon-wig .8s ease-in-out; } }
*:active > .bk-icon .bk-icov { transform: perspective(140px) rotateY(-55deg); transition-duration: .08s; animation: none; }
@keyframes bk-icon-wig { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(16deg); } 55% { transform: rotate(-11deg); } 80% { transform: rotate(5deg); } }
@media (prefers-reduced-motion: reduce) { .bk-icon .bk-icov, .bk-icon .bk-irib { animation: none; } }
`;
  document.head.appendChild(st);
}

export function BookIcon(p: { size?: number; class?: string; style?: string }) {
  css();
  const k = (p.size ?? 44) / HUD_BOOK.h, [rx, ry, rw] = HUD_BOOK.rib;
  const W = HUD_BOOK.w * k, H = HUD_BOOK.h * k;
  return (
    <span class={'bk-icon ' + (p.class ?? '')} style={`width:${W}px;height:${H}px;${p.style ?? ''}`} aria-hidden="true">
      <img src={hudBase().url} alt="" draggable={false} style={{ width: `${W}px`, height: `${H}px` }} />
      <img class="bk-irib" src={hudRibbon().url} alt="" draggable={false} style={{ left: `${rx * k}px`, top: `${ry * k}px`, width: `${rw * k}px` }} />
      <span class="bk-icov"><img src={hudCover().url} alt="" draggable={false} style={{ width: `${W}px`, height: `${H}px` }} /></span>
    </span>
  );
}
