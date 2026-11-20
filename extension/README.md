# Hoot Hollow Bedtime (browser extension)

A web page can't block other websites, so Hoot Hollow comes with this small companion extension.
At bedtime, Pip the Meowl (a kitten's head on a little barn owl's body) tucks in social media: TikTok, Instagram, Facebook, X/Twitter, Reddit, YouTube,
Snapchat, Threads, Pinterest, Twitch and Discord, plus any sites you add. A visit to one of them
lands on a quiet night-sky page instead of the feed.

- **Bedtime window.** For example 22:30 to 07:00 on the nights you pick. A night belongs to the day it
  starts: "Friday" covers Friday 22:30 to Saturday 07:00.
- **Sleep mode.** While the Hoot Hollow app says a sleep session or wind-down is running, sites are
  blocked even outside the window. Sleep mode ends when the app says so, at the `until` time it gave,
  or at the window's end time (07:00), whichever comes first.
- **Strict mode.** No pausing during bedtime, and nothing that would loosen blocking (switching it off,
  removing sites, moving the window) takes effect until blocking ends. Adding sites still works at once.
- **Not strict.** You can take one gentle 5-minute "just this once" pause from the toolbar popup after
  typing *i choose sleep*.
- Each domain also covers its subdomains (`reddit.com` covers `old.reddit.com`, `m.reddit.com`, ...).
- When bedtime starts, tabs already open on blocked sites are politely moved to the bedtime page. It keeps
  a link back for the morning.

Plain JS/HTML/CSS, Manifest V3, no build step.

## Install

### Chrome, Edge, Brave, Vivaldi, Opera, Arc (Chromium 121+)

1. Open the extensions page: `chrome://extensions`, `edge://extensions`, `brave://extensions`, ...
2. Turn on **Developer mode** (top right in Chrome; left sidebar in Edge).
3. Click **Load unpacked** and choose this `extension/` folder.
4. Pin Pip from the puzzle-piece menu so you can see its status.
5. To block in private windows too, open the extension's **Details** and turn on **Allow in Incognito**.

Chromium shows a "developer mode extensions" reminder now and then. That is normal for unpacked
extensions.

### Firefox (128+)

1. Open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on...**.
2. Pick `extension/manifest.json`.
3. Open `about:addons`, then **Hoot Hollow Bedtime**, then **Permissions**, and make sure
   **Access your data for all websites** is on. Firefox treats MV3 host permissions as opt-in. Without it,
   the redirect rules and the app bridge do nothing.
4. To block in private windows too, set **Run in Private Windows** to *Allow*.

Temporary add-ons are removed when Firefox restarts. A permanent install needs the extension to be signed
through addons.mozilla.org (an unlisted, self-distributed signing is enough).

How Firefox differs:

- The manifest lists both `background.service_worker` (Chrome) and `background.scripts` (Firefox runs
  `background.js` as a non-persistent event page). Each browser ignores the key it doesn't use. This is
  why Chrome needs version 121 or newer.
- `browser_specific_settings` (add-on id, `data_collection_permissions: none`) is used only by Firefox.
  Older Chrome versions may list it as an unrecognised key, which is harmless.
- The code uses `globalThis.browser ?? globalThis.chrome` and promise-style APIs, which both browsers support.
- Only Chromium was load-tested (Playwright, headless). The Firefox path uses only APIs Firefox documents
  for MV3 (declarativeNetRequest with `redirect.extensionPath`, alarms, storage, tabs, scripting), but has
  not been run here.

## Pairing with the app

Nothing to set up. Open Hoot Hollow in the same browser and it finds the extension by itself. When the
extension is installed while the app is already open, it injects its bridge into that tab, so no reload
is needed.

The app side lives in `src/game/blocker.ts` (`BlockerBridge`). On the wire:

1. The app page carries `<meta name="hoot-hollow-app" content="1">` (`BlockerBridge.connect()` adds it).
2. The content script `bridge.js` runs on every http(s) page at `document_start`. It stays silent unless the
   page has that meta tag **and** posts a same-origin message with `source: 'hoot-hollow'`.
3. Messages from the app use `window.postMessage(msg, location.origin)`:

   | `type`   | `payload`                               | effect                                                     |
   | -------- | --------------------------------------- | ---------------------------------------------------------- |
   | `hello`  | none                                    | answer with the current status                             |
   | `config` | `BlockConfig`                           | save the config, remember the app's URL, answer with status |
   | `sleep`  | `{ active: boolean, until?: number }`   | start or stop sleep mode, answer with status               |

   The app may add `id: string`; the answer echoes it as `re`, so replies can be matched to requests.
4. The extension answers with `{ source: 'hoot-hollow-ext', type: 'status', payload: BlockStatus, re? }`.
   After the first exchange it also **pushes** a fresh `status` whenever the blocking state or config
   changes, for example when bedtime starts or you add a site from the popup.

