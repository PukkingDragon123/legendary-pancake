"""furnA kit: the shared palette, materials and part helpers for Hoot Hollow's furniture (lowpix specs).

Units are game px (16 per block, like src/assets/*.ts `build()`), origin bottom-centre, facing +Z, Y up. The build
step (build.py) wraps the exported GLB in a root node scaled 1/16, so the model lands in world units like the old box
props. Wall items hang with their back on z = 0.

Look: "Moss & Moonlight" (docs/ART-STYLE.md). Calm, natural ramps hue-shifted from src/gfx/palette.ts, hand-painted
pixel detail (grain with knots and rubbed edges, cloth weave and stitching, tarnished brass, glaze, wax drips), soft
painted light (the game lights the scene too), a 1 px ink rim on edges that turn away from the light.
"""
from __future__ import annotations

import copy
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = "art/lowpix/items/_furnA/photos"   # relative to the repo root (builds run from there)
LOWPIX = os.environ.get("LOWPIX_SRC", "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/refs2/symmetrical-goggles")
if LOWPIX not in sys.path:
    sys.path.insert(0, LOWPIX)
from lowpix.palette import make_ramp  # noqa: E402

# ----------------------------------------------------------------------------------------------- palette (palette.ts)
P = dict(
    ink=0x2e2b24, ink2=0x4b463a, ink3=0x6f6856,
    paper=0xf4eedd, oat=0xeae0c8, linen=0xdccfb0, straw=0xc9b78d,
    woodPale=0xd8bf98, woodLight=0xbf9d74, wood=0x9c7a56, woodDark=0x6f553d, woodDeep=0x4a392b, bark=0x5b4a3c, barkDark=0x3d3229,
    sageLight=0xc4cfa3, sage=0xa7b788, moss=0x86a06a, fern=0x66844f, leaf=0x557343, pine=0x3f5a3b, forest=0x2c4030,
    mist=0xd3e0dc, sky=0xaec8cc, lake=0x86a9b0, dusk=0x617f8c, slate=0x46596a, night=0x27313f, deepNight=0x1b222d,
    lamp=0xf1d39a, honey=0xdcb072, ochre=0xc59a52, terracotta=0xc0866a, clay=0xa66c55,
    rose=0xd9aca4, blush=0xe8b4ae, berry=0x9e5f66, plum=0x6e5266,
    lilac=0xb4a9c9, lavender=0xd3cce0, frost=0xdfe9ea, snow=0xf5f7f2, ice=0xbcd6dc,
    pebble=0xb9b2a4, stone=0x908a7e, stoneDark=0x6a655c, brass=0xc8a764, brassDark=0x8e7440, iron=0x5c5a56,
    cream=0xf1e6cc, buff=0xd9bf93, tawny=0xa87652, russet=0x8a5a3c, umber=0x5e4130, soot=0x3a3029,
)


def hx(c):
    return "#%06x" % c


def mix(a, b, t):
    ch = lambda h, s: (h >> s) & 255
    m = lambda s: round(ch(a, s) + (ch(b, s) - ch(a, s)) * t)
    return (m(16) << 16) | (m(8) << 8) | m(0)


def ramp(base, steps=8, hue=16, sat=0.10, spread=0.82, bi=None):
    return make_ramp(hx(base) if isinstance(base, int) else base, steps, hue, sat, spread, bi)


