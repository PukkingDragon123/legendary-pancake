# tex7 credits

Photo textures for the interface's 3D models: the live shelf's wood, leather and cloth (`src/ui/chrome/props3d.ts`)
and the baked icons (`src/dev/iconbake.ts`). Downloaded from Poly Haven (1k diffuse), scaled to 512 px, kept in colour
or reduced to tintable grain (`art/tex7/*.webp`), and packed into the interface atlas `public/img/ui3d.webp`.

| Swatch | Source | Author(s) | Licence |
|---|---|---|---|
| `wood`, `woodg` (oak, walnut when tinted) | [Oak Veneer 01](https://polyhaven.com/a/oak_veneer_01) | Jenelle van Heerden | CC0 1.0 |
| `leather` (straps, tan leather) | [Brown Leather](https://polyhaven.com/a/brown_leather) | Rob Tuytel | CC0 1.0 |
| `grain` (the journal's leather, tinted) | [Leather Red 02](https://polyhaven.com/a/leather_red_02) | Rob Tuytel | CC0 1.0 |
| `linen` (cloth, burlap, ribbon) | [Rough Linen](https://polyhaven.com/a/rough_linen) | colormass, Rico Cilliers | CC0 1.0 |
| `knit` (knitwear) | [Knitted Fleece](https://polyhaven.com/a/knitted_fleece) | colormass, Rico Cilliers | CC0 1.0 |
| `velvet` (felt, velvet) | [Velour Velvet](https://polyhaven.com/a/velour_velvet) | colormass, Rico Cilliers | CC0 1.0 |

Everything else (brass, enamel, paper, glass, carving, the dial, the tooled cover) is painted procedurally in
`src/ui/chrome/paint3d.ts` and `props3d.ts`.
