// The first-run experience (see src/onboard/): the sleeping-owl loading screen hands over to Pip's
// office for a cinematic interview. app.tsx renders <Intro /> while the save is not onboarded.
import { save } from '../game/store.ts';
import { holdBoot } from '../onboard/boot.ts';

// A new player keeps the splash up until they tap to wake Pip (main.tsx still adds `gone`).
if (!save.value.onboarded && !save.value.active && !save.value.pending) holdBoot();

export { Intro } from '../onboard/intro.tsx';
