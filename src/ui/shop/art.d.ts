export declare const ICE_FRAMES: Record<string, { w: number; h: number; slice: number[]; fill: boolean; repeat: string }>;
export declare const SHOP_COLORS: Record<string, string>;
export declare function iceURL(name: string, scale?: number): string;
export declare function iceStyle(name: string, scale?: number): string;
export declare function injectIceCSS(): void;
export declare function patternURL(name: string, scale?: number): string;
export declare function raysURL(off?: number, n?: number, size?: number): string;
export declare function burstURL(size?: number, col?: string): string;
export declare function shootURL(col: string, len?: number): string;
