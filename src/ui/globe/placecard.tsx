// [postcard] The place card of the bedtime place picker (ui/globepick.tsx): it slides in once the camera has
// flown down to a place. A carved walnut cabinet with a parchment page: the place's real photographs, its clock
// right now (live, day or night), how far it is from home, the loot Pip can bring back from a night there (what
// the night's roll in adventure.ts really draws from: the souvenirs, the outfit pieces and coats, the furniture;
// each with its rarity and whether you have it), the postcard you unlock on your first night there, and five
// true facts. "Fly here tonight" starts the flight; "Planet" flies back up.
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Area, RARITY_COLOR, RARITY_NAME } from '../../game/catalog.ts';
import { PLACE_INFO } from '../../game/places.ts';
import { distanceKm, flightHours, fmtHours, localHour, placeLoot, postcardDate, souvenirNote, tzDiffText, tzOffsetMinutes, type LootLine } from '../../game/postcards.ts';
import { areaOpen, level, save } from '../../game/store.ts';
import { SOUVENIR_INFO } from '../../assets/souvenirs.ts';
import { homeGuess, isNightAt, localTime } from '../../world/globe/earth.ts';
import { hex } from '../real/paint.ts';
import { sealArt } from '../real/kit.ts';
import { Px } from '../icons.tsx';
import { tap } from '../kit.tsx';
import { findArt, findName } from '../morning.tsx';
import { stampArt } from './art.ts';
import { PLACE_PHOTOS } from './photos.ts';
import { loadSheet, photoStamp, thumbsReady } from './placephoto.ts';
import { requirement } from './placeview.tsx';
import { photoBg, Postcard } from './postcard.tsx';
import { nightsAt, travelOf } from './travel.ts';
import './placecard.css';

const home = homeGuess();
const dk = () => Math.min(3, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));

// ------------------------------------------------------------------ the live clock

function Dial(p: { h: number; night: boolean }) {
  const hr = ((p.h % 12) / 12) * 360, mn = ((p.h * 60) % 60) * 6;
  return (
    <span class={'pk-dial' + (p.night ? ' night' : '')} aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => <i class="tick" style={{ transform: `rotate(${i * 30}deg)` }} />)}
      <i class="hand h" style={{ transform: `rotate(${hr}deg)` }} />
      <i class="hand m" style={{ transform: `rotate(${mn}deg)` }} />
      <i class="pin" />
    </span>
  );
}

