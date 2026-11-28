// [postcard] The postcard Pip mails home from his first night at a place (src/game/postcards.ts): a vintage
// "Greetings from" card made from the place's own photograph, with its postage stamp and a postmark dated the
// night it came (art.ts), and on the back a note in Pip's hand. Tap it to turn it over. Before it comes it is
// shown sealed: the photo faded under a wax seal. Used by the bedtime place card, the passport and the morning.
import { useState } from 'preact/hooks';
import type { Area } from '../../game/catalog.ts';
import { save } from '../../game/store.ts';
import { hex } from '../real/paint.ts';
import { sealArt } from '../real/kit.ts';
import { tap } from '../kit.tsx';
import { postageStamp, postmark } from './art.ts';
import { sheetUrl, THUMBS } from './photos.ts';
import './postcard.css';

const k = () => Math.min(3, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));

/** CSS background for a place's first photo: the big sheet over the small atlas (shown while the sheet loads). */
export function photoBg(id: string, i = 0): Record<string, string> {
  const t = Math.max(0, THUMBS.order.indexOf(id)), rows = Math.ceil(THUMBS.order.length / THUMBS.cols);
  const col = t % THUMBS.cols, row = Math.floor(t / THUMBS.cols);
  const sheet = `url(${sheetUrl(id)})`, atlas = `url(${import.meta.env.BASE_URL}${THUMBS.src})`;
  return {
    backgroundImage: i === 0 ? `${sheet}, ${atlas}` : sheet,
    backgroundSize: i === 0 ? `200% 200%, ${THUMBS.cols * 100}% ${rows * 100}%` : '200% 200%',
    backgroundPosition: i === 0 ? `0% 0%, ${(col / (THUMBS.cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%` : `${(i % 2) * 100}% ${Math.floor(i / 2) * 100}%`,
  };
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

export function Postcard(p: { a: Area; date?: number; class?: string; flippable?: boolean }) {
  const a = p.a, s = save.value, got = !!p.date;
  const [back, setBack] = useState(false);
  const flip = () => { if (!got || p.flippable === false) return; tap('paper_flip', 0.4); setBack(!back); };
  const you = s.profile?.you?.trim() || 'friend';
  const sight = a.sights[0] ?? 'the view';
  const short = a.title.replace(/^The /, '');
  return (
    <div class={'pc' + (got ? ' got' : ' sealed') + (back ? ' back' : '') + (p.class ? ' ' + p.class : '')} style={{ '--place': a.color } as Record<string, string>}
      onClick={flip} role={got ? 'button' : 'img'} aria-label={got ? `Postcard from ${a.title}${back ? ' (back)' : ''}. Tap to turn over.` : `Postcard from ${a.title}, not yet sent`}>
      <div class="pc-in">
        <div class="pc-face pc-front">
          <i class="pc-photo" style={photoBg(a.id)} />
          <i class="pc-grade" />
          <div class="pc-greet">
            <em>Greetings from</em>
            <b style={{ '--len': String(Math.max(5, short.length)) } as Record<string, string>}>{short}</b>
          </div>
          <img class="pc-stamp" src={postageStamp(a, 2 * k())} alt="" draggable={false} />
          {got && <img class="pc-mark" src={postmark(a, 2 * k(), p.date)} alt="" draggable={false} />}
          {!got && (
            <div class="pc-seal">
              <img src={sealArt(30, hex(a.color), a.level + 3)} alt="" draggable={false} />
              <span>Sealed until your first night here</span>
            </div>
          )}
          {got && <i class="pc-turn" aria-hidden="true">↻</i>}
        </div>
        <div class="pc-face pc-back-face">
          <div class="pc-note">
            <p>Dear {you},</p>
            <p>Greetings from {a.name}! Tonight I saw {sight}. The satchel is getting heavy.</p>
            <p>Wish you were here!</p>
            <p class="pc-sig">Love, {s.name || 'Pip'}</p>
          </div>
          <div class="pc-addr">
            <div class="pc-stamps">
              <img class="pc-stamp2" src={postageStamp(a, 2 * k())} alt="" draggable={false} />
              {got && <img class="pc-mark2" src={postmark(a, 2 * k(), p.date)} alt="" draggable={false} />}
            </div>
            <span>{you}</span>
            <span>The Hollow Oak</span>
            <span>Hoot Hollow</span>
            {p.date && <small>Sent {fmtDate(p.date)}</small>}
          </div>
        </div>
      </div>
    </div>
  );
}
