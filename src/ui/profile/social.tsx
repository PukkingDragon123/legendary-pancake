// [profile] The profile's Friends and Ranks tabs. Everything is local and honest: your friend code is a snapshot of your
// numbers that you send yourself; a friend is the snapshot from the last code they sent you (paste a newer one to
// refresh them); the neighbours on the board are characters from the Hollow, marked as such, with silhouettes for
// portraits instead of owls.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { addFriendCode, removeFriend } from '../../game/friends.ts';
import { codeLink, myCode, myStats, NEIGHBOURS, neighbourStats, rankBoard, type Board, type Critter, type Entry, type FriendSnap, type SocialStats } from '../../game/social.ts';
import { save } from '../../game/store.ts';
import { uiBurst, uiBurstAt } from '../chrome/uifx.ts';
import { Px } from '../icons.tsx';
import { tap, toast } from '../kit.tsx';
import { medallionArt } from '../real/kit.ts';
import { hex } from '../real/paint.ts';
import { Cameo, MyFace, OwlFace } from './faces.tsx';
import { pendingCode } from './state.ts';

const DAY = 86_400_000;
const ago = (t: number, now = Date.now()) => { const d = Math.floor((now - t) / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d} days ago` : d < 60 ? `${Math.round(d / 7)} weeks ago` : `${Math.round(d / 30)} months ago`; };
const statLine = (st: SocialStats) => `Level ${st.level} · ${st.streak}-night streak · ${st.score === null ? 'no nights yet' : `sleep ${st.score} (${st.hours} h)`}`;

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

// ------------------------------------------------------------------ friends

export function FriendsTab() {
  const s = save.value;
  const code = useMemo(() => myCode(s), [s.pid, s.name, s.frame, s.xp, s.streak, s.bestStreak, s.nights.length, JSON.stringify(s.look)]);
  const me = myStats(s);
  const [text, setText] = useState(pendingCode.peek());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  useEffect(() => { if (pendingCode.peek()) { pendingCode.value = ''; } }, []);
  const doCopy = async (what: 'code' | 'link', e: MouseEvent) => {
    const el = e.currentTarget as Element;
    const ok = await copy(what === 'code' ? code : codeLink(code));
    if (ok) { tap('ui_check', 0.5); uiBurstAt(el, 'sparkle', 6); toast(what === 'code' ? 'Friend code copied' : 'Link copied'); }
    else toast('Couldn’t copy. Select the code and copy it yourself.');
  };
  const share = async () => {
    try { await navigator.share({ title: 'Hoot Hollow', text: `Add ${s.name} on Hoot Hollow! My friend code: ${code}`, url: codeLink(code) }); } catch { /* cancelled */ }
  };
  const add = (e: MouseEvent) => {
    const r = addFriendCode(text);
    if (!r.ok) { sound.play('ui_error', { volume: 0.5 }); setMsg({ ok: false, text: r.error }); return; }
    const name = r.friend?.name ?? 'Your friend';
    const t = r.status === 'added' ? `${name} is on your board now.` : r.status === 'updated' ? `${name}’s numbers are up to date.` : r.status === 'older' ? `You already have a newer code from ${name}.` : `${name} is already on your board, nothing new in that code.`;
    setMsg({ ok: true, text: t });
    if (r.status === 'added' || r.status === 'updated') {
      sound.play('reward_unlock', { volume: 0.4 });
      const b = (e.currentTarget as Element).getBoundingClientRect();
      uiBurst('hearts', b.left + b.width / 2, b.top, 10);
      setText('');
    } else tap('ui_tap', 0.4);
  };
  const friends = s.friends ?? [];
  return (
    <div class="pf-friends">
      <div class="card pf-mycode">
        <div class="row pf-me">
          <MyFace size={64} />
          <div class="grow">
            <h3>{s.name}</h3>
            <p class="small muted">{statLine(me)}</p>
          </div>
        </div>
        <p class="small pf-label2">Your friend code</p>
        <div class="pf-code" aria-label="Your friend code"><code>{code}</code></div>
        <div class="row pf-btns">
          <button class="btn pillow" onClick={(e) => void doCopy('code', e as unknown as MouseEvent)}>Copy code</button>
          <button class="btn soft" onClick={(e) => void doCopy('link', e as unknown as MouseEvent)}>Copy link</button>
          {typeof navigator !== 'undefined' && 'share' in navigator && <button class="btn soft" onClick={() => void share()}>Share…</button>}
        </div>
        <p class="small muted pf-note">The code is a snapshot of your numbers today. Hoot Hollow has no server, so friends see your new streak when you send them a fresh code.</p>
      </div>
      <div class="card pf-add">
        <h3>Add a friend</h3>
        <p class="small muted">Paste the code (or the link) a friend sent you. Paste a newer one later to update them.</p>
        <textarea class="field pf-field" rows={2} value={text} placeholder="hoot1.…" spellcheck={false} autocomplete="off" onInput={(e) => { setText((e.currentTarget as HTMLTextAreaElement).value); setMsg(null); }} />
        <div class="row pf-btns">
          <button class="btn pillow" onClick={(e) => add(e as unknown as MouseEvent)} disabled={!text.trim()}><Px name="plus" size={20} />Add friend</button>
          {msg && <span class={'small pf-msg ' + (msg.ok ? 'ok' : 'bad')}>{msg.text}</span>}
        </div>
      </div>
      {friends.length ? (
        <div class="pf-flist">
          {friends.map((f: FriendSnap) => (
            <div key={f.id} class="card pf-friend">
              <OwlFace look={f.look} frame={f.frame} size={56} />
              <div class="grow">
                <b>{f.name}</b>
                <div class="small muted">{statLine(f.stats)}</div>
                <div class="small pf-when">Code from {ago(f.at)}</div>
              </div>
              {sure === f.id
                ? <button class="btn berry sm pillow" onClick={() => { tap('ui_back', 0.5); removeFriend(f.id); setSure(null); }}>Remove</button>
                : <button class="icon-btn pf-x" aria-label={`Remove ${f.name}`} onClick={() => { tap('ui_tap', 0.4); setSure(f.id); }}><Px name="cross" size={20} /></button>}
            </div>
          ))}
        </div>
      ) : (
        <p class="small muted center pf-empty">No friends yet. Send your code to someone who sleeps with Hoot Hollow, and paste theirs here. Until then, the neighbours keep you company on the Ranks board.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ ranks

interface Row extends Entry { look?: FriendSnap['look']; frame?: string; critter?: Critter; blurb?: string; when?: number }
const BOARDS: { v: Board; label: string }[] = [{ v: 'streak', label: 'Streak' }, { v: 'sleep', label: 'Sleep' }, { v: 'level', label: 'Level' }];
const CRITTER: Record<Critter, string> = { beaver: 'beaver', hedgehog: 'hedgehog', fox: 'fox', badger: 'badger', hare: 'hare' };
const MEDAL = [hex('#c8921c'), hex('#8e98a6'), hex('#a4602e')];

function Medal(p: { rank: number | null; tie: boolean }) {
  if (p.rank === null) return <span class="pf-rank none">–</span>;
  if (p.rank <= 3) return <span class="pf-rank medal" style={{ backgroundImage: `url("${medallionArt(40, MEDAL[p.rank - 1])}")` }}><b>{p.rank}</b>{p.tie && <i>=</i>}</span>;
  return <span class="pf-rank">{p.tie ? '=' : ''}{p.rank}</span>;
}

export function RanksTab() {
  const s = save.value;
  const [board, setBoard] = useState<Board>('streak');
  const rows = useMemo(() => {
    const now = Date.now();
    const list: Row[] = [
      { key: 'you', name: s.name, kind: 'you', stats: myStats(s) },
      ...(s.friends ?? []).map((f): Row => ({ key: 'f:' + f.id, name: f.name, kind: 'friend', stats: f.stats, look: f.look, frame: f.frame, when: f.at })),
      ...NEIGHBOURS.map((n): Row => ({ key: 'n:' + n.id, name: n.name, kind: 'neighbour', stats: neighbourStats(n, now), critter: n.critter, blurb: n.blurb })),
    ];
    return rankBoard(list, board);
  }, [board, s.friends, s.xp, s.streak, s.bestStreak, s.nights.length, s.name]);
  const val = (r: Row) => {
    const st = r.stats;
    if (board === 'streak') return <><b>{st.streak}</b><small>{st.streak === 1 ? 'night' : 'nights'}</small></>;
    if (board === 'level') return <><small>Lv</small><b>{st.level}</b></>;
    return st.score === null ? <small>no nights</small> : <><b>{st.score}</b><small>{st.hours} h</small></>;
  };
  const sub = (r: Row) => {
    const st = r.stats;
    const extra = board === 'streak' ? `best ${st.best}` : board === 'sleep' ? (st.nights ? `over ${st.nights} night${st.nights === 1 ? '' : 's'}` : 'tracks no nights yet') : `${st.streak}-night streak`;
    if (r.kind === 'neighbour') return `${CRITTER[r.critter!]} · ${extra}`;
    if (r.kind === 'friend') return `${extra} · code from ${ago(r.when ?? 0)}`;
    return extra;
  };
  return (
    <div class="pf-ranks">
      <div class="seg pf-seg pf-boards" role="tablist" aria-label="Rank by">
        {BOARDS.map((b) => <button key={b.v} role="tab" aria-selected={board === b.v} class={board === b.v ? 'on' : ''} onClick={() => { tap('ui_tab', 0.4); setBoard(b.v); }}>{b.label}</button>)}
      </div>
      <ol class="pf-board">
        {rows.map((x) => {
          const r = x.entry as Row;
          return (
            <li key={r.key} class={'pf-row ' + r.kind} title={r.blurb}>
              <Medal rank={x.rank} tie={x.tie} />
              {r.kind === 'neighbour' ? <Cameo critter={r.critter!} size={48} /> : r.kind === 'you' ? <MyFace size={48} /> : <OwlFace look={r.look!} frame={r.frame!} size={48} />}
              <div class="grow pf-who">
                <b>{r.name}{r.kind === 'you' && <em class="pf-you">you</em>}{r.kind === 'neighbour' && <em class="pf-nb">neighbour</em>}</b>
                <span class="small muted">{sub(r)}</span>
              </div>
              <div class="pf-val">{val(r)}</div>
            </li>
          );
        })}
      </ol>
      <p class="small muted pf-note">Neighbours are Hoot Hollow’s forest characters, here to keep the board lively. Friends’ numbers are from the last code they sent you. Equal numbers share a place.</p>
    </div>
  );
}
