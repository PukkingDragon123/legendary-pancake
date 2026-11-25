// What is written in the diary, page by page. Four sections, each behind a cloth tab:
//   Stats       last night, this week, averages, streak, best night, the week in bars;
//               then the score trend, average times and the make-up of a night
//   Nights      every night as a row: date, how long, bed and wake times, score stamp, mood
//   Collection  how much of everything has been found, and the newest finds
//   Badges      the achievements as postage stamps
// `buildPages` paginates everything for the current layout.
import { fontPx } from '../../gfx/artpx.ts';
import type { JSX } from 'preact';
import { AREAS } from '../../game/catalog.ts';
import { level, type Save } from '../../game/store.ts';
import { ALL_ITEMS } from '../../assets/registry.ts';
import { PIECES } from '../../owl/outfits.ts';
import { SPECIES } from '../../owl/species.ts';
import { SPECIAL_SKINS } from '../../owl/skins.ts';
import { fmtDur, fmtTime } from '../kit.tsx';
import { itemIcon, pieceIcon } from '../portraits.ts';
import { badgeArt, hexOf, iconArt, moodArt, MOOD_NAMES, scoreHex, stampArt, type Art } from './art.ts';
import { Chart, scoreSteps, STAGE_INK, STAGE_NAME, stageBar, weekBars } from './charts.tsx';
import type { BookLayout } from './layout.ts';
import { useLazy } from './shots.ts';
import { averages, bestRun, chunk, fromDay, fromEvening, lastWeek, reported, scoreWord, seals, statNights, type Night, type Seal } from './stats.ts';

export type SectionId = 'stats' | 'nights' | 'things' | 'seals';
export const SECTIONS: { id: SectionId; name: string; tint: string; icon: string }[] = [
  { id: 'stats', name: 'Stats', tint: 'moss', icon: 'stats' },
  { id: 'nights', name: 'Nights', tint: 'lake', icon: 'nights' },
  { id: 'things', name: 'Finds', tint: 'honey', icon: 'things' }, // [font6] short enough for four tabs at any art pixel
  { id: 'seals', name: 'Badges', tint: 'berry', icon: 'seals' },
];

export interface PageCtx {
  L: BookLayout;
  /** content width in CSS px */
  cw: number;
  openNight: (id: string) => void;
}
export interface PageDef {
  key: string;
  section: SectionId;
  render: (c: PageCtx) => JSX.Element;
}

// ------------------------------------------------------------------ small pieces

export const Img = (p: { a: Art; T: number; class?: string; style?: string; alt?: string }) =>
  <img class={'bk-px ' + (p.class ?? '')} src={p.a.url} width={p.a.w * p.T} height={p.a.h * p.T} style={p.style} alt={p.alt ?? ''} draggable={false} />;

function Head(p: { kicker: string; title: string; right?: JSX.Element }) {
  return (
    <header class="bk-head">
      <small class="bk-kicker">{p.kicker}</small>
      <div class="bk-title-row"><h2 class="bk-title">{p.title}</h2>{p.right}</div>
      <i class="bk-rule" />
    </header>
  );
}

/** A score as a square ink stamp. */
export function Badge(p: { score: number; size: number; T: number }) {
  const n = Math.round(p.size / p.T);
  return <span class="bk-badge" style={{ width: `${n * p.T}px`, height: `${n * p.T}px`, backgroundImage: `url(${badgeArt(p.score, n).url})`, fontSize: p.size * 0.44 >= 1.375 * fontPx(1) ? 'var(--t2)' : 'var(--t1)' }}><b style={{ color: scoreHex(p.score) }}>{p.score}</b></span>;
}
export function Mood(p: { n?: number; T: number; k?: number }) {
  if (p.n === undefined || p.n === null) return <span class="bk-mood empty" style={{ width: `${12 * p.T * (p.k ?? 1)}px` }} />;
  return <Img a={moodArt(Math.max(0, Math.min(4, p.n)))} T={p.T * (p.k ?? 1)} class="bk-mood" alt={MOOD_NAMES[p.n]} />;
}
function Tile(p: { label: string; value: string; sub?: string; color?: string }) {
  return <div class="bk-tile"><small>{p.label}</small><b style={p.color ? { color: p.color } : undefined}>{p.value}</b>{p.sub && <span>{p.sub}</span>}</div>;
}
function Empty(p: { T: number; line: string }) {
  return <div class="bk-empty"><Img a={iconArt('nights', 'lake')} T={p.T * 4} /><p>{p.line}</p></div>;
}
const dayName = (t: number) => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

