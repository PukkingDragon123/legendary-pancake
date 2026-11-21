#!/usr/bin/env python3
"""Queen Neve's winter boutique: every prop as a lowpix spec (low poly, dense hand-painted pixel textures).

    python3 art/lowpix/shop/make.py                 # write every spec to art/lowpix/shop/<id>.json
    python3 art/lowpix/shop/make.py build [ids...]  # ... then build them and copy the GLBs to public/models/shop/

Units: 16 lowpix units = 1 world unit in the game (so a 1.0 m counter is 16 units tall). Y up, the model faces +Z
(towards the shopper), ground at y = 0. Colours come from the calm "Moss & Moonlight" palette (src/gfx/palette.ts):
ramps run dark to light and lean cool in the shadows, warm in the lights. Materials are exported lit
(`material.unlit = false`) so the shop's lamps, stove glow and window light shade them; the painted light is kept
gentle (AO in creases, rims on edges, a soft gradient). Parts whose id contains `glow` are made emissive at runtime.
Run from the repository root (photo paths are relative to it). Photos are CC0 from Poly Haven (see photos/*/source.json).
"""
import json
import math
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PUB = os.path.join(ROOT, "public", "models", "shop")
LOWPIX = os.environ.get("LOWPIX", "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/refs2/symmetrical-goggles")
PY = os.environ.get("LOWPIX_PY", os.path.expanduser("~/.cache/lowpix-venv/bin/python"))
OUT = os.environ.get("LOWPIX_OUT", os.path.join(ROOT, "art", "lowpix", "shop", "out"))
PH = "art/lowpix/shop/photos/"

# ------------------------------------------------------------------ palette (from src/gfx/palette.ts)

RAMPS = {
    "wood": ["#2f2620", "#43352a", "#5b4a3c", "#6f553d", "#86684a", "#9c7a56", "#b08c66", "#c4a37c", "#d8bf98"],
    "dwood": ["#211b18", "#2f2620", "#3d3229", "#4a392b", "#5b4a3c", "#6f553d", "#85674a", "#9c7a56"],
    "pwood": ["#5b4a3c", "#7a634a", "#9c7a56", "#b08c66", "#c4a37c", "#d8bf98", "#e6d3b0", "#f0e4c8"],
    "plaster": ["#6f6856", "#8a7f68", "#a3967a", "#b9ab8b", "#cdbf9d", "#dccfb0", "#e8dec5", "#f4eedd"],
    "linen": ["#5e5646", "#7b7058", "#97896b", "#b0a07e", "#c6b692", "#d8c9a6", "#e6d9ba", "#f1e8d2"],
    "sage": ["#24352a", "#2f4334", "#3f5a3b", "#4f6b45", "#66844f", "#7d975f", "#97ad77", "#b0c08f", "#c8d3a8"],
    "pine": ["#141d18", "#1c2a22", "#26392c", "#324a36", "#3f5a3b", "#4f6e45", "#628350", "#7c9a60", "#9cb47a"],
    "moss": ["#2a3a26", "#3a4f33", "#4c6640", "#5f7d4c", "#759459", "#8daa6a", "#a7bf82"],
    "dusk": ["#161c26", "#1f2834", "#2b3746", "#3a4a5b", "#4b5f6f", "#617f8c", "#7896a0", "#93aeb4"],
    "lake": ["#1e2a33", "#2a3b46", "#3a5160", "#4d6a78", "#627f8c", "#7a99a2", "#93b2b6", "#b2cacb"],
    "frost": ["#4b5f6f", "#617f8c", "#7c9aa3", "#96b4ba", "#b2cbcf", "#c9dcde", "#dde9e8", "#eef3ef", "#f8faf5"],
    "snow": ["#7c94a0", "#97aeb6", "#b0c5ca", "#c7d8da", "#dae6e5", "#e8f0ed", "#f3f7f2", "#fbfcf8"],
    "glass": ["#2b3746", "#3a4a5b", "#4f6672", "#6b8790", "#8aa7ad", "#aac3c6", "#cbdcdb", "#eaf1ee"],
    "brass": ["#2f261c", "#4a3a24", "#66512f", "#86693a", "#a3844a", "#bd9d5b", "#d3b778", "#e6d09c", "#f3e6c4"],
    "iron": ["#15161a", "#1e1f23", "#2a2a2c", "#363533", "#44423e", "#55524b", "#69655b", "#807a6c"],
    "berry": ["#2e1c24", "#43272f", "#5a333b", "#733f47", "#8a4f56", "#9e5f66", "#b5797b", "#c99590", "#dcb3aa"],
    "rose": ["#6b4446", "#86585a", "#a06e6d", "#b88582", "#cb9c95", "#d9aca4", "#e5c0b6", "#efd5cb", "#f7e7de"],
    "plum": ["#211a24", "#2f2533", "#3f3144", "#523f56", "#664e68", "#7b6079", "#93798f", "#ab94a8", "#c4b2c2"],
    "lilac": ["#4a4458", "#5f586f", "#787089", "#9188a3", "#a69cb9", "#b4a9c9", "#c6bdd6", "#d8d1e3", "#e9e5ef"],
    "honey": ["#3e2e1e", "#5a4126", "#7a5932", "#9c7440", "#b98c4c", "#cfa25e", "#dcb072", "#e8c68e", "#f3dcb0"],
    "terra": ["#3a2420", "#52302a", "#6b3e33", "#86503f", "#a0634c", "#b5765a", "#c88a6c", "#d8a385", "#e6bea2"],
    "cream": ["#8a7e66", "#a69a7e", "#bfb294", "#d3c6a6", "#e2d6b8", "#ece2c8", "#f4ecd8", "#faf5e8"],
    "lamp": ["#8a6532", "#b48a48", "#d6ac62", "#ebc985", "#f4dca6", "#f9e9c4", "#fdf4df", "#fffaee"],
    "fire": ["#6b2e1c", "#9a4a24", "#c66e2e", "#e0953e", "#efb85a", "#f7d688", "#fdeebe"],
    "ink": ["#1b1916", "#26231e", "#2e2b24", "#3b372e", "#4b463a", "#5d5748", "#6f6856"],
    "paper": ["#a89b80", "#c1b597", "#d6cbae", "#e4dbc2", "#eee7d4", "#f4eedd", "#f9f5ea"],
    "kraft": ["#4a3826", "#644b32", "#7d5f40", "#96744f", "#ab8a62", "#bf9f77", "#d1b48e"],
    "slate": ["#1d232b", "#27303a", "#323d49", "#3e4b59", "#4a596a", "#5a6a7a", "#6c7c8a"],
    "stone": ["#3e3b36", "#4f4b45", "#615c54", "#757067", "#8a8479", "#9e978b", "#b3ac9f", "#c7c1b4"],
    "fern": ["#1f2c20", "#2b3d2b", "#384f36", "#466243", "#557550", "#66884f", "#7f9d63", "#9cb47e"],
}

LIGHT = {"dir": [-0.5, 1.0, 0.75], "strength": 0.55, "gradient": 0.35, "ao": 0.55, "ao_height": 10.0}
BRUSH = {"flow": "long", "length": 2.4, "width": 0.7, "rough": 0.6, "overshoot": 0.3,
         "textures": {"wood": "wood", "dwood": "wood", "pwood": "wood", "brass": "metal", "iron": "metal",
                      "linen": "cloth", "plaster": "stone", "stone": "stone", "berry": "cloth", "rose": "cloth",
                      "plum": "cloth", "lilac": "cloth", "lake": "cloth", "cream": "cloth", "sage": "wood",
                      "pine": "organic", "fern": "organic", "moss": "moss", "honey": "cloth", "terra": "cloth",
                      "kraft": "cloth", "paper": "cloth", "frost": "crystal", "snow": "crystal", "glass": "crystal"}}
RIM = {"light": 1, "dark": 1, "light_shift": 1, "dark_shift": -1, "threshold": 0.25, "outline": "dark"}


def photo(src, scale=12, amount=0.8, ramps=None, **kw):
    d = {"op": "photo", "src": PH + src, "scale": scale, "amount": amount, "mode": "detail"}
    if ramps:
        d["ramps"] = ramps
    d.update(kw)
    return d


def wear(ramp="dwood", tone=2, width=1, density=0.18):
    return {"id": "wear", "op": "wear", "width": width, "density": density, "scratches": 0.3, "ramp": ramp, "tone": tone}


# reusable paint blocks
STYLES = {
    "wood": {"ramp": "wood", "tone": 5.0, "rim": RIM, "layers": [
        photo("oak_veneer_01", 18, 0.5), {"op": "noise", "scale": 9, "amount": 0.2}, wear("dwood", 2, 1, 0.1)]},
    "wood_light": {"ramp": "pwood", "tone": 3.6, "rim": RIM, "layers": [
        photo("oak_veneer_01", 18, 0.45), {"op": "noise", "scale": 9, "amount": 0.2}, wear("wood", 3, 1, 0.08)]},
    "wood_dark": {"ramp": "dwood", "tone": 4.5, "rim": RIM, "layers": [
        photo("wood_table_001", 20, 0.5), {"op": "noise", "scale": 9, "amount": 0.2}, wear("dwood", 1, 1, 0.08)]},
    "sage_paint": {"ramp": "sage", "tone": 5.2, "rim": RIM, "layers": [
        photo("oak_veneer_01", 20, 0.22), {"op": "noise", "scale": 10, "amount": 0.18}, wear("sage", 3, 1, 0.04)]},
    "dusk_paint": {"ramp": "dusk", "tone": 5.0, "rim": RIM, "layers": [
        photo("oak_veneer_01", 20, 0.22), {"op": "noise", "scale": 10, "amount": 0.18}, wear("dusk", 3, 1, 0.04)]},
    "brass": {"ramp": "brass", "tone": 5.0, "rim": dict(RIM, outline="dark"), "layers": [
        {"op": "noise", "scale": 3, "amount": 0.35},
        {"op": "patches", "scale": 3, "threshold": 0.7, "shift": -0.9},
        {"op": "gloss", "post": True, "dash": True, "length": 2, "density": 0.4, "shift": 2.0, "ramps": ["brass"]}]},
    "iron": {"ramp": "iron", "tone": 4.0, "rim": RIM, "layers": [
        {"op": "noise", "scale": 3, "amount": 0.4}, {"op": "patches", "scale": 4, "threshold": 0.7, "shift": 0.8},
        {"op": "gloss", "post": True, "dash": True, "length": 2, "density": 0.25, "shift": 1.5, "ramps": ["iron"]}]},
    "linen": {"ramp": "linen", "tone": 5.0, "rim": RIM, "layers": [photo("rough_linen", 6, 1.0), {"op": "noise", "scale": 6, "amount": 0.25}]},
    "plaster": {"ramp": "plaster", "tone": 5.5, "rim": {"light": 0, "dark": 0}, "layers": [
        {"op": "noise", "scale": 10, "amount": 0.35}, {"op": "patches", "scale": 9, "threshold": 0.68, "shift": -0.5},
        {"op": "cracks", "scale": 12, "width": 0.5, "threshold": 0.92, "shift": -0.8}]},
    "glass": {"ramp": "glass", "tone": 5.0, "brush": {"off": True}, "rim": {"light": 1, "dark": 0, "light_shift": 2}, "light": 0.4},
    "frost": {"ramp": "frost", "tone": 6.0, "rim": {"light": 1, "dark": 1, "outline": "none"}, "layers": [
        {"op": "noise", "scale": 3, "amount": 0.6}, {"op": "speckle", "density": 0.05, "shift": 1.5}]},
    "snow": {"ramp": "snow", "tone": 5.5, "rim": {"light": 1, "dark": 1, "outline": "none"}, "layers": [
        {"op": "noise", "scale": 3, "amount": 0.5}]},
    "glow": {"ramp": "lamp", "tone": 5.0, "light": 0.2, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}},
    "fire": {"ramp": "fire", "tone": 4.0, "light": 0.2, "brush": {"off": True}, "rim": {"light": 0, "dark": 0},
             "layers": [{"op": "noise", "scale": 1.5, "amount": 1.4}]},
    "ink": {"ramp": "ink", "tone": 2.0, "rim": {"light": 1, "dark": 0}},
    "paper": {"ramp": "paper", "tone": 5.0, "rim": RIM, "layers": [{"op": "noise", "scale": 4, "amount": 0.25}]},
    "kraft": {"ramp": "kraft", "tone": 4.0, "rim": RIM, "layers": [photo("rough_linen", 8, 0.5), {"op": "noise", "scale": 4, "amount": 0.3}]},
    "leaf": {"ramp": "pine", "tone": 5.0, "rim": dict(RIM, outline="dark"), "layers": [{"op": "noise", "scale": 2, "amount": 0.7}]},
    "terra": {"ramp": "terra", "tone": 5.0, "rim": RIM, "layers": [{"op": "noise", "scale": 4, "amount": 0.35}, wear("terra", 2, 1, 0.15)]},
    "stone": {"ramp": "stone", "tone": 4.5, "rim": RIM, "layers": [{"op": "noise", "scale": 4, "amount": 0.5}, {"op": "cracks", "scale": 6, "width": 0.5, "threshold": 0.9, "shift": -0.8}]},
}


