// What each Hollow & Co. form looks like: the printed layout of every question (tick boxes with pictograms,
// photo cards of the owls, a time box, a scale, the sleep-plan agreement) and how the visitor's answers show
// as ink on it. printForm() prints a page; syncForm() brings its ink up to date with the answers.
import { speciesOf } from '../owl/species.ts';
import { F } from './fonts.ts';
import { BLACK, Form, GOLD, imgOf, PH, PRINT, PRINT2, PW, RED, scaled } from './paper.ts';
import { ALARM_NAME, fmt, GOALS, RELAX, SOUND_NAME, toMin, type Answers, type Plan, type Step } from './script.ts';
import { crispText, measure } from './tex.ts';

export interface FormCtx { a: Answers; hour12: boolean; artifact: boolean; plan: Plan; photos: Record<string, string>; remind: boolean; signed: boolean; picked: Record<string, boolean> }

const NAMES = ['Pip', 'Hoot', 'Mochi', 'Biscuit', 'Luna', 'Juniper'];
const LAT_ICON: Record<string, string> = { quick: 'pillow', normal: 'moon', slow: 'sheep', long: 'clock' };
export const HOURS = { lo: 5, hi: 11, x0: 44, x1: 316, y: 236 };
const WAKE = { x: PW / 2, y: 196 };

/** where on the hours scale (texel x) a value sits */
export const hoursX = (v: number) => HOURS.x0 + ((v - HOURS.lo) / (HOURS.hi - HOURS.lo)) * (HOURS.x1 - HOURS.x0);
export const hoursOf = (x: number) => Math.max(HOURS.lo, Math.min(HOURS.hi, Math.round((HOURS.lo + ((x - HOURS.x0) / (HOURS.x1 - HOURS.x0)) * (HOURS.hi - HOURS.lo)) * 2) / 2));

