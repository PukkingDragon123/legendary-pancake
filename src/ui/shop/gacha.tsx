// The weekly series at the Lucky Barrel (opened from a banner or the barrel in Barnaby's lodge). The series board is a
// wooden notice board: the series poster pinned up, its featured prizes on paper cards, the pity counted in chalk tally
// marks on a slate, and two brass-cased stamps to wish x1 / x10. A wish is played in the room: the camera swings to the
// barrel, it rumbles and shakes, the lid pops and a beam of light shoots up in the colour of the best rarity (blue 3,
// violet 4, gold 5), and each prize rises out of the barrel, turning in the light, while a carved plaque names it.
// Then a ledger page lists the haul. Game rules live in src/game/{gacha,series,shop}.ts. OWNED BY THE SHOP BUILDER.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { untilFive, untilFour } from '../../game/gacha.ts';
import { ODDS, SERIES, SERIES_BY_ID, type Stars } from '../../game/series.ts';
import { fmtLeft, KIND_LABEL, msToWeek, nameOf, pityOf, PULL_COST, seriesActive, wish, wishLog, type Prize } from '../../game/shop.ts';
import { save } from '../../game/store.ts';
import type { Lodge } from '../../world/stages/lodge.ts';
import { Px } from '../icons.tsx';
import { haptic, Rolling, toast, useTick } from '../kit.tsx';
import { panel } from '../state.ts';
import { AnimPx, rewardMoment, Stamp } from './moment.tsx';
import { bannerArt, prizeArt } from './paint.ts';

const fmt = (n: number) => n.toLocaleString('en-US');
const isSide = () => innerWidth >= innerHeight * 1.05 && innerWidth >= 640;
const STAR_NAME: Record<Stars, string> = { 3: 'shop_star3', 4: 'shop_star4', 5: 'shop_star5' };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/** dev only: hold the reveal on its current prize (for screenshots) */
const debug = { hold: false };

function StarRow(p: { n: Stars; size?: number; pop?: boolean }) {
  return <span class={'lg-stars' + (p.pop ? ' pop' : '')}>{Array.from({ length: p.n }, (_, i) => <span style={{ animationDelay: `${0.25 + i * 0.12}s` }}><Px name={STAR_NAME[p.n]} size={p.size ?? 16} /></span>)}</span>;
}
/** chalk tally marks: groups of five (four strokes and a slash) */
function Tally(p: { n: number; max: number }) {
  const n = Math.min(p.n, p.max), groups = Math.floor(n / 5), rest = n % 5;
  return (
    <span class="lg-tally" aria-label={`${n} wishes`}>
      {Array.from({ length: groups }, () => <i class="g5" />)}
      {rest > 0 && <i class={'g' + rest} />}
      {n === 0 && <em>none yet</em>}
    </span>
  );
}

// ------------------------------------------------------------------ the series board