def knit(ramp, tone=5.0, stripe=None, period=4.0):
    """A hand-knit wool paint block: fleece photo relief, rib stripes, optional colour stripes."""
    layers = [photo("knitted_fleece", 5, 1.1), {"op": "stripes", "axis": "x", "period": 1.0, "width": 0.5, "shift": -0.35}]
    if stripe:
        layers.append({"op": "stripes", "axis": "y", "period": period, "width": 0.3, "ramp": stripe[0], "tone": stripe[1]})
    return {"ramp": ramp, "tone": tone, "rim": RIM, "layers": layers}


def cloth(ramp, tone=5.0, extra=None):
    layers = [photo("rough_linen", 5, 0.9), {"op": "noise", "scale": 4, "amount": 0.3}] + (extra or [])
    return {"ramp": ramp, "tone": tone, "rim": RIM, "layers": layers}


# ------------------------------------------------------------------ part helpers

class Spec:
    def __init__(self, sid, name, desc, density=2.0, tris=1500, colors=220, light=None):
        self.id = sid
        self.d = {
            "name": name, "description": desc, "author": "Hoot Hollow (lowpix spec)", "license": "CC0-1.0",
            "density": density, "budget": {"tris": tris, "colors": colors},
            "light": dict(LIGHT, **(light or {})), "brush": BRUSH,
            "render": {"background": "#27313f", "hero": [30, 20], "shadow": 0.45},
            "material": {"unlit": False, "roughness": 0.88},
            "palette": {"ramps": RAMPS}, "styles": dict(STYLES), "parts": [],
        }
        self.ids = set()

    def style(self, name, block):
        self.d["styles"][name] = block
        return name

    def _part(self, pid, shape, size, pivot, style, parent=None, **kw):
        assert pid not in self.ids, pid
        self.ids.add(pid)
        p = {"id": pid, "shape": shape, "size": [round(v, 3) for v in size], "pivot": [round(v, 3) for v in pivot]}
        if style:
            p["style"] = style
        if parent:
            p["parent"] = parent
        for k, v in kw.items():
            if v is not None:
                p[k] = v
        self.d["parts"].append(p)
        return p

    def box(self, pid, size, pivot, style, **kw):
        return self._part(pid, "box", size, pivot, style, **kw)

    def prism(self, pid, size, pivot, style, sides=8, **kw):
        return self._part(pid, "prism", size, pivot, style, sides=sides, **kw)

    def taper(self, pid, size, pivot, style, **kw):
        return self._part(pid, "taper", size, pivot, style, **kw)

    def loft(self, pid, rings, pivot, style, sides=8, rnd=2.2, **kw):
        assert pid not in self.ids, pid
        self.ids.add(pid)
        p = {"id": pid, "shape": "loft", "pivot": pivot, "style": style, "rings": rings,
             "profile": {"sides": sides, "round": rnd}}
        for k, v in kw.items():
            if v is not None:
                p[k] = v
        self.d["parts"].append(p)
        return p

    def card(self, pid, art, pivot, key, plane="xy", style=None, **kw):
        assert pid not in self.ids, pid
        self.ids.add(pid)
        ramp = next(iter(key.values())).split(":")[0]
        p = {"id": pid, "shape": "card", "plane": plane, "art": art, "pivot": pivot,
             "paint": {"ramp": ramp, "light": 0.5, "art_key": key}}
        if style:
            p["style"] = style
        for k, v in kw.items():
            if v is not None:
                p[k] = v
        self.d["parts"].append(p)
        return p

    def write(self):
        path = os.path.join(HERE, self.id + ".json")
        with open(path, "w") as f:
            json.dump(self.d, f, indent=1)
        return path


def rect_rows(w, h, fn):
    return ["".join(fn(x, y) for x in range(w)) for y in range(h)]


SPECS = {}


def spec(fn):
    SPECS[fn.__name__] = fn
    return fn


def stand_up(rot=None):
    """rotation that stands a prism (built along local Z) upright, optionally with extra degrees"""
    r = [-90, 0, 0]
    if rot:
        r = [r[0] + rot[0], r[1] + rot[1], r[2] + rot[2]]
    return r


SNOWFLAKE = [
    "....b....",
    ".b..w..b.",
    "..b.w.b..",
    "...www...",
    "bwwwgwwwb",
    "...www...",
    "..b.w.b..",
    ".b..w..b.",
    "....b....",
]
CROWN = [
    "b...b...b",
    "bb.bbb.bb",
    "bwbbgbbwb",
    "bbbbbbbbb",
    ".ddddddd.",
]
LEAF = ["...gg...", "..gGGg..", ".gGgGGg.", ".gGgGGg.", "gGGgGGGg", "gGGgGGgg", ".gGgGg..", "..ggg...", "...g....", "...g...."]
FLOWER = [".wWw.", "wWyWw", "WyyyW", "wWyWw", ".wWw."]


# ------------------------------------------------------------------ the counter (with bell, till and odds and ends)

