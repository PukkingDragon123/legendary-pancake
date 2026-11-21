"""furnB item kit: write lowpix specs for Hoot Hollow's furniture from Python.

Units are game px (16 px = 1 block), y up, the model faces +z, origin at the bottom centre (the same frame as each
item's old `build()`), so footprints and anchors line up. make.py scales the GLB to world units (1/16).

Everything is painted from the calm "Moss & Moonlight" palette (src/gfx/palette.ts): hue-shifted ramps that lean
slate in the shadows and lamp-gold in the lights. Materials are lowpix styles with layered hand-painted detail:
wood grain, knots and rubbed edges; cloth weave, seams and tufts; knit, wicker, glaze, brass, glass, leaves.
"""
from __future__ import annotations

import math
import random

# ------------------------------------------------------------------ palette (mirrors src/gfx/palette.ts)
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
    eye=0x231f1b,
)


def hx(c: int) -> str:
    return "#%06x" % (c & 0xFFFFFF)


def shade(c: int, f: float) -> int:
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    return (min(255, round(r * f)) << 16) | (min(255, round(g * f)) << 8) | min(255, round(b * f))


def mixc(a: int, b: int, t: float) -> int:
    ch = lambda h, s: (h >> s) & 255
    m = lambda s: round(ch(a, s) + (ch(b, s) - ch(a, s)) * t)
    return (m(16) << 16) | (m(8) << 8) | m(0)


def shadow(c: int, k: float = 0.3) -> int:
    return mixc(shade(c, 1 - k * 0.6), P["slate"], k * 0.35)


def light(c: int, k: float = 0.3) -> int:
    return mixc(shade(c, 1 + k * 0.35), P["lamp"], k * 0.3)


def col(c) -> int:
    if isinstance(c, str):
        return P[c] if c in P else int(c.lstrip("#"), 16)
    return int(c)


def make_ramp(base, n: int = 7, lo: float = 1.0, hi: float = 0.9, at: int | None = None) -> list[str]:
    """Darkest first. `at` is the base colour's index (default: a little below the middle)."""
    c = col(base)
    at = (n - 1) // 2 if at is None else at
    out = []
    for i in range(n):
        if i < at:
            out.append(hx(shadow(c, lo * (at - i) / at)))
        elif i == at:
            out.append(hx(c))
        else:
            out.append(hx(light(c, hi * (i - at) / max(1, n - 1 - at))))
    return out


