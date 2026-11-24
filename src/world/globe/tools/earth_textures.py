"""The Earth's textures for the globe stage, from public-domain NASA / NOAA data and two CC BY maps.

    python3 -I src/world/globe/tools/earth_textures.py <download dir>

Expects in <download dir> (fetch commands in docs/credits/globe4.md):
  bmng8k.jpg      NASA Blue Marble Next Generation, 8192 x 4096 (GIBS layer BlueMarble_NextGeneration)
  bathy8k.jpg     NASA Blue Marble with shaded bathymetry (GIBS BlueMarble_ShadedRelief_Bathymetry): the oceans
  water8k.png     MODIS land / water mask 2015 (GIBS MODIS_Terra_L3_Land_Water_Mask)
  lights8k.jpg    NASA VIIRS city lights 2012 (GIBS VIIRS_CityLights_2012)
  etopo.npy       NOAA ETOPO1 (ice surface) altitude, 4 arc-minute grid, north up (ERDDAP etopo180)
  sss_clouds8k.jpg  Solar System Scope cloud map (CC BY 4.0)
  eso0932a.jpg    ESO / S. Brunier, the Milky Way panorama (CC BY 4.0)

Writes public/models/globe/:
  earth_day.webp   4096 x 2048 colour: Blue Marble land, bathymetry seas
  earth_cl.webp    4096 x 4096 grey: clouds (top half) and city lights (bottom half), both equirectangular
  earth_topo.webp  4096 x 2048 grey: 0 = water, 24..255 = land height (for the bump light and the sea mask)
  sky.webp         2048 x 1024 colour: the Milky Way, galactic coordinates
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
OUT = os.path.join(ROOT, "public", "models", "globe")
W, H = 4096, 2048


def load(src, name, mode="RGB"):
    return Image.open(os.path.join(src, name)).convert(mode)


def land_mask(src):
    """1 where land at 8192 x 4096 (MODIS mask, with Antarctica, which MODIS leaves out, from ETOPO and the ice)."""
    wm = np.asarray(Image.open(os.path.join(src, "water8k.png")).convert("RGBA"))
    water = (wm[..., 3] > 0) & (wm[..., 2] > 128)
    bm = np.asarray(load(src, "bmng8k.jpg"), np.float32)
    et = np.load(os.path.join(src, "etopo.npy")).astype(np.float32)[:, :-1]
    et = np.asarray(Image.fromarray(et).resize((8192, 4096), Image.BILINEAR))
    lat = 90 - (np.arange(4096) + 0.5) * 180 / 4096
    south = (lat < -58)[:, None]
    ice = (bm.mean(-1) > 120) & (et > -5)
    water = np.where(south, ~ice & (et < 2), water)
    return ~water, et


def day(src, land):
    bm = np.asarray(load(src, "bmng8k.jpg"), np.float32)
    sea = np.asarray(load(src, "bathy8k.jpg"), np.float32)
    m = Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    m = np.asarray(m, np.float32)[..., None] / 255
    out = bm * m + sea * (1 - m)
    # a touch more life in the land (the Blue Marble mosaic is a little flat), keeping the oceans as they are
    lum = out @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    sat = lum[..., None] + (out - lum[..., None]) * (1 + 0.12 * m)
    out = np.clip(sat, 0, 255)
    img = Image.fromarray(out.astype(np.uint8)).resize((W, H), Image.LANCZOS)
    img.save(os.path.join(OUT, "earth_day.webp"), quality=84, method=6)


def clouds_lights(src):
    cl = load(src, "sss_clouds8k.jpg", "L").resize((W, H), Image.LANCZOS)
    c = np.asarray(cl, np.float32) / 255
    c = np.clip((c - 0.06) / 0.9, 0, 1)
    rgb = np.asarray(load(src, "lights8k.jpg"), np.float32) / 255
    # the lights are amber and white over a dark blue base map: keep what is warmer than the base
    li = np.clip((rgb[..., 0] - 0.55 * rgb[..., 2] - 0.035) / 0.42, 0, 1)
    del rgb
    # keep the little towns: half box filter, half max pool when shrinking 2x
    a = li.reshape(H, 2, W, 2)
    li = 0.55 * a.mean((1, 3)) + 0.45 * a.max((1, 3))
    li = np.clip((li - 0.04) / 0.96, 0, 1) ** 1.1
    out = np.concatenate([c, li], 0)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), "L").save(os.path.join(OUT, "earth_cl.webp"), quality=80, method=6)


def topo(land, et):
    h = np.clip(et / 6500.0, 0, 1) ** 0.6
    g = 24 + 231 * h
    g = np.where(land, g, 0).astype(np.float32)
    img = Image.fromarray(g).resize((W, H), Image.BOX)
    a = np.clip(np.asarray(img), 0, 255)
    Image.fromarray((a + 0.5).astype(np.uint8), "L").save(os.path.join(OUT, "earth_topo.webp"), quality=86, method=6)


def sky(src):
    im = load(src, "eso0932a.jpg").resize((2048, 1024), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    a = np.clip((a - 0.02) / 0.98, 0, 1)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "sky.webp"), quality=82, method=6)


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    land, et = land_mask(src)
    day(src, land)
    topo(land, et)
    del land, et
    clouds_lights(src)
    sky(src)
    for f in ("earth_day.webp", "earth_cl.webp", "earth_topo.webp", "sky.webp"):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")


if __name__ == "__main__":
    main()