@spec
def counter():
    s = Spec("counter", "Boutique counter",
             "Queen Neve's shop counter: a panelled oak counter painted sage below a worn honey-oak top, fluted dark corner posts, "
             "a brass foot rail, a crown-and-snowflake crest, and on top a brass till, a service bell, an open ledger, "
             "a sweet jar, a ribbon spool, a stack of price tags and a little Christmas rose.", density=2.0, tris=2600)
    L, H, D = 54, 14, 11
    s.box("body", [L, H, D], [0, 1.6 + H / 2, 0], "wood")
    s.box("plinth", [L + 1.6, 1.6, D + 1.2], [0, 0.8, 0.2], "wood_dark")
    s.box("top", [L + 4, 1.4, D + 3], [0, H + 1.6 + 0.7, 0.6], "wood_light", chamfer=0.35)
    s.box("top_lip", [L + 1, 0.8, 0.8], [0, H + 1.2, D / 2 + 0.6], "wood_dark")
    for i, x in enumerate((-18, 0, 18)):
        sty = s.style(f"panel{i}", dict(STYLES["sage_paint"], layers=STYLES["sage_paint"]["layers"] + [
            {"op": "panel", "inset": 3, "shift": -1.0, "highlight": 1, "shadow": 1}]))
        s.box(f"panel_{i}", [16, 10, 0.8], [x, 1.6 + H / 2, D / 2 + 0.4], sty, hide=["back"])
    crest = s.style("crest", {"ramp": "brass", "tone": 5, "rim": RIM, "layers": [{"op": "noise", "scale": 2, "amount": 0.3}],
                              "stamps": [{"face": "front", "at": "center", "offset": [0, 3], "art": CROWN,
                                          "key": {"b": "brass:7", "w": "frost:8", "g": "berry:5", "d": "brass:2"}},
                                         {"face": "front", "at": "center", "offset": [0, -3], "art": SNOWFLAKE,
                                          "key": {"b": "frost:6", "w": "frost:8", "g": "lamp:6"}}]})
    s.box("crest", [8, 9, 0.6], [0, 1.6 + H / 2, D / 2 + 1.05], crest, chamfer=0.8, hide=["back"])
    post = s.style("post", dict(STYLES["wood_dark"], layers=STYLES["wood_dark"]["layers"] + [
        {"op": "stripes", "axis": "x", "period": 0.9, "width": 0.35, "shift": -0.9, "faces": ["front", "left", "right"]}]))
    for sd in (-1, 1):
        s.box("post_l" if sd < 0 else "post_r", [2.6, H + 0.4, D + 1.0], [sd * (L / 2 + 0.6), 1.6 + H / 2, 0.2], post)
    # brass foot rail on little brackets
    s.prism("rail", [1.0, 1.0, L + 2], [0, 3.2, D / 2 + 2.6], "brass", sides=8, rotation=[0, 90, 0])
    for k, x in enumerate((-22, 0, 22)):
        s.box(f"rail_bracket{k}", [0.8, 0.8, 2.4], [x, 3.2, D / 2 + 1.4], "brass")

    TOP = H + 1.6 + 1.4  # 17
    # --- the till: a brass register with a key deck, a little number window and a wooden drawer
    s.box("till_drawer", [9, 1.8, 7], [15, TOP + 0.9, -0.5], "wood_dark", chamfer=0.3)
    s.box("till_body", [8, 4.6, 6], [15, TOP + 1.8 + 2.3, -1.0], "brass", chamfer=0.6)
    keys = s.style("till_keys", {"ramp": "brass", "tone": 3, "rim": RIM, "stamps": [
        {"face": "top", "at": "center", "art": [
            "w.w.w.w.w.w.w",
            ".............",
            "w.w.w.w.w.w.w",
            ".............",
            "c.c.c.c.c.c.c",
            ".............",
            "r.r.r.w.w.w.w",
        ], "key": {"w": "cream:6", "c": "cream:4", "r": "berry:6"}}]})
    s.box("till_keys", [8, 1.2, 3.6], [15, TOP + 2.6, 3.0], keys, rotation=[22, 0, 0])
    window = s.style("till_window", {"ramp": "ink", "tone": 1, "rim": RIM, "brush": {"off": True}, "stamps": [
        {"face": "front", "at": "center", "art": ["ll.lll.lll", ".l...l...l", ".l.lll..ll", ".l.l.....l", "lll.lll.lll"],
         "key": {"l": "lamp:6"}}]})
    s.box("till_glow_window", [6, 2.2, 1.2], [15, TOP + 7.4, -1.2], window)
    s.box("till_crown", [7, 0.8, 1.6], [15, TOP + 8.8, -1.2], "brass", chamfer=0.3)
    s.prism("till_crank", [0.8, 0.8, 2.4], [19.8, TOP + 4.6, -1.0], "brass", sides=6, rotation=[0, 90, 0])
    s.box("till_handle", [0.8, 2.8, 0.8], [21.0, TOP + 5.6, -1.0], "wood_dark")
    s.prism("till_knob", [1.0, 1.0, 0.6], [15, TOP + 0.9, 3.2], "brass", sides=6)
    s.card("till_flag", ["kkkkkk", "kpppk.", "kpppk.", "kkkkkk", "s.....", "s.....", "s....."], [12.2, TOP + 10.6, -1.2],
           {"k": "berry:4", "p": "berry:7", "s": "brass:5"})
    # --- the service bell
    s.prism("bell_base", [3.6, 3.6, 0.7], [3, TOP + 0.35, 3.2], "wood_dark", sides=10, rotation=stand_up())
    s.loft("bell_dome", [{"at": [0, 0, 0], "size": 3.2}, {"at": [0, 0.8, 0], "size": 3.0}, {"at": [0, 1.6, 0], "size": 2.3},
                         {"at": [0, 2.1, 0], "size": 1.2}, {"at": [0, 2.3, 0], "size": 0}],
           [3, TOP + 0.7, 3.2], "brass", sides=10, rnd=2.0, up=[0, 0, 1])
    s.prism("bell_plunger", [0.6, 0.6, 0.9], [3, TOP + 3.3, 3.2], "brass", sides=6, rotation=stand_up())
    # --- an open ledger with a ribbon bookmark
    s.box("ledger_cover", [11, 0.6, 7.4], [-7, TOP + 0.3, 2.6], s.style("ledger", cloth("berry", 4)), rotation=[0, -8, 0])
    pages = s.style("pages", {"ramp": "paper", "tone": 5, "rim": RIM, "layers": [
        {"op": "stripes", "axis": "z", "period": 0.9, "width": 0.25, "ramp": "lake", "tone": 5, "faces": ["top"]}]})
    s.box("ledger_page_l", [5.2, 0.6, 7], [-9.6, TOP + 0.9, 2.6], pages, rotation=[0, -8, -4])
    s.box("ledger_page_r", [5.2, 0.6, 7], [-4.4, TOP + 0.9, 1.9], pages, rotation=[0, -8, 4])
    s.box("ledger_ribbon", [0.6, 0.2, 5], [-7.2, TOP + 1.25, 5.2], s.style("sage_cloth", cloth("sage", 5)), rotation=[0, -8, 0])
    # --- a jar of wrapped sweets with a linen lid tied with a berry knot
    jar = s.style("jar", {"ramp": "glass", "tone": 5, "rim": {"light": 1, "dark": 1, "light_shift": 2, "outline": "dark"}, "brush": {"off": True},
                          "layers": [{"op": "spots", "count": 26, "radius": [0.5, 0.9], "ramp": "berry", "tone": 6, "min_gap": 0.3, "where": {"y": [-1, 0.55]}, "bevel": True},
                                     {"op": "spots", "count": 20, "radius": [0.5, 0.9], "ramp": "honey", "tone": 6, "seed": 3, "min_gap": 0.3, "where": {"y": [-1, 0.55]}, "bevel": True},
                                     {"op": "spots", "count": 16, "radius": [0.5, 0.8], "ramp": "sage", "tone": 7, "seed": 7, "min_gap": 0.3, "where": {"y": [-1, 0.55]}, "bevel": True},
                                     {"op": "gloss", "post": True, "dash": True, "length": 3, "density": 0.6, "shift": 3, "ramps": ["glass"]}]})
    s.prism("jar", [4.6, 4.6, 6.4], [-21, TOP + 3.2, 0.5], jar, sides=8, rotation=stand_up())
    s.prism("jar_lid", [5.0, 5.0, 1.0], [-21, TOP + 6.9, 0.5], s.style("linen_cloth", cloth("linen", 5)), sides=8, rotation=stand_up())
    s.prism("jar_knot", [1.4, 1.4, 0.8], [-21, TOP + 7.7, 0.5], s.style("berry_cloth", cloth("berry", 5)), sides=6, rotation=stand_up())
    # --- a ribbon spool on its side, the ribbon running across the counter
    s.prism("spool", [3.4, 3.4, 2.4], [-14.5, TOP + 1.7, -1.5], "wood_light", sides=10, rotation=[0, 90, 0])
    rose = s.style("rose_cloth", cloth("rose", 5, [{"op": "stripes", "axis": "x", "period": 0.6, "width": 0.3, "shift": -0.7}]))
    s.prism("spool_ribbon", [2.8, 2.8, 1.8], [-14.5, TOP + 1.7, -1.5], rose, sides=10, rotation=[0, 90, 0])
    s.box("ribbon_tail", [1.4, 0.15, 6], [-14.5, TOP + 0.1, 2.6], rose, rotation=[0, 12, 0])
    # --- a little pile of kraft price tags
    tag = s.style("tag", {"ramp": "kraft", "tone": 5, "rim": RIM, "stamps": [
        {"face": "top", "at": "center", "art": ["..i..", ".....", "iiii.", ".....", "ii.ii"], "key": {"i": "ink:3"}}]})
    for k, (x, z, r) in enumerate(((-26, 3.5, 18), (-25, 4.4, -10), (-24.4, 2.6, 40))):
        s.box(f"tag_{k}", [3, 0.25, 2], [x, TOP + 0.15 + k * 0.25, z], tag, rotation=[0, r, 0])
    # --- a Christmas rose in a terracotta pot at the far end
    s.prism("pot", [4, 4, 3.6], [24.5, TOP + 1.8, 1.5], "terra", sides=8, rotation=stand_up(), front_scale=[1.15, 1.15])
    s.prism("pot_rim", [4.8, 4.8, 0.8], [24.5, TOP + 3.8, 1.5], "terra", sides=8, rotation=stand_up())
    s.prism("soil", [4.2, 4.2, 0.3], [24.5, TOP + 4.0, 1.5], "wood_dark", sides=8, rotation=stand_up())
    for k, (rx, ry, x, z) in enumerate(((-30, 0, 23.8, 1.0), (-28, 120, 25.4, 1.2), (-32, 240, 24.4, 2.4), (-15, 60, 24.6, 1.6))):
        s.card(f"rose_leaf{k}", LEAF, [x, TOP + 4.1, z], {"g": "pine:3", "G": "pine:6"}, rotation=[rx, ry, 0])
    for k, (x, y, z) in enumerate(((24.0, 8.6, 2.2), (25.6, 7.8, 1.0), (23.6, 7.4, 0.6))):
        s.card(f"rose_bloom{k}", FLOWER, [x, TOP + y - 2, z], {"w": "rose:7", "W": "snow:6", "y": "honey:7"}, rotation=[-35, k * 40, 0])
    return s


# ------------------------------------------------------------------ the room: floor, papered walls, panelling, beams

# the back wall's window opening (model units, room origin): x in [-WX, WX], y in [WY0, WY1]; the wall's face is at z = WZ
WX, WY0, WY1, WZ = 20, 18, 50, -45
ROOM_W, ROOM_H, ROOM_FRONT = 136, 68, 150


def wallpaper(axis):
    return {"ramp": "plaster", "tone": 5.2, "rim": {"light": 0, "dark": 0}, "layers": [
        {"op": "noise", "scale": 10, "amount": 0.2},
        {"op": "stripes", "axis": axis, "period": 4, "width": 0.5, "ramp": "sage", "tone": 7.6},
        {"op": "noise", "scale": 12, "amount": 0.16},
        {"op": "stripes", "axis": axis, "period": 4, "width": 0.07, "phase": 0.5, "ramp": "sage", "tone": 5.4},
        {"op": "spots", "count": 160, "radius": [0.3, 0.45], "ramp": "berry", "tone": 6.8, "min_gap": 2.2, "seed": 5},
        {"op": "patches", "scale": 16, "threshold": 0.74, "shift": -0.3},
    ]}


def boards(axis, ramp="sage", tone=5.2):
    return {"ramp": ramp, "tone": tone, "rim": RIM, "layers": [
        photo("oak_veneer_01", 20, 0.2), {"op": "noise", "scale": 9, "amount": 0.18},
        {"op": "stripes", "axis": axis, "period": 3.2, "width": 0.12, "shift": -1.6},
        {"op": "stripes", "axis": axis, "period": 3.2, "width": 0.08, "phase": 0.14, "shift": 0.7},
        wear(ramp, 3, 1, 0.04)]}


@spec
def room():
    s = Spec("room", "Boutique room", "The boutique's shell: wide oak floorboards, oat wallpaper with sage pinstripes and little berry "
             "sprigs over sage tongue-and-groove panelling, a dado rail, skirting, crown moulding, a plaster ceiling on dark "
             "beams, and a window opening in the back wall.", density=2.0, tris=900, colors=200,
             light={"strength": 0.35, "gradient": 0.25, "ao": 0.45, "ao_height": 18})
    W, H, F, Z = ROOM_W, ROOM_H, ROOM_FRONT, WZ
    D = F - Z
    floor = s.style("floor", {"ramp": "wood", "tone": 4.4, "rim": {"light": 0, "dark": 0}, "layers": [
        photo("wood_table_001", 26, 0.55), {"op": "noise", "scale": 12, "amount": 0.2},
        {"op": "stripes", "axis": "x", "period": 7, "width": 0.06, "shift": -1.8},
        {"op": "stripes", "axis": "x", "period": 7, "width": 0.05, "phase": 0.08, "shift": 0.6},
        {"op": "stripes", "axis": "z", "period": 41, "width": 0.03, "shift": -1.5},
        {"op": "patches", "scale": 10, "threshold": 0.66, "shift": -0.5},
        {"op": "spots", "count": 40, "radius": [0.3, 0.4], "ramp": "dwood", "tone": 1, "min_gap": 4, "seed": 9}]})
    s.box("floor", [W, 2, D], [0, -1, (F + Z) / 2], floor, hide=["bottom"])
    paper_x, paper_z = s.style("paper_x", wallpaper("x")), s.style("paper_z", wallpaper("z"))
    wt = 1.0
    # back wall around the window opening
    side_w = W / 2 - WX
    s.box("wall_l", [side_w, H, wt], [-(WX + side_w / 2), H / 2, Z - wt / 2], paper_x, hide=["back"])
    s.box("wall_r", [side_w, H, wt], [WX + side_w / 2, H / 2, Z - wt / 2], paper_x, hide=["back"])
    s.box("wall_b", [2 * WX, WY0, wt], [0, WY0 / 2, Z - wt / 2], paper_x, hide=["back"])
    s.box("wall_t", [2 * WX, H - WY1, wt], [0, (H + WY1) / 2, Z - wt / 2], paper_x, hide=["back"])
    for sd, nm in ((-1, "side_l"), (1, "side_r")):
        s.box(nm, [wt, H, D], [sd * (W / 2 + wt / 2), H / 2, (F + Z) / 2], paper_z, hide=["left" if sd < 0 else "right"])
    # panelling, dado rail, skirting and crown moulding on all three walls
    pan_x, pan_z = s.style("boards_x", boards("x")), s.style("boards_z", boards("z"))
    PH_ = 16.5
    s.box("wainscot_b", [W, PH_, 0.6], [0, PH_ / 2, Z + 0.3], pan_x, hide=["back"])
    for sd, nm in ((-1, "wainscot_l"), (1, "wainscot_r")):
        s.box(nm, [0.6, PH_, D], [sd * (W / 2 - 0.3), PH_ / 2, (F + Z) / 2], pan_z, hide=["left" if sd < 0 else "right"])
    rail = s.style("dado", dict(STYLES["wood"], layers=STYLES["wood"]["layers"] + [
        {"op": "stripes", "axis": "y", "period": 0.7, "width": 0.3, "shift": -0.8, "faces": ["front", "left", "right"]}]))
    s.box("dado_b", [W, 1.6, 1.4], [0, PH_ + 0.8, Z + 0.7], rail)
    s.box("skirt_b", [W, 2.6, 1.2], [0, 1.3, Z + 0.9], "wood_dark")
    s.box("crown_b", [W, 2.4, 2.0], [0, H - 1.2, Z + 1.0], rail)
    for sd, nm in ((-1, "l"), (1, "r")):
        x = sd * (W / 2 - 0.7)
        s.box("dado_" + nm, [1.4, 1.6, D], [x, PH_ + 0.8, (F + Z) / 2], rail)
        s.box("skirt_" + nm, [1.2, 2.6, D], [sd * (W / 2 - 0.9), 1.3, (F + Z) / 2], "wood_dark")
        s.box("crown_" + nm, [2.0, 2.4, D], [sd * (W / 2 - 1.0), H - 1.2, (F + Z) / 2], rail)
    # ceiling and beams
    s.box("ceiling", [W, 1, D], [0, H + 0.5, (F + Z) / 2], s.style("ceil", dict(STYLES["plaster"], tone=4.6)), hide=["top"])
    beam = s.style("beam", dict(STYLES["wood_dark"], layers=STYLES["wood_dark"]["layers"] + [
        {"op": "cracks", "scale": 5, "width": 0.4, "threshold": 0.88, "shift": -1.0}]))
    for k, z in enumerate((-34, -12, 10, 32, 54, 76, 98, 120)):
        s.box(f"beam_{k}", [W, 3.2, 3.6], [0, H - 1.6, z], beam, hide=["top"])
    return s