# ------------------------------------------------------------------ spec builder
class Item:
    """Collects ramps, styles and parts and returns a lowpix spec dict."""

    def __init__(self, iid: str, name: str, density: float = 3.0, desc: str = "", tris: int = 3000, hero=(-34, 24)):
        self.id, self.name, self.density, self.desc = iid, name, density, desc
        self.ramps: dict[str, list[str]] = {}
        self.styles: dict[str, dict] = {}
        self.parts: list[dict] = []
        self.anims: dict[str, dict] = {}
        self._ids: dict[str, int] = {}
        self.tris = tris
        self.hero = hero
        self.light = {"dir": [-0.5, 1.0, 0.62], "strength": 0.75, "gradient": 0.35, "ao": 1.1, "ao_height": 3.0}

    # ---- naming
    def uid(self, base: str) -> str:
        n = self._ids.get(base, 0)
        self._ids[base] = n + 1
        return base if n == 0 else f"{base}{n}"

    # ---- palette
    def ramp(self, name: str, base, n: int = 7, lo: float = 1.0, hi: float = 0.9, at=None) -> str:
        if name not in self.ramps:
            self.ramps[name] = make_ramp(base, n, lo, hi, at)
        return name

    def ramp_list(self, name: str, colours) -> str:
        if name not in self.ramps:
            self.ramps[name] = [hx(col(c)) for c in colours]
        return name

    def style(self, name: str, d: dict) -> str:
        if name not in self.styles:
            self.styles[name] = d
        return name

    # ---- parts
    def add(self, part: dict) -> str:
        part["id"] = self.uid(part["id"])
        self.parts.append(part)
        return part["id"]

    def box(self, pid, c, s, st, rot=None, parent=None, ch=None, hide=None, paint=None, pivot=None, **kw) -> str:
        """A box centred at c (px) of size s. With `pivot`, it rotates about that point instead."""
        p = {"id": pid, "shape": "box", "size": list(map(float, s)), "style": st}
        if pivot is not None:
            p["pivot"] = list(map(float, pivot))
            p["offset"] = [float(c[i] - pivot[i]) for i in range(3)]
        else:
            p["pivot"] = list(map(float, c))
        if rot:
            p["rotation"] = list(map(float, rot))
        if parent:
            p["parent"] = parent
        if ch:
            p["chamfer"] = float(ch)
        if hide:
            p["hide"] = list(hide)
        if paint:
            p["paint"] = paint
        p.update(kw)
        return self.add(p)

    def taper(self, pid, c, s, st, front=None, back=None, fshift=None, bshift=None, rot=None, parent=None, pivot=None, paint=None, **kw) -> str:
        p = {"id": pid, "shape": "taper", "size": list(map(float, s)), "style": st}
        if pivot is not None:
            p["pivot"] = list(map(float, pivot))
            p["offset"] = [float(c[i] - pivot[i]) for i in range(3)]
        else:
            p["pivot"] = list(map(float, c))
        if front is not None:
            p["front_scale"] = list(front)
        if back is not None:
            p["back_scale"] = list(back)
        if fshift is not None:
            p["front_shift"] = list(fshift)
        if bshift is not None:
            p["back_shift"] = list(bshift)
        if rot:
            p["rotation"] = list(map(float, rot))
        if parent:
            p["parent"] = parent
        if paint:
            p["paint"] = paint
        p.update(kw)
        return self.add(p)

    def cyl(self, pid, c, r, h, st, sides=8, axis="y", rot=None, rz=None, top=None, parent=None, paint=None, angle=None, **kw) -> str:
        """An upright (axis y) prism of radius r and height h, standing on c (c is its bottom centre).
        axis 'x'/'z': lying along that axis, centred on c. `top` scales the far end (a cone)."""
        rz = r if rz is None else rz
        p = {"id": pid, "shape": "prism", "sides": int(sides), "size": [2.0 * r, 2.0 * rz, float(h)], "style": st}
        if axis == "y":
            p["pivot"] = [float(c[0]), float(c[1] + h / 2), float(c[2])]
            p["rotation"] = [-90.0, 0.0, 0.0]
            if rot:
                p["rotation"] = [-90.0 + rot[0], rot[1], rot[2]]
        elif axis == "x":
            p["pivot"] = list(map(float, c))
            p["rotation"] = [0.0, 90.0, 0.0]
        else:
            p["pivot"] = list(map(float, c))
            if rot:
                p["rotation"] = list(map(float, rot))
        if top is not None:
            p["front_scale"] = [top, top] if isinstance(top, (int, float)) else list(top)
        if angle is not None:
            p["angle"] = float(angle)
        if parent:
            p["parent"] = parent
        if paint:
            p["paint"] = paint
        p.update(kw)
        return self.add(p)

    def loft(self, pid, rings, st, sides=8, round_=2.0, caps=(True, True), subdiv=1, pivot=(0, 0, 0), rot=None, parent=None, paint=None, up=None, angle=None, **kw) -> str:
        """rings: [(x, y, z, size)] with size a number or (w, h), optional 5th item shift (dx, dy)."""
        rr = []
        for r in rings:
            d = {"at": [float(r[0]), float(r[1]), float(r[2])], "size": r[3] if isinstance(r[3], (int, float)) else list(r[3])}
            if len(r) > 4 and r[4] is not None:
                d["shift"] = list(r[4])
            if len(r) > 5 and r[5] is not None:
                d["roll"] = float(r[5])
            rr.append(d)
        prof = {"sides": int(sides), "round": float(round_)}
        if angle is not None:
            prof["angle"] = float(angle)
        # Catmull-Rom rings overshoot (and even run backwards) when ring spacing is very uneven: keep those crisp
        segs = [math.dist(rr[i]["at"], rr[i + 1]["at"]) for i in range(len(rr) - 1)]
        if subdiv and segs and min(segs) > 0 and max(segs) / min(segs) > 2.5:
            subdiv = 0
        p = {"id": pid, "shape": "loft", "rings": rr, "profile": prof, "caps": list(caps), "subdiv": int(subdiv),
             "pivot": list(map(float, pivot)), "style": st}
        if up is not None:
            p["up"] = list(up)
        if rot:
            p["rotation"] = list(map(float, rot))
        if parent:
            p["parent"] = parent
        if paint:
            p["paint"] = paint
        p.update(kw)
        return self.add(p)

    def card(self, pid, c, st, art=None, size=None, plane="xy", rot=None, parent=None, key=None, pivot=None, paint=None, **kw) -> str:
        p = {"id": pid, "shape": "card", "plane": plane, "style": st}
        if art is not None:
            p["art"] = art
        if size is not None:
            p["size"] = list(map(float, size))
        if pivot is not None:
            p["pivot"] = list(map(float, pivot))
            p["offset"] = [float(c[i] - pivot[i]) for i in range(3)]
        else:
            p["pivot"] = list(map(float, c))
        if rot:
            p["rotation"] = list(map(float, rot))
        if parent:
            p["parent"] = parent
        pt = dict(paint or {})
        if key:
            pt["art_key"] = key
        if pt:
            p["paint"] = pt
        p.update(kw)
        return self.add(p)

    def bone(self, pid, at, rot=None, parent=None) -> str:
        p = {"id": pid, "shape": "bone", "pivot": list(map(float, at))}
        if rot:
            p["rotation"] = list(map(float, rot))
        if parent:
            p["parent"] = parent
        return self.add(p)

    def anim(self, name: str, length: float, tracks: list[dict]):
        self.anims[name] = {"length": length, "loop": True, "tracks": tracks}

    # ---- output
    def spec(self) -> dict:
        first = next(iter(self.ramps), None)
        for p in self.parts:  # joints have no surface, but lint wants every part to name a ramp
            if p["shape"] == "bone" and first:
                p.setdefault("paint", {"ramp": first})
        textures = {}
        for rn in self.ramps:
            for pref, kind in TEXTURE_BY_PREFIX:
                if rn.startswith(pref):
                    textures[rn] = kind
                    break
        s = {
            "name": self.id,
            "description": self.desc or self.name,
            "author": "Hoot Hollow (furnB)",
            "license": "CC0-1.0",
            "density": self.density,
            "budget": {"tris": self.tris, "colors": 400},
            "light": self.light,
            "material": {"unlit": False, "roughness": 0.88},
            "brush": {"flow": "long", "length": 1.5, "width": 0.4, "rough": 0.55, "overshoot": 0.3, "textures": textures},
            "render": {"background": "#2a3330", "hero": list(self.hero), "shadow": 0.45},
            "palette": {"ramps": self.ramps},
            "styles": self.styles,
            "parts": self.parts,
        }
        if self.anims:
            s["animations"] = self.anims
        return s