/** the place's clock, ticking: dial, time, day or night, and how far it is from yours */
function LocalClock(p: { a: Area }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  const a = p.a, night = isNightAt(a.lat, a.lon, now);
  const diff = tzOffsetMinutes(a.tz, now) + new Date(now).getTimezoneOffset();
  return (
    <div class={'pk-tile pk-time' + (night ? ' night' : '')}>
      <Dial h={localHour(a.tz, now)} night={night} />
      <div>
        <small>Time there now</small>
        <b>{localTime(a.tz, save.value.settings.hour12, now)}</b>
        <span><Px name={night ? 'moon' : 'sun'} size={16} />{night ? 'Night' : 'Day'} · {tzDiffText(diff)}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ loot

/** A loot tile. Icons are 3D renders: each tile asks for its picture a moment after the last, so a full card
 * never stalls a frame. */
function LootTile(p: { e: LootLine; delay: number; big?: boolean }) {
  const [armed, setArmed] = useState(p.delay <= 0);
  useEffect(() => { if (armed) return undefined; const t = setTimeout(() => setArmed(true), p.delay); return () => clearTimeout(t); }, []);
  const e = p.e, url = armed ? findArt(e) : '';
  const name = findName(e);
  const wear = e.kind === 'piece' || e.kind === 'palette';
  const note = e.owned ? (e.canDrop ? (e.group === 'souvenir' ? 'Yours · spares turn up' : 'Yours · can come again') : 'Yours · won’t come again') : e.group === 'souvenir' ? 'Only found here' : 'Not found yet';
  return (
    <div class={'pk-loot' + (p.big ? ' big' : '') + (e.owned ? ' owned' : '') + (e.canDrop ? '' : ' done')} style={{ '--rc': RARITY_COLOR[e.rarity] } as Record<string, string>} title={`${name} · ${RARITY_NAME[e.rarity]} · ${note}`}>
      <span class="art">{url ? <img src={url} alt="" draggable={false} /> : <Px name={wear ? 'hanger' : e.group === 'souvenir' ? 'satchel' : 'treehouse'} size={p.big ? 40 : 28} class="ph" />}</span>
      {e.owned && <i class="have" aria-label="You have it"><Px name="check" size={14} /></i>}
      <span class="tx">
        <b>{name}</b>
        <small class="rar">{RARITY_NAME[e.rarity]}{p.big && SOUVENIR_INFO[e.id] ? ' · souvenir' : ''}</small>
        {p.big && <em>{note}</em>}
      </span>
    </div>
  );
}

function LootSection(p: { a: Area }) {
  const s = save.value;
  const l = placeLoot(s, p.a.id);
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [p.a.id]);
  const FEW = 8;
  const home = all ? l.home : l.home.slice(0, FEW);
  return (
    <section class="pk-sec pk-lootsec">
      <h3><Px name="satchel" size={24} /><span>Loot you can find</span><small>{l.owned} of {l.total} found</small></h3>
      <p class="pk-lede">Every night here Pip packs one to three gifts into the satchel (more on great nights). Rarer finds turn up after better sleep.</p>
      {l.souvenirs.length > 0 && (
        <>
          <h4>Souvenirs <small>{souvenirNote(l)}</small></h4>
          <div class="pk-grid big">{l.souvenirs.map((e, i) => <LootTile key={e.id} e={e} big delay={i * 60} />)}</div>
        </>
      )}
      {l.wear.length > 0 && (
        <>
          <h4>Outfits &amp; coats <small>each comes once</small></h4>
          <div class="pk-grid">{l.wear.map((e, i) => <LootTile key={e.kind + e.id} e={e} delay={150 + i * 90} />)}</div>
        </>
      )}
      {l.home.length > 0 && (
        <>
          <h4>For the house <small>{l.home.length} pieces</small></h4>
          <div class="pk-grid">{home.map((e, i) => <LootTile key={e.id} e={e} delay={300 + i * 70} />)}</div>
          {l.home.length > FEW && <button class="pk-more" onClick={() => { tap('paper_flip', 0.3); setAll(!all); }}>{all ? 'Show fewer' : `Show all ${l.home.length}`}</button>}
        </>
      )}
      <ul class="pk-legend" aria-label="Rarities">{(['common', 'uncommon', 'rare', 'legendary'] as const).map((r) => <li style={{ '--rc': RARITY_COLOR[r] } as Record<string, string>}>{RARITY_NAME[r]}</li>)}</ul>
    </section>
  );
}

// ------------------------------------------------------------------ the card

export function PlaceCard(p: { a: Area; shown: boolean; onBack: () => void; onGo: () => void; onStep: (d: number) => void }) {
  const a = p.a, s = save.value;
  const info = PLACE_INFO[a.id];
  const photos = PLACE_PHOTOS[a.id] ?? [];
  const open = areaOpen(a.id);
  const nights = nightsAt(s, a.id);
  const card = postcardDate(s, a.id);
  const log = travelOf(s).nights[a.id];
  const km = distanceKm(home, a);
  const body = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [ph, setPh] = useState(0);
  void thumbsReady.value;

  useEffect(() => { loadSheet(a.id); setPh(0); body.current?.scrollTo({ top: 0 }); strip.current?.scrollTo({ left: 0 }); }, [a.id]);
  const onStrip = () => { const el = strip.current; if (el) setPh(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); };
  const toPhoto = (i: number) => { const el = strip.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };

  const L = level.value.level;
  const req = requirement(a);
  const k = dk();
  const stState = log ? 'visited' : open ? 'open' : 'locked';
  const stamp = photoStamp(a, { date: log?.first, state: stState, seed: 7 }, 2 * k) ?? stampArt(a, { date: log?.first, state: stState, seed: 7 }, 2 * k);

  return (
    <section class={'pk hh-wood-dark' + (p.shown ? ' in' : '')} role="dialog" aria-label={a.title} style={{ '--place': a.color } as Record<string, string>}>
      <div class="pk-page">
        <div class="pk-body" ref={body}>
          {/* the photographs, big, swiped sideways */}
          <div class="pk-hero">
            <div class="pk-strip" ref={strip} onScroll={onStrip}>
              {photos.map((x, i) => <figure class="pk-shot" style={photoBg(a.id, i)} aria-label={x.caption}><figcaption>{x.caption}</figcaption></figure>)}
            </div>
            <i class="pk-shade" />
            <div class="pk-name">
              <small>{a.country}{a.country !== a.continent ? ` · ${a.continent}` : ''}</small>
              <h2>{a.title}</h2>
            </div>
            <img class={'pk-pstamp ' + stState} src={stamp} alt={log ? 'Passport stamp' : ''} draggable={false} />
            {photos.length > 1 && <div class="pk-dots">{photos.map((_, i) => <button class={i === ph ? 'on' : ''} aria-label={`Photo ${i + 1}`} onClick={() => toPhoto(i)} />)}</div>}
            <button class="pk-nav l" aria-label="Previous place" onClick={() => p.onStep(-1)}><Px name="arrow_left" size={20} /></button>
            <button class="pk-nav r" aria-label="Next place" onClick={() => p.onStep(1)}><Px name="arrow_right" size={20} /></button>
          </div>

          <p class="pk-blurb">{a.blurb}</p>

          {/* the place right now */}
          <div class="pk-tiles">
            <LocalClock a={a} />
            <div class="pk-tile pk-fly">
              <span class="ic"><Px name="map" size={30} /></span>
              <div>
                <small>From home</small>
                <b>{km < 50 ? 'Right here' : `${Math.round(km).toLocaleString()} km`}</b>
                <span>{km < 50 ? 'next door!' : `about ${fmtHours(flightHours(km))} by plane`}</span>
              </div>
            </div>
            <div class="pk-tile pk-owl">
              <span class="ic"><Px name="owl" size={30} /></span>
              <div>
                <small>Pip’s flight</small>
                <b>5 minutes</b>
                <span>{nights ? `${nights} ${nights === 1 ? 'night' : 'nights'} here so far` : 'breathing all the way'}</span>
              </div>
            </div>
          </div>

          {/* the postcard you unlock */}
          <section class="pk-sec pk-card">
            <h3><img class="seal" src={sealArt(22, hex(a.color), a.level + 1)} alt="" /><span>{card ? 'Your postcard' : 'The postcard you unlock'}</span>{card ? <small class="ok"><Px name="check" size={14} /> Collected</small> : <small>first night here</small>}</h3>
            <Postcard a={a} date={card} />
            <p class="pk-cap">{card ? `Pip mailed it home on ${new Date(card).toLocaleDateString([], { day: 'numeric', month: 'long' })}. Tap it to read the back. It’s in your passport.` : `Sleep one night here (an hour or more) and Pip mails this postcard home for your passport.`}</p>
          </section>

          <LootSection a={a} />

          {/* five true things */}
          <section class="pk-sec pk-facts">
            <h3><Px name="book" size={24} /><span>Did you know?</span></h3>
            <ol>{info?.facts.map((f) => <li>{f}</li>)}</ol>
            <p class="pk-lang"><b>You would hear:</b> {info?.lang}</p>
          </section>

          <p class="pk-credit">Photos: {photos.map((x) => `${x.author} (${x.licence})`).join(' · ')}, via Flickr.</p>
        </div>

        {/* what to do */}
        <footer class="pk-act">
          <button class="pk-planet" onClick={p.onBack} aria-label="Back to the planet"><Px name="arrow_left" size={22} /><span>Planet</span></button>
          {open ? (
            <button class="pk-go btn pillow night" onClick={p.onGo}>
              <span class="pk-moon" aria-hidden="true" />
              <span class="t"><b>Fly here tonight</b><small>a five-minute breathing flight</small></span>
            </button>
          ) : (
            <div class="pk-lock">
              <Px name="lock" size={26} />
              <div>
                <b>Opens at level {a.level}{a.streak ? ` · ${a.streak}-night streak` : ''}</b>
                <small>To fly here, {req || 'keep sleeping well'}.</small>
                <i class="pk-bar"><i style={{ width: `${Math.min(100, (L / a.level) * 100)}%` }} /></i>
              </div>
            </div>
          )}
        </footer>
      </div>
    </section>
  );
}