# Every ramp an item may use. Darkest first. Shadows drift cool (slate), highlights warm (lamp).
RAMPS = {
    # woods
    "oak": ramp(P["wood"], 9, 14, 0.10, 0.68),
    "oakl": ramp(P["woodLight"], 9, 14, 0.10, 0.66),
    "pale": ramp(P["woodPale"], 8, 12, 0.08, 0.62),
    "walnut": ramp(P["woodDark"], 9, 16, 0.10, 0.72),
    "bark": ramp(P["bark"], 8, 16, 0.08, 0.75),
    "twig": ramp(mix(P["bark"], P["wood"], 0.55), 9, 16, 0.10, 0.72),
    # cloth and paper
    "linen": ramp(P["linen"], 8, 14, 0.08, 0.85),
    "paper": ramp(P["paper"], 7, 12, 0.06, 0.85, 4),
    "oat": ramp(P["oat"], 8, 12, 0.06, 0.85),
    "rose": ramp(P["rose"], 8, 18, 0.10, 0.85),
    "berry": ramp(P["berry"], 8, 18, 0.10, 0.85),
    "plum": ramp(P["plum"], 8, 18, 0.10, 0.85),
    "sage": ramp(P["sage"], 8, 16, 0.08, 0.85),
    "moss": ramp(P["moss"], 8, 16, 0.10, 0.85),
    "fern": ramp(P["fern"], 8, 18, 0.10, 0.85),
    "pine": ramp(P["pine"], 8, 18, 0.10, 0.85),
    "lake": ramp(P["lake"], 8, 16, 0.10, 0.85),
    "dusk": ramp(P["dusk"], 8, 16, 0.10, 0.85),
    "night": ramp(P["night"], 8, 14, 0.10, 0.9, 2),
    "mist": ramp(P["mist"], 7, 12, 0.06, 0.85),
    "honey": ramp(P["honey"], 8, 16, 0.10, 0.85),
    "ochre": ramp(P["ochre"], 8, 16, 0.10, 0.85),
    "terra": ramp(P["terracotta"], 8, 16, 0.10, 0.85),
    "clay": ramp(P["clay"], 8, 16, 0.10, 0.85),
    "lilac": ramp(P["lilac"], 8, 14, 0.08, 0.85),
    "cream": ramp(P["cream"], 8, 12, 0.06, 0.85, 5),
    "wax": ramp(mix(P["cream"], P["honey"], 0.3), 8, 10, 0.12, 0.8, 5),
    # hard materials
    "brass": ["#2f2412", "#4a3819", "#69501f", "#8c6b28", "#b08934", "#cba648", "#e0c26a", "#efdc9b", "#f8f0cf"],
    "verd": ramp(mix(P["sage"], P["lake"], 0.5), 5, 10, 0.04, 0.6),
    "iron": ramp(P["iron"], 8, 14, 0.06, 0.85),
    "stone": ramp(P["stone"], 8, 14, 0.06, 0.85),
    "pebble": ramp(P["pebble"], 8, 12, 0.06, 0.85),
    "soil": ramp(0x5a4432, 7, 14, 0.08, 0.8),
    "ink": ["#1c1a17", "#2e2b24", "#4b463a", "#6f6856"],
    # light: near-white at the core, used on glowing parts only
    "flame": ["#a8643c", "#d58a4a", "#e9ad5f", "#f4cd84", "#fbe5b0", "#fff6df"],
    "glow": ramp(P["lamp"], 7, 10, 0.06, 0.9, 2),
    "glowblue": ramp(mix(P["ice"], P["lake"], 0.45), 7, 12, 0.14, 0.9, 2),
}

# ----------------------------------------------------------------------------------------------- materials (styles)
RIM = {"light": 1, "dark": 1, "light_shift": 0.8, "dark_shift": -0.8, "threshold": 0.25, "outline": "dark", "outline_width": 1}

GRAIN_FACES = {  # which stripe axis gives long grain on which faces, per grain direction
    "x": [("y", ["front", "back"]), ("z", ["top", "bottom"])],
    "y": [("x", ["front", "back"]), ("z", ["left", "right"])],
    "z": [("y", ["left", "right"]), ("x", ["top", "bottom"])],
}


def wood(rmp="oak", tone=4.0, grain="x", knots=2, wear=0.45, photo=0.2, gloss=0.35, period=0.7, seed=0, figure=0.55):
    """Hand-painted wood: wavy grain lines, darker figure clusters, knots with a lit lip, rubbed pale edges."""
    layers = []
    for i, (ax, faces) in enumerate(GRAIN_FACES[grain]):
        layers.append({"id": f"grain{i}", "op": "stripes", "axis": ax, "period": period, "width": 0.3, "shift": -0.55,
                       "wobble": 0.8, "seed": seed + i, "faces": faces})
        layers.append({"id": f"grainb{i}", "op": "stripes", "axis": ax, "period": period * 2.7, "width": 0.22, "shift": -0.5,
                       "wobble": 1.4, "seed": seed + 7 + i, "faces": faces})
    layers += [
        {"id": "figure", "op": "noise", "scale": 2.2, "amount": figure, "seed": seed + 3},
        {"id": "photo", "op": "photo", "src": f"{PHOTOS}/oak_veneer_01", "scale": 14, "amount": photo, "ramps": [rmp]},
    ]
    if knots:
        layers.append({"id": "knots", "op": "spots", "count": knots, "radius": [0.35, 0.7], "stretch": _stretch(grain),
                       "ramp": rmp, "tone": 1.2, "bevel": {"highlight_shift": 1.4, "shadow_shift": -1.2}, "seed": seed + 5,
                       "faces": ["sides", "top"], "asymmetric": True})
    if wear:
        layers.append({"id": "wear", "op": "wear", "width": 1, "density": wear, "shift": 0.9, "scratches": 0.006})
    if gloss:
        layers.append({"id": "polish", "op": "gloss", "dash": True, "length": 3, "shift": 1.0, "density": gloss, "post": True})
    return {"ramp": rmp, "tone": tone, "rim": RIM, "layers": layers,
            "brush": {"flow": grain, "length": 4.0, "width": 0.6, "rough": 0.42, "textures": {rmp: "wood"}}}


