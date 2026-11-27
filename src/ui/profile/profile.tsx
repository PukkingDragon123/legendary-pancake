// [profile] The profile, opened by tapping the owl's portrait on the name sign: a carved walnut cabinet over the photo
// studio (src/world/stages/studio.ts) with four leather index tabs:
//   Studio      pose Pip, pick a face and a backdrop, watch the keyed portrait live in your frame, take the photo
//               (the strobes fire, the print slides out), keep it or retake; or go back to the live owl
//   Frames      every portrait frame with your own portrait in it: wear the ones you own, buy the rest (acorns or moon
//               gems, one on sale a day, as on Barnaby's frame wall), see which come from the wishes
//   Friends     your friend code (copy it, or a link) and the friends you've added from theirs (social.tsx)
//   Ranks       you, your friends and the Hollow's neighbours by streak, sleep or level (social.tsx)
// The studio stays up behind every tab (it only keys while the Studio tab is open). On a wide screen the cabinet stands
// on the right and the set fills the rest; on a phone it is a sheet over the bottom of the screen with the set above.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { FRAME_BY_ID, FRAMES, type FrameDef } from '../../assets/frames.ts';
import { phase } from '../../game/night.ts';
import { buyFrame, frameWall } from '../../game/shop.ts';
import { level, save, setFrame, setPhoto, usePhoto } from '../../game/store.ts';
import type { OwlMood } from '../../owl/actor.ts';
import { BACKDROPS, backdropSwatch, BACKDROP_BY_ID, loadBark } from '../../world/stages/backdrops.ts';
import { EXPRESSIONS, POSES, POSE_BY_ID, Studio, type Framing } from '../../world/stages/studio.ts';
import { FRAME_D, FRAME_OPEN, frameArt } from '../chrome/frameart.ts';
import { uiBurst, uiBurstAt } from '../chrome/uifx.ts';
import { Px } from '../icons.tsx';
import { haptic, Price, tap, toast } from '../kit.tsx';
import { roundButton } from '../real/kit.ts';
import { texReady } from '../real/tex.ts';
import { panel, sceneRef } from '../state.ts';
import { Framed, MyFace } from './faces.tsx';
import { FriendsTab, RanksTab } from './social.tsx';
import { pendingCode, profileTab, type ProfileTab } from './state.ts';
import { nineCSS } from '../real/kit.ts';
import './profile.css';

export { profileTab, type ProfileTab };

// a link with #friend=<code> opens the profile on the Friends tab with the code ready to add
if (typeof location !== 'undefined') {
  const m = /[#&?]friend=([^&\s]+)/.exec(location.hash + '&' + location.search);
  if (m) {
    try { pendingCode.value = decodeURIComponent(m[1]); } catch { pendingCode.value = m[1]; }
    profileTab.value = 'friends';
    try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]friend=[^&]*/, '')); } catch { /* */ }
    let tries = 0;
    const go = () => { if (save.peek().onboarded && phase.peek() === 'day' && sceneRef.current) panel.value = 'profile'; else if (tries++ < 60) setTimeout(go, 1000); };
    setTimeout(go, 1500);
  }
}

const TABS: { v: ProfileTab; label: string }[] = [
  { v: 'studio', label: 'Studio' },
  { v: 'frames', label: 'Frames' },
  { v: 'friends', label: 'Friends' },
  { v: 'ranks', label: 'Ranks' },
];
const isSide = () => innerWidth >= 860 && innerWidth > innerHeight * 1.1;

let styled = false;
/** the rules that need painted art (brass plaques for the section labels and your row, gilt trays) */
function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'hh-profile';
  st.textContent = `
.pf-label{${nineCSS('plaque', { bw: [3, 10, 4, 10] })};background:none}
.pf-row.you{${nineCSS('plaque', { bw: [5, 10, 6, 6] })};background:none;box-shadow:none;outline:0}
.pf-ftile{${nineCSS('slot_brass')}}
.pf-ftile.sel{${nineCSS('slot_gold_active')}}
.pf-current,.pf-fsel,.pf-friend{padding:6px 8px;flex-direction:row}
.pf-close{background:url("${roundButton(44, 'cream')}") center/100% 100% no-repeat}
.pf-close:active{background-image:url("${roundButton(44, 'cream', true)}")}
`;
  document.head.appendChild(st);
}