TEXTURE_BY_PREFIX = [
    ("wd_", "wood"), ("pw_", "wood"), ("cl_", "cloth"), ("kn_", "cloth"), ("wk_", "wood"), ("br_", "metal"), ("ir_", "metal"),
    ("st_", "stone"), ("lf_", "organic"), ("ms_", "moss"), ("fl_", "fur"), ("cer_", "none"), ("gl_", "none"), ("so_", "stone"),
    ("bk_", "wood"), ("pa_", "none"), ("wx_", "none"), ("fm_", "none"), ("ru_", "cloth"),
]

# ------------------------------------------------------------------ materials
GRAIN_FACES = {  # grain axis -> [(faces, stripe axis)], plus the end-grain faces
    "x": ([(["front", "back"], "y"), (["top", "bottom"], "z")], ["left", "right"]),
    "y": ([(["front", "back"], "x"), (["left", "right"], "z")], ["top", "bottom"]),
    "z": ([(["left", "right"], "y"), (["top", "bottom"], "x")], ["front", "back"]),
}

WOODS = {  # name -> base colour
    "oak": P["wood"], "light": P["woodLight"], "pale": P["woodPale"], "dark": P["woodDark"], "deep": P["woodDeep"],
    "walnut": 0x6a4b36, "cherry": 0x8e5c45, "birch": 0xd4c09a, "ash": 0xbfa983, "pine": 0xc4a272, "rose": 0x7e4f42,
    "bark": P["bark"],
}


def wood(it: Item, kind: str = "oak", grain: str = "x", tone: float | None = None, knots: int = 3, polish: bool = True,
         worn: bool = True, period: float = 1.1, base=None, key: str | None = None) -> str:
    """Hand-painted wood: wobbling grain lines on the long faces, end grain on the ends, knots with a bevel, rubbed
    lighter edges, a little bark-photo fibre and short polish dashes. Grain runs along `grain` (x, y, z or 'long')."""
    rn = it.ramp(f"wd_{kind}", base if base is not None else WOODS.get(kind, P["wood"]), n=8, lo=1.05, hi=0.95, at=4)
    name = key or f"wood_{kind}_{grain}" + (f"_{tone}" if tone is not None else "")
    layers = [
        {"id": "figure", "op": "noise", "scale": 5.0, "amount": 0.35},
        {"id": "fibre", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 18.0, "amount": 0.18, "ramps": [rn]},
    ]
    if grain in GRAIN_FACES:
        long_faces, ends = GRAIN_FACES[grain]
        for i, (faces, ax) in enumerate(long_faces):
            layers.append({"id": f"grain{i}", "op": "stripes", "axis": ax, "period": period, "width": 0.3, "shift": -0.75,
                           "wobble": 0.55, "wobble_scale": 5.0, "faces": faces})
            layers.append({"id": f"late{i}", "op": "stripes", "axis": ax, "period": period * 3.7, "width": 0.18, "shift": 0.55,
                           "wobble": 0.9, "wobble_scale": 7.0, "faces": faces})
        layers.append({"id": "endgrain", "op": "fill", "shift": -0.55, "faces": ends})
        layers.append({"id": "endrings", "op": "noise", "scale": 0.9, "amount": 0.5, "faces": ends})
        stretch = {"x": [3, 1, 1], "y": [1, 3, 1], "z": [1, 1, 3]}[grain]
    else:  # round parts (prisms / lofts) whose long axis is local x / y / z: rx, ry, rz
        ax = {"rx": [0, 1, 0.6], "ry": [1, 0, 0.6], "rz": [1, 0.6, 0]}.get(grain, [1, 0.6, 0])
        layers.append({"id": "grain0", "op": "stripes", "axis": ax, "period": period, "width": 0.3, "shift": -0.7,
                       "wobble": 0.55, "wobble_scale": 5.0, "faces": ["sides"]})
        layers.append({"id": "endgrain", "op": "fill", "shift": -0.5, "faces": ["caps"]})
        stretch = {"rx": [3, 1, 1], "ry": [1, 3, 1], "rz": [1, 1, 3]}.get(grain, [1, 1, 3])
    if knots:
        layers.append({"id": "knots", "op": "spots", "count": knots, "radius": [0.45, 0.8], "stretch": stretch,
                       "shift": -1.8, "ring": 0.55, "centre_shift": -0.6, "min_gap": 3, "faces": ["-bottom"]})
    if worn:
        layers.append({"id": "rubbed", "op": "wear", "width": 2, "density": 0.32, "shift": 0.9})
    if polish:
        layers.append({"id": "polish", "op": "gloss", "dash": True, "length": 3, "shift": 1.1, "density": 0.35, "post": True})
    flow = grain if grain in ("x", "y", "z") else "long"
    st = {"ramp": rn, "tone": 4.0 if tone is None else tone, "rim": {"light_shift": 1.0, "dark_shift": -1.1},
          "brush": {"flow": flow, "length": 2.6, "rough": 0.4}, "layers": layers}
    return it.style(name, st)