// ------------------------------------------------------------------ stats

function OverviewPage(p: { c: PageCtx; s: Save; nights: Night[]; demo: boolean }) {
  const { L } = p.c, T = L.T, s = p.s, h12 = s.settings.hour12;
  const last = p.nights.at(-1);
  const week = lastWeek(p.nights), wk = week.filter((d) => d.night).map((d) => d.night!);
  const wa = averages(wk), all = averages(p.nights);
  const best = p.nights.reduce<Night | undefined>((b, n) => (!b || n.report.score > b.report.score ? n : b), undefined);
  const chartH = Math.round(Math.min(L.PH * (L.single ? 0.34 : 0.21), p.c.cw * (L.single ? 0.72 : 0.6)));
  return (
    <div class="bk-col">
      <Head kicker={`${s.name}'s sleep diary`} title="This week" right={p.demo ? <span class="bk-demo">demo</span> : undefined} />
      {last ? (
        <button class="bk-last" onClick={(e) => { e.stopPropagation(); p.c.openNight(last.id); }}>
          <Badge score={last.report.score} size={Math.round(L.fs * 3.3)} T={T} />
          <span class="bk-last-t">
            <small>Last night</small>
            <b>{fmtDur(last.report.asleep)}</b>
            <span>{fmtTime(last.report.asleepAt, h12)} to {fmtTime(last.report.wokeAt, h12)}</span>
          </span>
          <Mood n={last.mood} T={T} k={1.5} />
        </button>
      ) : <Empty T={T} line="Sleep tonight and Pip will write the first page." />}
      {last && <div class="bk-tiles">
        <Tile label="Average sleep" value={wk.length ? fmtDur(wa.asleep) : '–'} sub={`${wk.length} of 7 nights`} />
        <Tile label="Average score" value={wk.length ? String(Math.round(wa.score)) : '–'} sub={wk.length ? scoreWord(wa.score) : 'this week'} color={wk.length ? scoreHex(wa.score) : undefined} />
        <Tile label="Streak" value={`${s.streak} ${s.streak === 1 ? 'night' : 'nights'}`} sub={`best ${Math.max(s.bestStreak, bestRun(p.nights, s.sleep.goalMin))}`} />
        <Tile label="Best night" value={best ? String(best.report.score) : '–'} sub={best ? dayName(best.start) : ''} color={best ? scoreHex(best.report.score) : undefined} />
        {!L.single && <Tile label="All nights" value={String(all.count)} sub={`${Math.round(all.totalAsleep / 3.6e6)}h asleep`} />}
        {!L.single && <Tile label="Longest" value={all.count ? fmtDur(all.longest) : '–'} sub="in one night" />}
      </div>}
      {last && <>
        <h3 class="bk-h3">Hours asleep</h3>
        <Chart w={p.c.cw} h={chartH} T={T} draw={weekBars(week, s.sleep.goalMin)} dep={'w' + p.nights.length + s.sleep.goalMin + (last.id ?? '')} label="Hours asleep each day this week against your goal" />
      </>}
    </div>
  );
}