def _stretch(grain):
    return {"x": [2.6, 1, 1], "y": [1, 2.6, 1], "z": [1, 1, 2.6]}[grain]


def painted_wood(rmp="sage", tone=4.2, under="oakl", grain="y", wear=0.35, seed=0):
    """Milk-painted wood: soft brushed paint over grain, chipped on the edges to the wood beneath."""
    layers = []
    for i, (ax, faces) in enumerate(GRAIN_FACES[grain]):
        layers.append({"id": f"grain{i}", "op": "stripes", "axis": ax, "period": 0.9, "width": 0.25, "shift": -0.45,
                       "wobble": 1.0, "seed": seed + i, "faces": faces})
    layers += [
        {"id": "brushy", "op": "noise", "scale": 1.2, "amount": 0.45, "seed": seed + 3},
        {"id": "photo", "op": "photo", "src": f"{PHOTOS}/wood_table_001", "scale": 16, "amount": 0.25, "ramps": [rmp]},
        {"id": "wear", "op": "wear", "width": 2, "density": wear, "ramp": under, "tone": 4.5, "scratches": 0.008},
    ]
    return {"ramp": rmp, "tone": tone, "rim": RIM, "layers": layers,
            "brush": {"flow": grain, "length": 2.5, "width": 0.6, "rough": 0.5, "textures": {rmp: "wood"}}}


def cloth(rmp="linen", tone=4.2, weave=0.55, photo="rough_linen", scale=7, stitch=None, seed=0, flow="horizontal"):
    """Woven cloth: a fine cross weave, soft fold clusters, a photo of real weave for relief."""
    layers = [
        {"id": "weave_a", "op": "stripes", "axis": "x", "period": 0.34, "width": 0.5, "shift": -0.35 * weave, "seed": seed},
        {"id": "weave_b", "op": "stripes", "axis": "y", "period": 0.34, "width": 0.5, "shift": 0.3 * weave, "seed": seed + 1, "faces": ["sides"]},
        {"id": "weave_c", "op": "stripes", "axis": "z", "period": 0.34, "width": 0.5, "shift": 0.3 * weave, "seed": seed + 1, "faces": ["top", "bottom"]},
        {"id": "folds", "op": "noise", "scale": 2.2, "amount": 0.7, "seed": seed + 2},
        {"id": "photo", "op": "photo", "src": f"{PHOTOS}/{photo}", "scale": scale, "amount": 0.55, "ramps": [rmp]},
    ]
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, light_shift=0.6, dark_shift=-0.8), "layers": layers,
            "brush": {"flow": flow, "length": 1.0, "width": 0.4, "rough": 0.4, "textures": {rmp: "cloth"}}}


def velvet(rmp="moss", tone=4.0, seed=0):
    """Plush velvet: deep nap clusters that catch the light on the crowns, crushed darker in the creases."""
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, light_shift=1.2, dark_shift=-1.0),
            "layers": [
                {"id": "nap", "op": "noise", "scale": 1.4, "amount": 0.6, "seed": seed},
                {"id": "crush", "op": "patches", "scale": 2.5, "threshold": 0.62, "shift": -0.8, "seed": seed + 1},
                {"id": "photo", "op": "photo", "src": f"{PHOTOS}/velour_velvet", "scale": 9, "amount": 0.6, "ramps": [rmp]},
                {"id": "crown", "op": "gloss", "dash": True, "length": 3, "shift": 0.9, "density": 0.35, "post": True},
            ],
            "brush": {"flow": "horizontal", "length": 1.0, "width": 0.4, "rough": 0.4, "textures": {rmp: "cloth"}}}