def painted(it: Item, key: str, paint_base, under: str = "oak", grain: str = "y", chips: float = 0.22, tone=3.6) -> str:
    """Chalky furniture paint over wood: soft brush marks with the grain, chipped edges that show the wood."""
    rn = it.ramp(f"pw_{key}", paint_base, n=7, lo=0.9, hi=0.8, at=3)
    wr = it.ramp(f"wd_{under}", WOODS.get(under, P["wood"]), n=8, lo=1.05, hi=0.95, at=4)
    ax = {"x": "y", "y": "x", "z": "y"}.get(grain, "x")
    layers = [
        {"id": "mottle", "op": "noise", "scale": 4.0, "amount": 0.4},
        {"id": "strokes", "op": "stripes", "axis": ax, "period": 1.6, "width": 0.25, "shift": -0.35, "wobble": 0.7, "wobble_scale": 6.0, "faces": ["sides"]},
        {"id": "fibre", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 16.0, "amount": 0.18, "ramps": [rn]},
        {"id": "chips", "op": "wear", "width": 2, "density": chips, "scratches": 0.004, "ramp": wr, "tone": 3.2},
        {"id": "grime", "op": "patches", "scale": 3.0, "threshold": 0.7, "shift": -0.45, "faces": ["sides"]},
    ]
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.9, "dark_shift": -1.0},
          "brush": {"flow": grain if grain in ("x", "y", "z") else "long", "length": 2.0, "rough": 0.45}, "layers": layers}
    return it.style(f"paint_{key}_{grain}", st)


def fabric(it: Item, key: str, base, tone=3.4, weave: bool = True, tufts: list | None = None, nap: str = "horizontal",
           piping: bool = True, n=7, faded: bool = True) -> str:
    """Upholstery cloth: a soft weave, slight fading on the tops, piped edges and optional tuft buttons."""
    rn = it.ramp(f"cl_{key}", base, n=n, lo=0.95, hi=0.85, at=(n - 1) // 2)
    layers = [{"id": "mottle", "op": "noise", "scale": 4.0, "amount": 0.4}]
    if weave:
        layers += [
            {"id": "warp", "op": "stripes", "axis": [1, 0, 0.3], "period": 1.0, "width": 0.34, "shift": -0.22},
            {"id": "nub", "op": "spots", "count": 10, "radius": [0.3, 0.45], "shift": 0.5, "roughness": 0.1},
        ]
    if faded:
        layers.append({"id": "sunfade", "op": "patches", "scale": 3.5, "threshold": 0.62, "shift": 0.5, "faces": ["up"]})
    if tufts:
        layers.append({"id": "tufts", "op": "spots", "centers": tufts, "shift": -1.6, "roughness": 0.1,
                       "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -0.6, "highlight_shift": 1.6}})
    rim = {"light_shift": 1.1 if piping else 0.6, "dark_shift": -1.2 if piping else -0.7, "light": 1, "dark": 1}
    st = {"ramp": rn, "tone": tone, "rim": rim, "brush": {"flow": nap, "length": 1.4, "rough": 0.5}, "layers": layers}
    return it.style(f"fab_{key}", st)


def soft(it: Item, key: str, base, tone=3.4, n=7, pattern: list | None = None, flow="path") -> str:
    """Cloth for lofts (cushions, pillows, plush): no weave stripes in loft space, a gentle nap and the given layers."""
    rn = it.ramp(f"cl_{key}", base, n=n, lo=0.95, hi=0.85, at=(n - 1) // 2)
    layers = [{"id": "mottle", "op": "noise", "scale": 2.5, "amount": 0.4}]
    layers += pattern or []
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.7, "dark_shift": -0.8}, "brush": {"flow": flow, "length": 1.4, "rough": 0.5}, "layers": layers}
    return it.style(f"soft_{key}", st)


def knit(it: Item, key: str, base, tone=3.4, stripe=None, every=4.0) -> str:
    """Chunky knit: rows of little V stitches (round scales) with an optional coloured stripe."""
    rn = it.ramp(f"kn_{key}", base, n=7, lo=0.9, hi=0.85)
    layers = [{"id": "stitches", "op": "scales", "along": "x", "size": [1.0, 1.0], "shape": "round", "gradient": 1.1, "rim": -0.9, "shadow": -1.0, "jitter": 0.25}]
    if stripe is not None:
        sr = it.ramp(f"kn_{key}_s", stripe, n=7, lo=0.9, hi=0.85)
        layers.append({"id": "stripe", "op": "stripes", "axis": "y", "period": every, "width": 0.3, "ramp": sr, "tone": 3.4, "faces": ["sides"]})
        layers.append({"id": "stripe_t", "op": "stripes", "axis": "z", "period": every, "width": 0.3, "ramp": sr, "tone": 3.6, "faces": ["top"]})
        layers.append({"id": "stitches2", "op": "scales", "along": "x", "size": [1.0, 1.0], "shape": "round", "gradient": 1.1, "rim": -0.9, "shadow": -1.0, "jitter": 0.25})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.6, "dark_shift": -0.9}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"knit_{key}", st)