function TrendsPage(p: { c: PageCtx; s: Save; nights: Night[] }) {
  const { L } = p.c, T = L.T, a = averages(p.nights), h12 = p.s.settings.hour12, has = p.nights.length > 0;
  const t = (d: Date) => fmtTime(d, h12), dash = '–';
  const chartH = Math.round(Math.min(L.PH * 0.25, p.c.cw * 0.48));
  return (
    <div class="bk-col">
      <Head kicker="Stats" title="On average" />
      {has ? <>
        <h3 class="bk-h3">Score, night by night</h3>
        <Chart w={p.c.cw} h={chartH} T={T} draw={scoreSteps(p.nights)} dep={'s' + p.nights.length + (p.nights.at(-1)?.id ?? '')} label="Sleep score over recent nights" />
        <dl class="bk-avg">
          <dt>Fell asleep</dt><dd>{t(fromEvening(a.bedtime))}</dd>
          <dt>Woke up</dt><dd>{t(fromDay(a.wake))}</dd>
          <dt>Time asleep</dt><dd>{fmtDur(a.asleep)}</dd>
          <dt>Drifting off</dt><dd>{Math.round(a.latency)} min</dd>
          <dt>Times awake</dt><dd>{a.awakenings.toFixed(1).replace('.0', '')}</dd>
          <dt>Score</dt><dd style={{ color: scoreHex(a.score) }}>{Math.round(a.score)}</dd>
        </dl>
        <h3 class="bk-h3">A night, on average</h3>
        <Chart w={p.c.cw} h={Math.round(L.fs * 1.6)} T={T} draw={stageBar(a)} dep={'g' + p.nights.length} label="Average sleep stages" class="bk-stagebar" />
        <div class="bk-legend">{(['deep', 'light', 'rem', 'awake'] as const).map((k) => <span><i style={{ background: hexOf(STAGE_INK[k]) }} />{STAGE_NAME[k]} {Math.round(a[k] * 100)}%</span>)}</div>
      </> : <><dl class="bk-avg">{['Fell asleep', 'Woke up', 'Time asleep', 'Drifting off', 'Score'].map((k) => <><dt>{k}</dt><dd>{dash}</dd></>)}</dl><Empty T={T} line="Averages appear after your first night." /></>}
    </div>
  );
}

// ------------------------------------------------------------------ nights

