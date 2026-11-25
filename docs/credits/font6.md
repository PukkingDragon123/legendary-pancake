# Credits: the game's typeface (builder font6)

- **Alagard** - Hewett Tsoi (Pix3M), https://www.dafont.com/alagard.font, "Give credit if used."
  A 16 px pixel font, supplied by the project owner. It is now the game's one typeface: every screen, button,
  sign, tag, toast, the book, the globe, the shop's signs and slate, the interview's forms, speech, name plate,
  certificates and props, the house signs and moving-box labels. Shipped unmodified as
  `src/assets/fonts/alagard.ttf`.

Glyphs Alagard does not have (typographic quotes and dashes, the middle dot, the ellipsis, accents) are turned into
their plain ASCII twins before they are drawn (`src/ui/font.ts`). Anything else falls back to the TBME Goofy pixel
face (made from Chewy by Font Diner, Apache 2.0, see `src/assets/fonts/FONTS_LICENSE.txt`). The pretend phone's
tiny system text (app labels, notifications) keeps m5x7 by Daniel Linssen (managore.itch.io), credited in
`intro4.md`. The m6x11plus and Galmuri11 faces are no longer used and were removed.