def wicker(it: Item, key: str = "wicker", base=0xc49a62, tone=3.6, size=(1.4, 1.0)) -> str:
    """Woven willow: square staggered weave plates with a lit top edge and dark gaps."""
    rn = it.ramp(f"wk_{key}", base, n=8, lo=1.0, hi=0.9, at=4)
    layers = [
        {"id": "weave", "op": "scales", "along": "x", "size": list(size), "shape": "square", "gap": 0.34, "gradient": 1.4, "highlight": 0.9, "shadow": -2.2, "jitter": 0.55},
        {"id": "strands", "op": "stripes", "axis": "y", "period": 0.5, "width": 0.3, "shift": -0.3},
    ]
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.9, "dark_shift": -1.1}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"wicker_{key}", st)


def metal(it: Item, key: str = "brass", base=None, tone=4.0, tarnish: bool = True, polish: float = 0.5) -> str:
    base = base if base is not None else {"brass": P["brass"], "gold": 0xd4b36a, "iron": P["iron"], "pewter": 0x9a988e, "copper": 0xb57a5a}.get(key, P["brass"])
    rn = it.ramp(f"br_{key}" if key != "iron" else "ir_iron", base, n=8, lo=1.1, hi=1.0, at=4)
    layers = [{"id": "under", "op": "gradient", "axis": "y", "amount": 0.6}, {"id": "mottle", "op": "noise", "scale": 1.6, "amount": 0.55}]
    if tarnish:
        tr = it.ramp("br_verdigris" if key != "iron" else "ir_rust", 0x6f8a78 if key != "iron" else 0x8a5a44, n=4, lo=0.6, hi=0.5)
        layers.append({"id": "tarnish", "op": "patches", "scale": 1.2, "threshold": 0.74, "ramp": tr, "tone": 1.6, "faces": ["sides", "bottom", "-up"]})
    layers.append({"id": "shine", "op": "gloss", "dash": True, "length": 2, "shift": 1.6, "density": polish, "post": True})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 1.5, "dark_shift": -1.3}, "brush": {"flow": "long", "length": 1.2, "rough": 0.4}, "layers": layers}
    return it.style(f"metal_{key}", st)


def glaze(it: Item, key: str, base, tone=3.6, band=None, bands=(), dots=None, drip=None) -> str:
    """Glazed ceramic: smooth with a pooled darker foot, crackle, a wet highlight and optional bands or dots."""
    rn = it.ramp(f"cer_{key}", base, n=7, lo=0.95, hi=0.95)
    layers = [{"id": "pool", "op": "gradient", "axis": "y", "amount": 0.8}, {"id": "mottle", "op": "noise", "scale": 2.0, "amount": 0.3},
              {"id": "crackle", "op": "cracks", "scale": 2.4, "width": 0.02, "threshold": 0.5, "shift": -0.6}]
    if band is not None:
        br = it.ramp(f"cer_{key}_b", band, n=6, lo=0.9, hi=0.8)
        for i, (a, b) in enumerate(bands):
            layers.append({"id": f"band{i}", "op": "band", "axis": "y", "from": a, "to": b, "ramp": br, "tone": 2.8, "bevel": {"shadow": 1, "highlight": 0}})
    if dots is not None:
        dr = it.ramp(f"cer_{key}_d", dots, n=5, lo=0.8, hi=0.7)
        layers.append({"id": "dots", "op": "spots", "count": 14, "radius": [0.45, 0.7], "ramp": dr, "tone": 2.6, "roughness": 0.1, "min_gap": 1.5, "faces": ["sides"]})
    if drip is not None:
        dp = it.ramp(f"cer_{key}_dp", drip, n=6, lo=0.9, hi=0.8)
        layers.append({"id": "dip", "op": "drip", "ramp": dp, "tone": 3.0, "depth": 1.2, "length": 1.6, "width": 0.8, "scale": 2.0,
                       "bevel": {"shadow": 1, "highlight": 0}})
    layers.append({"id": "wet", "op": "gloss", "dash": True, "length": 2, "shift": 2.2, "density": 0.6, "post": True})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 1.2, "dark_shift": -1.0}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"glaze_{key}", st)


def clay(it: Item, key: str = "terracotta", base=None, tone=3.5, band=True) -> str:
    """Unglazed terracotta: dusty, chalky salt bloom near the rim, a few chips."""
    base = base if base is not None else P["terracotta"]
    rn = it.ramp(f"st_{key}", base, n=7, lo=0.95, hi=0.85)
    layers = [{"id": "dust", "op": "noise", "scale": 1.5, "amount": 0.5},
              {"id": "photo", "op": "photo", "src": "assets/photos/rock_face_03", "scale": 10.0, "amount": 0.35, "ramps": [rn]},
              {"id": "bloom", "op": "patches", "scale": 1.4, "threshold": 0.66, "shift": 1.0, "faces": ["sides"]},
              {"id": "chips", "op": "wear", "width": 1, "density": 0.2, "shift": -1.2}]
    if band:
        layers.append({"id": "lip", "op": "band", "axis": "y", "from": 0.55, "to": 1.0, "shift": 0.5})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 1.0, "dark_shift": -1.0}, "brush": {"flow": "horizontal", "length": 1.2, "rough": 0.5}, "layers": layers}
    return it.style(f"clay_{key}", st)