function NightsPage(p: { c: PageCtx; s: Save; rows: Night[]; first: boolean; part: number; parts: number }) {
  const { L } = p.c, T = L.T, h12 = p.s.settings.hour12;
  if (!p.rows.length) return <div class="bk-col"><Head kicker="Nights" title="Every night" /><Empty T={T} line="The diary is waiting for its first night. Tap Sleep tonight!" /></div>;
  return (
    <div class="bk-col">
      <Head kicker="Nights" title={p.first ? 'Every night' : 'Nights, continued'} right={p.parts > 1 ? <span class="bk-count">{p.part + 1}/{p.parts}</span> : undefined} />
      <ul class="bk-nights">
        {p.rows.map((n) => {
          const d = new Date(n.start), r = n.report;
          return (
            <li><button class="bk-row" onClick={(e) => { e.stopPropagation(); p.c.openNight(n.id); }}>
              <span class="bk-date"><b>{d.getDate()}</b><small>{d.toLocaleDateString([], { month: 'short' })}</small></span>
              <span class="bk-mid"><b>{d.toLocaleDateString([], { weekday: 'long' })}{n.simulated ? <i class="bk-demo">demo</i> : null}</b><small>{fmtDur(r.asleep)} · {fmtTime(r.asleepAt, h12)}</small></span>
              <Mood n={n.mood} T={T} />
              <Badge score={r.score} size={Math.round(L.fs * 2.2)} T={T} />
            </button></li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ collection

type Entry = { id: string; name: string; have: boolean; url?: () => string };
function collection(s: Save) {
  return [
    { id: 'furniture', name: 'Furniture', entries: ALL_ITEMS.map((it) => ({ id: it.id, name: it.name, have: s.owned.items.includes(it.id), url: () => itemIcon(it.id) })) as Entry[] },
    { id: 'outfits', name: 'Outfits', entries: PIECES.map((pc) => ({ id: pc.id, name: pc.name, have: s.owned.pieces.includes(pc.id), url: () => pieceIcon(pc.id, pc.slot, s.look) })) as Entry[] },
    { id: 'owls', name: 'Owls & looks', entries: [...SPECIES.map((sp) => ({ id: 'sp:' + sp.id, name: sp.name, have: s.owned.species.includes(sp.id) || s.look.species === sp.id })), ...SPECIAL_SKINS.map((sk) => ({ id: 'sk:' + sk.id, name: sk.name, have: s.owned.skins.includes(sk.id) }))] as Entry[] },
    { id: 'places', name: 'Places', entries: AREAS.map((a) => ({ id: a.id, name: a.name, have: s.seen.areas.includes(a.id) })) as Entry[] },
  ];
}

function Finding(p: { e: Entry; size: number }) {
  const url = useLazy('bkf:' + p.e.id, () => p.e.url?.() ?? '');
  return <figure class="bk-find" style={{ width: `${p.size}px` }}><span style={{ height: `${p.size}px` }}>{url ? <img src={url} alt="" draggable={false} /> : null}</span><figcaption>{p.e.name}</figcaption></figure>;
}

function CollectionPage(p: { c: PageCtx; s: Save }) {
  const cats = collection(p.s), lv = level.value;
  const all = cats.reduce((a, c) => a + c.entries.length, 0), got = cats.reduce((a, c) => a + c.entries.filter((e) => e.have).length, 0);
  const newest: Entry[] = [...p.s.owned.items.slice(-3).map((id) => cats[0].entries.find((e) => e.id === id)), ...p.s.owned.pieces.slice(-1).map((id) => cats[1].entries.find((e) => e.id === id))].filter((e): e is Entry => !!e).slice(-4);
  const fsz = Math.floor((p.c.cw - 3 * 10) / 4);
  return (
    <div class="bk-col">
      <Head kicker="Collection" title="Found so far" right={<span class="bk-count">{all ? Math.round((got / all) * 100) : 0}%</span>} />
      <ul class="bk-prog">
        {cats.map((c) => {
          const n = c.entries.filter((e) => e.have).length, q = c.entries.length ? n / c.entries.length : 0;
          return <li><span class="t">{c.name}</span><span class="v">{n} / {c.entries.length}</span><span class="bk-pbar"><i style={{ width: `${Math.round(q * 100)}%` }} /></span></li>;
        })}
      </ul>
      <dl class="bk-avg tight">
        <dt>Level</dt><dd>{lv.level}</dd>
        <dt>Acorns</dt><dd>{p.s.coins.toLocaleString()}</dd>
        <dt>Moon gems</dt><dd>{p.s.gems.toLocaleString()}</dd>
      </dl>
      {newest.length > 0 && <>
        <h3 class="bk-h3">Newest finds</h3>
        <div class="bk-finds">{newest.map((e) => <Finding e={e} size={Math.min(fsz, 96)} />)}</div>
      </>}
    </div>
  );
}

function SealsPage(p: { c: PageCtx; list: Seal[]; first: boolean; total: number; got: number; cols: number }) {
  const k = Math.max(2, Math.floor(Math.min(p.c.cw / p.cols - 10, 56) / 16));
  return (
    <div class="bk-col">
      <Head kicker="Badges" title={p.first ? 'Badges' : 'More badges'} right={<span class="bk-count">{p.got}/{p.total}</span>} />
      <div class="bk-seals" style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }}>
        {p.list.map((s) => (
          <div class={'bk-seal' + (s.done ? ' done' : '')} title={s.how}>
            <Img a={stampArt(s.color, s.emblem, s.done)} T={k} />
            <b>{s.name}</b>
            <small>{s.done ? 'done' : s.need > 1 ? `${s.have} / ${s.need}` : s.how}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pagination

export function buildPages(s: Save, L: BookLayout): PageDef[] {
  const pages: PageDef[] = [];
  const add = (key: string, section: SectionId, render: PageDef['render']) => pages.push({ key, section, render });
  const { nights, demo } = statNights(s);
  add('overview', 'stats', (c) => <OverviewPage c={c} s={s} nights={nights} demo={demo} />);
  add('trends', 'stats', (c) => <TrendsPage c={c} s={s} nights={nights} />);
  const all = reported(s);
  const rowH = L.fs * 3.3 + 8, perPage = Math.max(4, Math.floor((L.PH - L.fs * 5.5 - 40) / rowH));
  const parts = chunk([...all].reverse(), perPage);
  parts.forEach((part, i) => add('nights' + i, 'nights', (c) => <NightsPage c={c} s={s} rows={part} first={i === 0} part={i} parts={parts.length} />));
  add('things', 'things', (c) => <CollectionPage c={c} s={s} />);
  const sl = seals(s), cols = L.single ? 4 : 4, sealH = 16 * Math.max(2, Math.floor(Math.min(L.PW / cols - 10, 56) / 16)) + L.fs * 2.6 + 8;
  const per = cols * Math.max(2, Math.floor((L.PH - L.fs * 5.5 - 40) / sealH));
  const got = sl.filter((x) => x.done).length;
  chunk(sl, per).forEach((part, i) => add('seals' + i, 'seals', (c) => <SealsPage c={c} list={part} first={i === 0} total={sl.length} got={got} cols={cols} />));
  if (!L.single && pages.length % 2) add('blank', 'seals', () => <div class="bk-col bk-endp"><p class="bk-fin">To be continued…</p><p>Every night adds a page.</p></div>);
  return pages;
}
