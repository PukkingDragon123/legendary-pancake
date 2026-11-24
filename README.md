# Hoot Hollow

A cozy, gamified sleep tracker. **Pip the owl** lives in a hollow oak at the edge of a hand-painted pixel-art forest.
While you sleep, Pip flies off on adventures and comes home in the morning with treasures,
furniture and outfits. The better you sleep, the fuller the satchel.

- **Sleep tracking with the microphone**: on-device analysis of movement, snoring and sleep talk,
  30-second epochs, estimated stages (awake / light / deep / REM), a 0–100 score and friendly notes.
  Optional snore and sleep-talk clips (Plus). Nothing leaves the device.
- **Smart alarm**: drag the golden hand on the pixel-art alarm clock; it can ring up to 30 minutes
  early when you're sleeping lightly. Four real recorded melodies that swell gently. Snooze or slide to wake.
- **Bedtime reminders**: a wind-down nudge and a bedtime nudge (in-app plus system notifications).
- **Social media blocking**: a companion browser extension ([`extension/`](extension)) blocks the
  sites you choose during your bedtime window and while you're asleep, configured from the app.
  On phones the app explains Screen Time / Digital Wellbeing and notes when you pick up your phone at night.
- **Breathing exercises**: five rhythms (Settle, 4·7·8, Box, Even tide, Sleepy sigh) or "follow me"
  (hold to breathe in). Pip breathes with you on a mossy log in the moonlit clearing while a glowing
  pixel ring swells and shrinks, sparks stream in on the inhale and puff out on the exhale, fireflies
  gather and scatter, and soft chimes and haptics mark each turn.
- **Adventures and collecting**: five places to explore (Whispering Woods, Mushroom Grotto, Moonlit
  Lake, Crystal Caverns, Starfall Peak) that open with levels and streaks; 20 pixel-art trinkets,
  furniture, outfits and coats to find.
