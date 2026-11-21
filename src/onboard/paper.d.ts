export declare const PX: number;
export declare function rng(seed?: number): () => number;
export declare const PAPER_KINDS: string[];
export declare function paperTile(kind: string): { url: string; w: number; h: number; base: string };
export declare function paperTexture(kind: string, w: number, h: number, opts?: Record<string, unknown>): string;
export declare const DECO_NAMES: string[];
export declare function decoCanvas(name: string, opts?: Record<string, unknown>): HTMLCanvasElement;
export declare function decoURL(name: string, opts?: Record<string, unknown>): string;
export declare function deco(name: string, opts?: Record<string, unknown>): string;
