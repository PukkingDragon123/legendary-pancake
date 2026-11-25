# ui7 credits (the realistic interface materials)

The interface's material tiles live in `src/ui/real/tex/` (512 px, seamless, WebP). The photo ones are Poly Haven texture
scans (1k): each albedo is lit by its own normal map from the interface's light (top left), shrunk seamlessly to 512 px
and graded; the "detail" tiles keep only the brightness variation (grey, tinted to any colour at run time). Rebuilt by
`art/ui/textures.py`. Everything else in the interface (frames, buttons, brass, enamel, glass, the props, portrait frames,
the book, the presents, the window, the transitions and particles) is painted procedurally by our own code
(`src/ui/real/paint.ts`, `kit.ts`), and `paper`, `kraft`, `cork` and `brushed` are procedural tiles from the same script.

| File | Texture | Source | Author | Licence |
|---|---|---|---|---|
| `src/ui/real/tex/walnut.webp` (walnut frames, boards, the nightstand, the shelf) | Dark Wood | https://polyhaven.com/a/dark_wood | Dario Barresi, Dimitrios Savva, Rico Cilliers | CC0 |
| `src/ui/real/tex/oak.webp` (oak frames, signs, blinds, window casements) | Oak Veneer 01 | https://polyhaven.com/a/oak_veneer_01 | Jenelle van Heerden | CC0 |
| `src/ui/real/tex/leather.webp`, `pebble.webp` (leather: the diary, the passport, tabs, the interview folio) | Leather Red 02 | https://polyhaven.com/a/leather_red_02 | Rob Tuytel | CC0 |
| `src/ui/real/tex/bookcloth.webp` (book cloth) | Book Pattern | https://polyhaven.com/a/book_pattern | Rob Tuytel | CC0 |
| `src/ui/real/tex/linen.webp` (linen: tray linings, index tabs, rope, burlap) | Rough Linen | https://polyhaven.com/a/rough_linen | colormass, Rico Cilliers | CC0 |
| `src/ui/real/tex/velvet.webp` (velvet: curtains, ribbons, the dressing room) | Velour Velvet | https://polyhaven.com/a/velour_velvet | colormass, Rico Cilliers | CC0 |
| `src/ui/real/tex/felt.webp` (felt and wool: tool tiles, the knitted frame, moss) | Knitted Fleece | https://polyhaven.com/a/knitted_fleece | colormass, Rico Cilliers | CC0 |