@spec
def window():
    s = Spec("window", "Frosted bay window", "A deep bay window in the back wall: splayed panelled reveals, a sash with six panes, an "
             "oak casing, a window seat with a plum cushion and pillows, a carved pelmet, linen curtains caught back with berry "
             "ties, and snow drifted on the outside ledge.", density=2.0, tris=1500)
    X0, X1, Y0, Y1, Z = -WX, WX, WY0, WY1, WZ
    gz = Z - 7  # the glass plane, set back into the bay
    # splayed reveals and the bay's head and floor (panelled)
    rev = s.style("reveal", boards("y", "pwood", 4.6))
    for sd in (-1, 1):
        s.box("reveal_" + ("l" if sd < 0 else "r"), [1.2, Y1 - Y0, 8], [sd * (WX + 1.0), (Y0 + Y1) / 2, Z - 3.6], rev, rotation=[0, -sd * 14, 0])
    s.box("bay_head", [2 * WX + 2, 1.2, 8], [0, Y1 + 0.6, Z - 3.6], rev)
    s.box("bay_floor", [2 * WX + 2, 1.2, 8], [0, Y0 - 0.6, Z - 3.6], "wood_light")
    # the sash: frame, mullions, glazing bars
    sash = s.style("sash", dict(STYLES["wood_light"], tone=5.2))
    s.box("sash_top", [2 * WX, 1.6, 1.4], [0, Y1 - 0.8, gz], sash)
    s.box("sash_bot", [2 * WX, 2.0, 1.4], [0, Y0 + 1.0, gz], sash)
    for sd in (-1, 1):
        s.box("sash_" + ("l" if sd < 0 else "r"), [1.6, Y1 - Y0, 1.4], [sd * (WX - 0.8), (Y0 + Y1) / 2, gz], sash)
    for k, x in enumerate((-WX / 3, WX / 3)):
        s.box(f"mullion_{k}", [1.0, Y1 - Y0 - 2, 1.2], [x, (Y0 + Y1) / 2, gz], sash)
    s.box("transom", [2 * WX - 2, 1.0, 1.2], [0, Y0 + (Y1 - Y0) * 0.62, gz], sash)
    # snow piled on the outside ledge, behind the glass
    s.box("snow_ledge", [2 * WX - 2, 2.4, 4], [0, Y0 + 3.2, gz - 2.6], "snow")
    s.box("snow_heap", [14, 1.6, 3], [-8, Y0 + 5.0, gz - 2.6], "snow")
    # casing on the wall face
    case = s.style("casing", dict(STYLES["wood"], layers=STYLES["wood"]["layers"] + [
        {"op": "stripes", "axis": "x", "period": 1.0, "width": 0.3, "shift": -0.7, "faces": ["front"]}]))
    for sd in (-1, 1):
        s.box("casing_" + ("l" if sd < 0 else "r"), [3.2, Y1 - Y0 + 4, 1.2], [sd * (WX + 1.6), (Y0 + Y1) / 2 + 1, Z + 0.6], case)
    # the window seat: a deep ledge with a cushion and two pillows
    s.box("seat", [2 * WX + 8, 2.0, 9], [0, Y0 - 1.0, Z + 3.0], "wood_light", chamfer=0.4)
    s.box("seat_apron", [2 * WX + 6, 1.6, 0.8], [0, Y0 - 2.8, Z + 7.0], "wood")
    cushion = s.style("cushion", cloth("plum", 5.4, [{"op": "stripes", "axis": "x", "period": 4, "width": 0.08, "ramp": "honey", "tone": 6}]))
    s.box("cushion", [2 * WX + 2, 2.2, 7.4], [0, Y0 + 1.1, Z + 2.6], cushion, chamfer=0.8)
    pil1 = s.style("pillow1", knit("sage", 5.5, ("cream", 6), 2.2))
    pil2 = s.style("pillow2", cloth("rose", 5.2, [{"op": "spots", "count": 12, "radius": [0.4, 0.6], "ramp": "cream", "tone": 7, "min_gap": 1.4}]))
    s.box("pillow_a", [7, 6, 2.4], [-13, Y0 + 5.0, Z + 1.0], pil1, chamfer=1.0, rotation=[-14, 12, -6])
    s.box("pillow_b", [6, 5.4, 2.2], [14, Y0 + 4.8, Z + 1.0], pil2, chamfer=1.0, rotation=[-12, -16, 8])
    # pelmet with a scalloped edge and a painted holly band
    pel = s.style("pelmet", dict(STYLES["sage_paint"], stamps=[{"face": "front", "at": "center", "art": [
        "..g.r...g.r...g.r...g.r...g.r...g.r...g.r...g.r..",
        ".ggGgr.ggGgr.ggGgr.ggGgr.ggGgr.ggGgr.ggGgr.ggGgr.",
        "..g.....g.....g.....g.....g.....g.....g.....g....",
    ], "key": {"g": "pine:4", "G": "pine:7", "r": "berry:6"}}]))
    s.box("pelmet", [2 * WX + 12, 4.4, 3.0], [0, Y1 + 4.4, Z + 1.5], pel, chamfer=0.4)
    s.box("pelmet_trim", [2 * WX + 13, 0.8, 3.4], [0, Y1 + 2.0, Z + 1.7], "wood_dark")
    # curtains gathered at a tie-back
    curtain = s.style("curtain", cloth("linen", 5.6, [{"op": "stripes", "axis": "x", "period": 1.6, "width": 0.35, "shift": -0.9},
                                                     {"op": "band", "axis": "y", "from": -1, "to": -0.86, "ramp": "berry", "tone": 5}]))
    for sd in (-1, 1):
        x = sd * (WX + 4.5)
        s.loft("curtain_" + ("l" if sd < 0 else "r"), [
            {"at": [0, 0, 0], "size": [8, 2.6]}, {"at": [sd * -1.2, -10, 0.3], "size": [5.4, 2.8]},
            {"at": [sd * -0.4, -17, 0.6], "size": [3.0, 2.4]}, {"at": [0, -24, 0.4], "size": [6.0, 2.8]},
            {"at": [sd * 1.0, -34, 0.2], "size": [8.4, 3.0]}], [x, Y1 + 2, Z + 3.2], curtain, sides=8, rnd=2.4, caps=[True, True])
        s.box("tie_" + ("l" if sd < 0 else "r"), [4.2, 1.4, 3.6], [x - sd * 0.8, Y1 - 15, Z + 3.8], s.style("tie", cloth("berry", 5)), chamfer=0.4)
    # a curtain pole with brass finials
    s.prism("pole", [1.0, 1.0, 2 * WX + 18], [0, Y1 + 2.4, Z + 3.6], "brass", sides=8, rotation=[0, 90, 0])
    for sd in (-1, 1):
        s.prism("finial_" + ("l" if sd < 0 else "r"), [2.0, 2.0, 2.0], [sd * (WX + 10), Y1 + 2.4, Z + 3.6], "brass", sides=8, rotation=[0, 90, 0])
    return s


# ------------------------------------------------------------------ wall shelves crowded with goods

def gift(s, pid, size, at, ramp, ribbon, rot=0):
    st = s.style("gift_" + ramp + "_" + ribbon, {"ramp": ramp, "tone": 5, "rim": RIM, "layers": [
        {"op": "noise", "scale": 3, "amount": 0.25},
        {"op": "band", "axis": "x", "from": -0.14, "to": 0.14, "ramp": ribbon, "tone": 6, "bevel": True, "faces": ["front", "back", "top"]},
        {"op": "band", "axis": "z", "from": -0.14, "to": 0.14, "ramp": ribbon, "tone": 6, "bevel": True, "faces": ["left", "right", "top"]}]})
    s.box(pid, size, at, st, rotation=[0, rot, 0], chamfer=0.2)


def hatbox(s, pid, w, h, at, ramp, band, rot=0):
    st = s.style("hatbox_" + ramp + band, {"ramp": ramp, "tone": 5.2, "rim": RIM, "layers": [
        photo("rough_linen", 5, 0.6), {"op": "stripes", "axis": "z", "period": 2.0, "width": 0.4, "shift": -0.4}]})
    s.prism(pid, [w, w, h], at, st, sides=10, rotation=stand_up([0, rot, 0]))
    s.prism(pid + "_lid", [w + 0.6, w + 0.6, 1.0], [at[0], at[1] + h / 2 + 0.5, at[2]], s.style("hatlid_" + band, cloth(band, 5)), sides=10, rotation=stand_up([0, rot, 0]))


def folded(s, pid, size, at, style, rot=0):
    s.box(pid, size, at, style, chamfer=0.5, rotation=[0, rot, 0])


def jar(s, pid, w, h, at, fill, cap="brass"):
    st = s.style("jar_" + fill, {"ramp": "glass", "tone": 5, "brush": {"off": True}, "rim": {"light": 1, "dark": 1, "light_shift": 2, "outline": "dark"}, "layers": [
        {"op": "spots", "count": 18, "radius": [0.35, 0.6], "ramp": fill, "tone": 6, "min_gap": 0.2, "where": {"y": [-1, 0.5]}, "bevel": True},
        {"op": "gloss", "post": True, "dash": True, "length": 2, "density": 0.6, "shift": 3, "ramps": ["glass"]}]})
    s.prism(pid, [w, w, h], at, st, sides=8, rotation=stand_up())
    s.prism(pid + "_cap", [w * 0.8, w * 0.8, 0.8], [at[0], at[1] + h / 2 + 0.4, at[2]], cap, sides=8, rotation=stand_up())