- **Decorate and dress up**: 60+ furniture pieces in the tree house, loft, garden and stargazing deck
  (rooms unlock with levels); 25 outfit pieces and 14 coats; the **Meowl** skin (a kitten's face on an
  owl's body) is an optional unlock.
- **Optional premium**: moonstones and a Hoot Hollow Plus subscription. The bundled store is a
  clearly labelled demo (`src/ui/market.tsx`, `PurchaseProvider`): nothing is charged.

## What's new in the golden diorama update (v4)

- **Light and colour**: realistic lighting (filmic tone mapping, sun and sky fill, reflections) with bloom,
  tilt-shift depth of field and a warm grade; blue days, golden evenings, deep blue nights. Bushy forests of
  hand-painted leaves that turn with the real season, a sunny glade, and woods and mountains to the horizon.
  Quality adapts to the device.
- **The hollow oak**: a gnarled living oak with bark, moss, ivy, carved windows, a porch and balcony; locked
  floors are shuttered with brass plaques; warm rooms with real lamp light. Every clock shows the real time.
- **Fluffy owls**: eight realistic, hand-painted species and four skins with soft downy plumage; 39 remodelled
  cosmetics.
- **Intro and interview**: a hand-painted loading clock showing the real time, then the Hollow & Co. office,
  where Pip interviews you with a 2D paper form, live 3D answer cards, a fountain pen and a rubber stamp.
- **Barnaby's Lodge Store**: a beaver shopkeeper in a log-cabin general store; price tags, packs, banners and
  the Lucky Barrel wishes are all physical objects.
- **The Earth**: NASA imagery with city lights, clouds, relief and a real-time terminator; fly down to 20 real
  places with photos, facts and their souvenirs.
- **UI as objects**: a walnut, brass and leather HUD, a moon lamp, alarm clock and journal as the main buttons,
  a carved cuckoo clock, about 80 new organic pixel-art icons.

## Earlier: the hand-made update

- **A new art style**: calm "Moss & Moonlight" colours, hand-painted low-poly models with pixel-art
  textures, and a soft low-res pixel finish on every scene (grade, dither, grain). Nothing is voxel or blocky
  any more. Art direction: [`docs/ART-STYLE.md`](docs/ART-STYLE.md).
- **Owls**: eight real species (Tawny, Barn, Snowy, Burrowing, Saw-whet, Great Horned, Great Grey,
  Eurasian Eagle-Owl) plus the Gingerbread, Snowman, Celestial and Meowl skins. They are faceted,
  hand-painted toy figures with tiny dot eyes, and 39 outfits fit every one of them.
- **The hollow oak**: a big three-floor tree with a painted bark trunk, porch, roots and leaf canopy. The
  windows show the real forest outside, and the wall art is real public-domain paintings. There are 130+
  furniture models, and moving boxes to unpack.
- **Forest**: trees and bushes built from 2D pixel-art leaf cards; ground, rocks and stumps.
- **Loading clock**: a pixel-art clock that just ticks while the game loads, then strikes midnight. Its
  door swings open and the camera dives through the dial.
- **Transitions**: 15 of them.
- **Interview**: in Pip's office, with a desk, a real view out of the window, office props and hands-on
  widgets.
- **The lodge store**: Barnaby Birchbark, a hand-painted beaver, keeps a general store in his log lodge: deals on gnawed stumps, acorn sacks and gem chests, a gift parcel, series banners over the Lucky Barrel, and a
  window onto the real forest.
- **Book**: a simpler diary of your stats.
- **Explore the world**: a hand-painted globe with 20 real places, each with a real photo, a souvenir
  model to collect and a passport stamp.
- **Sound**: 166 sounds (UI, owl, home, nature, weather, magic, sleep beds and music), all from the web and
  credited in Settings > Credits.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. For a production build (single static folder, works from any host):

```bash
npm run build
```

Other scripts: `npm test` (44 sleep-engine tests), `npm run typecheck`. Dev-only pages:
`/dev-owl.html` (owl coats/outfits/expressions sheet), `/dev-scene.html?hour=22&view=home`
(scene views and times of day), `/dev-px.html` (every pixel icon and UI frame).

### On itch.io

`npm run build:itch` makes `hoot-hollow-itch.zip` (relative paths, no service worker, `index.html` at the
zip's root). Upload it on itch.io as an HTML5 game ("This file will be played in the browser").

### As a claude.ai Artifact

`npm run build:artifact` builds a relative-path bundle into `dist-artifact/` for publishing as a
claude.ai Artifact. The host doesn't serve `.glb` and its frame may block wasm and data:/blob: fetches, so that build wraps
every model as `<name>.glb.json` (`scripts/glb2json.mjs`), which `src/gfx/glb.ts` decodes itself. In that mode the service worker is skipped, nights are tracked by time (the
artifact frame has no microphone), the adventure story can be read aloud through the host's `tts`
capability, and the journal export goes through the host's `downloads` capability. Linking to
`#breathe` opens the breathing exercise.

### The bedtime blocker extension

Load `extension/` as an unpacked extension (Chrome/Edge/Brave: `chrome://extensions`, Developer mode,
*Load unpacked*). Open the app, go to **Settings › Bedtime Blocker**, and it pairs automatically. See
[`extension/README.md`](extension/README.md) for permissions, privacy and Firefox notes.

## How it's built

TypeScript, Preact + signals, three.js, Vite. Models are GLBs in `public/models/` (owls from Blender scripts in
`art/blender`, furniture, house and props from lowpix sources in `art/lowpix`, plus credited CC0/CC BY assets),
loaded by `src/gfx/glb.ts`.

```
src/owl/      Pip: hand-painted species models, spring-driven animation and moods, outfits, skins
src/world/    the diorama: sky and day/night, terrain, flora, Moleforge pixel grass, the cut-away tree
              house with unlockable rooms and furniture slots, fireflies, particles, critters
src/sleep/    microphone analyzer, sleep staging and score, smart alarm, reminders, IndexedDB clips,
              service worker registration (tests alongside)
src/breathe/  breathing patterns and session clock, the pixel-art particle overlay
src/game/     save and economy, catalog, adventures and loot, the night controller, blocker bridge
src/ui/       screens, the pixel UI kit (frames, sprites, fonts from The Bear Must Eat), pixel alarm clock
src/audio/    sound manager: four buses, gapless loops, soundscapes, the swelling alarm
extension/    MV3 browser extension (declarativeNetRequest blocking, bedtime page, popup)
```

### Reused from earlier projects

- **Sidekick**: the voxel box/texture engine (`src/gfx`), forest flora, sky, particles, critters,
  garden furniture, and the original CC0/public-domain sound library.
- **Moleforge (Burrowsmith)**: the forest grass field (`src/world/grassAtlas.js`, `grass.ts`).
- **The Bear Must Eat**: the pixel sprite kit and ~170 icons (`src/ui/px/sprites.js`), the 9-slice UI
  frames (`src/ui/px/frames.js`) and the TBME Goofy / Galmuri pixel fonts. Hoot Hollow's own icons are
  drawn with the same kit (`src/ui/px/hollow.js`).

### Sounds and art credits

All sounds are real recordings or music from the web, CC0 or public domain (BigSoundBank,
OpenGameArt.org contributors, the U.S. National Park Service and the Internet Archive). Every file, its source, author and licence evidence
is listed in [`docs/AUDIO-CREDITS.md`](docs/AUDIO-CREDITS.md) and `public/sfx/credits.json`. Borrowed models,
textures, paintings and place photos (CC0, CC BY and public domain) are credited in [`docs/credits/`](docs/credits);
all credits are gathered into `CREDITS.txt` at build time and shown in Settings > Credits.

## Honest limitations

- **Sleep stages are estimated from sound**, steered by a typical night's structure. They're not
  medical measurements. A bed partner's sounds count as yours.
- **Phones must stay on overnight** (charging, screen up). The app keeps the screen awake and very dim.
  iOS stops the microphone if the screen locks; Android needs the tab in front.
- **Alarms and reminders need the page alive.** In a background tab the alarm may ring up to about a
  minute late; it can't ring if the app is closed. A native wrapper or push server would remove this.
- **Social-media blocking works in desktop browsers** via the extension. Mobile browsers don't run
  extensions, so the app points you to Screen Time / Digital Wellbeing.
- **The Artifact build can't use the microphone or a service worker**, so sleep tracking there is
  by time only and reminders fire only while the page is open.
- **Payments are a demo.** Wire a real provider into `PurchaseProvider` before shipping.
- The sounds were chosen by measurement (levels, loops, clipping), not auditioned by ear.