def glass(it: Item, key: str = "glass", base=None, tone=2.2) -> str:
    base = base if base is not None else 0xcfe2df
    rn = it.ramp(f"gl_{key}", base, n=6, lo=0.7, hi=1.0, at=2)
    layers = [{"id": "sheen", "op": "band", "axis": "x", "from": -0.75, "to": -0.45, "shift": 2.0, "faces": ["sides"]},
              {"id": "sheen2", "op": "band", "axis": "x", "from": -0.3, "to": -0.2, "shift": 1.2, "faces": ["sides"]},
              {"id": "edge", "op": "gloss", "dash": True, "length": 3, "shift": 2.5, "density": 0.8, "post": True}]
    st = {"ramp": rn, "tone": tone, "light": 0.4, "rim": {"light_shift": 1.5, "dark_shift": -0.4}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"glass_{key}", st)


def glow(it: Item, key: str, base, tone=4.0, n=6, core=None) -> str:
    """A light source: flat, warm, near-white at the core (parts using it are made emissive by make.py: name them
    glow_*)."""
    rn = it.ramp(f"fm_{key}", base, n=n, lo=0.8, hi=1.0, at=2)
    layers = [{"id": "heat", "op": "gradient", "axis": "y", "amount": -0.8}, {"id": "flick", "op": "noise", "scale": 1.0, "amount": 0.5}]
    if core is not None:
        layers.append({"id": "core", "op": "band", "axis": "y", "from": core[0], "to": core[1], "shift": 1.4})
    st = {"ramp": rn, "tone": tone, "light": 0.15, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"glow_{key}", st)


def flame_ramp(it: Item) -> str:
    """Candle flame colours: a russet outer lick, honey and lamp-gold, a near-white core."""
    return it.ramp_list("fm_flame", [P["clay"], P["ochre"], P["honey"], 0xf3c879, P["lamp"], 0xfbe9c2, 0xfff8e8])


def wax(it: Item, key: str = "wax", base=0xf3e9d2, tone=3.4) -> str:
    rn = it.ramp(f"wx_{key}", base, n=6, lo=0.8, hi=0.7)
    layers = [{"id": "drips", "op": "drip", "ramp": rn, "tone": 4.6, "depth": 0.6, "length": 2.2, "width": 0.6, "scale": 1.5, "bevel": {"shadow": 1, "highlight": 0}},
              {"id": "soft", "op": "gradient", "axis": "y", "amount": 0.6}]
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.8, "dark_shift": -0.6}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"wax_{key}", st)


def leafy(it: Item, key: str, base, tone=3.4, bloom=None, rate=10, veins=True) -> str:
    """Foliage on boxes/lofts/cards: clustered leaf shapes (round scales) with lit tops, and optional blossoms."""
    rn = it.ramp(f"lf_{key}", base, n=8, lo=1.05, hi=0.95, at=4)
    layers = [{"id": "clumps", "op": "noise", "scale": 1.6, "amount": 0.8},
              {"id": "leaves", "op": "scales", "along": "x", "size": [1.6, 1.3], "shape": "round", "gradient": 1.4, "rim": -1.0, "shadow": -1.4, "jitter": 0.6},
              {"id": "photo", "op": "photo", "src": "assets/photos/forest_leaves_02", "scale": 6.0, "amount": 0.4, "ramps": [rn]}]
    if bloom is not None:
        fr = it.ramp(f"lf_{key}_bl", bloom, n=6, lo=0.9, hi=0.8)
        layers.append({"id": "bloom", "op": "spots", "count": rate, "radius": [0.4, 0.75], "ramp": fr, "tone": 3.6, "roughness": 0.15, "min_gap": 1.2,
                       "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -1.6, "highlight_shift": 1.2}, "faces": ["-down"]})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.9, "dark_shift": -1.0}, "brush": {"flow": "vertical", "length": 1.0, "rough": 0.7}, "layers": layers}
    return it.style(f"leafy_{key}", st)


def leaf_card(it: Item, key: str, base, tone=3.6, vein=None) -> str:
    """Leaf blades (card art): a lit body with darker edges; chars 'v' in the art are veins, 'e' edge, 'h' highlight."""
    rn = it.ramp(f"lf_{key}", base, n=8, lo=1.05, hi=0.95, at=4)
    layers = [{"id": "mottle", "op": "noise", "scale": 1.8, "amount": 0.6},
              {"id": "photo", "op": "photo", "src": "assets/photos/forest_leaves_02", "scale": 7.0, "amount": 0.3, "ramps": [rn]}]
    # cards are double-sided and often face down: keep painted light low and let the scene light shade them
    st = {"ramp": rn, "tone": tone + 0.4, "light": 0.3, "rim": {"light": 0, "dark": 0}, "brush": {"flow": "long", "length": 1.0, "rough": 0.5}, "layers": layers}
    return it.style(f"leaf_{key}", st)


def soil(it: Item, key: str = "soil", base=0x4d3a2c, tone=3.0, moss=None) -> str:
    rn = it.ramp(f"so_{key}", base, n=6, lo=0.9, hi=0.8)
    layers = [{"id": "clods", "op": "scales", "along": "x", "size": [0.9, 0.8], "shape": "round", "gradient": 1.0, "rim": -0.6, "shadow": -1.0, "jitter": 0.9},
              {"id": "grit", "op": "speckle", "density": 0.05, "shift": 1.5}]
    if moss is not None:
        mr = it.ramp("ms_moss", moss, n=6, lo=0.9, hi=0.9)
        layers.append({"id": "moss", "op": "patches", "scale": 1.0, "threshold": 0.56, "ramp": mr, "tone": 3.2, "bevel": {"shadow": 1, "highlight": 1}})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.5, "dark_shift": -0.6}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"soil_{key}", st)


