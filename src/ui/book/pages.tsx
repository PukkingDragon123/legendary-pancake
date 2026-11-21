// What is written in Pip's book, page by page: the bookplate and contents, Pip and you, sleep
// (last night, trends, averages), the diary of nights, the collection album, wax-seal achievements
// and Pip's adventures on an inked map. `buildPages` paginates everything for the current layout.
import type { JSX } from 'preact';
import { AREA, AREAS } from '../../game/catalog.ts';
import { rollAdventure } from '../../game/adventure.ts';
import { level, type Save } from '../../game/store.ts';
import { ALL_ITEMS } from '../../assets/registry.ts';
import { PIECE, PIECES } from '../../owl/outfits.ts';
import { SPECIES, speciesOf } from '../../owl/species.ts';
import { SPECIAL_SKINS } from '../../owl/skins.ts';
import { Hypnogram } from '../morning.tsx';
import { Px } from '../icons.tsx';
import { fmtDur, fmtTime } from '../kit.tsx';
import { itemIcon, pieceIcon, portrait } from '../portraits.ts';
import { moodArt, moonDoodle, ovalFrameArt, pencilSealArt, plateArt, sealArt, sleepDoodle, stampRingArt, stickerArt, swashArt, tapeArt, mapArt, RIBBONS } from '../px/bookart.js';
import { Chart, scoreTrend, stageBar, STAGE_INK, timeStrips, weekBars } from './charts.tsx';
import type { BookLayout } from './layout.ts';
import { owlFace, sketch, useLazy } from './shots.ts';
import { averages, chunk, daysTogether, fromDay, fromEvening, goalName, lastWeek, reported, scoreInk, scoreWord, seals, statNights, type Night, type Seal } from './stats.ts';

