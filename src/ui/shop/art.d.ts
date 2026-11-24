export declare const LG_FRAMES: Record<string, { w: number; h: number; slice: number[]; fill: boolean; repeat: string }>;
export declare const SHOP_COLORS: Record<string, string>;
export declare function lgURL(name: string, scale?: number): string;
export declare function lgStyle(name: string, scale?: number): string;
export declare function injectLodgeCSS(): void;
export declare function patternURL(name: string, scale?: number): string;
export declare function raysURL(off?: number, n?: number, size?: number): string;
export declare function burstURL(size?: number, col?: string): string;
export declare function shootURL(col: string, len?: number): string;
