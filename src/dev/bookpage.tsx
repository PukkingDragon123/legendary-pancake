// The book on its own, over a night-sky backdrop, with a seeded save:
//   dev-book.html?nights=12         twelve simulated nights (0 for the empty book)
//   &bk=enter:0.45 | exit:0.6 | open | flip:0.4 | night | page:9   freeze a moment (see book.tsx)
import { render } from 'preact';
import { ALL_ITEMS } from '../assets/registry.ts';
import { freshSave, save } from '../game/store.ts';
import { PIECES } from '../owl/outfits.ts';
import { demoNight } from '../sleep/simulate.ts';
import { Book } from '../ui/book/book.tsx';
import { installRealSkin } from '../ui/real/skin.ts';
import { loadTextures } from '../ui/real/tex.ts';
import { panel } from '../ui/state.ts';
import '../ui/style.css';

const q = new URLSearchParams(location.search);
const n = +(q.get('nights') ?? 12);
const DAY = 86_400_000, now = Date.now();
const nights = Array.from({ length: n }, (_, i) => {
  const s = demoNight({ now: now - (n - 1 - i) * DAY, seed: 101 + i * 7, snorer: i % 3 === 0, restless: (i % 4) * 0.12 });
  return { ...s, id: 'demo' + i, simulated: false, mood: i % 4 === 1 ? undefined : (i * 3) % 5, note: i === n - 2 ? 'Dreamt about a lighthouse made of cake.' : undefined };
});
const base = freshSave();
save.value = {
  ...base, onboarded: true, name: q.get('name') ?? 'Pip', xp: n ? 900 : 0, coins: 1240, gems: 85, bestStreak: n ? 9 : 0, streak: n ? 4 : 0, nights,
  look: { ...base.look, species: q.get('species') ?? 'tawny' },
  profile: { ...base.profile, you: n ? 'Sam' : '', goals: n ? ['faster', 'earlier', 'wake'] : [], interviewed: n > 0, chronotype: 'owl', latency: 'slow', sleepHours: 7 },
  owned: n ? { ...base.owned, items: [...base.owned.items, ...ALL_ITEMS.slice(6, 22).map((x) => x.id)], pieces: [...base.owned.pieces, ...PIECES.slice(3, 8).map((x) => x.id)], species: ['tawny', 'barn', 'snowy'], skins: ['owl', 'meowl'] } : base.owned,
  seen: { zones: [], areas: n ? ['woods', 'grotto', 'lake'] : ['woods'] },
  breath: { ...base.breath, sessions: n ? 6 : 0, minutes: n ? 14 : 0 },
  home: { ...base.home, seeded: true, boxes: n ? [] : ['b1'] },
  shop: { ...base.shop, pity: n ? { frostlight: { five: 0, four: 0, total: 3 } } : {} },
};
void loadTextures().then(installRealSkin);
panel.value = 'book';

function Dev() {
  return (
    <div style="position:fixed;inset:0;background:radial-gradient(ellipse at 50% 85%, #3a5a3a 0, #22324a 38%, #131833 70%);overflow:hidden">
      <div style="position:absolute;left:0;right:0;bottom:0;height:22%;background:linear-gradient(#2e4a2a,#1a2a1a)" />
      {panel.value === 'book' ? <Book /> : <button style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 20px;font-size:20px;background:#efc650" onClick={() => { panel.value = 'book'; }}>Open the book</button>}
    </div>
  );
}
render(<Dev />, document.getElementById('ui')!);
