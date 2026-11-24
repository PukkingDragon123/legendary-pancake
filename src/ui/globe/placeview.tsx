// The place view: the card that rises when the camera has flown down to a place on the globe. Real photographs
// as big travel prints (swipe them; tap one to see it full screen), the country, local time and a few friendly
// facts, the souvenir turning in a glass case (the real 3D model), how the place opens (or "Explore tonight")
// and its passport stamp.
// [globe] OWNED BY THE GLOBE BUILDER.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { ITEM_BY_ID, type Area } from '../../game/catalog.ts';
import { PLACE_INFO } from '../../game/places.ts';
import { areaOpen, edit, level, save } from '../../game/store.ts';
import { isNightAt, localTime } from '../../world/globe/earth.ts';
import { SouvenirView } from '../../world/globe/souvenirview.ts';
import { SOUVENIR_INFO } from '../../assets/souvenirs.ts';
import { b9, cabinetFrame, linenTile, paperNote, tape, thinFrame, velvetTile } from '../chrome/surfaces.ts';
import { uiBurst, uiBurstAt } from '../chrome/uifx.ts';
import { Px } from '../icons.tsx';
import { tap, toast } from '../kit.tsx';
import { padlock, stampArt } from './art.ts';
import { PLACE_PHOTOS, SHEET, sheetUrl } from './photos.ts';
import { photoStamp, sheetsReady, thumbsReady } from './placephoto.ts';
import { nightsAt, travelOf } from './travel.ts';

let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const el = document.createElement('style');
  el.textContent = `
.gb-sheet{${b9(cabinetFrame('walnut', 14))};background:url("${linenTile()}") 0 0/96px 96px,#efe4cb;background-clip:padding-box}
.gb-print{${b9(paperNote('cream', 3), true, 'round')};background:none}
.gb-print:nth-child(2){${b9(paperNote('cream', 7), true, 'round')};background:none}
.gb-print:nth-child(3){${b9(paperNote('cream', 11), true, 'round')};background:none}
.gb-print::before{background-image:url("${tape(52)}")}
.gb-facts{${b9(paperNote('yellow', 4), true, 'round')};background:none}
.gb-case{${b9(thinFrame('oak', 7))};background:url("${velvetTile('sapphire')}") 0 0/64px 64px,#24304a;background-clip:padding-box}
`;
  document.head.appendChild(el);
}

/** what still stands between the player and a place ('' when it is open) */
export function requirement(a: Area): string {
  const s = save.value, L = level.value.level;
  const parts: string[] = [];
  if (L < a.level) parts.push(`reach level ${a.level}`);
  if ((a.streak ?? 0) > s.bestStreak) parts.push(`sleep ${a.streak} good nights in a row`);
  return parts.length ? parts.join(' and ') : '';
}

const RARITY: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

