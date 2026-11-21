// The weekly series banner (opened from a series card in the boutique): a painted backdrop, the
// featured 5-star owl big in the middle, the featured 4-stars in a row, the series name in big
// decorative lettering, rates and history, the pity counter, and Wish x1 / x10. A wish plays a
// cinematic: shooting stars streak across a night sky in the colour of the best prize (blue 3,
// violet 4, gold 5), then each prize is revealed with a burst of light, then a summary grid.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { untilFive, untilFour } from '../../game/gacha.ts';
import { ODDS, SERIES_BY_ID, type SeriesEntry, type Stars } from '../../game/series.ts';
import { fmtLeft, KIND_LABEL, msToWeek, nameOf, pityOf, PULL_COST, seriesActive, wish, wishLog, type Prize } from '../../game/shop.ts';
import { save } from '../../game/store.ts';
import { SPECIAL_SKIN } from '../../owl/skins.ts';
import { Px } from '../icons.tsx';
import { haptic, Rolling, toast, useTick } from '../kit.tsx';
import { panel } from '../state.ts';
import { AnimPx, rewardMoment } from './moment.tsx';
import { bannerArt, bigOwl, prizeArt, skinLook, skyArt } from './paint.ts';

const fmt = (n: number) => n.toLocaleString('en-US');
const isSide = () => innerWidth >= innerHeight * 1.05 && innerWidth >= 640;
const STAR_NAME: Record<Stars, string> = { 3: 'shop_star3', 4: 'shop_star4', 5: 'shop_star5' };
/** dev only: keep the wish cinematic on its current phase (for screenshots) */
const debug = { hold: false };

function Stars(p: { n: Stars; size?: number; pop?: boolean }) {
  return <span class={'nv-stars' + (p.pop ? ' pop' : '')}>{Array.from({ length: p.n }, (_, i) => <span style={{ animationDelay: `${0.35 + i * 0.12}s` }}><Px name={STAR_NAME[p.n]} size={p.size ?? 18} /></span>)}</span>;
}
function PrizeImg(p: { e: Pick<SeriesEntry, 'kind' | 'id'>; big?: boolean }) {
  const look = save.value.look;
  const big = p.big && p.e.kind === 'skin' && SPECIAL_SKIN[p.e.id];
  const a = big ? bigOwl(skinLook(p.e.id), 512) : prizeArt(p.e.kind, p.e.id, look);
  if (a) return <img class={'nv-prize-art ' + p.e.kind} src={a} alt="" draggable={false} />;
  return <div class={'nv-missing' + (p.big ? ' big' : '')}><Px name="shop_mystery" size={p.big ? 160 : 48} class="nv-float" /><span>{p.big ? 'A surprise, still being wrapped' : 'Arriving soon'}</span></div>;
}

// ------------------------------------------------------------------ the banner