def moss(it: Item, key: str = "moss", base=None, tone=3.4, bloom=None) -> str:
    base = base if base is not None else P["moss"]
    rn = it.ramp(f"ms_{key}", base, n=7, lo=1.0, hi=0.9)
    layers = [{"id": "tufts", "op": "scales", "along": "x", "size": [0.8, 0.7], "shape": "round", "gradient": 1.2, "rim": -0.8, "shadow": -1.4, "jitter": 0.8},
              {"id": "clumps", "op": "noise", "scale": 1.2, "amount": 0.7}]
    if bloom is not None:
        fr = it.ramp(f"ms_{key}_bl", bloom, n=5, lo=0.8, hi=0.7)
        layers.append({"id": "bloom", "op": "spots", "count": 8, "radius": [0.3, 0.5], "ramp": fr, "tone": 3.0, "roughness": 0.1, "faces": ["up"]})
    st = {"ramp": rn, "tone": tone, "rim": {"light_shift": 0.8, "dark_shift": -1.0}, "brush": {"flow": "vertical", "length": 0.8, "rough": 0.8}, "layers": layers}
    return it.style(f"moss_{key}", st)


def plain(it: Item, key: str, base, tone=3.4, n=7, layers=None, brush=None, rim=None, light=None) -> str:
    rn = it.ramp(key if "_" in key else f"pa_{key}", base, n=n, lo=0.95, hi=0.9)
    st = {"ramp": rn, "tone": tone, "rim": rim or {"light_shift": 0.9, "dark_shift": -1.0}, "layers": layers or [{"id": "mottle", "op": "noise", "scale": 2.0, "amount": 0.35}]}
    st["brush"] = brush if brush is not None else {"off": True}
    if light is not None:
        st["light"] = light
    if st["brush"].get("off"):
        st["dither"] = 0.0
    return it.style(f"plain_{key}", st)


def ink(it: Item, key: str = "ink", base=None) -> str:
    """Flat dark detail (eyes, holes): no light, no rims."""
    base = base if base is not None else P["eye"]
    rn = it.ramp_list(f"pa_{key}", [mixc(base, 0, 0.3), base, mixc(base, 0xffffff, 0.12)])
    return it.style(f"ink_{key}", {"ramp": rn, "tone": 1.0, "light": 0.0, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0})


# ------------------------------------------------------------------ pixel-art helpers (stamps and card art)
def grid(w: int, h: int, fill: str = ".") -> list[list[str]]:
    return [[fill] * w for _ in range(h)]


def rows(g: list[list[str]]) -> list[str]:
    return ["".join(r) for r in g]


def put(g, x, y, ch):
    if 0 <= y < len(g) and 0 <= x < len(g[0]):
        g[y][x] = ch


def stitch_rect(g, x0, y0, x1, y1, ch="s", dash=2, gap=1):
    """Running stitch around a rectangle (inclusive coords)."""
    k = 0
    pts = [(x, y0) for x in range(x0, x1 + 1)] + [(x1, y) for y in range(y0 + 1, y1 + 1)] + \
          [(x, y1) for x in range(x1 - 1, x0 - 1, -1)] + [(x0, y) for y in range(y1 - 1, y0, -1)]
    for (x, y) in pts:
        if k % (dash + gap) < dash:
            put(g, x, y, ch)
        k += 1


def stitch_line(g, x0, y0, x1, y1, ch="s", dash=2, gap=1):
    n = max(abs(x1 - x0), abs(y1 - y0)) + 1
    for k in range(n):
        t = k / max(1, n - 1)
        if k % (dash + gap) < dash:
            put(g, round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), ch)


def face_px(size_a: float, size_b: float, density: float) -> tuple[int, int]:
    return max(1, int(round(size_a * density))), max(1, int(round(size_b * density)))


def rng(seed: int) -> random.Random:
    return random.Random(seed)


def leaf_art(w: int, h: int, shape, seed: int = 0, vein=True, notch=None) -> list[str]:
    """Card art for a leaf: rows top (tip) to bottom (stem). shape(a, x) -> half width (0..1) at a = 0 base .. 1 tip.
    Chars: '#' body (lit by the painter), 'e' dark edge, 'v' vein, 'h' highlight, '.' empty."""
    g = grid(w, h)
    cx = (w - 1) / 2
    for yy in range(h):
        a = 1 - (yy + 0.5) / h  # 0 base (bottom row) .. 1 tip (top row)
        hw = shape(a) * (w / 2)
        for xx in range(w):
            dx = xx - cx
            if abs(dx) <= hw - 0.25:
                ch = "#"
                if abs(dx) > hw - 1.25:
                    ch = "e"
                if notch and notch(a, dx / max(hw, 0.1)):
                    ch = "."
                g[yy][xx] = ch
    if vein:
        for yy in range(int(h * 0.08), h):
            if g[yy][int(round(cx))] != ".":
                g[yy][int(round(cx))] = "v"
        # side veins angled toward the tip
        for k in range(1, 6):
            y0 = int(h * (0.15 + k * 0.14))
            for s in (-1, 1):
                for t in range(1, int(w * 0.4)):
                    xx, yy = int(round(cx + s * t)), y0 - t // 2
                    if 0 <= yy < h and 0 <= xx < w and g[yy][xx] == "#":
                        g[yy][xx] = "v" if t % 3 else "#"
    # highlight dabs along the lit (left) half
    for yy in range(h):
        for xx in range(w):
            if g[yy][xx] == "#" and xx < cx - 1 and (xx * 7 + yy * 3 + seed) % 11 == 0:
                g[yy][xx] = "h"
    return rows(g)


