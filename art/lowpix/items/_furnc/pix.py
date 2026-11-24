"""A tiny raster for card art: draw with chars, then pass .rows to Spec.card (chars map to ramp colours via `key`)."""
import math


class Pix:
    def __init__(self, w, h, fill="."):
        self.w, self.h = int(w), int(h)
        self.g = [[fill] * self.w for _ in range(self.h)]

    def set(self, x, y, c):
        x, y = int(math.floor(x)), int(math.floor(y))
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.g[y][x] = c

    def get(self, x, y):
        x, y = int(x), int(y)
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if w <= 1:
                self.set(x, y, c)
            else:
                self.disc(x, y, w / 2, c)

    def path(self, pts, c, w=1):
        for a, b in zip(pts, pts[1:]):
            self.line(a[0], a[1], b[0], b[1], c, w)

    def disc(self, cx, cy, r, c, ry=None):
        ry = r if ry is None else ry
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if ((x + 0.5 - cx) / max(r, 1e-6)) ** 2 + ((y + 0.5 - cy) / max(ry, 1e-6)) ** 2 <= 1.0:
                    self.set(x, y, c)

    def ring(self, cx, cy, r, c, w=1.0, ry=None):
        ry = r if ry is None else ry
        for y in range(int(cy - ry - 2), int(cy + ry + 3)):
            for x in range(int(cx - r - 2), int(cx + r + 3)):
                d = math.hypot((x + 0.5 - cx) / max(r, 1e-6), (y + 0.5 - cy) / max(ry, 1e-6))
                if abs(d - 1.0) * min(r, ry) <= w / 2:
                    self.set(x, y, c)

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
            yc = y + 0.5
            xs = []
            for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(math.ceil(a - 0.5)), int(math.floor(b - 0.5)) + 1):
                    self.set(x, y, c)

    def star(self, cx, cy, r, c, points=5, inner=0.45, rot=-90):
        self.poly(star_pts(cx, cy, r, points, inner, rot), c)

    def map(self, fn):
        """Repaint every cell: fn(x, y, current) -> char."""
        for y in range(self.h):
            for x in range(self.w):
                self.g[y][x] = fn(x, y, self.g[y][x])

    def outline(self, c, inside=None):
        """Draw `c` on clear cells that touch a filled cell (or, with inside, on filled edge cells)."""
        src = [r[:] for r in self.g]
        for y in range(self.h):
            for x in range(self.w):
                me = src[y][x]
                nb = [src[y + dy][x + dx] if 0 <= x + dx < self.w and 0 <= y + dy < self.h else "."
                      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if inside is None and me == "." and any(n != "." for n in nb):
                    self.g[y][x] = c
                elif inside is not None and me != "." and any(n == "." for n in nb):
                    self.g[y][x] = inside

    @property
    def rows(self):
        return ["".join(r) for r in self.g]


def star_pts(cx, cy, r, points=5, inner=0.45, rot=-90):
    pts = []
    for i in range(points * 2):
        a = math.radians(rot + i * 180 / points)
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts
