"""Hand-pixelled foliage for the oak's crown, generated: clusters of lobed oak leaves (each leaf outlined on its
shaded side, lit along its upper edge, a pale midrib), hanging ivy strands and acorn sprigs. Rows of chars for
lowpix cards; the keys map chars to leaf-ramp tones so a cluster can be lit (crown top) or shaded (underside)."""
import math
import random


def _leaf(grid, cx, cy, ang, L, W, rank):
    """Rasterise one lobed oak leaf into grid (char per pixel), `rank` is its depth for shading."""
    h, w = len(grid), len(grid[0])
    ca, sa = math.cos(ang), math.sin(ang)
    cells = {}
    for y in range(h):
        for x in range(w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u = dx * ca + dy * sa          # along the leaf (0 at the stalk end)
            v = -dx * sa + dy * ca         # across
            if u < 0 or u > L:
                continue
            t = u / L
            hw = W / 2 * (math.sin(math.pi * min(1.0, t * 1.08)) ** 0.75)
            hw *= 0.7 + 0.3 * abs(math.cos(t * math.pi * 3.0 + 0.3))   # lobes
            if abs(v) <= hw:
                cells[(x, y)] = (t, v, hw)
    for (x, y), (t, v, hw) in cells.items():
        edge = any((x + dx, y + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            # outline: dark on the shaded (lower) side, a lit rim on the upper side
            ch = 'o' if v > -hw * 0.2 else 'h'
        elif abs(v) < 0.55 and 0.12 < t < 0.9:
            ch = 'v'
        elif v < 0:
            ch = 'l' if rank % 2 == 0 else 'm'
        else:
            ch = 'm' if rank % 2 == 0 else 'd'
        grid[y][x] = ch
    # the stalk
    for k in range(3):
        x, y = int(cx - ca * k), int(cy - sa * k)
        if 0 <= x < w and 0 <= y < h and grid[y][x] == '.':
            grid[y][x] = 's'


def cluster(seed, w=22, h=18, n=5):
    rng = random.Random(seed)
    grid = [['.'] * w for _ in range(h)]
    for i in range(n):
        ang = rng.uniform(-math.pi, math.pi) if i else rng.uniform(-2.2, -0.9)
        L = rng.uniform(0.36, 0.5) * w
        W = L * rng.uniform(0.5, 0.6)
        cx = w / 2 + rng.uniform(-w * 0.28, w * 0.28) - math.cos(ang) * L * 0.4
        cy = h / 2 + rng.uniform(-h * 0.25, h * 0.25) - math.sin(ang) * L * 0.4
        _leaf(grid, cx, cy, ang, L, W, i)
    return [''.join(r) for r in grid]


def acorn_sprig(seed):
    rng = random.Random(seed)
    g = cluster(seed, 16, 14, 3)
    grid = [list(r) for r in g]
    for (ax, ay) in ((6, 10), (9, 11)):
        for y in range(ay, min(len(grid), ay + 3)):
            for x in range(ax, ax + 2):
                if 0 <= x < len(grid[0]):
                    grid[y][x] = 'a' if y > ay else 'c'
    return [''.join(r) for r in grid]


def strand(seed, h=30):
    rng = random.Random(seed)
    w = 7
    grid = [['.'] * w for _ in range(h)]
    x = 3.0
    for y in range(h):
        x += rng.uniform(-0.5, 0.5)
        x = min(max(x, 1), w - 2)
        grid[y][int(x)] = 's'
        if y % 3 == 1 and y < h - 2:
            side = 1 if (y // 3) % 2 else -1
            for k in range(1, 3):
                xx = int(x) + side * k
                if 0 <= xx < w:
                    grid[y][xx] = 'm' if k == 1 else 'l'
                    if y + 1 < h:
                        grid[y + 1][xx] = 'd'
    return [''.join(r) for r in grid]


def flower_sprig(seed, bloom=True, w=12, h=16):
    """A potted-plant sprig: a stem or two with paired pointed leaves and (optionally) a five-petal bloom on top
    (s stem, d/m/l leaf shades, p/P petals, c centre)."""
    rng = random.Random(seed)
    g = [['.'] * w for _ in range(h)]
    stems = [w // 2 + rng.choice((-2, -1, 0, 1))] + ([w // 2 + rng.choice((2, 3)) * rng.choice((-1, 1))] if rng.random() < 0.6 else [])
    tops = []
    for si, x0 in enumerate(stems):
        top = rng.randint(3, 6) + si * 3
        x = float(x0)
        for y in range(h - 1, top - 1, -1):
            xi = int(round(x))
            if 0 <= xi < w:
                g[y][xi] = 's'
                if (h - y) % 3 == 1 and y > top + 1:
                    for side in (-1, 1):
                        for k in (1, 2):
                            xx = xi + side * k
                            yy = y - (k - 1)
                            if 0 <= xx < w and g[yy][xx] == '.':
                                g[yy][xx] = 'l' if side < 0 else ('m' if k == 1 else 'd')
            x += rng.uniform(-0.35, 0.35)
        tops.append((int(round(x)), top))
    if bloom:
        for (x, y) in tops:
            for dx, dy, ch in ((0, -2, 'P'), (-1, -1, 'p'), (1, -1, 'P'), (-2, 0, 'p'), (2, 0, 'P'), (-1, 1, 'p'), (1, 1, 'p'), (0, 0, 'c'),
                               (-1, 0, 'P'), (1, 0, 'P'), (0, -1, 'P'), (0, 1, 'p')):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    g[yy][xx] = ch
    else:
        for (x, y) in tops:
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (-1, -1), (1, -1), (0, -2)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    g[yy][xx] = 'l' if dx <= 0 else 'm'
    return [''.join(r) for r in g]


FLOWER_KEY = {c: {'s': 'fern:1', 'd': 'leaf:2', 'm': 'leaf:3', 'l': 'leaf:5', 'p': c + ':3', 'P': c + ':4', 'c': 'ochre:5'}
              for c in ('rose', 'cream', 'lilac', 'ochre', 'red', 'sky')}


KEYS = {
    # crown top in the light
    'lit': {'o': 'leaf:2', 'd': 'leaf:3', 'm': 'leaf:4', 'l': 'leaf:5', 'h': 'leaf:6', 'v': 'leaf:6', 's': 'dark:2', 'a': 'ochre:3', 'c': 'dark:2'},
    # the body of the crown
    'mid': {'o': 'leaf:1', 'd': 'leaf:2', 'm': 'leaf:3', 'l': 'leaf:4', 'h': 'leaf:5', 'v': 'leaf:5', 's': 'dark:1', 'a': 'ochre:3', 'c': 'dark:2'},
    # underside and deep inside
    'shade': {'o': 'leaf:0', 'd': 'leaf:1', 'm': 'leaf:2', 'l': 'leaf:3', 'h': 'leaf:3', 'v': 'leaf:3', 's': 'dark:1', 'a': 'ochre:2', 'c': 'dark:1'},
    # sun-warmed sage tips
    'sage': {'o': 'leaf:2', 'd': 'fern:2', 'm': 'fern:3', 'l': 'fern:4', 'h': 'fern:5', 'v': 'fern:5', 's': 'dark:2', 'a': 'ochre:4', 'c': 'dark:2'},
}
