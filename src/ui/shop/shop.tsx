// OWNED BY THE SHOP BUILDER: Queen Neve's daily cosmetics boutique, in the format of MrBeast
// Swarmers' daily shop (reset countdown, a free daily gift, a deals grid with price tags and SOLD
// stamps, coin deals, titled sections, confirm boxes, reward pop-ups), restyled as frosted ice.
// Landscape: the shop UI on the left, the queen in her voxel boutique (a Stage) on the right.
// Portrait: the boutique fills the top, the shop scrolls below. Scrolling down reaches the weekly
// series; a series opens its gacha banner (gacha.tsx).
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { PIECE } from '../../owl/outfits.ts';
import { QUEEN_NAME } from '../../owl/queen.ts';
import { SPECIAL_SKIN } from '../../owl/skins.ts';
import {
  ACORN_PACKS, activeSeries, buyAcorns, buyDeal, claimGift, dailyDeals, dailyGift, ensureDay, fmtLeft, GEM_PACKS, giftClaimed, grantGems,
  isSold, KIND_LABEL, msToMidnight, msToWeek, seriesActive, SERIES, type AcornPack, type Deal, type GemPack,
} from '../../game/shop.ts';
import type { Series } from '../../game/series.ts';
import { save } from '../../game/store.ts';
import { Boutique } from '../../world/stages/boutique.ts';
import { transition } from '../chrome/transition.ts';
import { ask } from '../fx.tsx';
import { Px } from '../icons.tsx';
import { haptic, toast, useTick } from '../kit.tsx';
import { spriteURL } from '../px/sprites.js';
import '../px/anim.ts';
import { panel, sceneRef } from '../state.ts';
import { injectIceCSS } from './art.js';
import { Gacha } from './gacha.tsx';
import { AnimPx, iceConfirm, rewardMoment, showPrize } from './moment.tsx';
import { bannerArt, bigOwl, prizeArt, skinLook } from './paint.ts';
import './shop.css';

const fmt = (n: number) => n.toLocaleString('en-US');
const dpr = () => Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
const isSide = () => innerWidth >= innerHeight * 1.05 && innerWidth >= 640;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------------ the queen's voice

const LINES = {
  hello: [
    'Welcome, little one! The snow brought you here for a reason.',
    'Ah, a visitor! Come in, shake off the frost.',
    'Darling, your feathers look radiant today. Shall we find something to match?',
    'Hoo-hoo! Fresh stock, just unpacked from the north wind.',
  ],
  deal: [
    (n: string) => `The ${n}? Hand-finished by frost elves. I checked every stitch.`,
    (n: string) => `Ah, the ${n}. That one has your name on it. Well, almost.`,
    (n: string) => `Exquisite taste. The ${n} is my favourite today.`,
    (n: string) => `The ${n}. Even the aurora is jealous of it.`,
  ],
  bought: ['A royal choice! Wear it with pride.', 'Wonderful! I wrapped it in moonlight for you.', 'Splendid! The whole Hollow will be talking.', 'Oh, it suits you already. I can tell.'],
  poor: ['Oh dear, a few acorns short. Sleep well and come back to me.', 'Your purse is light tonight. Pip will find more on an adventure.', 'Not quite enough, darling. The stars will provide.'],
  poke: ['Careful, darling, the crown is real ice.', 'Hoo-hoo! You tickle like a snowflake.', 'Royalty does not giggle. ...Hee.', 'Have I told you about my nineteen capes?'],
  gift: ['A little something, from my court to your nest.', 'For you. No curtsy needed. Though I would not mind one.'],
  acorns: ['The squirrels will be so jealous.', 'A mountain of acorns! Spend them wisely. Or splendidly.'],
  gems: ['Moon gems, polished by starlight. Ooh, shiny.'],
  wish: ['May the stars fall kindly for you.', 'The banner awaits. Wish boldly!'],
  sold: ['That one is spoken for until tomorrow. New treasures at midnight!'],
  bye: ['Farewell! Mind the icicles on your way out.', 'Come back tomorrow. I will have new things to show you.'],
};

