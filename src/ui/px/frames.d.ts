export declare const FRAMES: Record<string, { w: number; h: number; slice: number[]; fill: boolean; repeat: string; fixed?: boolean }>;
export declare function frameCanvas(name: string, scale?: number): HTMLCanvasElement;
export declare function frameURL(name: string, scale?: number): string;
export declare function frameStyle(name: string, scale?: number): string;
export declare function injectFrameCSS(): void;
