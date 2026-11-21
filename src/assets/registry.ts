// Every placeable thing in one place: furniture, decor, seasonal items and room finishes.
import { BASE_FINISHES, type Finish } from './finishes.ts';
import { FURNITURE, type ItemDef } from './furniture.ts';
import { DECOR_FINISHES, DECOR_ITEMS } from './decor.ts';
import { HOME_ITEMS } from './home.ts';
import { SEASONAL_FINISHES, SEASONAL_ITEMS } from './seasonal.ts';

export const ALL_ITEMS: ItemDef[] = [...HOME_ITEMS, ...FURNITURE, ...DECOR_ITEMS, ...SEASONAL_ITEMS];
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
export const FINISHES: Finish[] = [...BASE_FINISHES, ...DECOR_FINISHES, ...SEASONAL_FINISHES];
export const FINISH: Record<string, Finish> = Object.fromEntries(FINISHES.map((f) => [f.id, f]));
export type { Finish, ItemDef };
