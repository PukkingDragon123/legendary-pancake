// OWNED BY THE SHOP BUILDER: Barnaby's Lodge Store, the daily shop (a free gift, three discounted daily deals, acorn
// heaps and moon gem chests, the weekly series and the Lucky Barrel). Every piece is a thing in the beaver's lodge
// (src/world/stages/lodge.ts): the deals stand on gnawed stumps, the packs sit by the shelf, the gift is a parcel on
// the counter, the series hang as cloth banners. The DOM adds only what you'd see on real things: paper price tags
// hanging off the stumps (a red-pencilled old price, a sticker for the discount), kraft and brass labels, wooden signs
// to move about the store, Barnaby's speech bubble, and a detail card that is itself an object (a ledger page pinned
// on a board, a burlap label, a brass plate, a gift tag) with the purchase as a rubber stamp. The layout keeps the
// MrBeast Swarmers spirit: the shopkeeper on one side, the goods on the other (desktop: goods left, Barnaby right;
// phone: Barnaby above, goods below).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { PIECE } from '../../owl/outfits.ts';
import {
  ACORN_PACKS, buyAcorns, buyDeal, buyFrame, claimGift, dailyDeals, dailyGift, ensureDay, fmtLeft, frameWall, GEM_PACKS, giftClaimed, grantGems,
  isSold, msToMidnight, msToWeek, nameOf, seriesActive, SERIES, type AcornPack, type Deal, type FrameOffer, type GemPack,
} from '../../game/shop.ts';
import { level, ownsEntry, save } from '../../game/store.ts';
import { OwlPortrait } from '../chrome/livepip.tsx';
import { Lodge } from '../../world/stages/lodge.ts';
import { BEAVER_NAME } from '../../world/stages/beaver.ts';
import { transition } from '../chrome/transition.ts';
import { Px } from '../icons.tsx';
import { haptic, toast, useTick } from '../kit.tsx';
import '../px/anim.ts';
import { panel, sceneRef } from '../state.ts';
import { injectLodgeCSS } from './art.js';
import { Gacha } from './gacha.tsx';
import { AnimPx, rewardMoment, showPrize, Stamp } from './moment.tsx';
import { bannerArt, prizeArt } from './paint.ts';
import { fxMoment } from '../fx/moment.ts'; // [fx10]
import './shop.css';

const fmt = (n: number) => n.toLocaleString('en-US');
const isSide = () => innerWidth >= innerHeight * 1.05 && innerWidth >= 640;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
type Section = 'home' | 'deals' | 'stash' | 'series' | 'frames';

// ------------------------------------------------------------------ Barnaby's voice

export const LINES = {
  hello: [
    'Well hello there, friend! Mind the shavings, I\'ve been whittling.',
    'Come in, come in! Fresh stock, still smells of pine.',
    'Barnaby Birchbark, at your service. Have a look around!',
    'Welcome to the lodge! Everything\'s hand-picked. A few things are hand-gnawed.',
  ],
  deal: [
    (n: string) => `The ${n}? Lovely choice. I sanded that stump myself.`,
    (n: string) => `Ah, the ${n}. Sturdy as a good dam, that one.`,
    (n: string) => `The ${n}! Between you and me, it's my favourite today.`,
    (n: string) => `${n}, marked down today. Don't tell my accountant. He's also me.`,
  ],
  bought: ['Sold! I\'ll wrap it in birch bark for you.', 'A fine purchase! The whole Hollow will be envious.', 'Timber! That\'s what I shout at a happy sale.', 'Pleasure doing business, friend.'],
  poor: ['Ah, a few acorns short. Sleep well and come back, it\'ll keep.', 'Not quite enough in the pouch. Pip will find more on an adventure.', 'Hmm, the pouch is light today. Tomorrow, maybe!'],
  poke: ['Hey now, that tickles!', 'Careful, the pencil\'s sharp. Well, it was, before I chewed it.', 'My teeth never stop growing, you know. Hence all the furniture.', 'Built this whole lodge with my own two teeth.', 'Spectacles? Reading glasses. For the small print on acorns.'],
  gift: ['Here, a little something from me. No charge, friend.', 'For you! I tied the bow myself. Took eleven tries.'],
  giftLook: ['That parcel has your name on it. Go on, untie it!', 'A gift, every day. That\'s the lodge way.'],
  acorns: ['A fine heap of acorns! Spend them well.', 'Acorns for days! Don\'t eat them all at once.'],
  gems: ['Moon gems, fresh from the riverbed. Shiny!', 'Mind the glow, those gems are full of moonlight.'],
  pack: ['Weighed them myself on the brass scales.', 'Every acorn counted twice. Well, once and a half.'],
  stash: ['Acorns and moon gems, right this way.', 'The good stuff\'s by the shelf. Help yourself to a look.'],
  frames: ['Portrait frames! I carve the wooden ones myself.', 'A good frame makes a good owl look even better.', 'Try one on, see how your owl likes it.'],
  frame: [(n: string) => `The ${n}? Your owl looks very distinguished in it.`, (n: string) => `Ah, the ${n}. Hangs straight, never squeaks.`],
  series: ['The weekly series is in! Wishes go in the barrel.', 'The Lucky Barrel! Give it a whirl, see what tumbles out.'],
  wish: ['Here we go, here we go!', 'Round and round she goes...', 'Every tenth wish brings something special. Beaver\'s promise.'],
  sold: ['That one\'s spoken for until tomorrow. New stock at midnight!'],
  till: ['Ka-ching! Just testing the bell.', 'The till\'s older than me. Still counts better, too.'],
  scales: ['Honest scales, honest beaver.', 'One acorn against one brass weight. Perfectly fair!'],
  slate: [(t: string) => `New stock in ${t}. I chalk it up every morning.`],
  bye: ['Come back tomorrow, friend! New stock every morning.', 'Mind the step on your way out!'],
};

