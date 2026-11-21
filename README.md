# Hoot Hollow

A cozy, gamified sleep tracker. **Pip the owl** lives in a hollow oak at the edge of a voxel forest.
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

## What's new in the big hollow update

- **Loading screen and interview**: Pip sleeps on a moonlit branch while the app loads; tap to wake him,
  then answer his questions in a little office in the oak. His lines float as 3D pixel text and each answer
  is acted out live (a cozy bed for "sleep better", sheep for "fall asleep faster"...). Answers are pencilled
  onto a clipboard and stamped into your sleep plan. Settings > Replay the interview shows it again.
- **Realistic species owls**: ten real owls in detailed voxels (Tawny, Barn, Snowy, Burrowing, Saw-whet,
  Little, Great Horned, Long-eared, Great Grey, Eurasian Eagle-Owl), plus Gingerbread, Snowman, Celestial and
  Meowl skins, in a pixel dressing room.
- **A grand hollow oak**: three floors (Living Room open, Bedroom at Lv 3, Attic Observatory at Lv 6, boarded
  up until repaired), moving boxes to unpack for free furniture, and a top-down blueprint build mode with
  free camera, move/turn/store, stacking, wall items, wallpaper and flooring.
- **Sleep, Clock, Book**: a bedtime ritual on the nightstand (personalised wind-down, breathing, hold to sleep,
  can't-sleep help and a phone lock), a cuckoo clock with a routine clipboard and sticker calendar, and a big
  flippable book of stats, nights, collection, achievements and adventures.
- **Queen Neve's boutique**: daily deals on stands, a free gift, acorn piles, and weekly series wish banners
  (Frostlight Festival, Starfall Dreams) with pity and a shooting-star reveal.
- **The world**: real sunrise/sunset, moon phase and season; weather (rain, storms, snow that settles, fog);
  a bushier forest of pixel-art leaves; Pip packs up and flies off across the night sky, and comes home at
  dawn with presents (furniture and outfits).
- **Hanging wooden signs** with a magic level bar, animated main buttons, pixel UI particles and transitions.

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

### As a claude.ai Artifact

`npm run build:artifact` builds a relative-path bundle into `dist-artifact/` for publishing as a
claude.ai Artifact. In that mode the service worker is skipped, nights are tracked by time (the
artifact frame has no microphone), the adventure story can be read aloud through the host's `tts`
capability, and the journal export goes through the host's `downloads` capability. Linking to
`#breathe` opens the breathing exercise.

### The bedtime blocker extension

Load `extension/` as an unpacked extension (Chrome/Edge/Brave: `chrome://extensions`, Developer mode,
*Load unpacked*). Open the app, go to **Settings › Bedtime Blocker**, and it pairs automatically. See
[`extension/README.md`](extension/README.md) for permissions, privacy and Firefox notes.

## How it's built

TypeScript, Preact + signals, three.js, Vite. No art files: every model, texture and icon is drawn in code.

```
src/owl/      Pip: rounded voxel model, hand-painted feather painters, live pixel eyes, spring-driven
              animation and moods, outfits, coats (owl and Meowl skins)
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

### Sounds

All sounds are real recordings or music from the web, CC0 or public domain (OpenGameArt.org
contributors and the U.S. National Park Service). Every file, its source, author and licence evidence
is listed in [`docs/AUDIO-CREDITS.md`](docs/AUDIO-CREDITS.md) and `public/sfx/credits.json`.

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