export function Gacha(p: { seriesId: string; onClose: () => void; onBuyGems: () => void }) {
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
  const f4 = s.pool.filter((e) => e.stars === 4 && e.featured);
  const bg = bannerArt(s, side ? 320 : 180, side ? 180 : 320);

  const close = () => { sound.play('ui_close', { volume: 0.5 }); setClosing(true); setTimeout(p.onClose, 320); };
  function doWish(n: 1 | 10, force = false) {
    if (!on && !force) { sound.play('ui_error', { volume: 0.5 }); toast(`${s.name} returns next week`); return; }
    const cost = PULL_COST * n;
    if (save.value.gems < cost) {
      sound.play('ui_error', { volume: 0.5 });
      toast(`You need ${fmt(cost)} moon gems`);
      return;
    }
    const r = wish(s.id, n, Math.random, force);
    if ('error' in r) { toast(r.error); return; }
    sound.play('ui_confirm', { volume: 0.6 });
    haptic(20);
    setShow(r.prizes);
  }

  return (
    <div class={'nv-gacha ' + s.motif + (side ? ' side' : ' tall') + (closing ? ' closing' : '')} style={{ '--c0': s.colors[0], '--c1': s.colors[1], '--c2': s.colors[2], '--c3': s.colors[3] } as unknown as string}>
      <img class="nv-g-bg" src={bg} alt="" />
      <div class="nv-g-fall" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i style={{ left: `${(i * 41) % 100}%`, animationDelay: `${-(i * 0.73) % 9}s`, animationDuration: `${(s.motif === 'stars' ? 3.5 : 7) + (i % 5)}s` }} />)}</div>
      <div class="nv-g-vignette" />

      <header class="nv-g-top">
        <button class="nv-btn frost nv-g-close" aria-label="Back to the boutique" onClick={close}><Px name="arrow_left" size={22} /></button>
        <span class="nv-g-limited if-ice_chip"><Px name="shop_timer" size={20} />{on ? <><span class="nv-lim-l">Limited · </span>ends in <b>{fmtLeft(msToWeek())}</b></> : <>Arrives in <b>{fmtLeft(msToWeek())}</b></>}</span>
        <span class="grow" />
        <button class="nv-g-gems if-ice_chip" onClick={p.onBuyGems} aria-label="Moon gems: get more"><AnimPx name="moongem" size={26} /><b><Rolling value={sv.gems} /></b><span class="nv-plus">+</span></button>
      </header>

      <div class="nv-g-stage">
        <div class="nv-g-rays" />
        <div class="nv-g-halo" />
        <div class="nv-g-hero"><PrizeImg e={f5} big /></div>
        <div class="nv-g-pedestal" />
      </div>

      <div class="nv-g-head">
        <span class="nv-g-kicker"><Px name="ice_flake" size={22} />Weekly Series<Px name="ice_flake" size={22} /></span>
        <h2 class="nv-g-title">{s.name}</h2>
        <p class="nv-g-tagline">{s.tagline}</p>
      </div>
      <div class="nv-g-feat">
        <div class="nv-g-five if-ice_card_gold">
          <span class="nv-g-up">UP!</span>
          <Stars n={5} size={16} />
          <b>{nameOf(f5.kind, f5.id)}</b>
          <small>{KIND_LABEL[f5.kind]} · featured 5-star</small>
        </div>
        <div class="nv-g-fours">
          {f4.map((e) => (
            <div class="nv-g-four if-ice_card_dark">
              <PrizeImg e={e} />
              <Stars n={4} size={10} />
              <small>{nameOf(e.kind, e.id)}</small>
            </div>
          ))}
        </div>
      </div>

      <footer class="nv-g-bottom">
        <div class="nv-g-links">
          <button class="nv-btn frost sm" onClick={() => { sound.play('ui_open', { volume: 0.4 }); setSheet('details'); }}>Details</button>
          <button class="nv-btn frost sm" onClick={() => { sound.play('ui_open', { volume: 0.4 }); setSheet('history'); }}>History</button>
        </div>
        <div class="nv-g-pity if-ice_chip">
          <Px name="shop_star5" size={18} />
          <span>5★ guaranteed within <b>{untilFive(pity)}</b> wishes</span>
          <span class="nv-g-pity4">4★ within <b>{untilFour(pity)}</b>{pity.guaranteed ? <> · next 5★ is <b>featured</b></> : null}</span>
        </div>
        <div class="nv-g-wish">
          <button class={'nv-btn violet nv-wishbtn' + (on ? '' : ' off')} onClick={() => doWish(1)}><span>Wish ×1</span><span class="nv-cost"><Px name="moongem" size={20} />{PULL_COST}</span></button>
          <button class={'nv-btn gold nv-wishbtn' + (on ? '' : ' off')} onClick={() => doWish(10)}><span>Wish ×10</span><span class="nv-cost"><Px name="moongem" size={20} />{fmt(PULL_COST * 10)}</span></button>
        </div>
      </footer>

      {sheet === 'details' && <Details seriesId={s.id} onClose={() => setSheet(null)} />}
      {sheet === 'history' && <History seriesId={s.id} onClose={() => setSheet(null)} />}
      {show && <PullShow prizes={show} motif={s.motif} onAgain={on ? (n) => { setShow(null); setTimeout(() => doWish(n), 60); } : undefined} onDone={() => setShow(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ details and history

function Details(p: { seriesId: string; onClose: () => void }) {
  const s = SERIES_BY_ID[p.seriesId];
  const by = (n: Stars) => s.pool.filter((e) => e.stars === n);
  return (
    <div class="nv-modal-back" onClick={p.onClose}>
      <div class="nv-modal nv-sheet if-ice_panel" onClick={(e) => e.stopPropagation()}>
        <div class="nv-modal-title if-ice_ribbon_violet">Rates & details</div>
        <div class="nv-sheet-scroll">
          <table class="nv-rates">
            <tr><td><Stars n={5} size={12} /></td><td>{(ODDS.five * 100).toFixed(1)}%</td><td class="muted">about 1.6% with pity</td></tr>
            <tr><td><Stars n={4} size={12} /></td><td>{(ODDS.four * 100).toFixed(1)}%</td><td class="muted">about 13% with pity</td></tr>
            <tr><td><Stars n={3} size={12} /></td><td>{((1 - ODDS.five - ODDS.four) * 100).toFixed(1)}%</td><td /></tr>
          </table>
          <p>The 5-star chance climbs from wish {ODDS.softFrom}, and wish {ODDS.hard} is always a 5-star. Every {ODDS.fourHard} wishes bring at least a 4-star. A 5-star has a 50% chance to be the featured one; if it is not, the next 5-star will be. Pity is kept for each series, even between weeks.</p>
          <p>Duplicate outfits, skins and finishes turn into acorns (3★ 60, 4★ 300, 5★ 1,500). Duplicate furniture stacks in your storage.</p>
          {([5, 4, 3] as Stars[]).map((n) => (
            <div class="nv-pool">
              <Stars n={n} size={12} />
              <ul>{by(n).map((e) => <li class={e.featured ? 'feat' : ''}>{nameOf(e.kind, e.id)}<small>{KIND_LABEL[e.kind]}{e.featured ? ' · UP' : ''}</small></li>)}</ul>
            </div>
          ))}
        </div>
        <button class="nv-btn gold" onClick={p.onClose}>Got it</button>
      </div>
    </div>
  );
}
function History(p: { seriesId: string; onClose: () => void }) {
  const list = wishLog().filter((l) => l.series === p.seriesId).slice(0, 60);
  return (
    <div class="nv-modal-back" onClick={p.onClose}>
      <div class="nv-modal nv-sheet if-ice_panel" onClick={(e) => e.stopPropagation()}>
        <div class="nv-modal-title if-ice_ribbon_violet">Wish history</div>
        <div class="nv-sheet-scroll">
          {!list.length && <p class="center">No wishes on this series yet. The stars are waiting!</p>}
          <ul class="nv-history">{list.map((l) => <li class={'r' + l.stars}><Stars n={l.stars} size={10} /><b>{nameOf(l.kind, l.id)}</b><small>{l.dupe ? `+${l.dupe} acorns` : KIND_LABEL[l.kind]}</small><time>{new Date(l.t).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time></li>)}</ul>
        </div>
        <button class="nv-btn gold" onClick={p.onClose}>Close</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the wish cinematic

export function PullShow(p: { prizes: Prize[]; motif: 'snow' | 'stars'; onDone: () => void; onAgain?: (n: 1 | 10) => void }) {
  const best = useMemo(() => Math.max(...p.prizes.map((x) => x.stars)) as Stars, [p.prizes]);
  const [phase, setPhase] = useState<'sky' | 'reveal' | 'summary'>('sky');
  const [i, setI] = useState(0);
  const dupes = p.prizes.reduce((a, x) => a + x.dupe, 0);
  useEffect(() => {
    sound.play('tp_shimmer', { volume: 0.5 });
    const t1 = setTimeout(() => sound.play(best === 5 ? 'reward_levelup' : best === 4 ? 'reward_unlock' : 'sparkle', { volume: 0.55 }), 900);
    const t2 = setTimeout(() => { if (!debug.hold) setPhase((ph) => (ph === 'sky' ? 'reveal' : ph)); }, best === 5 ? 3000 : 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  useEffect(() => {
    if (phase !== 'reveal') return;
    const pr = p.prizes[i];
    sound.play(pr.stars === 5 ? 'reward_levelup' : pr.stars === 4 ? 'reward_unlock' : 'ui_page', { volume: pr.stars === 3 ? 0.5 : 0.6 });
    haptic(pr.stars === 5 ? 30 : 10);
  }, [phase, i]);
  useEffect(() => {
    if (phase === 'summary') { sound.play('reward_quest', { volume: 0.5 }); if (dupes) setTimeout(() => rewardMoment('coin', dupes, 'From duplicates'), 500); }
  }, [phase]);
  const next = () => { if (phase === 'sky') { setPhase('reveal'); return; } if (phase === 'reveal') { if (i + 1 < p.prizes.length) setI(i + 1); else setPhase('summary'); } };
  const shoot = Math.min(5, p.prizes.length === 1 ? 1 : 3 + (best === 5 ? 2 : best === 4 ? 1 : 0));
  const pr = p.prizes[i];
  const look = save.value.look;
  return (
    <div class={'nv-pull ' + phase + ' best' + best} onClick={next}>
      {phase === 'sky' && (
        <div class="nv-sky">
          <img class="nv-sky-art" src={skyArt(p.motif, isSide() ? 320 : 180, isSide() ? 180 : 320)} alt="" />
          {Array.from({ length: shoot }, (_, k) => (
            <div class={'nv-shoot r' + (k === 0 ? best : Math.min(best, 4) - (k % 2)) + (k === 0 ? ' lead' : '')} style={{ top: `${(k === 0 ? 20 : 8 + k * 11)}%`, animationDelay: `${0.25 + k * 0.22}s`, '--len': `${k === 0 ? 52 : 30}vmax` } as unknown as string}><i /><b /></div>
          ))}
          <div class={'nv-sky-flash r' + best} />
          <span class="nv-skip">Tap to skip</span>
        </div>
      )}
      {phase === 'reveal' && (
        <div class={'nv-reveal r' + pr.stars} key={i}>
          <div class="nv-reveal-burst" />
          <div class="nv-reveal-rays" />
          <div class="nv-reveal-motes" aria-hidden="true">{Array.from({ length: pr.stars * 6 }, (_, k) => <i style={{ left: `${(k * 37 + 11) % 100}%`, animationDelay: `${(k % 7) * 0.31}s`, animationDuration: `${2.4 + (k % 4) * 0.6}s` }} />)}</div>
          <div class="nv-reveal-art"><PrizeImg e={pr.entry} big /></div>
          <div class="nv-reveal-text">
            <Stars n={pr.stars} size={26} pop />
            <b class="nv-reveal-name">{nameOf(pr.entry.kind, pr.entry.id)}</b>
            <span class="nv-reveal-kind">{KIND_LABEL[pr.entry.kind]}{pr.featured ? ' · featured' : ''}</span>
            {pr.isNew ? <span class="nv-new">NEW!</span> : pr.dupe ? <span class="nv-dupe"><Px name="owlcoin" size={20} />Duplicate: +{fmt(pr.dupe)} acorns</span> : <span class="nv-dupe">Another one for your storage</span>}
          </div>
          <span class="nv-count">{i + 1} / {p.prizes.length}</span>
          {p.prizes.length > 1 && <button class="nv-btn frost sm nv-skipall" onClick={(e) => { e.stopPropagation(); setPhase('summary'); }}>Skip ▸▸</button>}
        </div>
      )}
      {phase === 'summary' && (
        <div class="nv-summary" onClick={(e) => e.stopPropagation()}>
          <div class="nv-modal-title if-ice_ribbon_gold">Your wishes</div>
          <div class={'nv-sum-grid n' + p.prizes.length}>
            {[...p.prizes].map((x, k) => ({ x, k })).sort((a, b) => b.x.stars - a.x.stars || a.k - b.k).map(({ x, k }) => (
              <div class={'nv-sum-card r' + x.stars} style={{ animationDelay: `${k * 0.06}s` }}>
                <div class="nv-sum-art">{(() => { const a = prizeArt(x.entry.kind, x.entry.id, look); return a ? <img src={a} alt="" /> : <Px name="shop_mystery" size={64} />; })()}</div>
                <Stars n={x.stars} size={9} />
                <small>{nameOf(x.entry.kind, x.entry.id)}</small>
                {x.isNew ? <span class="nv-new sm">NEW</span> : x.dupe ? <span class="nv-dupe sm">+{x.dupe}</span> : null}
              </div>
            ))}
          </div>
          {dupes > 0 && <p class="nv-sum-dupes"><Px name="owlcoin" size={22} />Duplicates became <b>{fmt(dupes)}</b> acorns</p>}
          <div class="nv-row">
            <button class="nv-btn frost grow" onClick={() => { panel.value = p.prizes.some((x) => x.entry.kind === 'item' || x.entry.kind === 'finish') ? 'build' : 'wardrobe'; }}>See them</button>
            {p.onAgain && <button class="nv-btn violet grow" onClick={() => p.onAgain!(p.prizes.length === 1 ? 1 : 10)}>Again ×{p.prizes.length === 1 ? 1 : 10}</button>}
            <button class="nv-btn gold grow" onClick={p.onDone}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