def brass(rmp="brass", tone=3.4, tarnish=0.74, seed=0):
    """Aged brass: crisp bands of reflected light (bright on the lit facets, dark olive on the turned-away ones),
    a warm polish dash on lit edges and verdigris tarnish in the low spots. No grain strokes: metal is clean."""
    return {"ramp": rmp, "tone": tone, "dither": 0.15, "rim": dict(RIM, light_shift=1.6, dark_shift=-1.2),
            "layers": [
                {"id": "under", "op": "gradient", "axis": "y", "amount": 0.8},
                {"id": "mottle", "op": "noise", "scale": 2.0, "amount": 0.35, "seed": seed},
                {"id": "band_hi", "op": "stripes", "axis": [1, 0.3, 1], "period": 2.6, "width": 0.22, "shift": 1.4, "wobble": 0.2, "seed": seed},
                {"id": "band_lo", "op": "stripes", "axis": [1, 0.3, 1], "period": 2.6, "width": 0.2, "phase": 1.1, "shift": -1.1, "seed": seed},
                {"id": "tarnish", "op": "patches", "scale": 0.9, "threshold": tarnish, "ramp": "verd", "tone": 2.4,
                 "faces": ["sides", "bottom"], "seed": seed + 1},
                {"id": "spec", "op": "fill", "shift": 1.4, "min_light": 0.5},
                {"id": "refl", "op": "fill", "shift": -1.0, "max_light": 0.05},
                {"id": "polish", "op": "gloss", "dash": True, "length": 2, "shift": 2.0, "density": 0.7, "post": True},
            ],
            "brush": {"off": True}}


def iron(rmp="iron", tone=4.0, seed=0):
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, light_shift=1.3),
            "layers": [{"id": "mottle", "op": "noise", "scale": 0.8, "amount": 0.6, "seed": seed},
                       {"id": "photo", "op": "photo", "src": f"{PHOTOS}/metal_plate_02", "scale": 8, "amount": 0.5, "ramps": [rmp]},
                       {"id": "polish", "op": "gloss", "dash": True, "length": 2, "shift": 1.2, "density": 0.4, "post": True}],
            "brush": {"flow": "long", "length": 1.6, "width": 0.4, "rough": 0.5, "textures": {rmp: "metal"}}}


def glaze(rmp="cream", tone=4.4, speck=True, seed=0, crackle=False):
    """Glazed ceramic: smooth with a wet highlight dash, a few kiln specks, pooled darker glaze low down."""
    layers = [
        {"id": "pool", "op": "gradient", "axis": "y", "amount": 0.8},
        {"id": "soft", "op": "noise", "scale": 2.4, "amount": 0.35, "seed": seed},
    ]
    if speck:
        layers.append({"id": "speck", "op": "spots", "count": 14, "radius": [0.1, 0.18], "shift": -1.6, "seed": seed + 1})
    if crackle:
        layers.append({"id": "crackle", "op": "cracks", "scale": 1.2, "width": 0.05, "threshold": 0.85, "shift": -0.7})
    layers.append({"id": "wet", "op": "gloss", "dash": True, "length": 3, "shift": 1.8, "density": 0.9, "post": True})
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, light_shift=1.2, dark_shift=-0.8), "layers": layers,
            "brush": {"flow": "horizontal", "length": 2.0, "width": 0.5, "rough": 0.35, "textures": {rmp: "liquid"}}}


def clay(rmp="terra", tone=4.2, seed=0):
    """Unglazed terracotta: dusty, chalky bloom on the rim, throwing rings."""
    return {"ramp": rmp, "tone": tone, "rim": RIM,
            "layers": [
                {"id": "rings", "op": "stripes", "axis": "y", "period": 0.8, "width": 0.25, "shift": -0.5, "wobble": 0.3, "seed": seed},
                {"id": "dust", "op": "noise", "scale": 1.3, "amount": 0.6, "seed": seed + 1},
                {"id": "photo", "op": "photo", "src": f"{PHOTOS}/clay_floor_001", "scale": 10, "amount": 0.5, "ramps": [rmp]},
                {"id": "bloom", "op": "patches", "scale": 1.2, "threshold": 0.7, "shift": 1.0, "seed": seed + 2},
                {"id": "chips", "op": "wear", "width": 1, "density": 0.25, "shift": -1.2},
            ],
            "brush": {"flow": "horizontal", "length": 2.0, "width": 0.5, "rough": 0.55, "textures": {rmp: "stone"}}}