interface Line { text: string; id: number }
let lineId = 0;

// ------------------------------------------------------------------ small pieces

export function Cost(p: { cur: 'coins' | 'gems'; n: number; size?: number }) {
  return <span class="lg-cost"><Px name={p.cur === 'gems' ? 'moongem' : 'owlcoin'} size={p.size ?? 22} />{fmt(p.n)}</span>;
}
function Timer(p: { ms: number; label?: string }) {
  return <span class="lg-timer lf-lg_chip"><Px name="shop_timer" size={20} />{p.label && <span class="lg-timer-l">{p.label}</span>}<b>{fmtLeft(p.ms)}</b></span>;
}
/** A thing anchored to a point in the store (positioned every frame by the shop's ticker). */
function Anchored(p: { at: string; lift?: number; class?: string; children: ComponentChildren }) {
  return <div class={'lg-anchor ' + (p.class ?? '')} data-anchor={p.at} data-lift={p.lift ?? 0}>{p.children}</div>;
}

// ------------------------------------------------------------------ the shop

export function Shop() {
  const sc = sceneRef.current;
  const [layout, setLayout] = useState<'side' | 'top'>(isSide() ? 'side' : 'top');
  const [stage, setStage] = useState<Lodge | null>(null);
  const [section, setSection] = useState<Section>(isSide() ? 'home' : 'home');
  const [card, setCard] = useState<string | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [gacha, setGacha] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [stamped, setStamped] = useState<string | null>(null);
  const stageRef = useRef<Lodge | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const lineTimer = useRef(0);
  useTick(1000);
  const s = save.value;

  const say = (text: string, ms = 4400) => {
    const id = ++lineId;
    setLine({ text, id });
    stageRef.current?.talk(Math.min(3.2, text.length * 0.045));
    clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine((x) => (x?.id === id ? null : x)), ms);
  };

  injectLodgeCSS();
  useEffect(() => { ensureDay(); }, []);
  const deals = useMemo(() => dailyDeals(save.value), [s.shop.day, s.owned.items.length, s.owned.pieces.length, s.owned.species.length]);
  const dealKey = deals.map((d) => d.key).join('|');
  const dealsRef = useRef<Deal[]>(deals);
  dealsRef.current = deals;

  // the lodge: built on open, shown behind a transition
  useEffect(() => {
    let b: Lodge | null = null;
    try { b = new Lodge(deals.map((d) => ({ kind: d.kind, id: d.id }))); } catch (e) { console.warn('lodge failed', e); }
    if (b && sc) {
      const st = b;
      st.attach(sc.renderer, sc as unknown as Parameters<Lodge['attach']>[1]);
      void transition('leaves', () => { sc.setStage(st); });
      st.onPick = (id) => onPick(id);
      setStage(st);
      stageRef.current = st;
      setTimeout(() => st.act('wave'), 900);
    }
    const t = setTimeout(() => say(firstVisit() ? 'Welcome, friend! Tap a price tag to look closer, then stamp it to buy. Wishes are by the barrel!' : pick(LINES.hello), 6000), 1100);
    const onResize = () => setLayout(isSide() ? 'side' : 'top');
    addEventListener('resize', onResize);
    if (import.meta.env.DEV) (window as unknown as { hhShop: unknown }).hhShop = { stage: b, open: (id: string) => openSeries(id), say, moment: rewardMoment, card: (c: string) => openCard(c), section: (x: Section) => go(x) };
    return () => {
      clearTimeout(t);
      removeEventListener('resize', onResize);
      if (sc && b && sc.stage === b) sc.setStage(null);
    };
  }, []);
  useEffect(() => { stage?.setDeals(deals.map((d) => ({ kind: d.kind, id: d.id }))); }, [stage, dealKey]);
  useEffect(() => { deals.forEach((d, i) => stage?.setSold(i, isSold(s, d.key))); }, [stage, dealKey, s.shop.bought.length]);
  useEffect(() => { stage?.setGiftClaimed(giftClaimed(s)); }, [stage, s.shop.free, s.shop.day]);
  useEffect(() => { stage?.setSeries(SERIES.map((x) => ({ id: x.id, art: bannerArt(x, 120, 156), on: seriesActive(x) }))); }, [stage]);
  // the slate on the counter: chalked with the countdown to new stock
  const reset = msToMidnight();
  const resetLabel = fmtLeft(reset);
  useEffect(() => { stage?.chalk([{ text: "Today's deals", size: 26 }, { text: `new stock in ${resetLabel}`, size: 17, col: '#f3d58e' }, { text: '~ B.B.', size: 14, col: '#c9d6cf' }]); }, [stage, resetLabel]);

  // everything anchored in the store follows its thing on screen
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const st = stageRef.current, el = root.current;
      if (!st || !el) return;
      // tags follow their things, then nudge sideways until no two overlap and none leaves the screen
      const tags: { a: HTMLElement; x: number; y: number; l: number; t: number; w: number; h: number }[] = [];
      for (const a of el.querySelectorAll<HTMLElement>('[data-anchor]')) {
        const p = st.anchor(a.dataset.anchor!, +(a.dataset.lift ?? 0));
        a.classList.toggle('off', !p.on);
        const b = a.querySelector<HTMLElement>('button');
        if (!b || !p.on) { a.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`; continue; }
        const w = b.offsetWidth * (b.closest('.lg-gifttag') ? 0.86 : 1);
        tags.push({ a, x: p.x, y: p.y, l: -w / 2, t: b.offsetTop, w, h: b.offsetHeight });
      }
      const W = innerWidth;
      for (let it = 0; it < 10; it++) {
        let moved = false;
        for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
          const A = tags[i], B = tags[j];
          if (A.y + A.t >= B.y + B.t + B.h || B.y + B.t >= A.y + A.t + A.h) continue;
          const ov = Math.min(A.x + A.l + A.w, B.x + B.l + B.w) - Math.max(A.x + A.l, B.x + B.l) + 6;
          if (ov <= 0) continue;
          const d = A.x <= B.x ? 1 : -1;
          A.x -= (d * ov) / 2; B.x += (d * ov) / 2; moved = true;
        }
        for (const T of tags) T.x = Math.min(W - 6 - T.w - T.l, Math.max(6 - T.l, T.x));
        if (!moved) break;
      }
      for (const T of tags) T.a.style.transform = `translate(${Math.round(T.x)}px, ${Math.round(T.y)}px)`;
      const bub = el.querySelector<HTMLElement>('.lg-bubble');
      if (bub) placeBubble(bub, st);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const go = (sec: Section) => {
    setCard(null);
    setSection(sec);
    stageRef.current?.focus((sec === 'deals' && !isSide()) || sec === 'frames' ? 'home' : sec);
    sound.play('step_wood', { volume: 0.35, gap: 100 });
    if (sec === 'stash') say(pick(LINES.stash));
    if (sec === 'frames') say(pick(LINES.frames));
    if (sec === 'series') { say(pick(LINES.series)); stageRef.current?.act('present', 'barrel'); }
  };

  function openCard(id: string) {
    setStamped(null);
    setCard(id);
    stageRef.current?.focus(id);
    stageRef.current?.lookAt(id);
    sound.play('paper_flip', { volume: 0.4, gap: 120 });
  }
  const closeCard = () => {
    if (!card) return;
    sound.play('ui_back', { volume: 0.35 });
    setCard(null);
    stageRef.current?.focus((section === 'deals' && !isSide()) || section === 'frames' ? 'home' : section);
  };

  function onPick(id: string) {
    const st = stageRef.current;
    if (!st) return;
    if (id.startsWith('deal:')) {
      const i = +id.slice(5), d = dealsRef.current[i];
      if (!d) return;
      openCard(id);
      st.act('present', id);
      say(isSold(save.value, d.key) ? pick(LINES.sold) : pick(LINES.deal)(d.name));
      return;
    }
    if (id.startsWith('acorn:') || id.startsWith('gem:')) { if (section !== 'stash') setSection('stash'); openCard(id); say(pick(LINES.pack)); return; }
    if (id === 'gift') { openCard('gift'); if (!giftClaimed(save.value)) { st.act('present', 'gift'); say(pick(LINES.giftLook)); } return; }
    if (id.startsWith('series:') || id === 'barrel') {
      const sid = id.startsWith('series:') ? id.slice(7) : (SERIES.find((x) => seriesActive(x)) ?? SERIES[0]).id;
      openSeries(sid);
      return;
    }
    if (id === 'beaver') { say(pick(LINES.poke)); st.act(pick(['wave', 'hop', 'think', 'gnaw'] as const)); haptic(8); return; }
    if (id === 'till') { sound.play('coin_purse', { volume: 0.5 }); say(pick(LINES.till)); return; }
    if (id === 'scales') { sound.play('ui_tap', { volume: 0.4, rate: 1.4 }); say(pick(LINES.scales)); return; }
    if (id === 'slate') { say(LINES.slate[0](fmtLeft(msToMidnight()))); return; }
  }

  const close = () => {
    if (leaving) return;
    sound.play('door_creak', { volume: 0.4 });
    setLeaving(true);
    say(pick(LINES.bye), 2000);
    stageRef.current?.act('wave');
    setTimeout(() => { void transition('leaves', () => { if (sc && sc.stage === stageRef.current) sc.setStage(null); panel.value = null; }); }, 600);
  };

  // ---------------------------------------------------------------- actions

  const look = s.look;
  const art = (d: { kind: Deal['kind'] | 'skin' | 'finish'; id: string }) => prizeArt(d.kind, d.id, look);

  const buy = (d: Deal, i: number) => {
    const have = d.cur === 'gems' ? s.gems : s.coins;
    if (have < d.price) {
      sound.play('ui_error', { volume: 0.5 });
      say(pick(LINES.poor));
      stageRef.current?.act('think');
      toast(d.cur === 'gems' ? 'Not enough moon gems' : 'Not enough acorns');
      return;
    }
    const err = buyDeal(d);
    if (err) { sound.play('ui_error', { volume: 0.5 }); toast(err); return; }
    setStamped('deal:' + i);
    sound.play('stamp', { volume: 0.6 });
    setTimeout(() => { sound.play('ui_buy', { volume: 0.55 }); sound.play('reward_unlock', { volume: 0.4 }); }, 260);
    haptic(20);
    stageRef.current?.celebrate('deal:' + i);
    fxMoment('bigbuy'); // [fx10] glints, acorns and shavings
    say(pick(LINES.bought));
    const a = art(d);
    setTimeout(() => showPrize({
      title: 'Yours!', name: d.name, sub: `${d.kind === 'piece' ? 'Outfit' : d.kind === 'species' ? 'Plumage' : 'Furniture'} · you saved ${fmt(d.base - d.price)} ${d.cur === 'gems' ? 'moon gems' : 'acorns'}`,
      art: a ? <img class="lg-prize-img" src={a} alt="" /> : <Px name="shop_mystery" size={128} />,
      actions: [
        { label: d.kind === 'item' ? 'Place it' : 'Try it on', tone: 'sage', run: () => { panel.value = d.kind === 'item' ? 'build' : 'wardrobe'; } },
        { label: 'Lovely!', tone: 'gold', run: () => closeCard() },
      ],
    }), 1100);
  };

  const gift = () => {
    const g = claimGift();
    if (!g) return;
    setStamped('gift');
    sound.play('ui_open', { volume: 0.5 });
    stageRef.current?.openGift();
    stageRef.current?.celebrate('gift');
    say(pick(LINES.gift));
    setTimeout(() => { rewardMoment(g.gems ? 'gem' : 'coin', g.gems ?? g.coins ?? 0, "Barnaby's gift"); }, 700);
  };

  const buyPack = (p: AcornPack) => {
    if (s.gems < p.gems) { sound.play('ui_error', { volume: 0.5 }); say('You\'ll need a few more moon gems for that, friend.'); return; }
    const err = buyAcorns(p);
    if (err) { toast(err); return; }
    setStamped('acorn:' + p.id);
    sound.play('stamp', { volume: 0.55 });
    stageRef.current?.celebrate('acorn:' + p.id);
    stageRef.current?.shower('acorn:' + p.id, 'coin');
    say(pick(LINES.acorns));
    setTimeout(() => rewardMoment('coin', p.coins, p.name), 500);
  };

  const buyGems = (p: GemPack) => {
    grantGems(p);
    setStamped('gem:' + p.id);
    sound.play('stamp', { volume: 0.55 });
    stageRef.current?.celebrate('gem:' + p.id);
    stageRef.current?.shower('gem:' + p.id, 'gem');
    say(pick(LINES.gems));
    setTimeout(() => rewardMoment('gem', p.gems + p.bonus, p.name), 500);
  };

  function openSeries(id: string) {
    sound.play('ui_open', { volume: 0.5 });
    setCard(null);
    setSection('series');
    setGacha(id);
    stageRef.current?.focus('series');
    stageRef.current?.act('present', 'barrel');
    say(pick(LINES.series));
  }

  // [ui5] the frame wall: every frame Barnaby stocks, one marked down today
  const wall = frameWall(s, undefined, level.value.level);
  const buyFrameOffer = (o: FrameOffer) => {
    const have = o.cur === 'gems' ? s.gems : s.coins;
    if (o.locked) { sound.play('ui_error', { volume: 0.5 }); say(`That one's for owls of level ${o.locked} and up, friend.`); return; }
    if (have < o.price) { sound.play('ui_error', { volume: 0.5 }); say(pick(LINES.poor)); stageRef.current?.act('think'); toast(o.cur === 'gems' ? 'Not enough moon gems' : 'Not enough acorns'); return; }
    const err = buyFrame(o);
    if (err) { sound.play('ui_error', { volume: 0.5 }); toast(err); return; }
    setStamped('frame:' + o.frame.id);
    sound.play('stamp', { volume: 0.6 });
    setTimeout(() => { sound.play('ui_buy', { volume: 0.55 }); sound.play('reward_unlock', { volume: 0.4 }); }, 260);
    haptic(20);
    stageRef.current?.act('hop');
    fxMoment('bigbuy'); // [fx10]
    say(pick(LINES.bought));
  };
  const openFrame = (id: string) => { openCard('frame:' + id); const f = wall.find((o) => o.frame.id === id); if (f) say(pick(LINES.frame)(f.frame.name)); };

  const claimed = giftClaimed(s), g = dailyGift();
  const sel = card ? card : null;
  const showTags = !gacha && !sel;

  return (
    <div ref={root} class={`lg-shop ${layout}${leaving ? ' leaving' : ''}${sel ? ' carded' : ''}${gacha ? ' wishing' : ''}`}>
      {/* the way out: a little door sign */}
      <button class="lg-leave lg-btn linen" aria-label="Leave the store" onClick={close}><Px name="arrow_left" size={20} /><span>Leave</span></button>

      {/* paper price tags hanging off the stumps */}
      {showTags && section !== 'stash' && section !== 'series' && section !== 'frames' && deals.map((d, i) => {
        const sold = isSold(s, d.key);
        return (
          <Anchored at={'deal:' + i} class={'lg-dealtag' + (sold ? ' sold' : '')}>
            <i class="lg-string" />
            <button class="lg-ptag" style={{ animationDelay: `${-i * 1.3}s` }} onClick={() => onPick('deal:' + i)} aria-label={`${d.name}: ${d.price} ${d.cur === 'gems' ? 'moon gems' : 'acorns'}`}>
              <span class="lg-hole" />
              <span class="lg-ptag-name">{d.name}</span>
              <span class="lg-ptag-price">
                <s class="lg-was">{fmt(d.base)}</s>
                <b><Cost cur={d.cur} n={d.price} size={18} /></b>
              </span>
              <span class="lg-sticker">-{d.off}%</span>
              {sold && <span class="lg-stamp-mark sm">SOLD</span>}
            </button>
          </Anchored>
        );
      })}
      {/* the gift tag on the parcel, kraft labels on the packs, cloth labels under the banners */}
      {showTags && (
        <Anchored at="gift" class="lg-gifttag">
          <i class="lg-string short" />
          <button class={'lg-ktag' + (claimed ? ' done' : '')} onClick={() => onPick('gift')}>
            <span class="lg-hole" />
            {claimed ? <span>See you tomorrow</span> : <><b>FREE gift</b><span>tap to open</span></>}
          </button>
        </Anchored>
      )}
      {showTags && section === 'stash' && ACORN_PACKS.map((p) => (
        <Anchored at={'acorn:' + p.id} class="lg-packtag">
          <button class="lg-ktag burlap" onClick={() => onPick('acorn:' + p.id)}>
            <b><Px name="owlcoin" size={16} />{fmt(p.coins)}</b>
            <span><Px name="moongem" size={14} />{p.gems}</span>
          </button>
        </Anchored>
      ))}
      {showTags && section === 'stash' && GEM_PACKS.map((p) => (
        <Anchored at={'gem:' + p.id} class="lg-packtag gem">
          <i class="lg-string" />
          <button class="lg-ktag brass" onClick={() => onPick('gem:' + p.id)}>
            <b><Px name="moongem" size={16} />{fmt(p.gems + p.bonus)}</b>
            <span>{p.price}</span>
          </button>
        </Anchored>
      ))}
      {showTags && SERIES.map((x) => {
        const on = seriesActive(x);
        return (
          <Anchored at={'series:' + x.id} class="lg-bannertag">
            <button class={'lg-cloth ' + (on ? 'on' : 'soon')} onClick={() => openSeries(x.id)}>
              <span>{on ? 'Make a wish' : 'Next week'}</span>
              <small class="lg-cloth-prize"><Px name="shop_star5" size={10} />{featuredName(x.id)}</small>
              <small>{on ? `ends in ${fmtLeft(msToWeek())}` : `arrives in ${fmtLeft(msToWeek())}`}</small>
            </button>
          </Anchored>
        );
      })}

      {/* [ui5] the frame wall: frames hanging on pegs, a paper price tag on each */}
      {!sel && !gacha && section === 'frames' && <FrameWall offers={wall} layout={layout} onPick={openFrame} />}

      {/* Barnaby's speech */}
      {line && !gacha && <Bubble line={line} />}

      {/* the detail card of whatever's in focus */}
      {sel && !gacha && <DetailCard id={sel} deals={deals} layout={layout} stamped={stamped} onClose={closeCard}
        onBuy={buy} onGift={gift} onPack={buyPack} onGems={buyGems} art={art} giftInfo={{ claimed, g }} frames={wall} onFrame={buyFrameOffer} />}

      {/* moving about the store: wooden signs on a rope */}
      {!gacha && (
        <nav class="lg-nav" aria-label="Store sections">
          <i class="lg-rope" />
          {([['deals', 'Deals', 'shop_tag'], ['stash', 'Stash', 'owlcoin'], ['frames', 'Frames', 'wd_frame'], ['series', 'Wishes', 'shop_star5']] as [Section, string, string][]).map(([k, label, ic], n) => (
            <button class={'lg-navsign' + ((section === k || (k === 'deals' && section === 'home')) && !sel ? ' on' : '')} style={{ animationDelay: `${n * 0.09}s` }} onClick={() => go(k)}>
              <i class="lg-navhook" /><Px name={ic} size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {!sel && !gacha && (section === 'home' || section === 'deals' || section === 'stash') && (
        <div class="lg-hint" key={section}>
          <span class="lg-pin" />
          <b>{section === 'stash' ? 'Acorns & Moon Gems' : "Today's Deals"}</b>
          <span>{section === 'stash' ? 'Tap a sack or a chest to trade' : 'Tap a price tag, then stamp to buy'}</span>
          {section !== 'stash' && <span class="lg-hint-time"><Px name="shop_timer" size={14} />new stock in {fmtLeft(reset)}</span>}
        </div>
      )}

      {gacha && <Gacha seriesId={gacha} stage={stage} say={say} onSeries={(id) => setGacha(id)}
        onClose={() => { setGacha(null); setSection(isSide() ? 'home' : 'home'); stageRef.current?.closeBarrel(); stageRef.current?.focus('home'); stageRef.current?.act('wave'); }}
        onBuyGems={() => { setGacha(null); setSection('stash'); stageRef.current?.closeBarrel(); stageRef.current?.focus('stash'); }} />}
    </div>
  );
}

/** Keep the bubble beside Barnaby's head (tail pointing at him), or in a corner when he's out of the shot. */
function placeBubble(el: HTMLElement, st: Lodge) {
  const p = st.anchor('beaver', 0.05);
  const side = isSide();
  const w = el.offsetWidth || 260, h = el.offsetHeight || 80;
  let left: number, top: number, tail: number, below = false;
  if (p.on && p.x > 0 && p.x < innerWidth) {
    left = Math.max(8, Math.min(innerWidth - w - 8, p.x - w * (side ? 0.75 : 0.5)));
    top = p.y - h - 22;
    if (top < 64) { top = p.y + 30; below = true; }
    tail = Math.max(14, Math.min(w - 26, p.x - left));
  } else {
    left = side ? innerWidth - w - 16 : 12;
    top = side ? 92 : 70;
    tail = -100;
  }
  // keep clear of the open card, the hanging HUD signs (top right) and the signs along the bottom
  const blocks: DOMRect[] = [];
  for (const sel of ['.lg-card', '.lg-hint', '.hud-top .cur, .hud-cur, .hh-cur']) { const b = document.querySelector(sel); if (b) blocks.push(b.getBoundingClientRect()); }
  blocks.push(new DOMRect(innerWidth - 170, 0, 170, 120));
  const navTop = (document.querySelector('.lg-nav')?.getBoundingClientRect().top ?? innerHeight) - 8;
  const hits = (l: number, t: number) => blocks.some((b) => l < b.right && l + w > b.left && t < b.bottom && t + h > b.top) || t + h > navTop;
  if (hits(left, top)) {
    const tries: [number, number][] = [[left, top - 40], [8, 70], [innerWidth - w - 8, 130], [8, 130]];
    const card = document.querySelector('.lg-card')?.getBoundingClientRect();
    if (card) tries.unshift([left, card.top - h - 16]);
    const ok = tries.find(([l, t]) => t >= 60 && !hits(l, t));
    if (ok) { [left, top] = ok; tail = -100; below = false; } else el.style.opacity = '0';
  } else el.style.opacity = '';
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.style.setProperty('--tail', `${Math.round(tail)}px`);
  el.classList.toggle('below', below);
  el.classList.toggle('notail', tail < 0);
}

/** The featured five-star of a series, by name (what a wish there can give). */
function featuredName(id: string): string {
  const s = SERIES.find((x) => x.id === id);
  const f5 = s?.pool.find((e) => e.stars === 5 && e.featured) ?? s?.pool.find((e) => e.stars === 5);
  return f5 ? nameOf(f5.kind, f5.id) : '';
}

/** True the first time the store opens on this device (Barnaby explains how it works). */
function firstVisit(): boolean {
  try { if (localStorage.getItem('hoot-hollow:lodge-seen')) return false; localStorage.setItem('hoot-hollow:lodge-seen', '1'); return true; } catch { return false; }
}

function Bubble(p: { line: Line }) {
  const [shown, setShown] = useState(0);
  const l = p.line;
  useEffect(() => {
    setShown(0);
    let i = 0;
    const t0 = performance.now();
    const id = setInterval(() => {
      const n = Math.min(l.text.length, Math.floor((performance.now() - t0) / 26) + 1);
      if (n === i) return;
      i = n;
      setShown(i);
      const ch = l.text[i - 1] ?? '';
      // Barnaby's voice: low, warm blips
      if (i % 2 === 0 && /[a-z]/i.test(ch)) sound.play(ch.charCodeAt(0) % 2 ? 'voice_b' : 'voice_c', { volume: 0.16, rate: 0.78 + ((ch.charCodeAt(0) * 7) % 9) / 60, gap: 40 });
      if (i >= l.text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [l.id]);
  return (
    <div class="lg-bubble lf-lg_bubble" key={l.id}>
      <span class="lg-bubble-who lf-lg_ribbon_gold">{BEAVER_NAME}</span>
      {l.text.slice(0, shown)}<span style="opacity:0">{l.text.slice(shown)}</span>
    </div>
  );
}

// ------------------------------------------------------------------ detail cards (objects, not panels)

interface CardProps {
  id: string; deals: Deal[]; layout: 'side' | 'top'; stamped: string | null; onClose: () => void; frames: FrameOffer[]; onFrame: (o: FrameOffer) => void;
  onBuy: (d: Deal, i: number) => void; onGift: () => void; onPack: (p: AcornPack) => void; onGems: (p: GemPack) => void;
  art: (d: { kind: Deal['kind']; id: string }) => string; giftInfo: { claimed: boolean; g: { coins?: number; gems?: number } };
}

function DetailCard(p: CardProps) {
  const s = save.value;
  const id = p.id;
  let body: ComponentChildren = null, kind = 'deal';
  if (id.startsWith('deal:')) {
    const i = +id.slice(5), d = p.deals[i];
    if (!d) return null;
    const sold = isSold(s, d.key), a = p.art(d), have = d.cur === 'gems' ? s.gems : s.coins;
    const stamped = p.stamped === id;
    body = (
      <div class="lg-ledger">
        <span class="lg-pin" />
        <div class="lg-ledger-art">{a ? <img src={a} alt="" /> : <Px name="shop_mystery" size={96} />}<span class="lg-sticker big left">-{d.off}%</span></div>
        <div class="lg-ledger-text">
          <span class="lg-kind">{d.kind === 'piece' ? `Outfit · ${PIECE[d.id]?.slot ?? ''}` : d.kind === 'species' ? 'Plumage' : 'Furniture'}</span>
          <h3>{d.name}</h3>
          {d.blurb && <p class="lg-blurb">{d.blurb}</p>}
          <div class="lg-prices"><s class="lg-was big"><Cost cur={d.cur} n={d.base} size={18} /></s><b class="lg-now"><Cost cur={d.cur} n={d.price} size={26} /></b></div>
        </div>
        {(sold || stamped) && <span class={'lg-stamp-mark' + (stamped ? ' fresh' : '')}>{stamped ? 'SOLD · THANK YOU' : 'SOLD'}</span>}
        {!sold && <Stamp label="Buy" cost={<Cost cur={d.cur} n={d.price} size={20} />} short={have < d.price} onPress={() => p.onBuy(d, i)} />}
        {sold && !stamped && <p class="lg-note">Spoken for until tomorrow. New stock at midnight.</p>}
      </div>
    );
  } else if (id.startsWith('frame:')) {
    // [ui5] a frame from the wall: your owl, live, in it
    const o = p.frames.find((x) => 'frame:' + x.frame.id === id);
    if (!o) return null;
    const own = ownsEntry(s, { kind: 'frame', id: o.frame.id }), stamped = p.stamped === id, have = o.cur === 'gems' ? s.gems : s.coins;
    body = (
      <div class="lg-ledger">
        <span class="lg-pin" />
        <div class="lg-ledger-art lg-fw-art"><OwlPortrait size={p.layout === 'top' ? 104 : 124} frame={o.frame.id} tappable />{o.off > 0 && !own && <span class="lg-sticker big left">-{o.off}%</span>}</div>
        <div class="lg-ledger-text">
          <span class="lg-kind">Portrait frame</span>
          <h3>{o.frame.name}</h3>
          <p class="lg-blurb">{o.frame.blurb}</p>
          {!own && <div class="lg-prices">{o.off > 0 && <s class="lg-was big"><Cost cur={o.cur} n={o.base} size={18} /></s>}<b class="lg-now"><Cost cur={o.cur} n={o.price} size={26} /></b></div>}
        </div>
        {stamped && <span class="lg-stamp-mark fresh">SOLD · THANK YOU</span>}
        {own ? <p class="lg-note">{s.frame === o.frame.id ? 'On your name sign now. Change frames in the Dressing Room.' : 'Yours! Put it on in the Dressing Room.'}</p>
          : o.locked ? <p class="lg-note">Barnaby keeps this one for owls of level {o.locked} and up.</p>
          : <Stamp label="Buy" cost={<Cost cur={o.cur} n={o.price} size={20} />} short={have < o.price} onPress={() => p.onFrame(o)} />}
      </div>
    );
  } else if (id === 'gift') {
    kind = 'gift';
    const { claimed, g } = p.giftInfo;
    const stamped = p.stamped === 'gift';
    body = (
      <div class="lg-gtag">
        <span class="lg-hole big" />
        <span class="lg-kind">Today's gift</span>
        <p class="lg-hand">To: <b>{s.name || 'you'}</b><br />From: <b>Barnaby</b></p>
        <div class="lg-gtag-what">{g.gems ? <AnimPx name="moongem" size={44} /> : <AnimPx name="owlcoin" size={44} />}<b>{fmt(g.gems ?? g.coins ?? 0)}</b><span>{g.gems ? 'moon gems' : 'acorns'}</span></div>
        {claimed && !stamped ? <p class="lg-note">Opened! Another parcel tomorrow.</p>
          : stamped ? <span class="lg-stamp-mark fresh green">OPENED</span>
          : <button class="lg-btn berry lg-ribbonpull" onClick={p.onGift}><span>Untie the ribbon</span></button>}
      </div>
    );
  } else if (id.startsWith('acorn:')) {
    kind = 'pack';
    const pk = ACORN_PACKS.find((x) => 'acorn:' + x.id === id);
    if (!pk) return null;
    const stamped = p.stamped === id;
    body = (
      <div class="lg-burlap">
        <span class="lg-kind">Acorn stash</span>
        <h3>{pk.name}</h3>
        <p class="lg-blurb">{pk.blurb}</p>
        <div class="lg-big-amount"><AnimPx name="owlcoin" size={40} /><b>{fmt(pk.coins)}</b>{pk.bonus ? <span class="lg-bonus">+{pk.bonus}% more</span> : null}</div>
        {stamped && <span class="lg-stamp-mark fresh green">PAID</span>}
        <Stamp label="Swap" cost={<Cost cur="gems" n={pk.gems} size={20} />} short={s.gems < pk.gems} onPress={() => p.onPack(pk)} />
      </div>
    );
  } else if (id.startsWith('gem:')) {
    kind = 'gem';
    const gp = GEM_PACKS.find((x) => 'gem:' + x.id === id);
    if (!gp) return null;
    const stamped = p.stamped === id;
    body = (
      <div class="lg-plate">
        <span class="lg-kind">Moon gems</span>
        <h3>{gp.name}</h3>
        <div class="lg-big-amount"><AnimPx name="moongem" size={40} /><b>{fmt(gp.gems)}</b>{gp.bonus ? <span class="lg-bonus gem">+{fmt(gp.bonus)} bonus</span> : null}</div>
        <p class="lg-fine">Demo store: no payment provider is connected, so nothing is ever charged.</p>
        {stamped && <span class="lg-stamp-mark fresh">GRANTED</span>}
        <Stamp label={gp.price} cost={<span class="lg-demo">demo</span>} onPress={() => p.onGems(gp)} />
      </div>
    );
  }
  return (
    <div class={`lg-card ${p.layout} ${kind}`} role="dialog" aria-modal="false">
      <button class="lg-card-close lg-btn linen" aria-label="Back" onClick={p.onClose}><Px name="arrow_left" size={18} /></button>
      {body}
    </div>
  );
}

/** [ui5] The frame wall: a board of frames on pegs, each with your owl's still inside and a paper price tag. */
function FrameWall(p: { offers: FrameOffer[]; layout: 'side' | 'top'; onPick: (id: string) => void }) {
  const s = save.value;
  return (
    <div class={'lg-framewall ' + p.layout} role="list" aria-label="Portrait frames">
      <div class="lg-fw-head"><b>Portrait Frames</b><span>for the owl on your name sign</span></div>
      <div class="lg-fw-grid">
        {p.offers.map((o, i) => {
          const own = ownsEntry(s, { kind: 'frame', id: o.frame.id }), on = s.frame === o.frame.id;
          return (
            <button role="listitem" class={'lg-fw-item' + (own ? ' own' : '') + (o.locked ? ' locked' : '')} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => p.onPick(o.frame.id)} aria-label={`${o.frame.name}: ${own ? 'owned' : o.locked ? `level ${o.locked}` : `${o.price} ${o.cur === 'gems' ? 'moon gems' : 'acorns'}`}`}>
              <i class="lg-fw-peg" />
              <OwlPortrait size={64} frame={o.frame.id} live={false} />
              <span class="lg-fw-tag">
                {own ? <em>{on ? 'Wearing' : 'Owned'}</em>
                  : o.locked ? <em class="lock"><Px name="lock" size={14} />Lv {o.locked}</em>
                  : <>{o.off > 0 && <s class="lg-was">{fmt(o.base)}</s>}<Cost cur={o.cur} n={o.price} size={16} /></>}
              </span>
              {o.off > 0 && !own && <span class="lg-sticker">-{o.off}%</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