interface Line { text: string; id: number }
let lineId = 0;

function QueenBubble(p: { stage: Boutique | null; line: Line | null; layout: 'side' | 'top' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const place = () => {
    const el = ref.current, st = p.stage;
    if (!el || !st) return;
    const q = st.queenScreen();
    // beside the queen's head, tail pointing at her, never over the shop panel or off screen
    const w = el.offsetWidth || 240, minL = p.layout === 'side' ? Math.min(innerWidth - w - 8, innerWidth * 0.5 + 20) : 8;
    const left = Math.max(minL, Math.min(innerWidth - w - 8, q.x + 34 - w * 0.12));
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(p.layout === 'side' ? 120 : 112, q.y + 18)}px`;
    el.style.setProperty('--tail', `${Math.max(12, Math.min(w - 24, q.x - left))}px`);
  };
  useEffect(() => {
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); place(); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.stage, p.layout]);
  const l = p.line;
  useLayoutEffect(place, [l?.id]);
  useEffect(() => {
    if (!l) return;
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(i);
      const ch = l.text[i - 1] ?? '';
      if (i % 2 === 0 && /[a-z]/i.test(ch)) sound.play(ch.charCodeAt(0) % 2 ? 'voice_d' : 'voice_e', { volume: 0.16, rate: 1.25 + ((ch.charCodeAt(0) * 7) % 9) / 40, gap: 40 });
      if (i >= l.text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [l?.id]);
  if (!l) return null;
  return (
    <div class="nv-bubble if-ice_bubble" ref={ref} key={l.id}>
      <span class="nv-bubble-who if-ice_ribbon_violet">{QUEEN_NAME}</span>
      {l.text.slice(0, shown)}<span style="opacity:0">{l.text.slice(shown)}</span>
    </div>
  );
}

// ------------------------------------------------------------------ small pieces

export function Cost(p: { cur: 'coins' | 'gems'; n: number; size?: number }) {
  return <span class="nv-cost"><Px name={p.cur === 'gems' ? 'moongem' : 'owlcoin'} size={p.size ?? 24} />{fmt(p.n)}</span>;
}
function Ribbon(p: { children: ComponentChildren; tone?: 'ice' | 'gold' | 'berry' | 'violet'; right?: ComponentChildren; id?: string }) {
  return (
    <div class="nv-sec-head" data-sec={p.id}>
      <h3 class={'nv-ribbon if-ice_ribbon' + (p.tone && p.tone !== 'ice' ? '_' + p.tone : '')}><Px name="ice_flake_s" size={10} />{p.children}<Px name="ice_flake_s" size={10} /></h3>
      {p.right}
    </div>
  );
}
function Timer(p: { ms: number; label?: string }) {
  return <span class="nv-timer if-ice_chip"><Px name="shop_timer" size={22} />{p.label && <span class="nv-timer-l">{p.label}</span>}<b>{fmtLeft(p.ms)}</b></span>;
}
function MissingArt(p: { name: string; size?: number }) {
  return <div class="nv-missing" style={p.size ? { width: `${p.size}px`, height: `${p.size}px` } : undefined}><Px name="shop_mystery" size={p.size ? p.size * 0.6 : 48} class="nv-float" /><span>{p.name}</span></div>;
}

// ------------------------------------------------------------------ the shop

export function Shop() {
  const sc = sceneRef.current;
  const [layout, setLayout] = useState<'side' | 'top'>(isSide() ? 'side' : 'top');
  const [stage, setStage] = useState<Boutique | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [gacha, setGacha] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [raised, setRaised] = useState(false);
  const [focus, setFocus] = useState(-1);
  const stageRef = useRef<Boutique | null>(null);
  const dealsRef = useRef<Deal[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const lineTimer = useRef(0);
  useTick(1000);
  const s = save.value;
  const say = (text: string, ms = 4200) => { const id = ++lineId; setLine({ text, id }); clearTimeout(lineTimer.current); lineTimer.current = window.setTimeout(() => setLine((x) => (x?.id === id ? null : x)), ms); };

  injectIceCSS();
  useEffect(() => { ensureDay(); }, []);
  const deals = useMemo(() => dailyDeals(save.value), [s.shop.day, s.owned.items.length, s.owned.pieces.length, s.owned.species.length]);
  const dealKey = deals.map((d) => d.key).join('|');
  dealsRef.current = deals;

  // the boutique stage: built on open, shown behind a snow flurry
  useEffect(() => {
    let b: Boutique | null = null;
    try { b = new Boutique(deals.map((d) => ({ kind: d.kind, id: d.id }))); } catch (e) { console.warn('boutique failed', e); }
    if (b && sc) {
      const st = b;
      void transition('snow', () => { sc.setStage(st); });
      st.greet();
      st.onPick = (i) => { pickDeal(i, true); };
      st.onQueen = () => say(pick(LINES.poke));
      setStage(st);
      stageRef.current = st;
    }
    const t = setTimeout(() => say(pick(LINES.hello)), 900);
    const onResize = () => setLayout(isSide() ? 'side' : 'top');
    addEventListener('resize', onResize);
    if (import.meta.env.DEV) (window as unknown as { hhShop: unknown }).hhShop = { stage: b, open: (id: string) => setGacha(id), say, moment: rewardMoment };
    return () => {
      clearTimeout(t);
      removeEventListener('resize', onResize);
      if (sc && b && sc.stage === b) sc.setStage(null);
    };
  }, []);
  useEffect(() => { stage?.setDeals(deals.map((d) => ({ kind: d.kind, id: d.id }))); }, [stage, dealKey]);
  useEffect(() => { deals.forEach((d, i) => stage?.setSold(i, isSold(s, d.key))); }, [stage, dealKey, s.shop.bought.length]);

  const close = () => {
    if (leaving) return;
    sound.play('ui_close', { volume: 0.5 });
    setLeaving(true);
    say(pick(LINES.bye), 2000);
    setTimeout(() => { void transition('snow', () => { if (sc && sc.stage === stage) sc.setStage(null); panel.value = null; }); }, 420);
  };

  const pickDeal = (i: number, fromStage = false) => {
    const d = dealsRef.current[i];
    if (!d) return;
    setFocus(i);
    stageRef.current?.present(i);
    sound.play('sparkle', { volume: 0.35, gap: 200 });
    say(isSold(save.value, d.key) ? pick(LINES.sold) : pick(LINES.deal)(d.name));
    if (fromStage) {
      const el = scroller.current?.querySelector(`[data-deal="${i}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const look = s.look;
  const art = (d: { kind: Deal['kind'] | 'skin' | 'finish'; id: string }) => prizeArt(d.kind, d.id, look);

  const buy = async (d: Deal, i: number) => {
    pickDeal(i);
    const a = art(d);
    const have = d.cur === 'gems' ? s.gems : s.coins;
    if (have < d.price) { sound.play('ui_error', { volume: 0.5 }); say(pick(LINES.poor)); stageRef.current?.react('shiver', 'worried'); toast(d.cur === 'gems' ? 'Not enough moon gems' : 'Not enough acorns'); return; }
    const ok = await iceConfirm({
      title: d.name,
      art: a ? <img class="nv-confirm-art" src={a} alt="" /> : <MissingArt name={d.name} />,
      body: <>{d.blurb}<div class="nv-confirm-price"><s><Cost cur={d.cur} n={d.base} size={20} /></s><span class="nv-off-inline">-{d.off}%</span></div></>,
      yes: <>Buy <Cost cur={d.cur} n={d.price} /></>,
    });
    if (!ok) return;
    const err = buyDeal(d);
    if (err) { sound.play('ui_error', { volume: 0.5 }); toast(err); return; }
    sound.play('ui_buy', { volume: 0.6 }); sound.play('reward_unlock', { volume: 0.4 });
    haptic(20);
    stageRef.current?.celebrate(i);
    say(pick(LINES.bought));
    setTimeout(() => showPrize({
      title: 'Yours!', name: d.name, sub: `${d.kind === 'piece' ? 'Outfit' : d.kind === 'species' ? 'Plumage' : 'Furniture'} · saved ${fmt(d.base - d.price)} ${d.cur === 'gems' ? 'moon gems' : 'acorns'}`,
      art: a ? <img class="nv-prize-img" src={a} alt="" /> : <MissingArt name={d.name} size={140} />,
      actions: [
        { label: d.kind === 'item' ? 'Place it' : 'Try it on', tone: 'ice', run: () => { panel.value = d.kind === 'item' ? 'build' : 'wardrobe'; } },
        { label: 'Lovely!', tone: 'gold' },
      ],
    }), 600);
  };

  const gift = (e: MouseEvent) => {
    const g = claimGift();
    if (!g) return;
    void e;
    sound.play('ui_open', { volume: 0.5 });
    stageRef.current?.celebrate();
    say(pick(LINES.gift));
    rewardMoment(g.gems ? 'gem' : 'coin', g.gems ?? g.coins ?? 0, 'Daily gift');
  };

  const buyPack = async (p: AcornPack) => {
    if (s.gems < p.gems) { sound.play('ui_error', { volume: 0.5 }); say('You will need a few more moon gems for that, darling.'); scroller.current?.querySelector('[data-sec="gems"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const ok = await iceConfirm({
      title: p.name,
      art: <Px name={p.sprite} size={128} />,
      body: <>{p.blurb}<div class="nv-confirm-price">Get <Cost cur="coins" n={p.coins} /></div></>,
      yes: <>Swap <Cost cur="gems" n={p.gems} /></>,
      tone: 'violet',
    });
    if (!ok) return;
    const err = buyAcorns(p);
    if (err) { toast(err); return; }
    stageRef.current?.celebrate();
    say(pick(LINES.acorns));
    rewardMoment('coin', p.coins, p.name);
  };

  const buyGems = async (p: GemPack) => {
    const ok = await ask({
      title: p.name, art: spriteURL('gem_pack_' + p.size, 4), ok: 'Grant for testing', cancel: 'Cancel', tone: 'night',
      body: <>{fmt(p.gems)} moon gems{p.bonus ? ` + ${fmt(p.bonus)} bonus` : ''} · <b>{p.price}</b><br /><span class="small">Demo store: no payment provider is connected, so nothing is charged.</span></>,
    });
    if (!ok) return;
    grantGems(p);
    stageRef.current?.celebrate();
    say(pick(LINES.gems));
    rewardMoment('gem', p.gems + p.bonus, p.name);
  };

  const openSeries = (sr: Series) => {
    sound.play('ui_open', { volume: 0.55 });
    say(pick(LINES.wish));
    setGacha(sr.id);
  };

  const claimed = giftClaimed(s), g = dailyGift();
  const reset = msToMidnight();

  return (
    <div class={`nv-shop ${layout}${leaving ? ' leaving' : ''}${raised ? ' raised' : ''}`}>
      <div class="nv-flurry" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.07}s`, animationDuration: `${1.1 + (i % 5) * 0.18}s` }} />)}</div>
      {!gacha && <QueenBubble stage={stage} line={line} layout={layout} />}
      <section class="nv-panel if-ice_panel" aria-label="Neve's Boutique">
        <header class="nv-head">
          <button class="nv-close nv-btn frost" aria-label="Leave the boutique" onClick={close}><Px name="arrow_left" size={22} /></button>
          <div class="nv-title">
            <b class="nv-title-main">Neve's Boutique</b>
            <span class="nv-title-sub">Fresh treasures every day!</span>
          </div>
          <Timer ms={reset} label="New in " />
        </header>
        <div class="nv-icicles" aria-hidden="true" />
        <div class="nv-scroll" ref={scroller} onScroll={(e) => setRaised((e.currentTarget as HTMLElement).scrollTop > 80)}>

          <Ribbon id="deals" tone="berry" right={<span class="nv-hint">Tap a stand to see it up close</span>}>Daily Deals</Ribbon>
          <div class="nv-deals">
            <div class="nv-rail" aria-hidden="true" />
            {deals.map((d, i) => {
              const sold = isSold(s, d.key), a = art(d), hang = d.kind !== 'item';
              return (
                <div class={'nv-deal' + (hang ? ' hang' : ' stand') + (sold ? ' sold' : '') + (focus === i ? ' focus' : '')} data-deal={i} style={{ animationDelay: `${-i * 0.9}s` }}>
                  {hang && <Px name="shop_hanger" size={44} class="nv-hanger" />}
                  <button class={'nv-deal-card ' + (d.cur === 'gems' ? 'if-ice_card_gold' : 'if-ice_card')} onClick={() => pickDeal(i)}>
                    <span class="nv-off if-ice_tag_berry">-{d.off}%</span>
                    <div class="nv-deal-art">{a ? <img src={a} alt="" /> : <MissingArt name={d.name} />}{!hang && <span class="nv-mini-stand" />}</div>
                    <b class="nv-deal-name">{d.name}</b>
                    <span class="nv-deal-kind">{d.kind === 'piece' ? `Outfit · ${PIECE[d.id]?.slot ?? ''}` : d.kind === 'species' ? 'Plumage' : 'Furniture'}</span>
                    <s class="nv-was"><Cost cur={d.cur} n={d.base} size={16} /></s>
                  </button>
                  {sold ? <span class="nv-sold">SOLD</span>
                    : <button class={'nv-btn ' + (d.cur === 'gems' ? 'violet' : 'gold') + ' nv-buy'} onClick={() => void buy(d, i)}><Cost cur={d.cur} n={d.price} /></button>}
                </div>
              );
            })}
          </div>

          <Ribbon id="gift" tone="gold" right={<Timer ms={reset} />}>Gift & Acorn Stash</Ribbon>
          <div class="nv-grid">
            <div class={'nv-offer gift ' + (claimed ? 'sold if-ice_card_dark' : 'if-ice_card_gold')}>
              <span class="nv-tag if-ice_tag_berry">DAILY GIFT</span>
              <div class="nv-offer-art"><Px name="shop_gift" size={72} class={claimed ? '' : 'nv-wiggle'} /></div>
              <b class="nv-offer-name">{claimed ? 'See you tomorrow' : 'A gift from the Queen'}</b>
              <span class="nv-offer-sub"><Cost cur={g.gems ? 'gems' : 'coins'} n={g.gems ?? g.coins ?? 0} size={18} /></span>
              {claimed ? <span class="nv-sold small">CLAIMED</span> : <button class="nv-btn berry nv-pulse" onClick={gift}>FREE!</button>}
            </div>
            {ACORN_PACKS.map((p) => (
              <div class={'nv-offer pack if-ice_card' + (p.tag ? ' best' : '')}>
                {p.tag && <span class={'nv-tag ' + (p.tag === 'Best value' ? 'if-ice_tag_gold' : 'if-ice_tag_ice')}>{p.tag.toUpperCase()}</span>}
                <div class="nv-offer-art">{p.id === 'mountain' ? <AnimPx name="coin_vault" size={88} fps={5} /> : <Px name={p.sprite} size={p.id === 'handful' ? 64 : 76} />}</div>
                <b class="nv-offer-amt nv-outline">{fmt(p.coins)}</b>
                <b class="nv-offer-name">{p.name}</b>
                {p.bonus ? <span class="nv-bonus">+{p.bonus}% more</span> : <span class="nv-bonus none">&nbsp;</span>}
                <button class="nv-btn violet" onClick={() => void buyPack(p)}><Cost cur="gems" n={p.gems} /></button>
              </div>
            ))}
          </div>

          <Ribbon id="gems" tone="violet">Moon Gems</Ribbon>
          <div class="nv-grid gems">
            {GEM_PACKS.map((p) => (
              <div class={'nv-offer gem if-ice_card_dark' + (p.tag ? ' best' : '')}>
                {p.tag && <span class={'nv-tag ' + (p.tag === 'Best value' ? 'if-ice_tag_gold' : 'if-ice_tag_ice')}>{p.tag.toUpperCase()}</span>}
                <div class="nv-offer-art"><Px name={'gem_pack_' + p.size} size={72} class="nv-float" /></div>
                <b class="nv-offer-amt nv-outline violet">{fmt(p.gems)}</b>
                {p.bonus ? <span class="nv-bonus gem">+{fmt(p.bonus)} bonus</span> : <span class="nv-bonus none">&nbsp;</span>}
                <button class="nv-btn ice" onClick={() => void buyGems(p)}>{p.price}</button>
              </div>
            ))}
          </div>
          <p class="nv-fine">Demo store: no payment provider is connected, so nothing is ever charged.</p>

          <Ribbon id="series" tone="violet" right={<Timer ms={msToWeek()} label="Swaps in " />}>Weekly Series</Ribbon>
          <div class="nv-series-list">
            {SERIES.map((sr) => <SeriesCard s={sr} onOpen={() => openSeries(sr)} />)}
          </div>
          <p class="nv-fine">One series is on the shelf each week. Wish with moon gems; every 10 wishes bring a 4-star or better, and a 5-star is certain within 90.</p>
        </div>
      </section>
      {gacha && <Gacha seriesId={gacha} onClose={() => { setGacha(null); stageRef.current?.react('nod', 'happy'); }} onBuyGems={() => { setGacha(null); setTimeout(() => scroller.current?.querySelector('[data-sec="gems"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} />}
    </div>
  );
}

function SeriesCard(p: { s: Series; onOpen: () => void }) {
  const s = p.s, on = seriesActive(s);
  const f5 = s.pool.find((e) => e.stars === 5 && e.featured) ?? s.pool.find((e) => e.stars === 5);
  const f4 = s.pool.filter((e) => e.stars === 4 && e.featured).slice(0, 3);
  const hero = f5 && SPECIAL_SKIN[f5.id] ? bigOwl(skinLook(f5.id), 256) : '';
  const bg = bannerArt(s, 168, 72);
  const look = save.value.look;
  return (
    <button class={'nv-series ' + s.motif + (on ? ' on' : ' off')} style={{ '--c0': s.colors[0], '--c1': s.colors[1], '--c2': s.colors[2], '--c3': s.colors[3] } as unknown as string} onClick={p.onOpen}>
      <img class="nv-series-bg" src={bg} alt="" />
      <span class="nv-series-shine" />
      {hero && <img class="nv-series-hero" src={hero} alt="" />}
      <div class="nv-series-text">
        <span class={'nv-chip ' + (on ? 'live' : 'soon')}>{on ? `ON THE SHELF · ${fmtLeft(msToWeek())}` : `ARRIVES IN ${fmtLeft(msToWeek())}`}</span>
        <b class="nv-series-name">{s.name}</b>
        <span class="nv-series-tag">{s.tagline}</span>
        <div class="nv-series-feat">
          {f4.map((e) => { const a = prizeArt(e.kind, e.id, look); return <span class="nv-feat4">{a ? <img src={a} alt="" /> : <b>?</b>}</span>; })}
          <span class="nv-series-cta nv-btn violet">{on ? 'Wish' : 'Preview'} <Px name="arrow_right" size={16} /></span>
        </div>
      </div>
      <span class="nv-series-stars">{[0, 1, 2, 3, 4].map(() => <Px name="shop_star5" size={18} />)}</span>
    </button>
  );
}

export { activeSeries, KIND_LABEL };