def spool(s, pid, at, ramp, rot=0):
    s.prism(pid, [2.8, 2.8, 2.0], at, "wood_light", sides=8, rotation=[0, 90 + rot, 0])
    s.prism(pid + "_r", [2.4, 2.4, 1.6], at, s.style("spool_" + ramp, cloth(ramp, 5.6, [{"op": "stripes", "axis": "z", "period": 0.5, "width": 0.3, "shift": -0.6}])), sides=8, rotation=[0, 90 + rot, 0])


def price_tag(s, pid, at, rot=0):
    st = s.style("ptag", {"ramp": "kraft", "tone": 5.4, "rim": RIM, "stamps": [
        {"face": "front", "at": "center", "art": [".i.", "...", "iii", ".i."], "key": {"i": "ink:3"}}]})
    s.box(pid, [2.2, 1.6, 0.2], at, st, rotation=[0, 0, rot])
    s.box(pid + "_string", [0.2, 1.4, 0.2], [at[0] - 0.2, at[1] + 1.4, at[2]], "linen")


@spec
def shelves():
    s = Spec("shelves", "Boutique wall shelves", "A tall oak shelf unit with a dusk-blue beadboard back and a sage cupboard below, crowded "
             "with folded jumpers, hat boxes, gift boxes, button and sweet jars, ribbon spools, perfume bottles, books, a candle "
             "lantern and a trailing ivy, with kraft price tags on strings along the shelf edges.", density=2.0, tris=3400, colors=240)
    W, H, D = 32, 46, 7
    s.box("side_l", [1.6, H, D], [-(W / 2 - 0.8), H / 2, 0], "wood")
    s.box("side_r", [1.6, H, D], [W / 2 - 0.8, H / 2, 0], "wood")
    s.box("back", [W - 3.2, H - 2, 0.6], [0, H / 2, -D / 2 + 0.3], s.style("beadboard", boards("x", "dusk", 5.4)), hide=["back"])
    s.box("crown", [W + 2, 2.4, D + 1.5], [0, H + 1.2, 0.4], "wood")
    s.box("cornice", [W + 3, 0.8, D + 2.4], [0, H + 2.8, 0.6], "wood_dark")
    s.box("cupboard", [W - 3.2, 11, D - 0.6], [0, 6.7, -0.2], "sage_paint", hide=["back"])
    door = s.style("door", dict(STYLES["sage_paint"], layers=STYLES["sage_paint"]["layers"] + [{"op": "panel", "inset": 2, "shift": -1.0, "highlight": 1, "shadow": 1}]))
    for sd in (-1, 1):
        s.box("door_" + ("l" if sd < 0 else "r"), [W / 2 - 2.4, 9.4, 0.6], [sd * (W / 4 - 0.6), 6.8, D / 2 - 0.2], door)
        s.prism("knob_" + ("l" if sd < 0 else "r"), [0.9, 0.9, 0.8], [sd * 1.4, 7.2, D / 2 + 0.4], "brass", sides=6)
    s.box("plinth", [W + 1, 1.2, D + 0.6], [0, 0.6, 0.2], "wood_dark")
    board = s.style("board", dict(STYLES["wood_light"], tone=4.4))
    shelf_y = [12.6, 21.8, 31.0, 40.2]
    for k, y in enumerate(shelf_y):
        s.box(f"shelf_{k}", [W - 3.2, 0.8, D - 0.4], [0, y, 0], board)
        s.box(f"lip_{k}", [W - 3.2, 1.2, 0.5], [0, y - 0.2, D / 2 - 0.1], "wood_dark")
    # shelf 1: folded jumpers, hat boxes, button jars
    y = shelf_y[0] + 0.4
    for i, (st, h) in enumerate(((s.style("knit_sage", knit("sage", 5.4, ("cream", 6))), 1.6), (s.style("knit_berry", knit("berry", 5.4)), 1.5), (s.style("knit_cream", knit("cream", 5.0, ("lake", 5))), 1.6))):
        folded(s, f"jumper_{i}", [7, h, 5], [-9, y + 0.8 + sum((1.6, 1.5, 1.6)[:i]), 0.5], st, rot=(-4, 5, -2)[i])
    hatbox(s, "hatbox_a", 6, 4.2, [1, y + 2.1, 0.2], "rose", "sage")
    jar(s, "btn_jar_a", 2.6, 3.4, [7.6, y + 1.7, 1.0], "honey")
    jar(s, "btn_jar_b", 2.2, 2.8, [10.6, y + 1.4, 1.4], "lake")
    price_tag(s, "ptag_0", [-9, shelf_y[0] - 2.2, D / 2 + 0.3], 6)
    price_tag(s, "ptag_1", [8.6, shelf_y[0] - 2.4, D / 2 + 0.3], -8)
    # shelf 2: gift boxes and a row of ribbon spools
    y = shelf_y[1] + 0.4
    gift(s, "gift_a", [5, 4, 4.4], [-10, y + 2, 0.4], "lake", "cream", 6)
    gift(s, "gift_b", [3.6, 2.8, 3.4], [-10.4, y + 5.4, 0.4], "berry", "honey", -10)
    gift(s, "gift_c", [4, 3.4, 4], [-4.6, y + 1.7, 0.6], "cream", "berry", -4)
    for i, (x, rmp) in enumerate(((1.0, "berry"), (3.4, "sage"), (5.8, "honey"), (8.2, "lake"), (10.6, "rose"))):
        spool(s, f"spool_{i}", [x, y + 1.4, 1.0 - (i % 2) * 0.6], rmp)
    price_tag(s, "ptag_2", [4.4, shelf_y[1] - 2.4, D / 2 + 0.3], 4)
    # shelf 3: folded scarves, frost perfume bottles, a little candle lantern
    y = shelf_y[2] + 0.4
    folded(s, "scarf_a", [6.4, 1.2, 4.4], [-10, y + 0.6, 0.6], s.style("knit_lake", knit("lake", 5.6, ("snow", 6), 2.0)), 4)
    folded(s, "scarf_b", [6.0, 1.2, 4.2], [-10, y + 1.8, 0.6], s.style("knit_plum", knit("plum", 5.6, ("rose", 6), 2.0)), -6)
    folded(s, "scarf_c", [5.6, 1.1, 4.0], [-10, y + 2.95, 0.6], s.style("knit_honey", knit("honey", 5.4)), 2)
    for i, (x, h, c) in enumerate(((-3.6, 3.2, "lilac"), (-1.4, 2.4, "rose"), (0.6, 2.8, "frost"))):
        st = s.style("bottle_" + c, {"ramp": c, "tone": 6, "brush": {"off": True}, "rim": {"light": 1, "dark": 1, "light_shift": 2, "outline": "dark"},
                                     "layers": [{"op": "gloss", "post": True, "dash": True, "length": 2, "density": 0.7, "shift": 2}]})
        s.prism(f"bottle_{i}", [1.8, 1.8, h], [x, y + h / 2, 1.2], st, sides=6, rotation=stand_up())
        s.prism(f"bottle_{i}_cap", [0.9, 0.9, 1.0], [x, y + h + 0.5, 1.2], "brass", sides=6, rotation=stand_up())
    # candle lantern
    s.box("lamp_base", [3.4, 0.6, 3.4], [6.8, y + 0.3, 0.6], "iron")
    s.box("lamp_glow", [2.6, 3.6, 2.6], [6.8, y + 2.4, 0.6], "glow")
    for i, (dx, dz) in enumerate(((-1.4, -1.4), (1.4, -1.4), (-1.4, 1.4), (1.4, 1.4))):
        s.box(f"lamp_post{i}", [0.5, 3.8, 0.5], [6.8 + dx, y + 2.5, 0.6 + dz], "iron")
    s.prism("lamp_cap", [4.0, 4.0, 1.6], [6.8, y + 5.2, 0.6], "iron", sides=4, rotation=stand_up([0, 45, 0]), back_scale=[1, 1], front_scale=[0.2, 0.2])
    s.box("lamp_ring", [1.4, 1.4, 0.4], [6.8, y + 6.3, 0.6], "iron")
    hatbox(s, "hatbox_b", 4.2, 3.0, [11.2, y + 1.5, 0.4], "cream", "berry")
    price_tag(s, "ptag_3", [-10, shelf_y[2] - 2.3, D / 2 + 0.3], -5)
    price_tag(s, "ptag_4", [-1.6, shelf_y[2] - 2.5, D / 2 + 0.3], 7)
    # shelf 4: a tall stack of hat boxes, books, a trailing ivy
    y = shelf_y[3] + 0.4
    hatbox(s, "hatbox_c", 6.4, 3.6, [-9.6, y + 1.8, 0.2], "sage", "honey")
    hatbox(s, "hatbox_d", 5.0, 2.8, [-9.4, y + 5.2, 0.2], "lilac", "rose", 12)
    for i, (x, h, c, r) in enumerate(((-3.0, 5.2, "berry", 0), (-1.8, 4.6, "lake", 0), (-0.7, 5.6, "sage", 0), (0.9, 4.8, "honey", -14))):
        st = s.style("book_" + c, {"ramp": c, "tone": 4.6, "rim": RIM, "layers": [{"op": "band", "axis": "y", "from": 0.55, "to": 0.7, "ramp": "brass", "tone": 6, "faces": ["front"]},
                                                                                {"op": "band", "axis": "y", "from": -0.7, "to": -0.55, "ramp": "brass", "tone": 6, "faces": ["front"]}]})
        s.box(f"book_{i}", [1.1, h, 4], [x, y + h / 2, 0.4], st, rotation=[0, 0, r])
    s.prism("ivy_pot", [3.2, 3.2, 2.8], [8.6, y + 1.4, 0.8], "terra", sides=8, rotation=stand_up(), front_scale=[1.15, 1.15])
    IVY = ["..gg..", ".gGGg.", "gGgGGg", ".gGGg.", "..gg..", "...g..", "..g...", ".gg...", "gGGg..", ".gg..."]
    for i, (x, y2, z, rx, ry) in enumerate(((7.6, 1.6, 1.4, -5, 20), (9.6, 0.6, 1.6, -2, -30), (8.2, -2.4, 2.6, 5, 10), (10.4, -3.6, 2.8, 8, -20), (6.8, -1.0, 2.2, 0, 40))):
        s.card(f"ivy_{i}", IVY, [x, y + y2, z], {"g": "fern:3", "G": "fern:6"}, rotation=[rx, ry, 0])
    price_tag(s, "ptag_5", [-9.6, shelf_y[3] - 2.4, D / 2 + 0.3], 5)
    return s


# ------------------------------------------------------------------ the garment rail