export function Profile() {
  installStyles();
  const sc = sceneRef.current;
  const [tab, setTabS] = useState<ProfileTab>(profileTab.peek());
  const [studio, setStudio] = useState<Studio | null>(null);
  const [side, setSide] = useState(isSide());
  const sheet = useRef<HTMLElement>(null);
  const setTab = (t: ProfileTab) => { if (t === tab) return; tap('ui_tab', 0.5); profileTab.value = t; setTabS(t); };

  // the studio: built on open, shown instead of the world until the profile closes
  useEffect(() => {
    let st: Studio | null = null;
    try { st = new Studio(save.peek().look); } catch (e) { console.warn('studio failed', e); }
    if (st && sc) { st.attach(sc.renderer); sc.setStage(st); setStudio(st); }
    const onResize = () => setSide(isSide());
    addEventListener('resize', onResize);
    if (import.meta.env.DEV) (window as unknown as { hhStudio: unknown }).hhStudio = st;
    return () => { removeEventListener('resize', onResize); if (sc && st && sc.stage === st) sc.setStage(null); };
  }, []);
  // keep Pip clear of the cabinet
  useLayoutEffect(() => {
    if (!studio) return;
    // (layout boxes, not getBoundingClientRect: the cabinet may still be sliding in)
    const fit = () => {
      const el = sheet.current;
      if (!el) return;
      if (side) studio.setInsets(Math.max(0, innerWidth - el.offsetLeft + 6), 0, 0);
      else studio.setInsets(0, Math.max(0, innerHeight - el.offsetTop + 4), 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (sheet.current) ro.observe(sheet.current);
    return () => ro.disconnect();
  }, [studio, side]);
  useEffect(() => { studio?.pause(tab !== 'studio'); }, [studio, tab]);
  useEffect(() => { if (studio) studio.onPoke = () => sound.play('feather_ruffle', { volume: 0.3, gap: 200 }); }, [studio]);

  const close = () => { tap('ui_close', 0.5); panel.value = null; };
  return (
    <div class={'pf ' + (side ? 'side' : 'top')}>
      <section class="sheet pf-sheet" ref={sheet} role="dialog" aria-label="Profile">
        <nav class="pf-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.v} role="tab" aria-selected={tab === t.v} class={'tag' + (tab === t.v ? ' on' : '')} onClick={(e) => { setTab(t.v); uiBurstAt(e.currentTarget as Element, 'sparkle', 3); }}>
              <span>{t.label}</span>
            </button>
          ))}
          <button class="icon-btn pf-close" aria-label="Close" onClick={close}><Px name="cross" size={20} /></button>
        </nav>
        <div class="pf-body">
          {tab === 'studio' ? <StudioTab st={studio} side={side} />
            : tab === 'frames' ? <FramesTab />
            : tab === 'friends' ? <FriendsTab />
            : <RanksTab />}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ the studio

/** The live keyed portrait in your frame: the studio's canvas, clipped round, under the frame's art. */
function Viewfinder(p: { st: Studio | null; size: number; frame: string; live: boolean }) {
  const slot = useRef<HTMLSpanElement>(null);
  useEffect(() => { const c = p.st?.view; if (c && slot.current && c.parentNode !== slot.current) slot.current.appendChild(c); }, [p.st]);
  void texReady.value;
  const S = p.size, open = (FRAME_OPEN / FRAME_D) * S, inset = (S - open * 2) / 2 - 0.5;
  return (
    <span class="pf-vf" style={{ width: `${S}px`, height: `${S}px` }}>
      <span class="pf-vf-slot" ref={slot} style={{ left: `${inset}px`, top: `${inset}px`, width: `${S - inset * 2}px`, height: `${S - inset * 2}px` }} />
      <img class="frm" src={frameArt(p.frame, S)} alt="" draggable={false} />
      {p.live && <span class="pf-tally"><i />Live</span>}
    </span>
  );
}

const FRAMINGS: { v: Framing; label: string }[] = [{ v: 'face', label: 'Close-up' }, { v: 'bust', label: 'Portrait' }, { v: 'full', label: 'Whole owl' }];

function StudioTab(p: { st: Studio | null; side: boolean }) {
  const s = save.value, st = p.st;
  const [pose, setPose] = useState(() => (s.photo?.pose && POSE_BY_ID[s.photo.pose] ? s.photo.pose : 'hello'));
  const [mood, setMood] = useState<OwlMood | null>(null);
  const [bd, setBd] = useState(() => (s.photo?.backdrop && BACKDROP_BY_ID[s.photo.backdrop] ? s.photo.backdrop : 'forest'));
  const [framing, setFraming] = useState<Framing>('bust');
  const [proof, setProof] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [, bark] = useState(0);
  useEffect(() => { void loadBark().then(() => bark((n) => n + 1)); }, []);
  useEffect(() => { st?.setPose(pose); }, [st, pose]);
  useEffect(() => { st?.setMood(mood); }, [st, mood]);
  useEffect(() => { st?.setBackdrop(bd); }, [st, bd]);
  useEffect(() => { st?.setFraming(framing); }, [st, framing]);
  const poseDef = POSE_BY_ID[pose];

  const shoot = (e: MouseEvent) => {
    if (!st || proof) return;
    haptic(30);
    sound.play('tick_brass', { volume: 0.7, rate: 1.5 });
    setTimeout(() => sound.play('drawer', { volume: 0.35, rate: 2.2 }), 40);
    setTimeout(() => sound.play('whoosh_soft', { volume: 0.25, rate: 1.6 }), 90);
    const url = st.shoot(256);
    setFlash((n) => n + 1);
    uiBurstAt(e.currentTarget as Element, 'sparkle', 8);
    if (!url) { toast('The camera isn’t ready yet'); return; }
    setTimeout(() => { setProof(url); sound.play('paper_rustle', { volume: 0.4 }); }, 420);
  };
  const keep = (e: MouseEvent) => {
    if (!proof) return;
    setPhoto({ url: proof, at: Date.now(), pose, mood: mood ?? poseDef.mood, backdrop: bd });
    tap('ui_confirm');
    sound.play('reward_unlock', { volume: 0.35 });
    const r = (e.currentTarget as Element).getBoundingClientRect();
    uiBurst('confetti', r.left + r.width / 2, r.top, 18);
    setProof(null);
    toast('Your new portrait is in its frame');
  };
  const retake = () => { tap('ui_back', 0.5); setProof(null); };
  const vf = p.side ? 196 : 132;
  return (
    <div class="pf-studio">
      <div class="pf-shot">
        <Viewfinder st={st} size={vf} frame={s.frame} live={!proof} />
        <button class="pf-shutter" style={{ '--rb': `url("${roundButton(76, 'red')}")`, '--rb-dn': `url("${roundButton(76, 'red', true)}")` } as Record<string, string>} onClick={shoot} disabled={!st || !!proof} aria-label="Take the photo">
          <span>Snap!</span>
        </button>
      </div>
      <div class="seg pf-seg pf-framing" role="radiogroup" aria-label="Framing">
        {FRAMINGS.map((f) => <button class={framing === f.v ? 'on' : ''} role="radio" aria-checked={framing === f.v} onClick={() => { tap('ui_tab', 0.4); setFraming(f.v); }}>{f.label}</button>)}
      </div>
      {s.photo && (
        <div class="card pf-current">
          <Framed src={s.photo.url} frame={s.frame} size={46} photo />
          <div class="grow small">
            <b>{s.photo.on ? 'Your photo is in your frame' : 'Your frame shows the live owl'}</b>
            <div class="muted">{s.photo.on ? 'Or show Pip live, blinking and fidgeting.' : 'Your last photo is kept for later.'}</div>
          </div>
          <button class="btn soft sm" onClick={() => { tap('ui_toggle', 0.5); usePhoto(!s.photo!.on); }}>{s.photo.on ? 'Use live owl' : 'Use photo'}</button>
        </div>
      )}
      <section class="pf-sec">
        <h4 class="pf-label">Pose</h4>
        <div class="pf-chips">
          {POSES.map((x) => <button key={x.id} class={'tag' + (pose === x.id ? ' on' : '')} onClick={() => { tap('ui_tab', 0.4); setPose(x.id); }}>{x.name}</button>)}
        </div>
      </section>
      <section class="pf-sec">
        <h4 class="pf-label">Expression</h4>
        <div class="pf-chips">
          <button class={'tag' + (mood === null ? ' on' : '')} onClick={() => { tap('ui_tab', 0.4); setMood(null); }}>As posed</button>
          {EXPRESSIONS.map((x) => <button key={x.id} class={'tag' + (mood === x.id ? ' on' : '')} onClick={() => { tap('ui_tab', 0.4); setMood(x.id); }}>{x.name}</button>)}
        </div>
      </section>
      <section class="pf-sec">
        <h4 class="pf-label">Backdrop</h4>
        <div class="pf-prints">
          {BACKDROPS.map((b, i) => (
            <button key={b.id} class={'pf-print' + (bd === b.id ? ' on' : '')} style={{ '--tilt': `${((i * 37) % 7) - 3}deg` } as Record<string, string>} onClick={() => { tap('place_paper', 0.4); setBd(b.id); }} aria-label={b.name} aria-pressed={bd === b.id}>
              <img src={backdropSwatch(b.id, 96)} alt="" draggable={false} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
        <p class="small muted pf-note">A real green screen: Pip is filmed against the green cloth and the green is keyed out, so the backdrop you pick shows through.</p>
      </section>
      {flash > 0 && <div class="pf-flash" key={flash} />}
      {proof && (
        <div class="pf-proof" role="dialog" aria-label="Your photo">
          <div class="pf-proof-card">
            <Framed src={proof} frame={s.frame} size={p.side ? 200 : 168} photo />
            <p class="small"><b>{poseDef.name}</b> · {BACKDROP_BY_ID[bd]?.name}</p>
            <div class="row pf-proof-btns">
              <button class="btn soft" onClick={retake}>Retake</button>
              <button class="btn pillow" onClick={keep}><Px name="check" size={20} />Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ frames

const SERIES_NAME: Record<string, string> = { frostlight: 'the Frostlight wishes', starfall: 'the Starfall wishes' };
const RARITY: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

function FramesTab() {
  const s = save.value, lv = level.value.level;
  const wall = useMemo(() => frameWall(s, undefined, lv), [s.owned.frames.length, s.coins, s.gems, lv]);
  const [sel, setSel] = useState(s.frame);
  const f: FrameDef = FRAME_BY_ID[sel] ?? FRAMES[0];
  const owned = s.owned.frames.includes(f.id);
  const offer = wall.find((o) => o.frame.id === f.id);
  const wear = (e: MouseEvent) => { if (setFrame(f.id)) { tap('ui_confirm'); uiBurstAt(e.currentTarget as Element, 'sparkle', 10); } };
  const buy = (e: MouseEvent) => {
    if (!offer) return;
    const err = buyFrame(offer);
    if (err) { sound.play('ui_error', { volume: 0.5 }); toast(err); return; }
    sound.play('ui_buy', { volume: 0.55 }); sound.play('reward_unlock', { volume: 0.35 });
    const r = (e.currentTarget as Element).getBoundingClientRect();
    uiBurst('confetti', r.left + r.width / 2, r.top, 22);
    toast(`${f.name} is yours`);
  };
  return (
    <div class="pf-frames">
      <div class="card pf-fsel">
        <MyFace size={118} frame={f.id} />
        <div class="grow">
          <h3>{f.name}</h3>
          <p class="small pf-rar"><i class={'r-' + f.rarity} />{RARITY[f.rarity]}{f.level && !owned ? ` · level ${f.level}` : ''}</p>
          <p class="small muted">{f.blurb}</p>
          <div class="row pf-fact">
            {owned ? (s.frame === f.id ? <span class="pf-worn"><Px name="check" size={20} />In your frame</span> : <button class="btn pillow" onClick={wear}>Wear it</button>)
              : f.series ? <span class="small muted">From {SERIES_NAME[f.series] ?? 'a wish series'} in Barnaby’s store</span>
              : offer?.locked ? <span class="small muted"><Px name="lock" size={20} /> Opens at level {offer.locked}</span>
              : offer ? <button class="btn pillow honey" onClick={buy}>Buy {offer.off ? <s class="was">{offer.base}</s> : null}<Price coins={offer.cur === 'coins' ? offer.price : undefined} gems={offer.cur === 'gems' ? offer.price : undefined} /></button>
              : null}
            {offer && offer.off > 0 && !owned && <span class="pf-sale">−{offer.off}% today</span>}
          </div>
        </div>
      </div>
      <div class="pf-fgrid">
        {FRAMES.map((x) => {
          const have = s.owned.frames.includes(x.id), o = wall.find((w) => w.frame.id === x.id);
          return (
            <button key={x.id} class={'pf-ftile' + (sel === x.id ? ' sel' : '') + (s.frame === x.id ? ' worn' : '') + (have ? ' have' : '')} onClick={() => { tap('ui_tab', 0.4); setSel(x.id); }} aria-label={x.name}>
              <MyFace size={64} frame={x.id} />
              <span class="nm">{x.name}</span>
              <span class="st">{s.frame === x.id ? 'Wearing' : have ? 'Yours' : x.series ? 'Wishes' : o?.locked ? `Level ${o.locked}` : o ? <Price coins={o.cur === 'coins' ? o.price : undefined} gems={o.cur === 'gems' ? o.price : undefined} /> : ''}</span>
              {o && o.off > 0 && !have && <i class="pf-dot">sale</i>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