def stone(rmp="stone", tone=4.2, moss=False, seed=0):
    layers = [
        {"id": "photo", "op": "photo", "src": f"{PHOTOS}/rock_face_03", "scale": 12, "amount": 0.9, "ramps": [rmp]},
        {"id": "clusters", "op": "noise", "scale": 1.5, "amount": 0.7, "seed": seed},
        {"id": "cracks", "op": "cracks", "scale": 1.0, "width": 0.06, "threshold": 0.82, "shift": -1.2, "bevel": True},
        {"id": "chips", "op": "wear", "width": 1, "density": 0.3, "shift": 1.0},
    ]
    if moss:
        layers.append({"id": "moss", "op": "drip", "ramp": "moss", "tone": 4, "depth": 0.6, "length": 1.4, "width": 0.6,
                       "bevel": {"shadow_ramp": "stone"}})
    return {"ramp": rmp, "tone": tone, "rim": RIM, "layers": layers,
            "brush": {"flow": "horizontal", "length": 2.0, "width": 0.6, "rough": 0.7, "textures": {rmp: "stone", "moss": "moss"}}}


def wax(rmp="cream", tone=4.6, seed=0):
    """Candle wax: soft, slightly translucent, warmer toward the top where the flame lights it."""
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, light_shift=0.8, dark_shift=-0.6),
            "layers": [{"id": "warm", "op": "gradient", "axis": "y", "amount": 1.4},
                       {"id": "soft", "op": "noise", "scale": 2.0, "amount": 0.4, "seed": seed}],
            "brush": {"flow": "vertical", "length": 1.4, "width": 0.4, "rough": 0.3, "textures": {rmp: "organic"}}}


def leafy(rmp="fern", tone=4.0, seed=0, veins=True):
    layers = [{"id": "tone", "op": "noise", "scale": 1.2, "amount": 0.8, "seed": seed},
              {"id": "tips", "op": "gradient", "axis": "path", "amount": 1.2}]
    if veins:
        layers.append({"id": "vein", "op": "band", "axis": "x", "from": -0.08, "to": 0.08, "shift": 1.1})
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, outline="none"), "layers": layers,
            "brush": {"flow": "long", "length": 1.6, "width": 0.4, "rough": 0.6, "textures": {rmp: "organic"}}}


def glow(rmp="glow", tone=3.0):
    """Light sources: flat and near-white at the core; the painted light barely touches them."""
    return {"ramp": rmp, "tone": tone, "light": 0.25, "rim": {"light": 1, "dark": 0, "light_shift": 0.6, "outline": "none"},
            "layers": [{"id": "core", "op": "gradient", "axis": "y", "amount": 0.8},
                       {"id": "soft", "op": "noise", "scale": 2.0, "amount": 0.3}],
            "brush": {"off": True}}


def soil(rmp="soil", tone=3.0):
    return {"ramp": rmp, "tone": tone, "rim": dict(RIM, outline="none"),
            "layers": [{"id": "crumbs", "op": "spots", "count": 30, "radius": [0.12, 0.3], "shift": 1.3, "seed": 2},
                       {"id": "dark", "op": "spots", "count": 20, "radius": [0.12, 0.25], "shift": -1.3, "seed": 3},
                       {"id": "clumps", "op": "noise", "scale": 0.8, "amount": 0.8}],
            "brush": {"flow": "horizontal", "length": 1.0, "width": 0.4, "rough": 0.8, "textures": {rmp: "stone"}}}


def flat(rmp, tone=3.0, light=1.0, outline="dark"):
    return {"ramp": rmp, "tone": tone, "light": light, "rim": dict(RIM, outline=outline), "layers": []}