@spec
def rail():
    s = Spec("rail", "Garment rail", "A brass garment rail on oak feet hung with six owl-sized winter garments on wooden hangers (a striped "
             "berry jumper, a sage linen coat, a plum velvet cape, a cream cardigan with honey buttons, a lake-blue knit and a "
             "terracotta duffle), with a slatted shelf below holding hat boxes.", density=2.0, tris=2600)
    L, H = 30, 30
    for sd in (-1, 1):
        nm = "l" if sd < 0 else "r"
        s.box("foot_" + nm, [2.2, 1.4, 11], [sd * L / 2, 0.7, 0], "wood_dark", chamfer=0.3)
        s.prism("post_" + nm, [1.1, 1.1, H - 1.4], [sd * L / 2, 1.4 + (H - 1.4) / 2, 0], "brass", sides=8, rotation=stand_up())
        s.prism("finial_" + nm, [1.8, 1.8, 1.8], [sd * (L / 2 + 0.9), H, 0], "brass", sides=8, rotation=[0, 90, 0])
    s.prism("bar", [1.0, 1.0, L], [0, H, 0], "brass", sides=8, rotation=[0, 90, 0])
    s.box("shelf", [L - 1.4, 0.8, 8], [0, 4.2, 0], s.style("slats", dict(STYLES["wood_light"], layers=STYLES["wood_light"]["layers"] + [
        {"op": "stripes", "axis": "z", "period": 2.0, "width": 0.16, "shift": -1.8, "faces": ["top"]}])))
    hatbox(s, "hb_a", 6, 4, [-8, 4.6 + 2, 0], "lake", "cream")
    hatbox(s, "hb_b", 5, 3.2, [7, 4.6 + 1.6, 0.5], "rose", "sage", 10)
    looks = [
        ("jumper", knit("berry", 5.2, ("cream", 6.5), 2.4), [7.2, 2.4], 11),
        ("coat", cloth("sage", 5.0, [{"op": "stripes", "axis": "y", "period": 3, "width": 0.1, "shift": -0.8}]), [7.6, 2.6], 16),
        ("cape", {"ramp": "plum", "tone": 5.4, "rim": RIM, "layers": [{"op": "noise", "scale": 2, "amount": 0.4}, {"op": "gloss", "post": True, "dash": True, "length": 3, "density": 0.4, "shift": 1.5}]}, [8.4, 2.2], 15),
        ("cardigan", knit("cream", 5.2), [7.0, 2.4], 12),
        ("knit", knit("lake", 5.4, ("frost", 6.5), 1.6), [7.0, 2.4], 11),
        ("duffle", cloth("terra", 5.2), [7.6, 2.8], 14),
    ]
    for i, (nm, st, (w, d), ln) in enumerate(looks):
        x = -11.5 + i * 4.6
        yaw = 64 + (i % 3 - 1) * 6
        st = s.style("garment_" + nm, st)
        s.box(f"hook_{i}", [0.4, 1.6, 0.4], [x, H - 0.6, 0], "brass")
        s.box(f"hanger_{i}", [7.4, 0.7, 0.6], [x, H - 1.8, 0], "wood_light", rotation=[0, yaw, 0])
        s.loft(f"garment_{i}", [{"at": [0, 0, 0], "size": [3.0, 1.4]}, {"at": [0, -1.2, 0], "size": [w, d]}, {"at": [0, -3, 0], "size": [w - 0.6, d + 0.3]},
                                 {"at": [0, -ln * 0.55, 0], "size": [w - 1.2, d + 0.4]}, {"at": [0, -ln, 0], "size": [w + 0.6, d + 0.6]}],
               [x, H - 1.6, 0], st, sides=8, rnd=3.0, rotation=[0, yaw, 0], caps=[True, True])
        for sd in (-1, 1):
            s.box(f"sleeve_{i}_{'l' if sd < 0 else 'r'}", [1.8, ln * 0.62, 1.8], [sd * (w / 2 + 0.2), -1.6 - ln * 0.31, 0], st,
                  parent=f"garment_{i}", rotation=[0, 0, sd * 6])
    s.style("btn", {"ramp": "honey", "tone": 6})
    return s


# ------------------------------------------------------------------ hat stand

@spec
def hatstand():
    s = Spec("hatstand", "Hat stand", "A turned dark-oak hat stand on four splayed feet, hung with a berry bobble hat, a sage felt hat with a "
             "ribbon band and a long lake-blue scarf with fringed ends.", density=2.0, tris=1600)
    for k in range(4):
        a = k * 90 + 45
        s.box(f"foot_{k}", [1.4, 1.2, 8], [math.sin(math.radians(a)) * 3.4, 1.4, math.cos(math.radians(a)) * 3.4], "wood_dark", rotation=[10, a, 0], chamfer=0.3)
    s.prism("hub", [3, 3, 3], [0, 2.0, 0], "wood_dark", sides=8, rotation=stand_up())
    s.prism("pole", [1.4, 1.4, 26], [0, 15.5, 0], s.style("turned", dict(STYLES["wood_dark"], layers=STYLES["wood_dark"]["layers"] + [
        {"op": "stripes", "axis": "z", "period": 5, "width": 0.12, "shift": 1.2}])), sides=8, rotation=stand_up())
    s.prism("collar", [2.2, 2.2, 1.0], [0, 26, 0], "brass", sides=8, rotation=stand_up())
    s.prism("top", [2.2, 2.2, 2.2], [0, 29.4, 0], "wood_dark", sides=8, rotation=stand_up(), front_scale=[0.3, 0.3])
    for k, a in enumerate((30, 120, 210, 300)):
        s.prism(f"peg_{k}", [0.7, 0.7, 4.4], [math.sin(math.radians(a)) * 1.6, 27.4, math.cos(math.radians(a)) * 1.6], "wood_dark", sides=6, rotation=[-38, a, 0])
    # a berry bobble hat on the front-left peg
    bob = s.style("bobble", knit("berry", 5.4, ("cream", 6.6), 1.6))
    s.loft("bobble_hat", [{"at": [0, 0, 0], "size": 5.2}, {"at": [0, 1.6, 0], "size": 5.4}, {"at": [0, 3.4, 0], "size": 4.4},
                          {"at": [0, 4.6, 0], "size": 2.4}, {"at": [0, 5.0, 0], "size": 0}], [-2.6, 28.2, 2.2], bob, sides=10, rnd=2.0, up=[0, 0, 1], rotation=[16, 0, 22])
    s.prism("bobble", [2.4, 2.4, 2.2], [-4.4, 33.2, 3.4], s.style("pom", knit("cream", 6)), sides=8, rotation=stand_up())
    # a sage felt hat with a ribbon on the back-right peg
    felt = s.style("felt", {"ramp": "sage", "tone": 4.8, "rim": RIM, "layers": [photo("rough_linen", 4, 0.5), {"op": "noise", "scale": 3, "amount": 0.3}]})
    s.prism("felt_brim", [8, 8, 0.6], [3.2, 28.6, -1.8], felt, sides=12, rotation=stand_up([0, 0, 0]))
    s.prism("felt_crown", [4.6, 4.6, 3.4], [3.2, 30.6, -1.8], felt, sides=10, rotation=stand_up(), front_scale=[0.85, 0.85])
    s.prism("felt_band", [4.8, 4.8, 0.8], [3.2, 29.4, -1.8], s.style("band", cloth("berry", 5)), sides=10, rotation=stand_up())
    # a long knitted scarf draped over a peg
    sc = s.style("scarf", knit("lake", 5.4, ("snow", 6.4), 2.4))
    s.box("scarf_a", [3, 14, 0.8], [1.6, 20.4, 2.6], sc, rotation=[-6, 20, 4])
    s.box("scarf_b", [3, 11, 0.8], [3.6, 21.6, 1.0], sc, rotation=[4, 70, -6])
    FR = ["s.s.s.s", "s.s.s.s", "s.s.s.s", "..s.s.."]
    s.card("fringe_a", FR, [1.4, 12.6, 2.9], {"s": "snow:5"}, rotation=[-6, 20, 4])
    return s


# ------------------------------------------------------------------ the owl dress form (bust)

def bust_parts(s):
    linen = s.style("form", {"ramp": "linen", "tone": 5.6, "rim": RIM, "layers": [
        photo("rough_linen", 4, 0.9), {"op": "noise", "scale": 4, "amount": 0.2},
        {"op": "stripes", "axis": "x", "period": 4.0, "width": 0.07, "shift": -1.3},
        {"op": "band", "axis": "y", "from": 0.18, "to": 0.24, "shift": -1.2}]})
    s.loft("form", [{"at": [0, 0, 0], "size": [9, 8]}, {"at": [0, 3, 0.2], "size": [11.8, 10.2]}, {"at": [0, 7, 0.4], "size": [12.6, 11]},
                    {"at": [0, 11, 0.3], "size": [11.6, 10.2]}, {"at": [0, 13.6, 0.1], "size": [10.2, 9.2]},
                    {"at": [0, 15.8, 0], "size": [10.8, 9.6]}, {"at": [0, 18.6, 0], "size": [10.4, 9.2]}, {"at": [0, 20.6, 0], "size": [8.6, 7.6]},
                    {"at": [0, 21.8, 0], "size": [5.4, 4.8]}, {"at": [0, 22.4, 0], "size": 0}],
           [0, 15, 0], linen, sides=10, rnd=2.2, up=[0, 0, 1], caps=[True, False])
    s.prism("neck_cap", [3, 3, 1.0], [0, 38.0, 0], "wood_dark", sides=8, rotation=stand_up())
    s.prism("base_cap", [9.4, 8.4, 1.0], [0, 14.6, 0], "wood_dark", sides=10, rotation=stand_up())
    s.prism("collar", [2.4, 2.4, 1.2], [0, 13.6, 0], "brass", sides=8, rotation=stand_up())
    s.prism("pole", [1.2, 1.2, 10.0], [0, 8.4, 0], "brass", sides=8, rotation=stand_up())
    s.prism("hub", [2.6, 2.6, 1.6], [0, 3.6, 0], "wood_dark", sides=8, rotation=stand_up())
    for k, a in enumerate((0, 120, 240)):
        s.box(f"leg_{k}", [1.2, 1.0, 7.2], [math.sin(math.radians(a)) * 3.2, 2.0, math.cos(math.radians(a)) * 3.2], "wood_dark", rotation=[22, a, 0], chamfer=0.25)
        s.prism(f"wheel_{k}", [1.2, 1.2, 0.8], [math.sin(math.radians(a)) * 6.0, 0.6, math.cos(math.radians(a)) * 6.0], "brass", sides=6, rotation=[0, a + 90, 0])


@spec
def bust():
    s = Spec("bust", "Owl dress form", "An owl-shaped tailor's dress form in pinned linen with seam lines, on a brass pole and a "
             "three-legged oak stand with little brass casters.", density=2.0, tris=1200)
    bust_parts(s)
    return s


@spec
def bust_dressed():
    s = Spec("bust_dressed", "Dressed owl dress form", "The owl dress form wearing a chunky sage knitted scarf with fringed tails, a rose "
             "beret and a berry pincushion with pins on its shoulder.", density=2.0, tris=1700)
    bust_parts(s)
    sc = s.style("dscarf", knit("sage", 5.4, ("cream", 6.6), 2.0))
    ring = []
    for k in range(13):
        a = k / 12 * math.tau
        ring.append({"at": [math.sin(a) * 6.0, 28.6 + math.cos(a) * 0.5, math.cos(a) * 5.4], "size": 2.8})
    s.loft("scarf_loop", ring, [0, 0, 0], sc, sides=6, rnd=2.2)
    s.box("scarf_tail_a", [2.8, 9, 0.9], [-1.6, 24.4, 5.6], sc, rotation=[-14, 0, 8])
    s.box("scarf_tail_b", [2.6, 7, 0.9], [1.4, 25.4, 5.8], sc, rotation=[-12, 0, -6])
    FR = ["c.c.c", "c.c.c", "c.c.c"]
    s.card("fr_a", FR, [-2.2, 19.6, 6.8], {"c": "cream:6"}, rotation=[-14, 0, 8])
    beret = s.style("beret", cloth("rose", 5.2))
    s.prism("beret", [10.6, 10.0, 1.6], [0.8, 37.0, 0.0], beret, sides=12, rotation=stand_up([-8, 0, 10]), front_scale=[0.8, 0.8])
    s.prism("beret_tip", [0.8, 0.8, 1.0], [1.4, 38.6, 0.0], beret, sides=6, rotation=stand_up())
    s.prism("pincushion", [3.0, 3.0, 1.6], [4.0, 27.6, 1.2], s.style("pin", cloth("berry", 5.2)), sides=8, rotation=stand_up([0, 0, -20]))
    return s


