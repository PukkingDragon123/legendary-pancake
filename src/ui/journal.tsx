// The journal: your nights at a glance (this week, the month as a sticker calendar, long-run
// stats) and Pip's trinket shelf of everything found on adventures.
import { useState } from 'preact/hooks';
import { AREAS, TRINKETS, trinketUrl } from '../game/catalog.ts';
import { save } from '../game/store.ts';
import type { SleepSession } from '../sleep/types.ts';
import { IcoCandle, IcoJournal, IcoLock } from './icons.tsx';
import { fmtDur, fmtTime, Seg, Sheet, tap } from './kit.tsx';
import { nightOpen, tab } from './state.ts';

const scoreColor = (s: number) => (s >= 85 ? '#5f8f4c' : s >= 70 ? '#4f8fd0' : s >= 50 ? '#e2a43a' : '#d9576a');
const real = (n: SleepSession[]) => n.filter((x) => x.report);

function Week() {
  const nights = real(save.value.nights);
  const days: { label: string; n?: SleepSession }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const n = [...nights].reverse().find((x) => new Date(x.end ?? x.start).toDateString() === key);
    days.push({ label: d.toLocaleDateString([], { weekday: 'narrow' }), n });
  }
  const withN = days.filter((d) => d.n);
  const avg = (f: (n: SleepSession) => number) => (withN.length ? withN.reduce((a, d) => a + f(d.n!), 0) / withN.length : 0);
  const goal = save.value.sleep.goalMin * 60000;
  const h12 = save.value.settings.hour12;
  return (
    <>
      <div class="card col">
        <div class="spread"><h3>This week</h3><span class="label">goal {fmtDur(goal)}</span></div>
        <div class="week" style="position:relative">
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${18 + (goal / (11 * 3.6e6)) * 132}px`, borderTop: '2px dashed rgba(120,84,50,.3)' }} />
          {days.map((d) => (
            <button class="bar" onClick={() => { if (d.n) { tap('paper_flip', 0.5); nightOpen.value = d.n.id; } }}>
              <i style={{ height: d.n ? `${Math.max(6, (d.n.report!.asleep / (11 * 3.6e6)) * 132)}px` : '4px', '--c': d.n ? scoreColor(d.n.report!.score) : 'rgba(120,84,50,.15)' } as any} />
              <small>{d.label}</small>
            </button>
          ))}
        </div>
      </div>
      <div class="stats">
        <div class="stat"><b>{withN.length ? fmtDur(avg((n) => n.report!.asleep)) : '–'}</b><small>average sleep</small></div>
        <div class="stat"><b>{withN.length ? Math.round(avg((n) => n.report!.score)) : '–'}</b><small>average score</small></div>
        <div class="stat"><b>{withN.length ? fmtTime(new Date(2020, 0, 1, 0, Math.round(avg((n) => { const d = new Date(n.report!.asleepAt); let m = d.getHours() * 60 + d.getMinutes(); if (m < 720) m += 1440; return m; })) % 1440), h12) : '–'}</b><small>typical sleep time</small></div>
        <div class="stat row" style="gap:8px"><IcoCandle size={40} /><div><b>{save.value.streak}</b><small>night streak (best {save.value.bestStreak})</small></div></div>
      </div>
      <div class="card col"><h3>Recent nights</h3>
        {nights.length === 0 && <p class="muted">No nights yet. Tap <b>Sleep</b> tonight and Pip will start the journal.</p>}
        {[...nights].reverse().slice(0, 8).map((n) => (
          <button class="spread" style="text-align:left;padding:6px 0;border-bottom:1px dashed var(--line)" onClick={() => { tap('paper_flip', 0.5); nightOpen.value = n.id; }}>
            <div><b>{new Date(n.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</b>{n.simulated && <span class="small muted"> · demo</span>}<div class="small muted">{fmtDur(n.report!.asleep)} asleep</div></div>
            <span class="num" style={{ fontSize: '20px', color: scoreColor(n.report!.score) }}>{n.report!.score}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Calendar() {
  const [off, setOff] = useState(0);
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + off);
  const y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y, m, 1).getDay(), len = new Date(y, m + 1, 0).getDate();
  const nights = real(save.value.nights);
  const byDay = new Map<number, SleepSession>();
  for (const n of nights) { const d = new Date(n.end ?? n.start); if (d.getFullYear() === y && d.getMonth() === m) byDay.set(d.getDate(), n); }
  const today = new Date();
  return (
    <div class="card col">
      <div class="spread"><button class="btn soft sm" onClick={() => { tap(); setOff(off - 1); }}>‹</button><h3>{base.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3><button class="btn soft sm" onClick={() => { tap(); setOff(off + 1); }}>›</button></div>
      <div class="cal">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => <div class="h">{d}</div>)}
        {Array.from({ length: first }, () => <div />)}
        {Array.from({ length: len }, (_, i) => {
          const n = byDay.get(i + 1), isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === i + 1;
          return <button class={'d' + (n ? ' has' : '') + (isToday ? ' today' : '')} style={n ? { background: scoreColor(n.report!.score) } : undefined} onClick={() => { if (n) { tap('paper_flip', 0.5); nightOpen.value = n.id; } }}>{i + 1}</button>;
        })}
      </div>
      <div class="row small muted" style="gap:12px;flex-wrap:wrap">{[['Wonderful', 85], ['Good', 70], ['Okay', 50], ['Restless', 0]].map(([l, v]) => <span class="row" style="gap:4px"><i style={{ width: '10px', height: '10px', borderRadius: '3px', background: scoreColor(v as number) }} />{l}</span>)}</div>
    </div>
  );
}

function Collection() {
  const col = save.value.collection;
  const found = TRINKETS.filter((t) => col[t.id]).length;
  return (
    <>
      <p class="muted">Pip has found <b>{found}</b> of {TRINKETS.length} treasures. Each place hides its own.</p>
      {AREAS.map((a) => (
        <div class="col" style="gap:6px">
          <div class="spread"><h3 style={{ color: a.color }}>{a.name}</h3><span class="label">{TRINKETS.filter((t) => t.area === a.id && col[t.id]).length}/{TRINKETS.filter((t) => t.area === a.id).length}</span></div>
          <div class="shelf">
            {TRINKETS.filter((t) => t.area === a.id).map((t) => (
              <div class="slot" title={col[t.id] ? t.name : '???'}>
                <img src={trinketUrl(t.id, 5, !col[t.id])} alt={col[t.id] ? t.name : 'Not found yet'} style={col[t.id] ? undefined : 'opacity:.35'} />
                <small>{col[t.id] ? (col[t.id] > 1 ? `×${col[t.id]}` : t.name.split(' ')[0]) : '?'}</small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Stats() {
  const s = save.value, nights = real(s.nights).filter((n) => !n.simulated);
  const total = nights.reduce((a, n) => a + n.report!.asleep, 0);
  const last30 = nights.slice(-30);
  const W = 300, H = 90;
  const pts = last30.map((n, i) => `${(i / Math.max(1, last30.length - 1)) * W},${H - (n.report!.score / 100) * (H - 10) - 4}`).join(' ');
  return (
    <>
      <div class="stats">
        <div class="stat"><b>{nights.length}</b><small>nights tracked</small></div>
        <div class="stat"><b>{Math.round(total / 3.6e6)}h</b><small>of sleep recorded</small></div>
        <div class="stat"><b>{s.bestStreak}</b><small>best streak</small></div>
        <div class="stat"><b>{s.breath.sessions}</b><small>breathing sessions ({s.breath.minutes} min)</small></div>
      </div>
      <div class="card col"><div class="spread"><h3>30-night trend</h3>{!s.plus.active && <span class="row small muted" style="gap:4px"><IcoLock size={20} />Plus</span>}</div>
        {s.plus.active ? (last30.length > 1 ? <svg viewBox={`0 0 ${W} ${H}`} width="100%"><polyline points={pts} fill="none" stroke="#7a5fd0" stroke-width="2.5" stroke-linejoin="round" />{last30.map((n, i) => <circle cx={(i / Math.max(1, last30.length - 1)) * W} cy={H - (n.report!.score / 100) * (H - 10) - 4} r="3" fill={scoreColor(n.report!.score)} />)}</svg> : <p class="muted">A trend appears after two nights.</p>)
          : <><p class="muted small">See how your sleep changes over a month, with snore and sleep-talk recordings.</p><button class="btn soft sm" onClick={() => { tap(); tab.value = 'market'; }}>Learn about Plus</button></>}
      </div>
    </>
  );
}

export function Journal() {
  const [v, setV] = useState<'week' | 'month' | 'shelf' | 'stats'>('week');
  return (
    <Sheet title={<span class="row" style="gap:8px"><IcoJournal size={40} />Sleep journal</span>}>
      <Seg value={v} onChange={setV} options={[{ v: 'week', label: 'Week' }, { v: 'month', label: 'Month' }, { v: 'shelf', label: 'Treasures' }, { v: 'stats', label: 'Stats' }]} />
      {v === 'week' ? <Week /> : v === 'month' ? <Calendar /> : v === 'shelf' ? <Collection /> : <Stats />}
    </Sheet>
  );
}
