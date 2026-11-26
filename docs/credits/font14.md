# Credits: the game's typefaces (builder font14)

Both faces were supplied by the project owner (pixel fonts by SpicyGame Studios; from their font name tables:
"Copyright SpicyGame Studios 2020", https://spicygame.itch.io/fonts, https://pixel-forge.com, licence Creative
Commons Zero v1.0 Universal, https://creativecommons.org/public-domain/cc0/).

- **Quest Square** (SpicyGame Studios, CC0): the body face, every word of copy, buttons, counters, Pip's and
  Barnaby's dialogue, the book, the globe, the interview's forms and props, the pretend phone. Shipped as
  `src/assets/fonts/quest-square.woff2`.
- **Retro Sans** (SpicyGame Studios, CC0): the display face, titles, signs, names, the big clock numbers, the rubber
  stamp. Shipped as `src/assets/fonts/retro-sans.woff2`, loaded with size-adjust 17/15 so both faces share one
  15 px pixel grid.

Modified only to sit exactly on their pixel grids: rescaled to 128 font units per font pixel with every point,
advance and vertical metric snapped to whole font pixels (`art/fonts/snapgrid.py`), so letters never drift between
device pixels along a line. The glyph designs are unchanged. The handful of characters neither face draws (stars,
the numero sign, fractions) are mapped to near twins by `textSafe` in `src/ui/font.ts`.