# ------------------------------------------------------------------ display furniture

@spec
def pedestal():
    s = Spec("pedestal", "Display pedestal", "An octagonal fluted oak display plinth with a brass ring and a berry velvet throw with "
             "honey tassels: today's furniture stands on it.", density=2.0, tris=600)
    s.prism("base", [14, 14, 1.6], [0, 0.8, 0], "wood_dark", sides=8, rotation=stand_up([0, 22.5, 0]))
    s.prism("column", [11, 11, 8.4], [0, 5.8, 0], s.style("fluted", dict(STYLES["wood"], layers=STYLES["wood"]["layers"] + [
        {"op": "stripes", "axis": "x", "period": 1.6, "width": 0.3, "shift": -0.9}])), sides=8, rotation=stand_up([0, 22.5, 0]))
    s.prism("ring", [11.6, 11.6, 0.8], [0, 2.0, 0], "brass", sides=8, rotation=stand_up([0, 22.5, 0]))
    s.prism("top", [14, 14, 1.2], [0, 10.6, 0], "wood_light", sides=8, rotation=stand_up([0, 22.5, 0]))
    vel = s.style("velvet", {"ramp": "berry", "tone": 4.8, "rim": RIM, "layers": [{"op": "noise", "scale": 2, "amount": 0.45},
                                                                                {"op": "band", "axis": "y", "from": -1, "to": -0.6, "ramp": "honey", "tone": 6, "faces": ["sides"]},
                                                                                {"op": "gloss", "post": True, "dash": True, "length": 2, "density": 0.4, "shift": 1.5}]})
    s.prism("throw", [14.6, 14.6, 1.6], [0, 11.4, 0], vel, sides=8, rotation=stand_up([0, 22.5, 0]))
    TAS = [".h.", "hHh", "hHh", "hhh", "h.h"]
    for k in range(4):
        a = math.radians(k * 90 + 45)
        s.card(f"tassel_{k}", TAS, [math.sin(a) * 7.6, 9.2, math.cos(a) * 7.6], {"h": "honey:4", "H": "honey:7"}, rotation=[0, k * 90 + 45, 0])
    return s


@spec
def riser():
    s = Spec("riser", "Counter display riser", "A little brass cake-stand riser with an oak top and a lace doily, for the counter's daily deal.",
             density=2.0, tris=300)
    s.prism("foot", [9, 9, 0.8], [0, 0.4, 0], "brass", sides=10, rotation=stand_up())
    s.prism("stem", [1.8, 1.8, 2.6], [0, 2.1, 0], "brass", sides=8, rotation=stand_up(), front_scale=[0.7, 0.7])
    s.prism("plate", [10, 10, 0.8], [0, 3.8, 0], "wood_light", sides=10, rotation=stand_up())
    doily = s.style("doily", {"ramp": "cream", "tone": 6.4, "rim": {"light": 0, "dark": 0}, "light": 0.3, "layers": [
        {"op": "spots", "count": 30, "radius": [0.25, 0.4], "ramp": "cream", "tone": 3, "min_gap": 0.6}]})
    s.prism("doily", [9.4, 9.4, 0.15], [0, 4.25, 0], doily, sides=12, rotation=stand_up())
    return s


@spec
def case():
    s = Spec("case", "Glass display case", "A sage-painted shop cabinet with two brass-pulled drawers under a brass-framed glass case "
             "(the glass is added in the game) lined in berry velvet, showing folded knitted scarves, a beret, a cloche hat and "
             "honey mittens.", density=2.0, tris=1800)
    L, D = 22, 9
    s.box("cabinet", [L, 8.4, D], [0, 4.2 + 0.8, 0], "sage_paint")
    s.box("plinth", [L + 0.8, 0.8, D + 0.6], [0, 0.4, 0.1], "wood_dark")
    drw = s.style("drawer", dict(STYLES["sage_paint"], layers=STYLES["sage_paint"]["layers"] + [{"op": "panel", "inset": 2, "shift": -1.0, "highlight": 1, "shadow": 1}]))
    for sd in (-1, 1):
        nm = "l" if sd < 0 else "r"
        s.box("drawer_" + nm, [L / 2 - 1.6, 5.6, 0.6], [sd * (L / 4 - 0.2), 5.2, D / 2 + 0.3], drw)
        s.box("pull_" + nm, [2.6, 0.6, 0.6], [sd * (L / 4 - 0.2), 5.6, D / 2 + 0.9], "brass")
    s.box("ledge", [L + 1, 0.8, D + 1], [0, 9.6, 0], "wood_light", chamfer=0.25)
    s.box("velvet", [L - 1, 0.6, D - 1], [0, 10.3, 0], s.style("lining", {"ramp": "berry", "tone": 4.4, "rim": RIM, "layers": [{"op": "noise", "scale": 2, "amount": 0.4}]}))
    GH = 6.0
    for k, (x, z) in enumerate(((-L / 2, -D / 2), (L / 2, -D / 2), (-L / 2, D / 2), (L / 2, D / 2))):
        s.box(f"cpost_{k}", [0.8, GH, 0.8], [x * 0.98, 10 + GH / 2, z * 0.96], "brass")
    s.box("frame_f", [L, 0.8, 0.8], [0, 10 + GH, D / 2 * 0.96], "brass")
    s.box("frame_b", [L, 0.8, 0.8], [0, 10 + GH, -D / 2 * 0.96], "brass")
    s.box("frame_l", [0.8, 0.8, D], [-L / 2 * 0.98, 10 + GH, 0], "brass")
    s.box("frame_r", [0.8, 0.8, D], [L / 2 * 0.98, 10 + GH, 0], "brass")
    y = 10.6
    folded(s, "c_scarf_a", [6, 1.0, 4], [-6.5, y + 0.5, 0.2], s.style("cs_a", knit("sage", 5.4, ("cream", 6.6), 1.4)), 8)
    folded(s, "c_scarf_b", [5.6, 1.0, 3.8], [-6.4, y + 1.5, 0.2], s.style("cs_b", knit("berry", 5.4)), -6)
    folded(s, "c_scarf_c", [5.2, 0.9, 3.6], [-6.2, y + 2.45, 0.2], s.style("cs_c", knit("cream", 5.2, ("lake", 5), 1.4)), 3)
    s.prism("c_beret", [5.0, 4.6, 1.0], [0.4, y + 0.5, 0.4], s.style("cberet", cloth("lake", 5)), sides=12, rotation=stand_up([-6, 0, 0]), front_scale=[0.8, 0.8])
    s.loft("c_cloche", [{"at": [0, 0, 0], "size": 5.8}, {"at": [0, 0.5, 0], "size": 4.4}, {"at": [0, 2.4, 0], "size": 4.2},
                        {"at": [0, 3.4, 0], "size": 3.0}, {"at": [0, 3.8, 0], "size": 0}], [5.2, y, -0.6], s.style("cloche", cloth("rose", 5.2)), sides=10, rnd=2.0, up=[0, 0, 1])
    mit = s.style("mitten", knit("honey", 5.4, ("cream", 6.4), 1.2))
    s.box("c_mitten_a", [2.4, 0.9, 3.6], [8.6, y + 0.45, 1.8], mit, chamfer=0.4, rotation=[0, 20, 0])
    s.box("c_mitten_b", [2.4, 0.9, 3.6], [9.8, y + 1.2, 1.2], mit, chamfer=0.4, rotation=[0, -10, 0])
    return s


# ------------------------------------------------------------------ the wood stove

@spec
def stove():
    s = Spec("stove", "Pot-bellied wood stove", "A small cast-iron pot-bellied stove on curled feet with a glowing grate in its door, a brass "
             "rail, a terracotta enamel kettle on top, a stovepipe up to the ceiling and a wicker basket of birch logs beside it.",
             density=2.0, tris=1800)
    for k, a in enumerate((45, 135, 225, 315)):
        s.box(f"leg_{k}", [1.4, 3.4, 1.4], [math.sin(math.radians(a)) * 4.2, 1.7, math.cos(math.radians(a)) * 4.2], "iron", rotation=[0, a, 12], chamfer=0.3)
    s.prism("base", [12, 12, 1.2], [0, 3.6, 0], "iron", sides=10, rotation=stand_up())
    s.loft("belly", [{"at": [0, 0, 0], "size": 10}, {"at": [0, 3, 0], "size": 12.4}, {"at": [0, 7, 0], "size": 12.6},
                     {"at": [0, 10.4, 0], "size": 10.4}, {"at": [0, 11.4, 0], "size": 9.6}], [0, 4.2, 0], "iron", sides=10, rnd=2.0, up=[0, 0, 1], caps=[False, True])
    grate = s.style("grate", {"ramp": "fire", "tone": 4.4, "light": 0.15, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}, "layers": [
        {"op": "noise", "scale": 1.2, "amount": 1.6}, {"op": "stripes", "axis": "x", "period": 1.2, "width": 0.3, "ramp": "iron", "tone": 1}]})
    s.box("stove_glow", [5, 4.2, 0.6], [0, 9.4, 6.25], grate)
    s.box("door_frame", [6.4, 0.8, 0.8], [0, 11.9, 6.3], "brass")
    s.box("door_frame_b", [6.4, 0.8, 0.8], [0, 6.9, 6.3], "brass")
    s.prism("door_knob", [0.8, 0.8, 1.2], [3.6, 9.4, 6.6], "brass", sides=6)
    s.prism("top", [11.6, 11.6, 1.0], [0, 16.2, 0], "iron", sides=10, rotation=stand_up())
    s.prism("rail", [13.4, 13.4, 0.5], [0, 14.4, 0], "brass", sides=10, rotation=stand_up())
    s.prism("collar", [4.4, 4.4, 1.6], [-1.4, 17.4, -1.4], "iron", sides=8, rotation=stand_up())
    s.prism("pipe", [3.4, 3.4, 49], [-1.4, 18.2 + 24.5, -1.4], s.style("pipe", dict(STYLES["iron"], layers=STYLES["iron"]["layers"] + [
        {"op": "stripes", "axis": "z", "period": 12, "width": 0.06, "shift": 1.6}])), sides=8, rotation=stand_up())
    s.prism("damper", [4.0, 4.0, 0.6], [-1.4, 30, -1.4], "brass", sides=8, rotation=stand_up())
    ket = s.style("kettle", dict(STYLES["terra"], layers=STYLES["terra"]["layers"] + [{"op": "gloss", "post": True, "dash": True, "length": 2, "density": 0.5, "shift": 2}]))
    s.loft("kettle", [{"at": [0, 0, 0], "size": 5.4}, {"at": [0, 1.6, 0], "size": 6.0}, {"at": [0, 3.0, 0], "size": 4.6}, {"at": [0, 3.6, 0], "size": 2.4},
                      {"at": [0, 3.8, 0], "size": 0}], [2.6, 16.7, 1.6], ket, sides=10, rnd=2.0, up=[0, 0, 1])
    s.taper("spout", [1.0, 1.0, 3.6], [2.6, 18.2, 4.4], ket, rotation=[-30, 0, 0], front_scale=[0.6, 0.6])
    s.box("k_handle", [4.4, 0.6, 0.6], [2.6, 21.4, 1.6], "iron")
    s.box("k_handle_l", [0.6, 1.8, 0.6], [0.6, 20.6, 1.6], "iron")
    s.box("k_handle_r", [0.6, 1.8, 0.6], [4.6, 20.6, 1.6], "iron")
    # a wicker log basket
    wick = s.style("wicker", {"ramp": "kraft", "tone": 4.6, "rim": RIM, "layers": [
        {"op": "scales", "along": "x", "size": [1.2, 1.0], "shape": "square", "gap": 0.2, "jitter": 0.3}]})
    s.prism("basket", [8, 6, 4.8], [10.6, 2.4, 2.0], wick, sides=10, rotation=stand_up([0, 10, 0]))
    birch = s.style("birch", {"ramp": "cream", "tone": 5.6, "rim": RIM, "layers": [
        {"op": "spots", "count": 14, "radius": [0.3, 0.7], "stretch": [2.2, 0.5, 1], "ramp": "ink", "tone": 2, "min_gap": 0.4}]})
    for k, (x, y, z, r) in enumerate(((9.0, 5.6, 2.0, 8), (11.6, 5.8, 1.6, -6), (10.4, 7.6, 2.2, 3))):
        s.prism(f"log_{k}", [2.2, 2.2, 7.4], [x, y, z], birch, sides=7, rotation=[0, 90 + r * 3, r])
    return s


