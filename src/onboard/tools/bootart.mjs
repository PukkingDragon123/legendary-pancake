// Generates the loading screen: the `#boot` block in index.html. [clock12] The clock is no longer pixel art: the
// block carries a small CSS layout (art units are `em`, so the whole stage scales with one font size), a few empty
// canvases and the clock's painter (src/onboard/clockpaint.ts, bundled and minified with esbuild) inline, so the
// first frame already shows the painted clock at the screen's own resolution with the real time:
//   - the hands are canvases turned by CSS animations at clock speed (one turn an hour, one in twelve), started at the
//     current time by negative delays (the script sets --tm and --th before the first paint);
//   - the pine-cone weights sink on their chains with the (estimated) loading progress while the rings on the other
//     ends rise, and the oak-leaf pendulum swings;
//   - src/onboard/boot.ts takes over once the app is ready (the clock is wound, the door opens and Pip calls; a dive
//     into the dial, where the office's own clock, painted by the same code, takes over).
// The wall is a deep emerald stripe (like the office's) in a pool of warm lamplight, in CSS gradients. No text.
//
//   node src/onboard/tools/bootart.mjs
import { buildSync } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
// the painter's plan, read from the module itself (it only touches the DOM inside functions)
const mod = buildSync({ entryPoints: [here('../clockpaint.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' }).outputFiles[0].text;
const P = await import('data:text/javascript;base64,' + Buffer.from(mod).toString('base64'));
const { G, CX, CASE_BOX: CB, DOOR_BOX: DB, HANDS, PEND_BOX, TRAVEL } = P;
const PB = PEND_BOX();

// the inline script: paint, then start the hands at the real time
const script = buildSync({
  stdin: {
    contents: `import { bootMain } from './clockpaint.ts';
try { const d = new Date(), m = d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1e3, s = document.getElementById('boot').style;
  s.setProperty('--tm', m.toFixed(1)); s.setProperty('--th', ((d.getHours() % 12) * 3600 + m).toFixed(1)); } catch (e) { /* no clock */ }
try { bootMain(); } catch (e) { /* the wall still shows */ }`,
    resolveDir: here('..'), loader: 'ts', sourcefile: 'boot-inline.ts',
  },
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
}).outputFiles[0].text.trim();

// ---- progress timing: the weights sink with the (estimated) loading progress, fast at first, then a crawl
const LOAD_S = 26;
const prog = (t) => { const a = Math.min(1, t / 7); return 0.9 * (1 - (1 - a) ** 2.4) + 0.07 * Math.max(0, (t - 7) / (LOAD_S - 7)); };
const sinkFrames = () => {
  const out = [];
  for (let i = 0; i <= 16; i++) { const t = (i / 16) ** 1.6 * LOAD_S; out.push(`${((t / LOAD_S) * 100).toFixed(1)}%{transform:translateY(calc(var(--d)*${(prog(t) * TRAVEL).toFixed(1)}em))}`); }
  return `@keyframes bt-wt{${out.join('')}}`;
};
const SW = G.W, SH = G.SH, R = G.dial.bez + 1, HL = HANDS.minute + 2;
const box = (x, y, w, h) => `left:${+x.toFixed(2)}em;top:${+y.toFixed(2)}em;width:${+w.toFixed(2)}em;height:${+h.toFixed(2)}em`;
const CSSTXT = `
#boot{--k:min(calc(86vw / ${SW}),calc(74vh / ${SH}));font-size:var(--k);position:fixed;inset:0;z-index:99;overflow:hidden;display:flex;align-items:center;justify-content:center;
background:radial-gradient(ellipse 58% 40% at 50% 38%,rgba(255,190,100,.34),rgba(255,170,80,.1) 55%,rgba(255,170,80,0) 78%),radial-gradient(ellipse 120% 95% at 50% 40%,rgba(0,0,0,0) 40%,rgba(1,6,3,.86) 100%),repeating-linear-gradient(90deg,#0f4a2f 0 6.2em,#a08a3a 6.2em 6.6em,#0b3b25 6.6em 12.8em,#a08a3a 12.8em 13.2em),#0b3b25;
user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .7s}
#boot.gone:not(.hold):not(.js){opacity:0;pointer-events:none}
#boot *{position:absolute;display:block;-webkit-user-drag:none;pointer-events:none}
#boot .bt-mote{width:1.4em;height:1.4em;border-radius:50%;background:radial-gradient(#fff2c8,rgba(255,216,144,0) 70%);opacity:0;animation:bt-mote 9s ease-in-out infinite}
#boot .bt-stage{position:relative;width:${SW}em;height:${SH}em;flex:none;transform-origin:50% ${((G.dial.y / SH) * 100).toFixed(3)}%}
#boot .bt-case{${box(CB.x, CB.y, CB.w, CB.h)}}
#boot .bt-door{${box(DB.x, DB.y, DB.w, DB.h)}}
#boot .bt-dial{${box(CX - R, G.dial.y - R, R * 2, R * 2)}}
#boot .bt-h{${box(CX - HL, G.dial.y - HL, HL * 2, HL * 2)};animation:bt-turn 3600s linear calc(var(--tm,0)*-1s) infinite}
#boot .bt-hh{animation-duration:43200s;animation-delay:calc(var(--th,0)*-1s)}
#boot .bt-pend{${box(PB.x, PB.y, PB.w, PB.h)};transform-origin:${CX - PB.x}em ${G.pivot.y - PB.y}em;animation:bt-pend .6s ease-in-out infinite alternate}
#boot .bt-wt,#boot .bt-rg{--d:1;animation:bt-wt ${LOAD_S}s linear forwards}
#boot .bt-rg{--d:-1}
${[-1, 1].map((sd, i) => `#boot .bt-wt.w${i}{${box(CX + sd * G.wx - 10, G.wTop - 92, 20, 136)}}`).join('\n')}
${[-1, 1].map((sd, i) => `#boot .bt-rg.w${i}{${box(CX + sd * G.rx - 6, G.rBot - 100, 12, 106)}}`).join('\n')}
#boot .bt-tap{left:${CX + 16}em;top:${G.dial.y + 14}em;width:18em;height:18em;margin:-9em 0 0 -9em;border-radius:50%;border:1.3em solid #ffe9b0;box-shadow:0 0 0 .7em rgba(20,12,16,.55),inset 0 0 0 .7em rgba(20,12,16,.55);opacity:0}
#boot .bt-note{width:7em;height:9em;opacity:0}
#boot.ready{cursor:pointer}
#boot.ready *{pointer-events:none}
#boot.ready .bt-tap{animation:bt-tap 1.5s ease-out infinite}
#boot.call .bt-note{animation:bt-note .9s ease-out forwards}
#boot.zoom .bt-tap{opacity:0;animation:none}
@keyframes bt-turn{to{transform:rotate(360deg)}}
@keyframes bt-pend{from{transform:rotate(-8.6deg)}to{transform:rotate(8.6deg)}}
@keyframes bt-mote{0%{opacity:0;transform:translate(0,0)}15%{opacity:.75}50%{transform:translate(6em,-14em)}85%{opacity:.5}100%{opacity:0;transform:translate(2em,-28em)}}
${sinkFrames()}
@keyframes bt-tap{0%{opacity:0;transform:scale(.55)}25%{opacity:.95}100%{opacity:0;transform:scale(1.25)}}
@keyframes bt-note{0%{opacity:1;transform:translate(0,0) rotate(0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(14deg)}}
@media (prefers-reduced-motion:reduce){#boot *:not(.bt-h){animation-duration:0s!important;animation-iteration-count:1!important}}
`.trim().replace(/\n+/g, '\n');

const motes = [[-48, 30, 0], [44, 10, -2.1], [-22, -40, -4.4], [56, -56, -6.2], [-62, -8, -1.3], [14, 62, -3.6], [32, -70, -7.7], [-36, 70, -5.1]];
const notes = [[CX - 21, 60, -9, -14], [CX + 13, 56, 10, -16], [CX - 5, 48, -2, -18]];
const NOTE = `<svg class="bt-note" style="left:%Xem;top:%Yem;--dx:%DXem;--dy:%DYem" viewBox="0 0 14 18"><path d="M5.5 14.2a3 2.3-22 1 1-.9-2.6V2l7.4 2v3.4L6.6 5.6v8.4z" fill="#ffd978" stroke="#140c10" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
const html = `<!-- boot:begin (generated by src/onboard/tools/bootart.mjs; edit the generator, not this block) -->
    <style>${CSSTXT}</style>
    <div id="boot" role="progressbar" aria-label="Loading" data-art='${JSON.stringify({ cx: CX, dy: G.dial.y, rd: G.dial.r, w: SW, sh: SH, wt: TRAVEL })}'>
      ${motes.map(([x, y, d]) => `<i class="bt-mote" style="left:calc(50% + ${x}em);top:calc(50% + ${y}em);animation-delay:${d}s"></i>`).join('')}
      <div class="bt-stage">
        <canvas class="bt-pend"></canvas>
        <canvas class="bt-wt w0"></canvas><canvas class="bt-wt w1"></canvas><canvas class="bt-rg w0"></canvas><canvas class="bt-rg w1"></canvas>
        <canvas class="bt-case"></canvas>
        <canvas class="bt-door"></canvas>
        <canvas class="bt-dial"></canvas>
        <canvas class="bt-h bt-hh"></canvas><canvas class="bt-h bt-mh"></canvas>
        <i class="bt-tap"></i>
        ${notes.map(([x, y, dx, dy]) => NOTE.replace('%X', x).replace('%Y', y).replace('%DX', dx).replace('%DY', dy)).join('')}
      </div>
    </div>
    <script>${script}</script>
    <!-- boot:end -->`;

const file = here('../../../index.html');
const src = readFileSync(file, 'utf8');
const a = src.indexOf('<!-- boot:begin'), z = src.indexOf('<!-- boot:end -->');
if (a < 0 || z < 0) throw new Error('boot markers missing in index.html');
writeFileSync(file, src.slice(0, a) + html + src.slice(z + '<!-- boot:end -->'.length));
console.log('boot block written:', (html.length / 1024).toFixed(1), 'KB (script', (script.length / 1024).toFixed(1), 'KB); stage', SW, 'x', SH);