```ts
const bridge = new BlockerBridge();
const status = await bridge.connect();     // null after ~800 ms means the extension isn't installed
bridge.onStatus((s) => render(s));          // answers and pushes
await bridge.sendConfig({ ...defaultBlockConfig(), start: '22:00', strict: true });
await bridge.setSleep(true, wakeAtMs);      // and setSleep(false) in the morning
```

`BlockStatus` has one optional field beyond the base contract: `pendingConfig`. It holds a config that
arrived while strict mode was blocking and will apply once blocking ends.

The schedule maths (`isBlockedNow`, `nextChange`, `nextWake`, `normalizeDomain`, ...) appears twice, in
`src/game/blocker.ts` and `lib/schedule.js`. The two copies match line for line, including handling of
daylight-saving gaps. Change both together.

## How blocking works

- `background.js` is the single source of truth. On every alarm, storage change or message it re-reads
  `chrome.storage.local`, decides whether to block, and replaces the **dynamic declarativeNetRequest
  rules**. There is one rule per domain:
  `{ requestDomains: [domain], resourceTypes: ['main_frame'] }` with the action redirect to
  `/blocked.html?site=domain`. Outside bedtime there are no rules at all.
- **Alarms:** a tick every minute, plus an exact alarm at the next change (window edge, end of sleep
  mode, end of a pause).
- The current `BlockStatus` is written to `storage.local` under `status`. The bridge, the popup and the
  bedtime page all watch that key, which is how live pushes keep working after the service worker sleeps.
- The badge shows `zz` while blocking and the minutes left while paused.

## Permissions

| Permission                                       | Why                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `declarativeNetRequest`                          | The actual blocking: browser-side redirect rules. The extension never sees your traffic.                                                                     |
| host access `http://*/*`, `https://*/*`          | Redirect rules need host access to the sites they redirect, including any domain you add. It also lets the bridge talk to the app on whatever address it's served from. |
| `storage`                                        | Keeps your settings, sleep mode, pause and today's count on this device.                                                                                     |
| `alarms`                                         | Starts and stops blocking on time, even while the browser is idle.                                                                                           |
| `tabs`                                           | Reads open tabs' addresses when bedtime starts, to move ones on blocked sites to the bedtime page. Also focuses an open Hoot Hollow tab instead of opening a new one. |
| `scripting`                                      | On install or update only: injects the bridge into an already-open Hoot Hollow tab so it pairs without a reload.                                             |
| content script `bridge.js` on http(s) pages      | Needed because the app can run on any origin. It does nothing on pages that don't identify as Hoot Hollow.                                                   |
| `web_accessible_resources: blocked.html`         | Lets the redirect land on the bedtime page.                                                                                                                  |

## Privacy

Nothing leaves your device. No network requests, no analytics, no remote code. Settings, the paired
app's address and a per-day count of blocked visits stay in `chrome.storage.local`. The bridge reads
nothing from pages that aren't Hoot Hollow. On the app page it only relays the messages above.

## Limitations

- **Phones and tablets:** mobile Chrome and Safari don't run extensions. Use **Screen Time** (iPhone, iPad,
  Mac) or **Digital Wellbeing** (Android) for bedtime app limits. Desktop Safari isn't supported either.
- It's a nudge, not a lock. Anyone can turn it off in the extensions page, use another browser or profile,
  or use a private window where the extension isn't allowed.
- Only whole-page visits are redirected. A YouTube video embedded on another site still plays, and
  desktop apps (Discord, Twitch) are not affected.
- Any page can claim to be the app by adding the meta tag, so a site you visit could, in principle, change
  your blocker settings. Strict mode limits the damage: nothing can loosen blocking during bedtime.
- On the night clocks fall back, a window edge that falls in the repeated hour follows the wall clock, so
  bedtime can briefly re-open for that hour.

## Files

```
manifest.json      MV3 manifest (Chrome + Firefox keys)
background.js      service worker: schedule, rules, alarms, tab tuck-in, messages
bridge.js          content script: app <-> extension postMessage bridge
blocked.html/.css/.js  bedtime page (pixel sky, fireflies, Pip on a branch)
popup.html/.css/.js    toolbar popup (status, window, sites, pairing, gentle pause)
lib/schedule.js    schedule + domain helpers (mirror of src/game/blocker.ts)
lib/owl.js         Pip the Meowl, drawn pixel by pixel (also the source of the 32/128 px icons)
fonts.css, fonts/  bundled Pixelify Sans, Silkscreen, Nunito (SIL OFL, see fonts/OFL.txt)
icons/             16/32/48/128 px Meowl icons
tools/make-icons.mjs  regenerates icons/ (node tools/make-icons.mjs [--preview out.png]), no dependencies
```