# ------------------------------------------------------------------ lantern, plants, garland, doormat

@spec
def lantern():
    s = Spec("lantern", "Hanging lantern", "A small black-iron and brass hanging lantern with four warm glowing panes, a peaked cap and a "
             "ring, hung on a chain.", density=3.0, tris=500)
    s.box("base", [5.4, 0.8, 5.4], [0, 0.4, 0], "iron", chamfer=0.3)
    s.box("brass_band", [5.0, 0.5, 5.0], [0, 1.05, 0], "brass")
    s.box("lantern_glow", [4.0, 5.4, 4.0], [0, 4.0, 0], s.style("pane", {"ramp": "lamp", "tone": 5.0, "light": 0.2, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}, "layers": [
        {"op": "gradient", "axis": "y", "amount": -1.2}, {"op": "stripes", "axis": "y", "period": 2.7, "width": 0.12, "ramp": "iron", "tone": 2}]}))
    for k, (x, z) in enumerate(((-2.1, -2.1), (2.1, -2.1), (-2.1, 2.1), (2.1, 2.1))):
        s.box(f"post_{k}", [0.7, 5.8, 0.7], [x, 4.0, z], "iron")
    s.box("top_plate", [5.4, 0.7, 5.4], [0, 7.2, 0], "iron", chamfer=0.3)
    s.prism("cap", [6.0, 6.0, 2.6], [0, 8.8, 0], "iron", sides=4, rotation=stand_up([0, 45, 0]), front_scale=[0.25, 0.25])
    s.prism("knob", [1.2, 1.2, 1.0], [0, 10.4, 0], "brass", sides=6, rotation=stand_up())
    s.prism("ring", [2.2, 2.2, 0.5], [0, 11.6, 0], "brass", sides=8, rotation=[0, 0, 0])
    s.box("chain", [0.4, 14, 0.4], [0, 19.6, 0], "iron")
    return s


@spec
def fir():
    s = Spec("fir", "Potted fir", "A potted little fir in a glazed terracotta pot, trimmed with tiny wooden stars and a berry ribbon.",
             density=2.0, tris=900)
    s.prism("pot", [8, 8, 7], [0, 3.5, 0], "terra", sides=10, rotation=stand_up(), front_scale=[1.15, 1.15])
    s.prism("pot_rim", [9.6, 9.6, 1.4], [0, 7.4, 0], "terra", sides=10, rotation=stand_up())
    s.prism("trunk", [1.4, 1.4, 6], [0, 9.6, 0], "wood_dark", sides=6, rotation=stand_up())
    needles = s.style("needles", {"ramp": "pine", "tone": 5.0, "rim": dict(RIM, outline="dark"), "layers": [
        {"op": "stripes", "axis": "y", "period": 1.0, "width": 0.4, "shift": -0.8},
        {"op": "noise", "scale": 1.6, "amount": 0.7},
        {"op": "spots", "count": 8, "radius": [0.4, 0.6], "ramp": "berry", "tone": 6, "min_gap": 2, "bevel": True},
        {"op": "spots", "count": 6, "radius": [0.4, 0.5], "ramp": "honey", "tone": 7, "min_gap": 2, "seed": 4, "bevel": True}]})
    for k, (y, w, h) in enumerate(((9.6, 16, 6.4), (12.8, 14, 6.0), (16, 12, 5.6), (19, 9.6, 5.2), (21.8, 7.2, 4.8), (24.2, 4.8, 4.2))):
        s.prism(f"tier_{k}", [w, w, h], [0, y + h / 2, 0], needles, sides=8, rotation=stand_up([0, k * 20, 0]), front_scale=[0.25, 0.25])
    s.prism("star", [1.6, 1.6, 0.6], [0, 28.8, 0], "brass", sides=5)
    return s


@spec
def plant():
    s = Spec("plant", "Potted Christmas rose", "A small potted hellebore with deep green leaves and creamy blooms, for sills and shelves.",
             density=2.0, tris=500)
    s.prism("pot", [5, 5, 4.4], [0, 2.2, 0], "terra", sides=8, rotation=stand_up(), front_scale=[1.15, 1.15])
    s.prism("rim", [6, 6, 1.0], [0, 4.6, 0], "terra", sides=8, rotation=stand_up())
    s.prism("soil", [5.2, 5.2, 0.3], [0, 4.9, 0], "wood_dark", sides=8, rotation=stand_up())
    for k in range(7):
        a = k * 51
        s.card(f"leaf_{k}", LEAF, [math.sin(math.radians(a)) * 0.6, 5.0, math.cos(math.radians(a)) * 0.6], {"g": "pine:3", "G": "pine:6"},
               rotation=[-24 - (k % 3) * 8, a, 0])
    for k, (x, y, z) in enumerate(((-0.8, 9.4, 1.0), (1.2, 8.8, 0.2), (0.0, 10.2, -0.8), (-1.6, 8.4, -0.4))):
        s.card(f"bloom_{k}", FLOWER, [x, y, z], {"w": "rose:7", "W": "snow:6", "y": "honey:7"}, rotation=[-40, k * 70, 0])
    return s


@spec
def garland():
    s = Spec("garland", "Pine garland", "A swag of pine garland with berries, little pine cones and rose ribbon bows.", density=2.0, tris=1100)
    ring = []
    for k in range(13):
        t = k / 12
        x = -24 + 48 * t
        ring.append({"at": [x, -7 * (1 - (2 * t - 1) ** 2), 0], "size": 4.6 + 0.8 * math.sin(k * 1.7), "roll": k * 23})
    needles = s.style("gneedle", {"ramp": "pine", "tone": 5.0, "rim": dict(RIM, outline="dark"), "layers": [
        {"op": "stripes", "axis": "x", "period": 0.9, "width": 0.45, "shift": -0.9},
        {"op": "noise", "scale": 1.2, "amount": 0.8},
        {"op": "spots", "count": 26, "radius": [0.35, 0.5], "ramp": "berry", "tone": 6, "min_gap": 1.4, "bevel": True}]})
    s.loft("swag", ring, [0, 16, 0], needles, sides=7, rnd=2.0, caps=[True, True])
    BOW = ["rr...rr", "rRr.rRr", "rRRkRRr", "rRr.rRr", "rr.r.rr", "..r.r..", ".r...r."]
    for k, x in enumerate((-24, 0, 24)):
        y = 16 - 7 * (1 - (x / 24) ** 2)
        s.card(f"bow_{k}", BOW, [x, y + 1.0, 1.8], {"r": "rose:3", "R": "rose:6", "k": "berry:3"})
    for k, x in enumerate((-12, 12)):
        y = 16 - 7 * (1 - (x / 24) ** 2)
        s.prism(f"cone_{k}", [1.6, 1.6, 2.4], [x, y - 2.2, 1.0], s.style("pcone", {"ramp": "wood", "tone": 4, "rim": RIM, "layers": [
            {"op": "scales", "along": "z", "size": [0.8, 0.8], "shape": "round", "gap": 0.1}]}), sides=6, rotation=[90, 0, 0], front_scale=[0.3, 0.3])
    return s


@spec
def doormat():
    s = Spec("doormat", "Doormat", "A coir doormat with a sage border and a stitched WELCOME.", density=2.0, tris=60)
    mat = s.style("coir", {"ramp": "kraft", "tone": 4.6, "rim": RIM, "layers": [
        photo("rough_linen", 3, 1.2), {"op": "stripes", "axis": "x", "period": 0.8, "width": 0.4, "shift": -0.5},
        {"op": "band", "axis": "x", "from": -1, "to": -0.88, "ramp": "sage", "tone": 4, "faces": ["top"]},
        {"op": "band", "axis": "x", "from": 0.88, "to": 1, "ramp": "sage", "tone": 4, "faces": ["top"]},
        {"op": "band", "axis": "z", "from": -1, "to": -0.8, "ramp": "sage", "tone": 4, "faces": ["top"]},
        {"op": "band", "axis": "z", "from": 0.8, "to": 1, "ramp": "sage", "tone": 4, "faces": ["top"]}],
        "stamps": [{"face": "top", "at": "center", "art": [
            "w...w.www.w....www..ww..w...w.www",
            "w...w.w...w...w....w..w.ww.ww.w..",
            "w.w.w.ww..w...w....w..w.w.w.w.ww.",
            "ww.ww.w...w...w....w..w.w...w.w..",
            "w...w.www.www..www..ww..w...w.www",
        ], "key": {"w": "berry:4"}}]})
    s.box("mat", [22, 0.5, 13], [0, 0.25, 0], mat, chamfer=0.2, hide=["bottom"])
    return s


# ------------------------------------------------------------------ main

def build(ids):
    os.makedirs(PUB, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    env = dict(os.environ, PYTHONPATH=LOWPIX)
    for sid in ids:
        path = SPECS[sid]().write()
        out = os.path.join(OUT, sid)
        r = subprocess.run([PY, "-m", "lowpix", "build", path, "-o", out], cwd=ROOT, env=env, capture_output=True, text=True)
        tail = (r.stdout + r.stderr).strip().splitlines()[-6:]
        print(f"[{sid}]", *tail, sep="\n  ")
        glb = [f for f in os.listdir(out) if f.endswith(".glb")] if os.path.isdir(out) else []
        if r.returncode == 0 and glb:
            shutil.copy(os.path.join(out, glb[0]), os.path.join(PUB, sid + ".glb"))
            print(f"  -> public/models/shop/{sid}.glb ({os.path.getsize(os.path.join(PUB, sid + '.glb')) // 1024} KB)")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "build":
        build(args[1:] or list(SPECS))
    else:
        for sid, fn in SPECS.items():
            print(fn().write())