export function PlaceView(p: { a: Area; shown: boolean; side: boolean; onBack: () => void; onStep: (d: number) => void }) {
  injectCSS();
  const a = p.a, s = save.value;
  const info = PLACE_INFO[a.id];
  const photos = PLACE_PHOTOS[a.id] ?? [];
  const ready = !!sheetsReady.value[a.id];
  const open = areaOpen(a.id);
  const isTonight = s.area === a.id;
  const nights = nightsAt(s, a.id);
  const night = isNightAt(a.lat, a.lon);
  const [lb, setLb] = useState<number | null>(null);
  const [svi, setSvi] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<SouvenirView | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const souv = a.souvenirs.map((id) => ({ id, name: ITEM_BY_ID[id]?.name ?? id, have: s.owned.items.includes(id), info: SOUVENIR_INFO[id] }));
  const cur = souv[Math.min(svi, souv.length - 1)];

  useEffect(() => { setSvi(0); setLb(null); body.current?.scrollTo({ top: 0 }); const r = body.current?.querySelector('.gb-prints'); r?.scrollTo({ left: 0 }); }, [a.id]);
  useEffect(() => {
    if (!canvas.current) return;
    try { view.current = new SouvenirView(canvas.current); } catch (e) { console.warn('souvenir view', e); }
    return () => { view.current?.dispose(); view.current = null; };
  }, []);
  useEffect(() => { if (cur) void view.current?.show(cur.id, cur.have); }, [cur?.id, cur?.have]);

  const explore = () => {
    if (!open || isTonight) return;
    edit((x) => { x.area = a.id; });
    tap('ui_confirm');
    sound.play('reward_unlock', { volume: 0.3 });
    sound.play('owl_hoot', { volume: 0.25 });
    sound.play('wings_flutter', { volume: 0.5 });
    uiBurstAt(btn.current, 'stars', 12);
    const r = btn.current?.getBoundingClientRect();
    if (r) uiBurst('sparkle', r.left + r.width / 2, r.top, 10);
    toast(`Tonight Pip flies to ${a.name}`);
  };
  const L = level.value.level;
  const req = requirement(a);
  const log = travelOf(s).nights[a.id];
  const k = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
  void thumbsReady.value;
  const stamp = photoStamp(a, { date: log?.first, state: log ? 'visited' : open ? 'open' : 'locked', seed: 7 }, 2 * k) ?? stampArt(a, { date: log?.first, state: log ? 'visited' : open ? 'open' : 'locked', seed: 7 }, 2 * k);
  const photoBg = (i: number) => ({ backgroundImage: ready ? `url(${sheetUrl(a.id)})` : 'none', backgroundSize: '200% 200%', backgroundPosition: `${(i % 2) * 100}% ${Math.floor(i / 2) * 100}%` });

  return (
    <>
      <section class={'gb-sheet' + (p.shown ? ' in' : '')} role="dialog" aria-label={a.title}>
        <div class="gb-body" ref={body}>
          <header class="gb-head">
            <div>
              <h2>{a.title}</h2>
              <p class="gb-where">{a.country}{a.country !== a.continent ? ` · ${a.continent}` : ''}</p>
            </div>
            <span class={'gb-clock' + (night ? ' night' : '')}><Px name={night ? 'moon' : 'sun'} size={18} />{localTime(a.tz, s.settings.hour12)}<small>{night ? 'night there' : 'day there'}</small></span>
          </header>

          <div class="gb-prints">
            {photos.map((ph, i) => (
              <button class="gb-print" onClick={() => { tap('paper_flip', 0.35); setLb(i); }} aria-label={ph.caption}>
                <i class={'gb-photo' + (ready ? ' in' : '')} style={photoBg(i)} />
                <span>{ph.caption}</span>
              </button>
            ))}
          </div>
          <p class="gb-hint2">Swipe the photos · tap one to see it big</p>

          <div class="gb-facts">
            <h4>Did you know?</h4>
            <ul>{info?.facts.map((f) => <li>{f}</li>)}</ul>
            <p class="gb-lang"><b>You would hear:</b> {info?.lang}</p>
          </div>

          {cur && (
            <div class="gb-souv">
              <h4>Souvenir{souv.length > 1 ? 's' : ''} from here</h4>
              <div class="gb-souvrow">
                <div class="gb-case"><canvas ref={canvas} /><i class="gb-glass" /><i class={'gb-tag' + (cur.have ? ' have' : '')}>{cur.have ? 'Found' : 'Not found yet'}</i></div>
                <div class="gb-souvtxt">
                  <b>{cur.name}</b>
                  <span class={'gb-rar ' + (cur.info?.rarity ?? 'common')}>{RARITY[cur.info?.rarity ?? 'common']}</span>
                  <p>{cur.have ? 'Found! It is in your storage, ready to place in the house.' : open ? 'Pip might bring it home from a night here.' : 'Pip can bring it home once this place opens.'}</p>
                  {souv.length > 1 && (
                    <div class="gb-souvtabs">
                      {souv.map((x, i) => <button class={i === svi ? 'on' : ''} onClick={() => { tap('ui_tab', 0.4); setSvi(i); }}>{x.have ? <Px name="check" size={14} /> : null}{x.name.split(' ').slice(-1)[0]}</button>)}
                    </div>
                  )}
                </div>
              </div>
              <p class="gb-turn">Drag the souvenir to turn it round.</p>
            </div>
          )}

          {open ? (
            <div class="gb-go">
              <button ref={btn} class={'btn pillow big block' + (isTonight ? ' honey' : '')} onClick={explore}>
                {isTonight ? <><Px name="check" size={22} /> Tonight’s destination</> : <><Px name="moon" size={22} /> Explore tonight</>}
              </button>
              <small>{isTonight ? 'Pip will fly here when you go to sleep.' : 'Pip flies here while you sleep and brings back finds.'}</small>
            </div>
          ) : (
            <div class="gb-locked">
              <img src={padlock(2 * k)} alt="" />
              <div>
                <b>Opens at level {a.level}</b>
                <span>To fly here, {req || 'keep sleeping well'}.</span>
                <i class="gb-bar"><i style={{ width: `${Math.min(100, (L / a.level) * 100)}%` }} /></i>
                <small>Level {L} of {a.level}{a.streak ? ` · best streak ${s.bestStreak} of ${a.streak}` : ''}</small>
              </div>
            </div>
          )}

          <div class="gb-stampline">
            <img src={stamp} alt="" />
            <div>
              <b>Passport stamp</b>
              <span>{log ? `Stamped ${new Date(log.first).toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${nights} ${nights === 1 ? 'night' : 'nights'} here` : 'Sleep here once to earn this stamp.'}</span>
            </div>
          </div>

          <div class="gb-nav">
            <button class="btn soft gb-arrow2" onClick={() => p.onStep(-1)} aria-label="Previous place"><Px name="arrow_left" size={22} /></button>
            <button class="btn soft grow" onClick={p.onBack}><Px name="arrow_left" size={20} /> Back to the Earth</button>
            <button class="btn soft gb-arrow2" onClick={() => p.onStep(1)} aria-label="Next place"><Px name="arrow_right" size={22} /></button>
          </div>
          <p class="gb-credit">Photos: {photos.map((ph) => `${ph.author} (${ph.licence})`).join(' · ')}, via Flickr. Satellite: NASA Blue Marble.</p>
        </div>
      </section>

      {lb !== null && photos[lb] && (
        <div class="gb-lightbox" onClick={() => setLb(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <i class="gb-big" style={{ ...photoBg(lb), aspectRatio: `${SHEET.cw} / ${SHEET.ch}` }} />
            <figcaption>
              <b>{photos[lb].caption}</b>
              <small>“{photos[lb].title}” by {photos[lb].author} · {photos[lb].licence}</small>
            </figcaption>
            <div class="gb-lbnav">
              <button class="btn soft gb-arrow2" onClick={() => { tap('paper_flip', 0.3); setLb((lb + photos.length - 1) % photos.length); }} aria-label="Previous photo"><Px name="arrow_left" size={22} /></button>
              <button class="btn soft" onClick={() => setLb(null)}><Px name="cross" size={18} /> Close</button>
              <button class="btn soft gb-arrow2" onClick={() => { tap('paper_flip', 0.3); setLb((lb + 1) % photos.length); }} aria-label="Next photo"><Px name="arrow_right" size={22} /></button>
            </div>
          </figure>
        </div>
      )}
    </>
  );
}
