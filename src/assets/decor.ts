// New furniture and decor for the bigger house and the build store. The models live in
// src/assets/decor/*, grouped by build category; this module only gathers them up.
import type { ItemDef } from './furniture.ts';
import type { Finish } from './finishes.ts';
import { BEDS_AND_SEATS } from './decor/beds.ts';
import { TABLES_AND_STORAGE } from './decor/tables.ts';
import { LIGHTS } from './decor/lights.ts';
import { TRINKETS } from './decor/trinkets.ts';
import { GREEN } from './decor/green.ts';
import { FUN } from './decor/fun.ts';

export const DECOR_ITEMS: ItemDef[] = [...BEDS_AND_SEATS, ...TABLES_AND_STORAGE, ...LIGHTS, ...TRINKETS, ...GREEN, ...FUN];
/** extra wallpapers and floorings beyond the base two */
export const DECOR_FINISHES: Finish[] = [];