# ----------------------------------------------------------------------------------------------- spec builder
def _rot(deg):
    rx, ry, rz = (math.radians(float(a)) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


UP = (-90, 0, 0)   # rotation that stands a prism (or a Z-running loft) upright: its front cap faces +Y


class Spec:
    """Collects parts in world coordinates (px) and writes a lowpix spec."""

    def __init__(self, id, name, density=6.0, tris=3000, colors=200, hero=(32, 24), light=None, grounded=True, desc=""):
        self.id, self.name, self.density = id, name, density
        self.parts, self.frames, self.styles, self.anims = [], {}, {}, {}
        self.tris, self.colors, self.hero, self.grounded, self.desc = tris, colors, hero, grounded, desc
        self.light = light or {"dir": [-0.5, 1.0, 0.7], "strength": 0.45, "gradient": 0.3, "ao": 0.55, "ao_height": 4.0}
        self.used_ramps = set()

    # -- styles
    def style(self, name, paint):
        self.styles[name] = paint
        return name

    # -- parts
    def add(self, id, shape, size=None, style=None, at=None, centre=None, rot=None, parent=None, paint=None, rel=None, off=None, **kw):
        """Add a part. `at` is the joint (world, default: `centre`), `centre` the geometry centre (world, default: the
        joint); `rot` is the local rotation in degrees relative to the parent. Or: `rel` = the joint in the parent's
        frame, `off` = the geometry centre in the part's own frame."""
        Rp, tp = self.frames[parent] if parent else (np.eye(3), np.zeros(3))
        if rel is not None:
            at = tp + Rp @ np.array(rel, float)
        if at is None:
            at = centre if centre is not None else (0, 0, 0)
        at = np.array(at, float)
        if off is not None:
            centre = at + (Rp @ _rot(rot or (0, 0, 0))) @ np.array(off, float)
        Rw = Rp @ _rot(rot or (0, 0, 0))
        d = {"id": id, "shape": shape}
        if parent:
            d["parent"] = parent
        if size is not None:
            d["size"] = [round(float(v), 4) for v in size]
        d["pivot"] = [round(float(v), 4) for v in Rp.T @ (at - tp)]
        if centre is not None:
            off = Rw.T @ (np.array(centre, float) - at)
            if np.abs(off).max() > 1e-9:
                d["offset"] = [round(float(v), 4) for v in off]
        if rot and any(rot):
            d["rotation"] = [float(v) for v in rot]
        if style:
            d["style"] = style
        if paint:
            d["paint"] = paint
        d.update(kw)
        self.parts.append(d)
        self.frames[id] = (Rw, at)
        return d

    def box(self, id, size, style, centre, rot=None, chamfer=None, **kw):
        if chamfer:
            kw["chamfer"] = chamfer
        return self.add(id, "box", size, style, centre=centre, rot=rot, **kw)

    def cyl(self, id, d, h, style, base, sides=8, top=1.0, bottom=1.0, depth=None, parent=None, angle=None, **kw):
        """An upright prism: diameter d (or [dx, dz]), height h, standing on `base` (world x, y, z)."""
        dx, dz = (d, d) if not isinstance(d, (list, tuple)) else d
        x, y, z = base
        extra = {"sides": sides}
        if top != 1.0:
            extra["front_scale"] = [top, top] if not isinstance(top, (list, tuple)) else list(top)
        if bottom != 1.0:
            extra["back_scale"] = [bottom, bottom] if not isinstance(bottom, (list, tuple)) else list(bottom)
        if angle is not None:
            extra["angle"] = angle
        extra.update(kw)
        return self.add(id, "prism", [dx, dz, h], style, at=(x, y, z), centre=(x, y + h / 2, z), rot=UP, parent=parent, **extra)

    def lathe(self, id, rings, style, base=(0, 0, 0), sides=10, round_=2.0, caps=(True, True), parent=None, **kw):
        """A vertical loft (vase, pot, candle, mushroom cap): rings = [(y, width) or (y, [w, d])] from the bottom up."""
        x, y0, z = base
        rr = [{"at": [0, float(y), 0], "size": (list(w) if isinstance(w, (list, tuple)) else float(w))} for y, w in rings]
        kw.setdefault("up", [0, 0, 1])
        kw.setdefault("subdiv", 0)   # Catmull-Rom would overshoot on unevenly spaced rings and flip the caps
        return self.add(id, "loft", None, style, at=(x, y0, z), parent=parent,
                        rings=rr, profile={"sides": sides, "round": round_}, caps=list(caps), **kw)

    def loft(self, id, rings, style, at=(0, 0, 0), sides=8, round_=2.6, caps=(True, True), subdiv=1, parent=None, rot=None, **kw):
        """A loft through rings given relative to `at`: [((x, y, z), size), ...] or dicts."""
        rr = []
        for r in rings:
            if isinstance(r, dict):
                rr.append(r)
            else:
                p, s = r[0], r[1]
                e = {"at": [float(v) for v in p], "size": (list(s) if isinstance(s, (list, tuple)) else float(s))}
                if len(r) > 2 and r[2]:
                    e["roll"] = r[2]
                rr.append(e)
        return self.add(id, "loft", None, style, at=at, parent=parent, rot=rot, rings=rr,
                        profile={"sides": sides, "round": round_}, caps=list(caps), subdiv=subdiv, **kw)

    def card(self, id, art, style, at=None, plane="xy", rot=None, parent=None, key=None, size=None, **kw):
        """A cut-out card. `size` [w, h] in px stretches the art; default: the art at the spec density."""
        paint = kw.pop("paint", None) or {}
        if key:
            paint["art_key"] = key
        return self.add(id, "card", size, style, at=at, rot=rot, parent=parent, plane=plane, art=art, paint=paint or None, **kw)

    def bone(self, id, at=None, parent=None, rot=None, rel=None):
        return self.add(id, "bone", None, None, at=at, parent=parent, rot=rot, rel=rel, paint={"ramp": "ink"})

    def anim(self, name, length, tracks, loop=True):
        self.anims[name] = {"length": length, "loop": loop, "tracks": tracks}

    # -- output
    def spec(self):
        used = set()
        blob = json.dumps({"s": self.styles, "p": self.parts})
        for k in RAMPS:
            if f'"{k}"' in blob or f'"{k}:' in blob:
                used.add(k)
        used.add("ink")
        ramps = {k: RAMPS[k] for k in RAMPS if k in used}
        textures = {}
        out = {
            "name": self.id,
            "description": self.desc or self.name,
            "author": "Hoot Hollow (furnA, lowpix spec)",
            "license": "CC0-1.0",
            "density": self.density,
            "grounded": self.grounded,
            "budget": {"tris": self.tris, "colors": self.colors},
            "light": self.light,
            "material": {"unlit": False, "roughness": 0.9},
            "render": {"background": "#27313f", "hero": list(self.hero), "shadow": 0.45},
            "palette": {"ramps": ramps},
            "brush": {"flow": "long", "length": 2.0, "width": 0.5, "rough": 0.55, "overshoot": 0.3, "textures": textures},
            "styles": self.styles,
            "parts": self.parts,
        }
        if self.anims:
            out["animations"] = self.anims
        return out

    def write(self, out_dir):
        path = os.path.join(out_dir, f"{self.id}.json")
        with open(path, "w") as fh:
            json.dump(self.spec(), fh, indent=1)
        return path


def stamp_rows(fn, w, h):
    """Make stamp art rows from fn(i, j) -> char ('.' = skip). i runs left to right, j top to bottom."""
    return ["".join(fn(i, j) for i in range(w)) for j in range(h)]


# ----------------------------------------------------------------------------------------------- shape helpers
def pillow(s, id, centre, w, h, d, style, axis="x", rot=None, sides=10, round_=1.9, puff=1.0, parent=None, **kw):
    """A stuffed pillow/cushion: a loft along its width whose end rings are thin seams (full depth, little height),
    puffing up toward the middle. w along `axis`, h up, d across."""
    seam = 0.22
    prof = [(-0.5, seam, 0.82), (-0.42, 0.72, 0.95), (-0.25, 0.95, 1.0), (0.0, 1.0, 1.0), (0.25, 0.95, 1.0), (0.42, 0.72, 0.95), (0.5, seam, 0.82)]
    rings = []
    for t, kh, kd in prof:
        p = [t * w, 0, 0] if axis == "x" else [0, 0, t * w]
        rings.append({"at": p, "size": [d * kd, h * (kh if puff else 1)]})
    return s.loft(id, rings, style, at=centre, sides=sides, round_=round_, rot=rot, parent=parent, **kw)


def torus(s, id, centre, radius, thick, style, n=16, sides=8, round_=2.0, rz=None, squash=1.0, parent=None, **kw):
    """A closed ring (nest rim, braided rug coil, tray lip): a loft around a horizontal circle.
    `thick` is [radial width, height]; `rz` an optional z radius (ovals)."""
    rz = radius if rz is None else rz
    w, h = thick if isinstance(thick, (list, tuple)) else (thick, thick * squash)
    rings = []
    for k in range(n + 1):
        a = 2 * math.pi * k / n
        rings.append({"at": [math.sin(a) * radius, 0, math.cos(a) * rz], "size": [w, h]})
    kw.setdefault("subdiv", 0)
    return s.loft(id, rings, style, at=centre, sides=sides, round_=round_, caps=(False, False), parent=parent, **kw)


def arc_points(r, a0, a1, n, plane="xy"):
    """Points on an arc (degrees, 0 = +Y up, 90 = +X) in the given plane."""
    pts = []
    for k in range(n):
        a = math.radians(a0 + (a1 - a0) * k / (n - 1))
        if plane == "xy":
            pts.append((math.sin(a) * r, math.cos(a) * r, 0))
        else:
            pts.append((math.sin(a) * r, 0, math.cos(a) * r))
    return pts


def grid_art(w, h, fn):
    """Card art from fn(x, y) with x, y in 0..1 (y = 0 at the top) -> char or '.'."""
    return ["".join(fn((i + 0.5) / w, (j + 0.5) / h) for i in range(w)) for j in range(h)]


def flame_art(w=7, h=12):
    """A candle flame: near-white core, gold body, a warm tip. Keys c core, y body, o edge, r tip."""
    def f(x, y):
        yy = 1 - y                       # 0 bottom .. 1 top
        half = 0.5 * math.sin(min(1, yy * 1.25) * math.pi) ** 0.8 * (1 - yy * 0.35)
        if yy < 0.06:
            half = 0.22
        dx = abs(x - 0.5)
        if dx > half:
            return "."
        k = dx / max(half, 1e-6)
        if yy > 0.8:
            return "r" if k < 0.8 else "."
        if k < 0.38 and 0.12 < yy < 0.6:
            return "c"
        if k < 0.7:
            return "y"
        return "o"
    return grid_art(w, h, f)


def frond_art(w, h, lean=0.0, seed=1, leaflets=9):
    """A fern frond seen flat: a lance-shaped blade with a serrated edge, a midrib and slanted leaflet lobes.
    Keys: s midrib, l leaf, d lobe shadow, h lobe highlight. Row 0 is the tip."""
    def f(x, y):
        t = y                                                  # 0 tip .. 1 base
        half = 0.5 * math.sin(min(1.0, t * 1.12) * math.pi * 0.9) ** 0.8
        lobe = (t * leaflets * 1.6 + abs(x - 0.5) * 2.2) % 1.0
        half *= 0.42 + 0.58 * math.sin(lobe * math.pi)        # deep lobes: each leaflet bulges out
        dx = abs(x - 0.5)
        if dx > half or t > 0.97:
            return "s" if dx < 0.04 and t > 0.9 else "."
        if dx < 0.035:
            return "s"
        if lobe < 0.16:
            return "d"
        if lobe > 0.8 and x < 0.5:
            return "h"
        return "l"
    return grid_art(w, h, f)


def frond_art_old(w, h, lean=0.0, seed=1, leaflets=9):
    rng = np.random.default_rng(seed)
    grid = [["."] * w for _ in range(h)]
    cx = (w - 1) / 2
    for j in range(h):
        t = j / (h - 1)                                       # 0 tip .. 1 base
        x = cx + lean * (1 - t) ** 2 * w * 0.3
        xi = int(round(x))
        if 0 <= xi < w:
            grid[j][xi] = "s"
    for k in range(leaflets):
        t = 0.1 + 0.85 * k / (leaflets - 1)                  # tip .. base
        j0 = int(t * (h - 1))
        L = (0.12 + 0.36 * math.sin(min(1, t * 1.15) * math.pi * 0.62)) * w
        for side in (-1, 1):
            for q in range(int(L)):
                u = q / max(L, 1)
                jj = j0 - int(u * L * 0.45)
                x = cx + lean * (1 - j0 / (h - 1)) ** 2 * w * 0.3 + side * (q + 1)
                xi = int(round(x))
                thick = max(1, int(round((1 - u) * 2.8 + 0.7)))
                for d in range(thick):
                    yy = jj + d
                    if 0 <= xi < w and 0 <= yy < h and grid[yy][xi] == ".":
                        grid[yy][xi] = "h" if d == 0 and side < 0 else ("d" if d == thick - 1 else "l")
    return ["".join(r) for r in grid]


def lace_art(cols, rows, holes=True, scallop=3.0, half=True):
    """A crochet doily as card art: a (half) disc with a scalloped edge and rings of little holes.
    Keys: w lit thread, l thread, s shadowed thread."""
    out = []
    cx, cy = (cols - 1) / 2, 0 if half else (rows - 1) / 2
    R = min(cols / 2, rows if half else rows / 2) - 0.5
    for j in range(rows):
        row = ""
        for i in range(cols):
            dx, dy = i - cx, j - cy
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            edge = R - (1 - abs(math.cos(a * scallop * R / 6))) * 1.6
            if r > edge:
                row += "."
                continue
            ring = r / R
            ch = "l"
            if holes:
                if abs(ring - 0.78) < 0.05 and int((a * R * 0.78) / 1.6) % 2 == 0:
                    ch = "."
                elif abs(ring - 0.5) < 0.06 and int((a * R * 0.5) / 1.4) % 2 == 0:
                    ch = "."
                elif ring < 0.16:
                    ch = "w"
                elif abs(ring - 0.92) < 0.06:
                    ch = "s"
            if ch == "l" and (i + j) % 5 == 0:
                ch = "w"
            row += ch
        out.append(row)
    return out