export function Gacha(p: { seriesId: string; stage: Lodge | null; say: (t: string, ms?: number) => void; onSeries: (id: string) => void; onClose: () => void; onBuyGems: () => void }) {
  const s = SERIES_BY_ID[p.seriesId];
  const [show, setShow] = useState<Prize[] | null>(null);
  const [sheet, setSheet] = useState<'details' | 'history' | null>(null);
  const [closing, setClosing] = useState(false);
  const [side, setSide] = useState(isSide());
  useTick(1000);
  useEffect(() => { const f = () => setSide(isSide()); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { hhShop?: Record<string, unknown> };
    w.hhShop = { ...(w.hhShop ?? {}), wish: (n: 1 | 10) => doWish(n, true), show: (pz: Prize[]) => setShow(pz), sheet: setSheet, hold: (v: boolean) => { debug.hold = v; } };
  });
  if (!s) return null;
  const sv = save.value, pity = pityOf(sv, s.id), on = seriesActive(s);
  const f5 = s.pool.find((e) => e.stars === 5 && e.featured) ?? s.pool.find((e) => e.stars === 5)!;
  const f4 = s.pool.filter((e) => e.stars === 4 && e.featured).slice(0, 3);
  const look = sv.look;

  const close = () => { sound.play('ui_close', { volume: 0.5 }); setClosing(true); setTimeout(p.onClose, 300); };
  function doWish(n: 1 | 10, force = false) {
    if (!on && !force) { sound.play('ui_error', { volume: 0.5 }); toast(`${s.name} arrives next week`); p.say('That one\'s still in the crate! Next week, friend.'); return; }
    const cost = PULL_COST * n;
    if (save.value.gems < cost) { sound.play('ui_error', { volume: 0.5 }); toast(`You need ${fmt(cost)} moon gems`); p.say('A few more moon gems for that one. The chests are by the shelf!'); return; }
    const r = wish(s.id, n, Math.random, force);
    if ('error' in r) { toast(r.error); return; }
    sound.play('ui_confirm', { volume: 0.6 });
    haptic(20);
    p.say(pick(['Here we go, here we go!', 'Round and round she goes...', 'Give it a good spin!']), 2400);
    setShow(r.prizes);
  }

  return (
    <div class={'lg-gacha ' + (side ? 'side' : 'tall') + (closing ? ' closing' : '') + (show ? ' revealing' : '')}>
      {!show && (
        <div class="lg-gboard lf-lg_board" role="dialog" aria-label={s.name}>
          <header class="lg-g-top">
            <button class="lg-btn linen lg-g-close" aria-label="Back to the store" onClick={close}><Px name="arrow_left" size={20} /></button>
            <div class="lg-g-tabs">
              {SERIES.map((x) => <button class={'lg-g-tab' + (x.id === s.id ? ' on' : '')} onClick={() => { sound.play('fabric', { volume: 0.4 }); p.onSeries(x.id); }}>{x.name.split(' ')[0]}</button>)}
            </div>
            <button class="lg-g-gems lf-lg_chip" onClick={p.onBuyGems} aria-label="Moon gems: get more"><AnimPx name="moongem" size={22} /><b><Rolling value={sv.gems} /></b><span class="lg-plus">+</span></button>
          </header>
          <div class="lg-g-body">
            <div class="lg-poster">
              <span class="lg-pin" /><span class="lg-pin r" />
              <img class="lg-poster-art" src={bannerArt(s, side ? 200 : 180, side ? 112 : 100)} alt="" />
              <div class="lg-poster-title">
                <span class="lg-poster-kick">{on ? `Weekly series · ends in ${fmtLeft(msToWeek())}` : `Arrives in ${fmtLeft(msToWeek())}`}</span>
                <h2>{s.name}</h2>
                <p>{s.tagline}</p>
              </div>
            </div>
            <div class="lg-feat">
              <div class="lg-fcard five lf-lg_kraft">
                <span class="lg-up">UP</span>
                <span class="lg-fart">{(() => { const a = prizeArt(f5.kind, f5.id, look); return a ? <img src={a} alt="" /> : <Px name="shop_mystery" size={56} />; })()}</span>
                <StarRow n={5} size={12} />
                <b>{nameOf(f5.kind, f5.id)}</b>
                <small>{KIND_LABEL[f5.kind]}</small>
              </div>
              {f4.map((e, k) => (
                <div class="lg-fcard lf-lg_paper" style={{ transform: `rotate(${(k - 1) * 2.5}deg)` }}>
                  <span class="lg-fart">{(() => { const a = prizeArt(e.kind, e.id, look); return a ? <img src={a} alt="" /> : <Px name="shop_mystery" size={40} />; })()}</span>
                  <StarRow n={4} size={9} />
                  <small>{nameOf(e.kind, e.id)}</small>
                </div>
              ))}
            </div>
            <div class="lg-g-slate lf-lg_slate">
              <div class="lg-chalk-row"><span>5<Px name="shop_star5" size={12} /> for sure in</span><b>{untilFive(pity)}</b><span>wishes</span></div>
              <div class="lg-chalk-row"><span>4<Px name="shop_star4" size={12} /> for sure in</span><b>{untilFour(pity)}</b><span>wishes</span></div>
              <div class="lg-chalk-row small"><span>wished since the last 5<Px name="shop_star5" size={10} />:</span><Tally n={pity.five} max={40} />{pity.five > 40 ? <em>+{pity.five - 40}</em> : null}</div>
              {pity.guaranteed && <div class="lg-chalk-row small gold">next 5<Px name="shop_star5" size={10} /> is the featured one!</div>}
            </div>
            <div class="lg-g-links">
              <button class="lg-ktag small" onClick={() => { sound.play('paper_flip', { volume: 0.4 }); setSheet('details'); }}>Rates</button>
              <button class="lg-ktag small" onClick={() => { sound.play('paper_flip', { volume: 0.4 }); setSheet('history'); }}>History</button>
            </div>
          </div>
          <footer class="lg-g-wish">
            <Stamp label="Wish ×1" cost={<span class="lg-cost"><Px name="moongem" size={18} />{PULL_COST}</span>} short={!on || sv.gems < PULL_COST} onPress={() => doWish(1)} />
            <Stamp label="Wish ×10" cost={<span class="lg-cost"><Px name="moongem" size={18} />{fmt(PULL_COST * 10)}</span>} short={!on || sv.gems < PULL_COST * 10} onPress={() => doWish(10)} />
          </footer>
        </div>
      )}
      {sheet === 'details' && <Details seriesId={s.id} onClose={() => setSheet(null)} />}
      {sheet === 'history' && <History seriesId={s.id} onClose={() => setSheet(null)} />}
      {show && <Reveal prizes={show} stage={p.stage} say={p.say} onAgain={on ? (n) => { setShow(null); setTimeout(() => doWish(n), 80); } : undefined} onDone={() => { setShow(null); p.stage?.closeBarrel(); p.stage?.focus('series'); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ rates and history (ledger pages)

function Details(p: { seriesId: string; onClose: () => void }) {
  const s = SERIES_BY_ID[p.seriesId];
  const by = (n: Stars) => s.pool.filter((e) => e.stars === n);
  return (
    <div class="lg-modal-back" onClick={p.onClose}>
      <div class="lg-page" onClick={(e) => e.stopPropagation()}>
        <h3 class="lg-page-title">Rates &amp; details</h3>
        <div class="lg-page-scroll">
          <table class="lg-rates">
            <tr><td><StarRow n={5} size={11} /></td><td>{(ODDS.five * 100).toFixed(1)}%</td><td class="muted">about 1.6% with pity</td></tr>
            <tr><td><StarRow n={4} size={11} /></td><td>{(ODDS.four * 100).toFixed(1)}%</td><td class="muted">about 13% with pity</td></tr>
            <tr><td><StarRow n={3} size={11} /></td><td>{((1 - ODDS.five - ODDS.four) * 100).toFixed(1)}%</td><td /></tr>
          </table>
          <p>The 5-star chance climbs from wish {ODDS.softFrom}, and wish {ODDS.hard} is always a 5-star. Every {ODDS.fourHard} wishes bring at least a 4-star. A 5-star has a 50% chance to be the featured one; if it isn't, the next 5-star will be. Pity is kept for each series, even between weeks.</p>
          <p>Duplicate outfits, skins and finishes turn into acorns (3★ 60, 4★ 300, 5★ 1,500). Duplicate furniture stacks in your storage.</p>
          {([5, 4, 3] as Stars[]).map((n) => (
            <div class="lg-pool">
              <StarRow n={n} size={11} />
              <ul>{by(n).map((e) => <li class={e.featured ? 'feat' : ''}>{nameOf(e.kind, e.id)}<small>{KIND_LABEL[e.kind]}{e.featured ? ' · UP' : ''}</small></li>)}</ul>
            </div>
          ))}
        </div>
        <button class="lg-btn gold" onClick={p.onClose}>Got it</button>
      </div>
    </div>
  );
}
function History(p: { seriesId: string; onClose: () => void }) {
  const list = wishLog().filter((l) => l.series === p.seriesId).slice(0, 60);
  return (
    <div class="lg-modal-back" onClick={p.onClose}>
      <div class="lg-page" onClick={(e) => e.stopPropagation()}>
        <h3 class="lg-page-title">Wish ledger</h3>
        <div class="lg-page-scroll">
          {!list.length && <p class="center">No wishes on this series yet. The barrel is waiting!</p>}
          <ul class="lg-history">{list.map((l) => <li class={'r' + l.stars}><StarRow n={l.stars} size={9} /><b>{nameOf(l.kind, l.id)}</b><small>{l.dupe ? `+${l.dupe} acorns` : KIND_LABEL[l.kind]}</small><time>{new Date(l.t).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time></li>)}</ul>
        </div>
        <button class="lg-btn gold" onClick={p.onClose}>Close</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the reveal at the barrel

export function Reveal(p: { prizes: Prize[]; stage: Lodge | null; say: (t: string, ms?: number) => void; onDone: () => void; onAgain?: (n: 1 | 10) => void }) {
  const best = useMemo(() => Math.max(...p.prizes.map((x) => x.stars)) as Stars, [p.prizes]);
  // the order they come out: the best one last, for the drum roll
  const order = useMemo(() => [...p.prizes].map((x, k) => ({ x, k })).sort((a, b) => a.x.stars - b.x.stars || a.k - b.k).map((o) => o.x), [p.prizes]);
  const [phase, setPhase] = useState<'barrel' | 'reveal' | 'summary'>('barrel');
  const [i, setI] = useState(0);
  const dupes = p.prizes.reduce((a, x) => a + x.dupe, 0);
  useEffect(() => {
    sound.play('tp_shimmer', { volume: 0.5 });
    let alive = true;
    const go = () => { if (alive && !debug.hold) setPhase('reveal'); };
    if (p.stage) void p.stage.wish(best).then(go); else setTimeout(go, 1500);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (phase !== 'reveal') return;
    const pr = order[i];
    void p.stage?.showPrize({ kind: pr.entry.kind, id: pr.entry.id }, pr.stars);
    sound.play(pr.stars === 5 ? 'reward_levelup' : pr.stars === 4 ? 'reward_unlock' : 'ui_page', { volume: pr.stars === 3 ? 0.5 : 0.6 });
    haptic(pr.stars === 5 ? 30 : 10);
    if (pr.stars === 5) p.say(pick(['TIMBER! Would you look at that!', 'Gnaw me a log, a five-star!', 'Oh my whiskers, the big one!']), 2600);
    else if (pr.stars === 4 && i === order.length - 1) p.say(pick(['Ooh, a four-star! Lovely.', 'That\'s a good one, friend!']), 2200);
  }, [phase, i]);
  useEffect(() => {
    if (phase === 'summary') {
      p.stage?.clearPrize();
      sound.play('reward_quest', { volume: 0.5 });
      if (dupes) setTimeout(() => rewardMoment('coin', dupes, 'From duplicates'), 500);
    }
  }, [phase]);
  const next = () => {
    if (phase === 'barrel') { setPhase('reveal'); return; }
    if (phase === 'reveal') { if (i + 1 < order.length) setI(i + 1); else setPhase('summary'); }
  };
  const pr = order[i];
  const look = save.value.look;
  return (
    <div class={'lg-reveal ' + phase + ' best' + best} onClick={next}>
      {phase === 'barrel' && <div class={'lg-flash r' + best} />}
      {phase === 'barrel' && <span class="lg-skip">Tap to skip</span>}
      {phase === 'reveal' && (
        <div class={'lg-plaque-wrap r' + pr.stars} key={i}>
          <div class="lg-rays" />
          <div class="lg-plaque lf-lg_board_gold">
            <StarRow n={pr.stars} size={22} pop />
            <b class="lg-plaque-name">{nameOf(pr.entry.kind, pr.entry.id)}</b>
            <span class="lg-plaque-kind">{KIND_LABEL[pr.entry.kind]}{pr.featured ? ' · featured' : ''}</span>
            {pr.isNew ? <span class="lg-new">NEW!</span> : pr.dupe ? <span class="lg-dupe"><Px name="owlcoin" size={18} />Duplicate: +{fmt(pr.dupe)} acorns</span> : <span class="lg-dupe">Another one for your storage</span>}
          </div>
          <span class="lg-count">{i + 1} / {order.length}</span>
          {order.length > 1 && <button class="lg-btn linen lg-skipall" onClick={(e) => { e.stopPropagation(); setPhase('summary'); }}>Skip ▸▸</button>}
        </div>
      )}
      {phase === 'summary' && (
        <div class="lg-page summary" onClick={(e) => e.stopPropagation()}>
          <h3 class="lg-page-title">From the barrel</h3>
          <div class={'lg-sum-grid n' + p.prizes.length}>
            {[...p.prizes].map((x, k) => ({ x, k })).sort((a, b) => b.x.stars - a.x.stars || a.k - b.k).map(({ x, k }) => (
              <div class={'lg-sum-card r' + x.stars} style={{ animationDelay: `${k * 0.06}s` }}>
                <div class="lg-sum-art">{(() => { const a = prizeArt(x.entry.kind, x.entry.id, look); return a ? <img src={a} alt="" /> : <Px name="shop_mystery" size={56} />; })()}</div>
                <StarRow n={x.stars} size={8} />
                <small>{nameOf(x.entry.kind, x.entry.id)}</small>
                {x.isNew ? <span class="lg-new sm">NEW</span> : x.dupe ? <span class="lg-dupe sm">+{x.dupe}</span> : null}
              </div>
            ))}
          </div>
          {dupes > 0 && <p class="lg-sum-dupes"><Px name="owlcoin" size={20} />Duplicates became <b>{fmt(dupes)}</b> acorns</p>}
          <div class="lg-row">
            <button class="lg-btn linen grow" onClick={() => { panel.value = p.prizes.some((x) => x.entry.kind === 'item' || x.entry.kind === 'finish') ? 'build' : 'wardrobe'; }}>See them</button>
            {p.onAgain && <button class="lg-btn violet grow" onClick={() => p.onAgain!(p.prizes.length === 1 ? 1 : 10)}>Again ×{p.prizes.length === 1 ? 1 : 10}</button>}
            <button class="lg-btn gold grow" onClick={p.onDone}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
