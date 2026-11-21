export declare const PX: number;
export declare const PAPER_KINDS: string[];
export declare function rng(seed?: number): () => number;
/** a tileable paper texture: data URL plus its size in texels (1 texel = PX css px by default) */
export declare function paperTile(kind: string): { url: string; w: number; h: number; base: string };
/** a paper texture sized w x h css px; opts: px, seed, edge, deckle, creases, stains, dogear, torn, rules, ruleTop, margin, holes, sticky... */
export declare function paperTexture(kind: string, w: number, h: number, opts?: Record<string, unknown>): string;
export declare function decoURL(name: string, opts?: Record<string, unknown>): string;
export declare function decoCanvas(name: string, opts?: Record<string, unknown>): HTMLCanvasElement;
export declare const DECO_NAMES: string[];