export type SectionId = 'start' | 'profile' | 'sleep' | 'nights' | 'collection' | 'seals' | 'adventures' | 'end';
export const SECTIONS: { id: SectionId; name: string; color: keyof typeof RIBBONS; icon: string }[] = [
  { id: 'profile', name: 'Pip & You', color: 'red', icon: 'owl' },
  { id: 'sleep', name: 'Sleep', color: 'blue', icon: 'moon' },
  { id: 'nights', name: 'Nights', color: 'purple', icon: 'calendar' },
  { id: 'collection', name: 'Collection', color: 'green', icon: 'camera' },
  { id: 'seals', name: 'Achievements', color: 'gold', icon: 'trophy' },
  { id: 'adventures', name: 'Adventures', color: 'teal', icon: 'map' },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export interface PageCtx {
  L: BookLayout;
  side: 'L' | 'R' | 'S';
  /** printed page number (0 = unnumbered) */
  num: number;
  /** content width in CSS px */
  cw: number;
  go: (s: SectionId) => void;
  openNight: (id: string) => void;
  sectionNum: Partial<Record<SectionId, number>>;
}
export interface PageDef {
  key: string;
  section: SectionId;
  paper: 'plain' | 'frame' | 'rules' | 'endpaper';
  render: (c: PageCtx) => JSX.Element;
}

// ------------------------------------------------------------------ small pieces

const Img = (p: { a: { url: string; w: number; h: number }; T: number; class?: string; style?: string; alt?: string }) =>
  <img class={'bk-px ' + (p.class ?? '')} src={p.a.url} width={p.a.w * p.T} height={p.a.h * p.T} style={p.style} alt={p.alt ?? ''} draggable={false} />;

function Head(p: { kicker: string; title: string; c: PageCtx; right?: JSX.Element }) {
  return (
    <header class="bk-head">
      <small class="bk-kicker">{p.kicker}</small>
      <div class="bk-title-row"><h2 class="bk-title">{p.title}</h2>{p.right}</div>
      <Img a={swashArt(Math.min(90, Math.round(p.c.cw / p.c.L.T * 0.45)))} T={p.c.L.T} class="bk-swash" />
    </header>
  );
}

function Sticker(p: { score: number; T: number; big?: boolean }) {
  const a = stickerArt(scoreInk(p.score), p.big ? 30 : 20);
  return <span class={'bk-sticker' + (p.big ? ' big' : '')} style={{ width: `${a.w * p.T}px`, height: `${a.h * p.T}px`, backgroundImage: `url(${a.url})` }}><b>{p.score}</b></span>;
}

function MoodStamp(p: { n?: number; T: number; on?: boolean; onClick?: () => void }) {
  if (p.n === undefined || p.n === null) return p.onClick ? null : <span class="bk-mood empty" style={{ width: `${20 * p.T}px`, height: `${20 * p.T}px` }} />;
  return <Img a={moodArt(p.n)} T={p.T} class={'bk-mood' + (p.on === false ? ' off' : '')} style={`--r:${((p.n * 37) % 11) - 5}deg`} />;
}

function Pola(p: { url: string; name: string; have: boolean; tint: string; seed: number; T: number; size: number; sub?: string }) {
  const rot = ((p.seed * 53) % 9) - 4;
  const tapes = ['pink', 'mint', 'yellow', 'blue', 'lilac', 'red'];
  const sk = useLazy('sk:' + p.name + p.url.length, () => (p.have ? '' : sketch(p.url)));
  return (
    <figure class={'bk-pola' + (p.have ? '' : ' ghost')} style={{ '--r': `${rot}deg`, '--tint': p.tint, width: `${p.size}px` } as Record<string, string>}>
      {p.have && <Img a={tapeArt(tapes[p.seed % tapes.length], 22, 8, p.seed)} T={p.T} class="bk-tape" />}
      <div class="bk-shot" style={{ height: `${Math.round(p.size * 0.82)}px` }}>
        {p.have ? (p.url ? <img src={p.url} alt="" draggable={false} /> : <i class="bk-dev" />) : (sk ? <img class="bk-sketch" src={sk} alt="" draggable={false} /> : null)}
        {!p.have && <b class="bk-q">?</b>}
      </div>
      <figcaption>{p.have ? p.name : '?'}{p.sub && p.have ? <small>{p.sub}</small> : null}</figcaption>
    </figure>
  );
}

const RARITY_TINT: Record<string, string> = { common: '#e9e2cc', uncommon: '#d8ecd0', rare: '#d4e2f6', epic: '#e6d8f4', legendary: '#f8e6b8' };

// ------------------------------------------------------------------ pages

function EndpaperPage(p: { c: PageCtx; s: Save }) {
  const { L } = p.c, T = L.T;
  const w = Math.round(L.pw * 0.74), h = Math.round(Math.min(L.ph * 0.5, w * 0.95));
  const por = useLazy('por:' + JSON.stringify(p.s.look), () => portrait(p.s.look));
  const oval = ovalFrameArt(Math.round(w * 0.36), Math.round(w * 0.42));
  return (
    <div class="bk-endpaper">
      <div class="bk-plate" style={{ width: `${w * T}px`, height: `${h * T}px`, backgroundImage: `url(${plateArt(w, h).url})` }}>
        <small>EX LIBRIS</small>
        <div class="bk-oval" style={{ width: `${oval.w * T}px`, height: `${oval.h * T}px` }}>{por && <img class="bk-oval-por" src={por} alt="" draggable={false} />}<Img a={oval} T={T} /></div>
        <b>{p.s.name}</b>
        <span>this book belongs to Pip, and is kept by {p.s.profile.you || 'a sleepy friend'}</span>
      </div>
    </div>
  );
}

function ContentsPage(p: { c: PageCtx; s: Save }) {
  const T = p.c.L.T, sl = seals(p.s), n = reported(p.s).length;
  return (
    <div class="bk-col">
      <Head kicker="The Book of Nights" title="Contents" c={p.c} />
      <ol class="bk-toc">
        {SECTIONS.map((s, i) => (
          <li><button onClick={(e) => { e.stopPropagation(); p.c.go(s.id); }}>
            <span class="n">{ROMAN[i]}.</span><Px name={s.icon} size={Math.round(p.c.L.fs * 1.5)} /><span class="t">{s.name}</span><i class="dots" /><span class="pg">{p.c.sectionNum[s.id] ?? ''}</span>
          </button></li>
        ))}
      </ol>
      <h3 class="bk-h3">At a glance</h3>
      <div class="bk-counts glance">
        <div><b>{n}</b><small>{n === 1 ? 'night' : 'nights'}</small></div>
        <div><b>{p.s.bestStreak}</b><small>best streak</small></div>
        <div><b>{sl.filter((x) => x.done).length}/{sl.length}</b><small>seals</small></div>
        <div><b>{p.s.seen.areas.length}</b><small>{p.s.seen.areas.length === 1 ? 'place' : 'places'}</small></div>
      </div>
      <p class="bk-hint">Drag a page corner, swipe, or pull a ribbon to turn the pages.</p>
      <Img a={moonDoodle()} T={T} class="bk-doodle-moon" />
    </div>
  );
}

function PipPage(p: { c: PageCtx; s: Save }) {
  const s = p.s, T = p.c.L.T, sp = speciesOf(s.look.species), lv = level.value;
  const por = useLazy('por:' + JSON.stringify(s.look), () => portrait(s.look));
  const ow = Math.round(Math.min(p.c.cw / T * 0.5, p.c.L.ph * 0.26)), oval = ovalFrameArt(ow, Math.round(ow * 1.16));
  const n = reported(s).length;
  const owned = s.owned.items.length + s.owned.pieces.length;
  return (
    <div class="bk-col">
      <Head kicker="Pip & You" title={s.name} c={p.c} />
      <div class="bk-pip-top">
        <div class="bk-oval" style={{ width: `${oval.w * T}px`, height: `${oval.h * T}px` }}>{por && <img class="bk-oval-por" src={por} alt={`${s.name}'s portrait`} draggable={false} />}<Img a={oval} T={T} /></div>
        <div class="bk-col tight">
          <b class="bk-species">{sp.name}</b>
          <i class="bk-latin">{sp.latin}</i>
          <div class="bk-lv"><span>Level <b>{lv.level}</b></span><span class="bk-magic" role="progressbar" aria-valuenow={lv.into} aria-valuemax={lv.need}><i style={{ width: `${Math.max(4, Math.round((lv.into / Math.max(1, lv.need)) * 100))}%` }} /></span><small>{lv.into} / {lv.need} XP</small></div>
        </div>
      </div>
      <dl class="bk-facts">
        <dt>Nights flown</dt><dd>{n}</dd>
        <dt>Treasures at home</dt><dd>{owned}</dd>
        <dt>Acorns</dt><dd>{s.coins}</dd>
        <dt>Moon gems</dt><dd>{s.gems}</dd>
        <dt>Favourite place</dt><dd>{AREA[s.area]?.name ?? 'the woods'}</dd>
        {!p.c.L.single && <><dt>Wearing</dt><dd>{Object.values(s.look.outfit ?? {}).map((id) => PIECE[id as string]?.name ?? id).join(', ') || 'just feathers'}</dd></>}
      </dl>
      <p class="bk-note">“{sp.blurb}”</p>
    </div>
  );
}

const CHRONO: Record<string, [string, string]> = { lark: ['Early bird', 'sun'], between: ['In between', 'sunrise'], owl: ['Night owl', 'moon'] };
const LATENCY: Record<string, string> = { quick: 'drifts off in minutes', normal: 'falls asleep in a while', slow: 'takes a while to drift off', long: 'lies awake a long time' };
const PHONE: Record<string, string> = { never: 'no phone in bed', sometimes: 'phone in bed sometimes', nightly: 'phone in bed most nights' };

function KeeperPage(p: { c: PageCtx; s: Save }) {
  const s = p.s, pr = s.profile, T = p.c.L.T;
  const days = daysTogether(s);
  const [chrono, ico] = CHRONO[pr.chronotype] ?? CHRONO.between;
  const stamps: { top: string; text: string; col: string }[] = [
    ...s.seen.areas.map((id) => ({ top: 'visited', text: (AREA[id]?.name ?? id).split(' ').pop() ?? id, col: AREA[id]?.color ?? '#2b3d8f' })),
    ...(reported(s).length >= 7 ? [{ top: 'slept', text: '7 nights', col: '#7a4cb0' }] : []),
    ...(reported(s).length >= 30 ? [{ top: 'slept', text: '30 nights', col: '#c07a18' }] : []),
    ...(s.bestStreak >= 3 ? [{ top: 'streak', text: `${s.bestStreak} nights`, col: '#b0303a' }] : []),
  ].slice(0, p.c.L.single ? 8 : 10);
  const h12 = s.settings.hour12, hm = (v: string) => { const [h, m] = v.split(':').map(Number); return h12 ? `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'a' : 'p'}` : v; };
  const ring = Math.round(Math.min(40, (p.c.cw / T - 12) / 4));
  return (
    <div class="bk-col">
      <Head kicker="Pip & You" title="The Keeper" c={p.c} />
      <div class="bk-keeper"><span>kept by</span><b class="bk-sig">{pr.you || 'a sleepy friend'}</b></div>
      <div class="bk-days"><b>{days}</b><span>{days === 1 ? 'day together' : 'days together'}</span></div>
      <h3 class="bk-h3">Your goals</h3>
      {pr.goals.length ? <ul class="bk-goals">{pr.goals.slice(0, 4).map((g) => <li><i class="bk-box" />{goalName(g)}</li>)}</ul> : <p class="bk-muted">Pip will ask about your goals soon.</p>}
      <h3 class="bk-h3">Sleep style</h3>
      <p class="bk-style"><Px name={ico} size={Math.round(p.c.L.fs * 1.4)} /><b>{chrono}</b>, {LATENCY[pr.latency] ?? 'falls asleep in a while'}, {PHONE[pr.phone] ?? 'phone in bed sometimes'}, about {pr.sleepHours}h a night.</p>
      {!p.c.L.single && s.routine?.length === 7 && <>
        <h3 class="bk-h3">Bedtime plan</h3>
        <div class="bk-routine">{s.routine.map((d, i) => <div class={d.on ? '' : 'off'}><b>{'SMTWTFS'[i]}</b><span>{d.on ? hm(d.bed) : 'off'}</span><small>{d.on ? hm(d.wake) : ''}</small></div>)}</div>
      </>}
      <h3 class="bk-h3">Stamps</h3>
      <div class="bk-stamps">
        {stamps.length ? stamps.map((st, i) => (
          <span class="bk-stamp" style={{ width: `${ring * T}px`, height: `${ring * T}px`, '--r': `${((i * 47) % 21) - 10}deg`, color: st.col, backgroundImage: `url(${stampRingArt(st.col, ring, i + 3).url})` } as Record<string, string>}><small>{st.top}</small><b>{st.text}</b></span>
        )) : <p class="bk-muted">Every place Pip visits leaves a stamp here.</p>}
      </div>
    </div>
  );
}

function EmptySleep(p: { c: PageCtx; title: string; line: string }) {
  return (
    <div class="bk-col">
      <Head kicker="Sleep" title={p.title} c={p.c} />
      <div class="bk-empty"><Img a={sleepDoodle()} T={p.c.L.T * 1.5} /><p>{p.line}</p></div>
    </div>
  );
}

function LastNightPage(p: { c: PageCtx; s: Save; n?: Night }) {
  const n = p.n, T = p.c.L.T, h12 = p.s.settings.hour12;
  if (!n) return <EmptySleep c={p.c} title="Last night" line="Sleep tonight and Pip will write the first page." />;
  const r = n.report;
  return (
    <div class="bk-col">
      <Head kicker="Sleep" title="Last night" c={p.c} />
      <div class="bk-ln">
        <Sticker score={r.score} T={T} big />
        <div class="bk-col tight">
          <b class="bk-big">{fmtDur(r.asleep)}</b>
          <span>{fmtTime(r.asleepAt, h12)} to {fmtTime(r.wokeAt, h12)}</span>
          <span class="bk-muted">{scoreWord(r.score)} · {new Date(n.start).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}{n.simulated ? ' · demo' : ''}</span>
        </div>
      </div>
      <div class="bk-hyp"><Hypnogram s={n} h12={h12} /></div>
      <div class="bk-mini">
        <div><b>{Math.round(r.efficiency * 100)}%</b><small>in bed asleep</small></div>
        <div><b>{Math.round(r.latencyMin)}m</b><small>to drift off</small></div>
        <div><b>{Math.round(r.deep * 100)}%</b><small>deep sleep</small></div>
        <div><b>{r.awakenings}</b><small>times awake</small></div>
      </div>
      {r.notes[0] && <p class="bk-note">“{r.notes[0]}”</p>}
      <button class="bk-link" onClick={(e) => { e.stopPropagation(); p.c.openNight(n.id); }}>Read the whole night →</button>
    </div>
  );
}

function TrendsPage(p: { c: PageCtx; s: Save; nights: Night[]; demo: boolean }) {
  const T = p.c.L.T, cw = p.c.cw, h = Math.round(Math.min(p.c.L.PH * 0.27, cw * 0.5));
  const week = lastWeek(p.nights);
  return (
    <div class="bk-col">
      <Head kicker="Sleep" title="How it's going" c={p.c} right={p.demo ? <span class="bk-demo">demo</span> : undefined} />
      <h3 class="bk-h3">Sleep score</h3>
      <Chart w={cw} h={h} T={T} draw={scoreTrend(p.nights)} dep={'s' + p.nights.length + (p.nights.at(-1)?.id ?? '')} label="Sleep score over recent nights" />
      <h3 class="bk-h3">This week</h3>
      <Chart w={cw} h={h} T={T} draw={weekBars(week, p.s.sleep.goalMin)} dep={'w' + p.nights.length + p.s.sleep.goalMin + (p.nights.at(-1)?.id ?? '')} label="Hours asleep each day this week against your goal" />
    </div>
  );
}

function AveragesPage(p: { c: PageCtx; s: Save; nights: Night[] }) {
  const T = p.c.L.T, a = averages(p.nights), h12 = p.s.settings.hour12, has = p.nights.length > 0;
  const t = (d: Date) => fmtTime(d, h12);
  const dash = '–';
  return (
    <div class="bk-col">
      <Head kicker="Sleep" title="On average" c={p.c} />
      <table class="bk-avg"><tbody>
        <tr><th>Fell asleep</th><td>{has ? t(fromEvening(a.bedtime)) : dash}</td></tr>
        <tr><th>Woke up</th><td>{has ? t(fromDay(a.wake)) : dash}</td></tr>
        <tr><th>Time asleep</th><td>{has ? fmtDur(a.asleep) : dash}</td></tr>
        <tr><th>Drifting off</th><td>{has ? `${Math.round(a.latency)} min` : dash}</td></tr>
        <tr><th>Score</th><td>{has ? Math.round(a.score) : dash}</td></tr>
      </tbody></table>
      {has ? <Chart w={p.c.cw} h={Math.round(p.c.L.fs * 5.4)} T={T} draw={timeStrips(p.nights.slice(-30), h12)} dep={'t' + p.nights.length + (p.nights.at(-1)?.id ?? '')} label="Bedtimes and wake times" /> : <p class="bk-muted">Averages appear after your first night with Pip.</p>}
      {has && <>
        <Chart w={p.c.cw} h={Math.round(p.c.L.fs * 1.4)} T={T} draw={stageBar(a)} dep={'g' + p.nights.length} label="Average sleep stages" class="bk-stagebar" />
        <div class="bk-legend">{(['deep', 'light', 'rem', 'awake'] as const).map((k) => <span><i style={{ background: STAGE_INK[k] }} />{k === 'rem' ? 'dreaming' : k} {Math.round(a[k] * 100)}%</span>)}</div>
      </>}
      <div class="bk-counts">
        <div><b>{p.s.bestStreak}</b><small>best streak</small></div>
        <div><b>{a.count}</b><small>nights</small></div>
        <div><b>{Math.round(a.totalAsleep / 3.6e6)}h</b><small>slept</small></div>
        <div><b>{Math.round(a.snoreMin)}m</b><small>snoring</small></div>
        <div><b>{a.talk}</b><small>sleep talk</small></div>
      </div>
    </div>
  );
}

function DiaryPage(p: { c: PageCtx; s: Save; rows: Night[]; first: boolean }) {
  const T = p.c.L.T, h12 = p.s.settings.hour12;
  if (!p.rows.length) return (
    <div class="bk-col">
      <Head kicker="Nights" title="Diary" c={p.c} />
      <div class="bk-empty"><Img a={sleepDoodle()} T={T * 1.5} /><p>The diary is waiting for its first night. Tap Sleep tonight!</p></div>
    </div>
  );
  return (
    <div class="bk-col">
      <Head kicker="Nights" title={p.first ? 'Diary' : 'Diary, continued'} c={p.c} />
      <ul class="bk-diary" style={{ top: `${p.c.L.r0}px` }}>
        {p.rows.map((n) => {
          const d = new Date(n.start), r = n.report;
          return (
            <li><button class="bk-row" onClick={(e) => { e.stopPropagation(); p.c.openNight(n.id); }}>
              <span class="bk-date"><b>{d.getDate()}</b><small>{d.toLocaleDateString([], { month: 'short' })}</small></span>
              <span class="bk-mid"><b>{d.toLocaleDateString([], { weekday: 'long' })}{n.simulated ? <i class="bk-demo">demo</i> : null}</b><small>{fmtDur(r.asleep)} · {fmtTime(r.asleepAt, h12)}</small></span>
              <Sticker score={r.score} T={T} />
              <MoodStamp n={n.mood} T={T} />
            </button></li>
          );
        })}
      </ul>
    </div>
  );
}

type Entry = { id: string; name: string; have: boolean; url: () => string; tint: string; sub?: string };
type Cat = { id: string; name: string; entries: Entry[] };

function collection(s: Save): Cat[] {
  const items = ALL_ITEMS.map((it) => ({ id: it.id, name: it.name, have: s.owned.items.includes(it.id), url: () => itemIcon(it.id), tint: RARITY_TINT[it.rarity ?? 'common'] ?? RARITY_TINT.common }));
  const pieces = PIECES.map((pc) => ({ id: pc.id, name: pc.name, have: s.owned.pieces.includes(pc.id), url: () => pieceIcon(pc.id, pc.slot, s.look), tint: pc.premium ? RARITY_TINT.epic : RARITY_TINT.uncommon }));
  const owls: Entry[] = [
    ...SPECIES.map((sp) => ({ id: 'sp:' + sp.id, name: sp.name, have: s.owned.species.includes(sp.id) || s.look.species === sp.id, url: () => owlFace({ skin: 'owl', species: sp.id, palette: s.look.palette, outfit: {} }), tint: RARITY_TINT.rare, sub: sp.latin })),
    ...SPECIAL_SKINS.map((sk) => ({ id: 'sk:' + sk.id, name: sk.name, have: s.owned.skins.includes(sk.id), url: () => owlFace({ skin: sk.id as never, species: s.look.species, palette: s.look.palette, outfit: {} }), tint: RARITY_TINT.legendary })),
  ];
  return [
    { id: 'furniture', name: 'Furniture', entries: items },
    { id: 'outfits', name: 'Outfits', entries: pieces },
    { id: 'owls', name: 'Owls & skins', entries: owls },
  ];
}

function AlbumCover(p: { c: PageCtx; cats: Cat[]; s: Save }) {
  const T = p.c.L.T;
  const newest: Entry[] = [...p.s.owned.items.slice(-3).map((id) => p.cats[0].entries.find((e) => e.id === id)), ...p.s.owned.pieces.slice(-2).map((id) => p.cats[1].entries.find((e) => e.id === id))].filter((e): e is Entry => !!e).slice(-(p.c.L.single ? 3 : 4));
  const nsz = Math.floor((p.c.cw - (newest.length - 1) * 10) / Math.max(3, newest.length));
  const all = p.cats.reduce((a, c) => a + c.entries.length, 0), got = p.cats.reduce((a, c) => a + c.entries.filter((e) => e.have).length, 0);
  const pct = all ? Math.round((got / all) * 100) : 0;
  return (
    <div class="bk-col">
      <Head kicker="Collection" title="The Album" c={p.c} />
      <div class="bk-total"><b>{pct}%</b><span>of everything found</span></div>
      <ul class="bk-comp">
        {p.cats.map((c) => {
          const n = c.entries.filter((e) => e.have).length, q = c.entries.length ? n / c.entries.length : 0;
          return <li><span class="t">{c.name}</span><span class="v">{n} / {c.entries.length}</span><span class="bk-pbar"><i style={{ width: `${Math.round(q * 100)}%` }} /></span><span class="p">{Math.round(q * 100)}%</span></li>;
        })}
      </ul>
      {newest.length > 0 && <>
        <h3 class="bk-h3">Newest treasures</h3>
        <div class="bk-newest">{newest.map((e, i) => <AlbumSlot e={e} i={i + 2} T={T} size={Math.min(nsz, 120)} />)}</div>
      </>}
      <p class="bk-note">Pip brings something home after every good night. The pencil outlines are still out there!</p>
    </div>
  );
}

function AlbumPage(p: { c: PageCtx; cat: Cat; entries: Entry[]; part: number; parts: number; cols: number }) {
  const T = p.c.L.T, { gap, size } = albumGrid(p.c.L);
  const n = p.cat.entries.filter((e) => e.have).length;
  return (
    <div class="bk-col">
      <Head kicker="Collection" title={p.cat.name} c={p.c} right={<span class="bk-count">{n}/{p.cat.entries.length}{p.parts > 1 ? <small> · {p.part + 1}/{p.parts}</small> : null}</span>} />
      <div class="bk-album" style={{ gridTemplateColumns: `repeat(${p.cols}, ${size}px)`, gap: `${gap}px` }}>
        {p.entries.map((e, i) => <AlbumSlot e={e} i={i} T={T} size={size} />)}
      </div>
    </div>
  );
}
function AlbumSlot(p: { e: Entry; i: number; T: number; size: number }) {
  const url = useLazy('al:' + p.e.id, () => p.e.url());
  return <Pola url={url} name={p.e.name} have={p.e.have} tint={p.e.tint} seed={p.i + p.e.id.length} T={p.T} size={p.size} sub={p.e.sub} />;
}

function SealsPage(p: { c: PageCtx; list: Seal[]; first: boolean; total: number; got: number; cols: number }) {
  const T = p.c.L.T;
  return (
    <div class="bk-col">
      <Head kicker="Achievements" title={p.first ? 'Wax Seals' : 'More seals'} c={p.c} right={<span class="bk-count">{p.got}/{p.total}</span>} />
      <div class="bk-seals" style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }}>
        {p.list.map((s) => (
          <div class={'bk-seal' + (s.done ? ' done' : '')} title={s.how}>
            <Img a={s.done ? sealArt(s.color, s.emblem) : pencilSealArt(s.emblem)} T={T * 1.5} />
            <b>{s.name}</b>
            <small>{s.done ? s.how : s.need > 1 ? `${s.have} / ${s.need}` : s.how}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapPage(p: { c: PageCtx; s: Save }) {
  const T = p.c.L.T, mw = Math.floor(p.c.cw / T), mh = Math.floor(Math.min(mw * 0.82, (p.c.L.PH * 0.6) / T));
  const areas = AREAS.map((a) => ({ id: a.id, x: a.x, y: a.y, seen: p.s.seen.areas.includes(a.id) }));
  const m = mapArt(mw, mh, areas);
  return (
    <div class="bk-col">
      <Head kicker="Adventures" title="Where Pip flies" c={p.c} />
      <div class="bk-map" style={{ width: `${mw * T}px`, height: `${mh * T}px` }}>
        <Img a={m} T={T} />
        {AREAS.map((a) => {
          const seen = p.s.seen.areas.includes(a.id);
          return <span class={'bk-place' + (seen ? '' : ' unseen')} style={{ left: `${(8 + a.x * (mw - 16)) * T}px`, top: `${(8 + a.y * (mh - 16)) * T}px` }}>{a.name}{!seen && <small>level {a.level}</small>}</span>;
        })}
      </div>
      <p class="bk-note">{p.s.seen.areas.length > 1 ? `Pip has explored ${p.s.seen.areas.length} of ${AREAS.length} places. The red dots are his flight paths.` : 'Pip only knows the Whispering Woods so far. Level up to open new places!'}</p>
    </div>
  );
}

type Story = { id: string; when: number; area: string; lines: string[] };
function stories(s: Save, nights: Night[]): Story[] {
  const seen = s.seen.areas.length ? s.seen.areas : ['woods'];
  return [...nights].reverse().filter((n) => n.report.asleep > 0).slice(0, 8).map((n) => {
    if (s.pending?.sessionId === n.id) return { id: n.id, when: n.start, area: s.pending.adventure.area, lines: s.pending.adventure.story };
    const area = seen[n.start % seen.length];
    const adv = rollAdventure({ area, report: n.report, seed: n.start % 100000, owned: () => false, plus: false, name: s.name, streak: 0 });
    return { id: n.id, when: n.start, area: adv.area, lines: adv.story };
  });
}

function StoriesPage(p: { c: PageCtx; list: Story[]; first: boolean }) {
  const L = p.c.L;
  const T = p.c.L.T;
  if (!p.list.length) return (
    <div class="bk-col">
      <Head kicker="Adventures" title="Travel journal" c={p.c} />
      <div class="bk-empty"><Img a={sleepDoodle()} T={T * 1.5} /><p>Pip hasn't flown anywhere yet. Sleep tonight and he'll bring home a story.</p></div>
    </div>
  );
  return (
    <div class="bk-col">
      <Head kicker="Adventures" title={p.first ? 'Travel journal' : 'Journal, continued'} c={p.c} />
      <div class="bk-stories" style={{ top: `${L.r0}px` }}>
        {p.list.map((st, i) => {
          const a = AREA[st.area];
          return (
            <article class="bk-story">
              <span class="bk-postmark" style={{ color: a?.color ?? '#2b3d8f', backgroundImage: `url(${stampRingArt(a?.color ?? '#2b3d8f', 30, i + 9).url})`, width: `${30 * T}px`, height: `${30 * T}px` }}><small>visited</small><b>{(a?.name ?? 'Woods').split(' ').pop()}</b></span>
              <h4>{new Date(st.when).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {a?.name ?? 'the woods'}</h4>
              {st.lines.map((l) => <p>{l}</p>)}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EndPage(p: { c: PageCtx }) {
  return (
    <div class="bk-col bk-endp">
      <div class="bk-empty"><Img a={sleepDoodle()} T={p.c.L.T * 1.5} /><p class="bk-fin">To be continued…</p><p>Every night with Pip adds a page.</p></div>
    </div>
  );
}

// ------------------------------------------------------------------ pagination

/** Polaroid grid for the album pages: as many rows as fit, shrinking the photos a little to fit one more. */
function albumGrid(L: BookLayout) {
  const cols = L.single ? 3 : 4, cw = L.PW - 21 * L.T, gap = Math.round(L.fs * 0.7);
  const avail = L.PH - L.r0 - 16 * L.T - L.fs, cap = L.fs * 0.68 * 2.3 + 12;
  const polH = (sz: number) => 5 + sz * 0.82 + cap;
  const sizeW = Math.floor((cw - (cols - 1) * gap) / cols);
  let rows = Math.max(1, Math.floor((avail + gap) / (polH(sizeW) + gap))), size = sizeW;
  const more = Math.floor(((avail + gap) / (rows + 1) - gap - 5 - cap) / 0.82);
  if (more >= sizeW * 0.8) { rows += 1; size = more; }
  return { cols, rows, gap, size };
}

/** Split the travel journal into pages by how many ruled lines each story takes. */
function storyPages(list: Story[], L: BookLayout): Story[][] {
  const lines = Math.floor((L.PH - L.r0 - 16 * L.T) / L.rule);
  const cpl = Math.max(14, Math.floor((L.PW - 21 * L.T - 34 * L.T) / (L.fs * 0.82 * 0.56)));
  const cost = (st: Story) => 1 + st.lines.reduce((a, l) => a + Math.ceil((l.length * 1.08) / cpl), 0);
  const pages: Story[][] = [[]];
  let used = 0;
  for (const st of list) {
    const gapLine = pages[pages.length - 1].length ? 1 : 0;
    if (used + cost(st) + gapLine > lines && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    used += cost(st) + (pages[pages.length - 1].length ? 1 : 0);
    pages[pages.length - 1].push(st);
  }
  return pages;
}

export function buildPages(s: Save, L: BookLayout): PageDef[] {
  const pages: PageDef[] = [];
  const add = (key: string, section: SectionId, paper: PageDef['paper'], render: PageDef['render']) => pages.push({ key, section, paper, render });
  if (!L.single) add('endpaper', 'start', 'endpaper', (c) => <EndpaperPage c={c} s={s} />);
  add('contents', 'start', 'frame', (c) => <ContentsPage c={c} s={s} />);
  // Pip & you
  add('pip', 'profile', 'frame', (c) => <PipPage c={c} s={s} />);
  add('keeper', 'profile', 'plain', (c) => <KeeperPage c={c} s={s} />);
  // sleep
  const { nights, demo } = statNights(s);
  const all = reported(s);
  add('last', 'sleep', 'plain', (c) => <LastNightPage c={c} s={s} n={all.at(-1)} />);
  add('trends', 'sleep', 'plain', (c) => <TrendsPage c={c} s={s} nights={nights} demo={demo} />);
  add('avg', 'sleep', 'plain', (c) => <AveragesPage c={c} s={s} nights={nights} />);
  // diary
  const rows = Math.max(4, Math.floor((L.PH - L.r0 - 18 * L.T) / (2 * L.rule)));
  chunk([...all].reverse(), rows).forEach((part, i) => add('diary' + i, 'nights', 'rules', (c) => <DiaryPage c={c} s={s} rows={part} first={i === 0} />));
  // collection
  const cats = collection(s);
  add('album', 'collection', 'frame', (c) => <AlbumCover c={c} cats={cats} s={s} />);
  const { cols, rows: arows } = albumGrid(L), perAlbum = cols * arows;
  for (const cat of cats) {
    const parts = chunk(cat.entries, perAlbum);
    parts.forEach((part, i) => add(`al-${cat.id}-${i}`, 'collection', 'plain', (c) => <AlbumPage c={c} cat={cat} entries={part} part={i} parts={parts.length} cols={cols} />));
  }
  // seals
  const sl = seals(s), sc = L.single ? 3 : 4, sealH = 30 * L.T * 1.5 + L.fs * 3.2, perSeal = sc * Math.max(2, Math.floor((L.PH - L.fs * 5.2 - L.T * 24) / (sealH + 8)));
  const got = sl.filter((x) => x.done).length;
  chunk(sl, perSeal).forEach((part, i) => add('seals' + i, 'seals', 'plain', (c) => <SealsPage c={c} list={part} first={i === 0} total={sl.length} got={got} cols={sc} />));
  // adventures
  add('map', 'adventures', 'plain', (c) => <MapPage c={c} s={s} />);
  storyPages(stories(s, all), L).forEach((part, i) => add('story' + i, 'adventures', 'rules', (c) => <StoriesPage c={c} list={part} first={i === 0} />));
  add('end', 'end', 'plain', (c) => <EndPage c={c} />);
  if (!L.single && pages.length % 2) pages.splice(pages.length - 1, 0, { key: 'blank', section: 'end', paper: 'plain', render: () => <div class="bk-col" /> });
  return pages;
}
