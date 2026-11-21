// OWNED BY THE UI-CHROME BUILDER. Full-screen transitions between places (iris wipe, falling
// leaves, a snow flurry, a page turn, a blueprint unroll, a starry fade). `mid` runs when the
// screen is fully covered; the promise resolves when the transition is over.
// This stub just runs `mid`; the chrome builder implements the effects.
export type TransitionKind = 'iris' | 'leaves' | 'snow' | 'page' | 'blueprint' | 'stars' | 'fade';
export async function transition(kind: TransitionKind, mid?: () => void | Promise<void>): Promise<void> { void kind; await mid?.(); }
