// The first-run experience (see src/onboard/): the loading clock dives into its dial and the camera pulls back out
// of the same clock on the wall of Pip's office for the interview. app.tsx renders <Intro /> while the save is not
// onboarded.
import { save } from '../game/store.ts';
import { holdBoot } from '../onboard/boot.ts';
import { fontsReady } from '../onboard/fonts.ts';

// A new player keeps the splash up until they tap the clock (main.tsx still adds `gone`).
if (!save.value.onboarded && !save.value.active && !save.value.pending) { holdBoot(); void fontsReady(); }

export { Intro } from '../onboard/intro.tsx';
