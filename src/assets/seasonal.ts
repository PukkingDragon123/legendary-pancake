// Limited series furniture and finishes (the Frostlight Festival and Starfall Dreams). Ids must match
// src/game/series.ts. The models live in src/assets/decor/frost.ts and src/assets/decor/starfall.ts.
import type { ItemDef } from './furniture.ts';
import type { Finish } from './finishes.ts';
import { FROST_FINISHES, FROST_ITEMS } from './decor/frost.ts';
import { STARFALL_FINISHES, STARFALL_ITEMS } from './decor/starfall.ts';

export const SEASONAL_ITEMS: ItemDef[] = [...FROST_ITEMS, ...STARFALL_ITEMS];
export const SEASONAL_FINISHES: Finish[] = [...FROST_FINISHES, ...STARFALL_FINISHES];
