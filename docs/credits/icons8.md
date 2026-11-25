# icons8 credits

The pixel-art icons and the main buttons' shelf sprites (`public/img/ui3d.webp`, baked by `src/dev/iconbake.ts` and
finished by `src/dev/pixelize.ts`) are rendered from 3D models. Nothing new was borrowed for them; they reuse:

| What | Used for | Source | Licence |
|---|---|---|---|
| Poly Haven photo textures (oak veneer, leathers, linen, knitted fleece, velour), prepared in `art/tex7` | the grain of wood, leather and cloth on the models before they are finished as pixel art (the photos are no longer packed into the atlas) | credited in [`tex7.md`](tex7.md) | CC0 1.0 |
| The game's own furniture models `items/armchair.glb`, `items/round_table.glb`, `items/bookshelf.glb`, `items/fernpot.glb`, `items/rocking_horse.glb` | the Build categories' chair, table, shelf, plant and fun icons | the game's own (borrowed ones credited with the models in [`furnA.md`](furnA.md) and [`furnB.md`](furnB.md)) | CC0 1.0 or own |

Every other model (the symbols, the acorn and moon gem, the packs, the clothes, the lamp, the cuckoo clock, the
journal, the shelf) is made in code in `src/dev/iconbake.ts` and `src/ui/chrome/props3d.ts`.
