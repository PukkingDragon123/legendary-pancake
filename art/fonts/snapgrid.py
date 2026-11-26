# Put a pixel font exactly on its pixel grid: rescale it to 128 font units per font pixel (unitsPerEm = em_px * 128)
# and snap every outline point, advance, side bearing and vertical metric to whole font pixels. The fonts as supplied
# use 2048 units per em, so a pixel is a fraction of a unit (2048 / 15 = 136.53...) and the rounded advances drift a
# little along a line: after a dozen letters the glyphs land between device pixels and blur. Snapped, every letter
# starts on a whole pixel. Writes WOFF2.
# usage: python3 -I snapgrid.py <in.ttf> <em_px> <out.woff2> [family name]
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem

src, em, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
fam = sys.argv[4] if len(sys.argv) > 4 else None
P = 128
t = TTFont(src)
old = t['head'].unitsPerEm
scale_upem(t, em * P)
snap = lambda v: int(round(v / P)) * P
gl = t['glyf']
for name in gl.keys():
    g = gl[name]
    if g.isComposite() or g.numberOfContours <= 0:
        continue
    for i, (x, y) in enumerate(g.coordinates):
        g.coordinates[i] = (snap(x), snap(y))
    g.recalcBounds(gl)
hm = t['hmtx']
for name, (adv, lsb) in list(hm.metrics.items()):
    g = gl[name]
    hm.metrics[name] = (snap(adv), g.xMin if hasattr(g, 'xMin') and g.numberOfContours > 0 else snap(lsb))
hh = t['hhea']
hh.ascent, hh.descent, hh.lineGap = snap(hh.ascent), snap(hh.descent), 0
os2 = t['OS/2']
os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = snap(os2.sTypoAscender), snap(os2.sTypoDescender), 0
os2.usWinAscent, os2.usWinDescent = snap(os2.usWinAscent), snap(os2.usWinDescent)
if fam:
    for rec in t['name'].names:
        if rec.nameID in (1, 4, 16):
            rec.string = fam
        if rec.nameID == 6:
            rec.string = fam.replace(' ', '')
t.flavor = 'woff2'
t.save(out)
print(src, old, '->', em * P)