export function printForm(st: Step, i: number, total: number, ctx: FormCtx): Form {
  const f = new Form(i + 1, total), g = f.g;
  let y = f.title(`Q${i + 1}.`, st.title);
  const note = (s: string) => { y = f.text(s, 16, y + 4, { font: F.small(16), color: PRINT2, max: PW - 32 }) + 4; };
  switch (st.kind) {
    case 'text': {
      const k = st.field as 'you' | 'name';
      note(k === 'you' ? 'Please print the name you would like Pip to use.' : 'Every owl in our care needs a name. Pip is fine too.');
      y += 8;
      crispText(g, k === 'you' ? 'NAME' : "OWL'S NAME", 16, y + 10, F.caps(12), PRINT);
      f.rule(16, y + 40, PW - 32, PRINT);
      f.regions.push({ id: 'field', kind: 'field', x: 12, y: y + 4, w: PW - 24, h: 42 });
      f.text('(tap the line to write)', PW - 16, y + 52, { font: F.small(16), color: PRINT2, align: 'right' });
      y += 66;
      if (k === 'name') {
        crispText(g, 'OR TICK A FAVOURITE', 16, y + 8, F.small(16), PRINT2);
        y += 18;
        NAMES.forEach((n, j) => f.option('opt:' + n, n, 16 + (j % 2) * 168, y + Math.floor(j / 2) * 28, 160, n));
        y += 86;
      } else {
        note('Leave it blank to stay a mysterious stranger. We do not judge.');
      }
      break;
    }
    case 'species': {
      note('Pick the owl you would like Pip to be. Tap a photograph.');
      const opts = st.opts ?? [];
      const cw = 104, ch = 120, top = y + 8;
      opts.forEach((o, j) => {
        const row = j < 3 ? 0 : 1, col = row ? j - 3 : j, n = row ? opts.length - 3 : 3;
        const x = Math.round(PW / 2 - (n * cw + (n - 1) * 10) / 2 + col * (cw + 10)), yy = top + row * (ch + 12);
        // the photograph: a white-bordered print with a clip at the top
        f.box(x, yy, cw, ch - 20, '#b8ab90', '#fbf8f0');
        const url = ctx.photos[o.v], im = url ? imgOf(url) : undefined;
        if (im?.complete && im.naturalWidth) {
          g.fillStyle = '#e8dcc0'; g.fillRect(x + 5, yy + 5, cw - 10, ch - 30);
          const s = Math.min((cw - 10) / im.naturalWidth, (ch - 30) / im.naturalHeight);
          g.imageSmoothingEnabled = true;
          g.drawImage(im, x + cw / 2 - (im.naturalWidth * s) / 2, yy + 5 + (ch - 30) / 2 - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
          g.imageSmoothingEnabled = false;
        } else { g.fillStyle = '#d8ccb0'; g.fillRect(x + 5, yy + 5, cw - 10, ch - 30); crispText(g, 'PHOTO', x + cw / 2, yy + 48, F.small(16), PRINT2, { align: 'center' }); }
        // paper clip
        g.fillStyle = '#8a8f98'; g.fillRect(x + cw / 2 - 4, yy - 4, 8, 1); g.fillRect(x + cw / 2 - 4, yy - 4, 1, 10); g.fillRect(x + cw / 2 + 3, yy - 4, 1, 8); g.fillRect(x + cw / 2 - 2, yy - 2, 1, 8);
        g.fillStyle = '#d8dde4'; g.fillRect(x + cw / 2 - 3, yy - 4, 6, 1);
        const sp = speciesOf(o.v);
        crispText(g, o.label.replace(' Owl', ''), x + cw / 2, yy + ch - 8, F.body(), BLACK, { align: 'center' });
        crispText(g, sp.latin, x + cw / 2, yy + ch + 3, F.small(16), PRINT2, { align: 'center' });
        f.regions.push({ id: 'card:' + o.v, kind: 'card', x: x - 2, y: yy - 4, w: cw + 4, h: ch + 10, v: o.v });
      });
      break;
    }
    case 'multi': case 'choice': {
      const opts = st.id === 'goals' ? GOALS : st.id === 'relax' ? RELAX : st.opts ?? [];
      note(st.kind === 'multi' ? 'Tick as many as you like.' : 'Tick one box.');
      y += 6;
      if (st.id === 'relax') {
        opts.forEach((o, j) => f.option('opt:' + o.v, o.v, 16 + (j % 2) * 168, y + Math.floor(j / 2) * 34, 160, o.label, undefined, (o as { art?: string }).art ?? o.icon));
        y += Math.ceil(opts.length / 2) * 34;
      } else {
        opts.forEach((o, j) => f.option('opt:' + o.v, o.v, 16, y + j * 40, PW - 160, o.label, o.sub, st.id === 'latency' ? LAT_ICON[o.v] : (o as { art?: string }).art ?? o.icon));
        y += opts.length * 40;
      }
      if (st.id === 'mic') note(`Pip listens on this device only and keeps nothing else. ${ctx.artifact ? 'This preview cannot use the microphone; the full app can.' : 'You can change this any time in Settings.'}`);
      break;
    }
    case 'dial': {
      note('Turn the brass clock on the desk, or use the boxes below.');
      // a big boxed time with nudge boxes and AM / PM
      f.box(WAKE.x - 70, WAKE.y - 34, 140, 50, PRINT);
      f.box(WAKE.x - 67, WAKE.y - 31, 134, 44, PRINT2);
      crispText(g, 'WAKE-UP TIME', WAKE.x, WAKE.y - 40, F.small(16), PRINT2, { align: 'center' });
      for (const [id, x, s] of [['minus', WAKE.x - 128, '- 15 min'], ['plus', WAKE.x + 78, '+ 15 min']] as [string, number, string][]) {
        f.box(x, WAKE.y - 22, 50, 28, PRINT, '#fbf6ea');
        crispText(g, s, x + 25, WAKE.y - 3, F.small(16), PRINT, { align: 'center' });
        f.regions.push({ id, kind: id === 'minus' ? 'minus' : 'plus', x: x - 4, y: WAKE.y - 26, w: 58, h: 36 });
      }
      f.option('ampm:am', 'am', WAKE.x - 70, WAKE.y + 30, 70, 'AM');
      f.option('ampm:pm', 'pm', WAKE.x + 12, WAKE.y + 30, 70, 'PM');
      y = WAKE.y + 70;
      note('Most people do best waking at the same time every day, weekends too.');
      break;
    }
    case 'hours': {
      note('Slide the brass marker along the scale, or tap a number.');
      const { x0, x1, y: sy } = HOURS;
      g.fillStyle = PRINT;
      g.fillRect(x0, sy, x1 - x0 + 1, 2);
      for (let h = HOURS.lo; h <= HOURS.hi; h += 0.5) {
        const x = Math.round(hoursX(h)), big = h % 1 === 0;
        g.fillRect(x, sy - (big ? 10 : 5), 1, big ? 10 : 5);
        if (big) crispText(g, String(h), x + 1, sy + 18, F.body(), BLACK, { align: 'center' });
      }
      // the sweet spot bracket over 7 to 9
      const a = Math.round(hoursX(7)), b = Math.round(hoursX(9));
      g.fillStyle = GOLD; g.fillRect(a, sy - 22, b - a, 1); g.fillRect(a, sy - 22, 1, 6); g.fillRect(b, sy - 22, 1, 6);
      crispText(g, 'the sweet spot', (a + b) / 2, sy - 26, F.small(16), GOLD, { align: 'center' });
      crispText(g, 'HOURS OF SLEEP', 16, sy + 50, F.caps(12), PRINT);
      f.rule(150, sy + 52, 80, PRINT);
      f.regions.push({ id: 'scale', kind: 'scale', x: x0 - 14, y: sy - 30, w: x1 - x0 + 28, h: 56 });
      y = sy + 66;
      note('Most grown-ups need seven to nine hours.');
      break;
    }
    case 'plan': {
      printPlan(f, ctx);
      break;
    }
  }
  if (st.kind !== 'plan') f.officeBox();
  syncForm(f, st, ctx, true);
  return f;
}

/** The agreement: schedule rows typed in, the terms, signature lines, the remind box and the office box. */
function printPlan(f: Form, ctx: FormCtx) {
  const g = f.g, p = ctx.plan, a = ctx.a;
  let y = 100;
  y = f.text(`between Hollow & Co. (Pip, Head of Sleep) and ${a.you.trim() || 'our client'}, regarding the sleep of ${a.name.trim() || 'Pip'} and household.`, 16, y, { font: F.small(16), color: PRINT2, max: PW - 32, lh: 11 }) + 6;
  crispText(g, 'SCHEDULE', 16, y + 8, F.caps(12), PRINT);
  y += 14;
  const row = (label: string, value: string) => {
    crispText(g, label, 22, y + 11, F.body(), BLACK);
    const lw = measure(label, F.body());
    for (let x = 24 + lw; x < 210; x += 3) g.fillRect(x, y + 10, 1, 1);
    crispText(g, value, PW - 22, y + 11, F.body(), '#2a2a2a', { align: 'right' });
    y += 15;
  };
  g.fillStyle = PRINT2;
  row('Wind down', fmt(p.windDown, ctx.hour12));
  row('Bedtime', fmt(p.bed, ctx.hour12));
  row('Wake up', fmt(p.wake, ctx.hour12));
  row('Alarm', ALARM_NAME[p.alarm] ?? 'Music box');
  row('Sleep sound', SOUND_NAME[p.soundscape] ?? 'gentle rain');
  if (p.blocker) row('Bedtime Blocker', a.phone === 'nightly' ? 'On' : 'Ready');
  y += 4;
  if (p.tips.length) {
    crispText(g, 'TERMS', 16, y + 8, F.caps(12), PRINT);
    y += 12;
    p.tips.forEach((t, k) => { crispText(g, `${k + 1}.  ${t}.`, 22, y + 11, F.small(16), BLACK); y += 12; });
  }
  y += 6;
  f.option('remind', 'remind', 16, y, PW - 32, 'Remind me to wind down');
  f.regions[f.regions.length - 1].kind = 'remind';
  y += 30;
  // signatures
  crispText(g, 'Signed, the client', 16, y + 34, F.small(16), PRINT2);
  f.rule(16, y + 26, 150, PRINT);
  f.regions.push({ id: 'sign', kind: 'sign', x: 12, y: y - 4, w: 160, h: 44 });
  crispText(g, 'For Hollow & Co.', 192, y + 34, F.small(16), PRINT2);
  f.rule(192, y + 26, 150, PRINT);
  f.write('pipsign', `${(a.name.trim() || 'Pip')}`, 200, y + 22, { font: F.hand(24), instant: true, slant: 0.18 });
  void RED;
  f.officeBox('APPROVE');
}

/** Bring a form's ink in line with the answers. */
export function syncForm(f: Form, st: Step, ctx: FormCtx, instant = false) {
  const a = ctx.a;
  const tick = (id: string, on: boolean, kind: 'tick' | 'loop' = 'tick') => {
    const had = f.marks.some((m) => m.id === id && m.kind === kind);
    f.setTick(id, on, kind);
    if (instant && on && !had) { const m = f.marks.find((x) => x.id === id && x.kind === kind); if (m) m.t = 1; }
  };
  switch (st.kind) {
    case 'text': {
      const k = st.field as 'you' | 'name', r = f.region('field');
      if (r) f.write('field', a[k], r.x + 10, r.y + 34, { font: F.hand(24), instant });
      if (k === 'name') for (const n of NAMES) tick('opt:' + n, a.name.trim() === n);
      break;
    }
    case 'species': for (const o of st.opts ?? []) tick('card:' + o.v, a.species === o.v, 'loop'); break;
    case 'multi': {
      const list = st.id === 'goals' ? a.goals : a.relax;
      const opts = st.id === 'goals' ? GOALS : RELAX;
      for (const o of opts) tick('opt:' + o.v, list.includes(o.v));
      break;
    }
    case 'choice': {
      const v = st.id === 'mic' ? (ctx.a.mic ? 'yes' : 'no') : String(a[st.field!]);
      for (const o of st.opts ?? []) tick('opt:' + o.v, !!ctx.picked[st.id] && o.v === v);
      break;
    }
    case 'dial': {
      const m = toMin(a.wake), pm = m >= 720;
      f.write('time', fmt(a.wake, ctx.hour12).replace(/ [AP]M$/, ''), WAKE.x - 40, WAKE.y + 6, { font: F.hand(24), instant: true });
      tick('ampm:am', !pm); tick('ampm:pm', pm);
      break;
    }
    case 'hours': {
      f.write('hours', `${String(a.hours).replace('.5', '½')} hours`, 152, HOURS.y + 48, { font: F.hand(24), instant: true });
      break;
    }
    case 'plan': {
      tick('remind', ctx.remind);
      if (ctx.signed) { const r = f.region('sign'); if (r) f.write('sign', a.you.trim() || 'A. Client', r.x + 8, r.y + 26, { font: F.hand(24), slant: 0.18, instant }); }
      break;
    }
  }
}
export { PH, PW, scaled };