# ------------------------------------------------------------------ cloth patterns (layers for a part's paint)
def patch_layers(it: Item, key: str, colours, nx: int, ny: int, seed: int = 1, faces=("top",), tone: float = 2.5,
                 cols_only: bool = False) -> list[dict]:
    """Patchwork: one rect per patch with its own ramp and a puffy bevel (a quilted seam)."""
    ramps = [it.ramp(f"cl_pw_{key}_{i}", c, n=6, lo=0.9, hi=0.8) for i, c in enumerate(colours)]
    r = rng(seed)
    grid_ = {}
    out = []
    for i in range(nx):
        for j in range(1 if cols_only else ny):
            choices = [k for k in range(len(ramps)) if k != grid_.get((i - 1, j)) and k != grid_.get((i, j - 1))]
            k = r.choice(choices)
            grid_[(i, j)] = k
            y0, y1 = (0.0, 1.0) if cols_only else (j / ny, (j + 1) / ny)
            out.append({"id": f"pw_{key}_{i}_{j}", "op": "rect", "rect": [i / nx, y0, (i + 1) / nx, y1], "ramp": ramps[k],
                        "tone": tone + r.uniform(-0.25, 0.25), "faces": list(faces),
                        "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -1.3, "highlight_shift": 0.9}})
    return out


def stripe_layers(it: Item, key: str, colour, axis, period: float, width: float, faces=None, tone=3.0, phase=0.0) -> list[dict]:
    rn = it.ramp(f"cl_st_{key}", colour, n=6, lo=0.9, hi=0.8)
    d = {"id": f"st_{key}_{axis}", "op": "stripes", "axis": axis, "period": period, "width": width, "ramp": rn, "tone": tone, "phase": phase}
    if faces:
        d["faces"] = list(faces)
    return [d]


def check_layers(it: Item, key: str, colour, period: float, faces=None, tone=3.0, axes=("x", "z")) -> list[dict]:
    """Gingham: two crossing stripe sets of one colour, the second a step darker."""
    rn = it.ramp(f"cl_ck_{key}", colour, n=6, lo=0.9, hi=0.8)
    out = []
    for ax in axes:
        d = {"id": f"ck_{key}_{ax}", "op": "stripes", "axis": ax, "period": period, "width": 0.5, "ramp": rn, "tone": tone}
        if faces:
            d["faces"] = list(faces)
        out.append(d)
        tone -= 0.9
    return out


def stitch_art(W: int, H: int, nx: int, ny: int, margin: int = 1, dash: int = 2, gap: int = 1, ch: str = "s", border: bool = True) -> list[str]:
    """Running-stitch lines along a patch grid on a face image of W x H px (stamp art, '.' = untouched)."""
    g = grid(W, H)
    xs = [round(W * i / nx) for i in range(nx + 1)]
    ys = [round(H * j / ny) for j in range(ny + 1)]
    for i in range(1, nx):
        stitch_line(g, xs[i] + 1, 1, xs[i] + 1, H - 2, ch, dash, gap)
    for j in range(1, ny):
        stitch_line(g, 1, ys[j] + 1, W - 2, ys[j] + 1, ch, dash, gap)
    if border:
        stitch_rect(g, margin, margin, W - 1 - margin, H - 1 - margin, ch, dash, gap)
    return rows(g)


def plaid_layers(it: Item, key: str, base_ramp: str, band, thin, period: float = 4.0, axes=("x", "y"), faces=None, thin_period=None) -> list[dict]:
    """Tartan on a part: darker base columns, coloured rows, darkest crossings, and fine accent lines both ways."""
    br = it.ramp(f"cl_pl_{key}_b", band, n=6, lo=0.9, hi=0.8)
    tr = it.ramp(f"cl_pl_{key}_t", thin, n=6, lo=0.9, hi=0.8)
    a1, a2 = axes
    f = {"faces": list(faces)} if faces else {}
    tp = thin_period or period
    return [
        {"id": f"pl_{key}_c", "op": "stripes", "axis": a1, "period": period, "width": 0.36, "shift": -1.1, **f},
        {"id": f"pl_{key}_r", "op": "stripes", "axis": a2, "period": period, "width": 0.36, "ramp": br, "tone": 3.2, **f},
        {"id": f"pl_{key}_x", "op": "stripes", "axis": a1, "period": period, "width": 0.36, "shift": -1.0, **f},
        {"id": f"pl_{key}_t1", "op": "stripes", "axis": a1, "period": tp, "width": 0.09, "phase": tp * 0.68, "ramp": tr, "tone": 3.0, **f},
        {"id": f"pl_{key}_t2", "op": "stripes", "axis": a2, "period": tp, "width": 0.09, "phase": tp * 0.68, "ramp": tr, "tone": 2.6, **f},
    ]
