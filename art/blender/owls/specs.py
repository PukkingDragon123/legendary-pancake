"""Hoot Hollow's owls as gashapon toys: one spec per model (the ten species, the special skins, Queen Neve).

Units are millimetres (the toy line's: lib/tk.py), Z up, the owl faces -Y and stands on z = 0. The game scales the
GLB so a tawny's ~44 mm is the old Pip's height (src/owl/model.ts MM).

Shape keys (all optional, the tawny's are the defaults):
  k        overall size
  bw, bh   body width / height factor     bd   body depth factor     breast  how far the breast bulges (mm)
  hw, hh   head width / height factor     hd   head depth factor     flat    0 domed .. 1 flat-topped crown
  leg      visible leg (mm)               legw leg radius             legx    half distance between the feet
  toes     'feathered' | 'bristled' | 'bare'
  disc     'lobes' | 'heart' | 'round'    discr disc radius (share of head width)
  ex, ez   eye half spacing (share of head width) and height (share of head height above its centre)
  er       eye dot radius (mm)            beak  beak size factor
  tufts    None or dict(len, w, x, lean, back): ear tufts (mm, x as share of head width, lean in degrees)
  tail     tail length factor             wing  wing length factor (tips past the body)
Paint keys: the plumage colours (lib/paint.py ramps are built from them) and the pattern names the painter knows.
"""

# the plumage colours lean on Hoot Hollow's calm palette (src/gfx/palette.ts): mossy, earthy, never candy
SPECIES = {
    'tawny': dict(
        shape=dict(),
        col=dict(up='#94694a', upDark='#56392a', upLight='#e8d6b2', under='#d8b892', underMark='#694634', underLow='#eadbbc',
                 disc='#ccab88', discDark='#8e6646', ruff='#5e4030', ruffLight='#c8a27c', brow='#ecdcbc',
                 wing='#8e6242', wingBar='#553826', wingLight='#e2cba0', tail='#8a6040', tailBar='#4e3424',
                 leg='#dcc49c', talon='#3a302a', beak='#cdb486', cere='#a08a68', tuft='#7a5236'),
        upper='tawny', under='tawny', discpat='tawny'),
    'barn': dict(
        shape=dict(k=0.98, bw=0.84, bh=1.1, bd=0.9, hw=0.9, hh=1.08, hd=0.88, flat=0.35, leg=7.5, legw=1.35, legx=4.0, toes='bristled',
                   disc='heart', discr=0.48, ex=0.2, ez=0.08, er=1.5, wing=1.2, tail=0.8),
        col=dict(up='#cfa266', upDark='#8a8480', upLight='#f6f0e2', under='#f3ecdc', underMark='#5a4a42', underLow='#f8f3e8',
                 disc='#f4eee2', discDark='#c9ab90', ruff='#c08a48', ruffLight='#e4bc80', brow='#f6f0e4',
                 wing='#cfa062', wingBar='#9a928c', wingLight='#f2e8d6', tail='#d4ab70', tailBar='#9a908a',
                 leg='#efe6d6', talon='#3a302a', beak='#e6d6c2', cere='#d0bba8', tuft='#cfa266'),
        upper='barn', under='dots', discpat='barn'),
    'snowy': dict(
        shape=dict(k=1.12, bw=1.18, bh=1.0, bd=1.14, hw=0.95, hh=0.9, flat=0.3, breast=2.6, leg=0.4, legw=3.3, toes='feathered',
                   ex=0.22, er=1.7, tail=1.0, fluff=0.35),
        col=dict(up='#eeeee6', upDark='#4a4440', upLight='#fbfaf4', under='#f2f1ea', underMark='#5a524c', underLow='#f8f7f0',
                 disc='#f6f5ee', discDark='#d6d6cc', ruff='#e2e0d6', ruffLight='#fbfaf4', brow='#fbfaf4',
                 wing='#ecebe2', wingBar='#4a4440', wingLight='#fbfaf4', tail='#eeeee6', tailBar='#4a4440',
                 leg='#f4f3ec', talon='#2e2a28', beak='#3a3634', cere='#4a4644', tuft='#eeeee6'),
        upper='snowy', under='snowy', discpat='snowy'),
    'burrowing': dict(
        shape=dict(k=0.84, bw=0.8, bh=0.84, hw=0.84, hh=0.84, hd=0.9, flat=0.6, leg=12.5, legw=0.95, legx=3.4, toes='bare',
                   ex=0.215, ez=0.1, er=1.7, tail=0.55, wing=0.9),
        col=dict(up='#8e6c4c', upDark='#4e3828', upLight='#f0e4cc', under='#ece2ca', underMark='#8a6a4a', underLow='#f4ecdc',
                 disc='#b89a74', discDark='#8a6c4c', ruff='#5e4430', ruffLight='#d8c4a0', brow='#f8f2e4',
                 wing='#886848', wingBar='#4c3626', wingLight='#e8dac0', tail='#846444', tailBar='#4c3626',
                 leg='#c8bea8', talon='#2e2826', beak='#cfc6a0', cere='#a8a084', tuft='#8e6c4c'),
        upper='spotted', under='barred', discpat='burrowing'),
    'sawwhet': dict(
        shape=dict(k=0.76, bw=0.86, bh=0.72, hw=1.08, hh=1.12, hd=1.0, flat=0.0, leg=0.6, legw=2.0, legx=4.4,
                   ex=0.225, ez=0.0, er=1.95, tail=0.6, wing=0.8),
        col=dict(up='#7c5236', upDark='#4a2e1e', upLight='#f2e8d8', under='#f2ebde', underMark='#9a5c3a', underLow='#f6f1e8',
                 disc='#ece0cc', discDark='#9a7052', ruff='#6a4430', ruffLight='#f0e6d6', brow='#f8f4ec',
                 wing='#764c32', wingBar='#44291a', wingLight='#efe4d2', tail='#704a30', tailBar='#ece2d0',
                 leg='#efe4d0', talon='#2e2826', beak='#2e2a28', cere='#44403c', tuft='#7c5236'),
        upper='spotted', under='chestnut', discpat='sawwhet'),
    'horned': dict(
        shape=dict(k=1.1, bw=1.12, bh=1.1, bd=1.06, hw=0.98, hh=0.92, flat=0.5, breast=2.2,
                   tufts=dict(len=13.0, w=5.2, x=0.3, lean=14, back=0.6), ex=0.22, er=1.75, tail=1.0, fluff=0.15),
        col=dict(up='#7a6852', upDark='#3a3026', upLight='#cec0a6', under='#ccb898', underMark='#45382c', underLow='#ddcfb6',
                 disc='#c28a56', discDark='#9a6638', ruff='#2e2620', ruffLight='#6e5a48', brow='#e8dcc6',
                 wing='#766450', wingBar='#3a3026', wingLight='#c8b89e', tail='#7a6852', tailBar='#3a3026',
                 leg='#d6c4a4', talon='#2a2624', beak='#363230', cere='#4a4440', tuft='#4a3c30', bib='#f4efe4'),
        upper='mottled', under='finebar', discpat='horned'),
    'greatgrey': dict(
        shape=dict(k=1.16, bw=1.1, bh=1.1, hw=1.2, hh=1.14, hd=1.02, flat=0.1, disc='round', discr=0.44, ex=0.16, ez=0.06,
                   er=1.15, tail=1.35, breast=1.8, fluff=0.6),
        col=dict(up='#8c8a84', upDark='#45443f', upLight='#d8d6ce', under='#bcbab2', underMark='#45443f', underLow='#cecbc4',
                 disc='#b8b6ae', discDark='#55544e', ruff='#3a3936', ruffLight='#9c9a92', brow='#f2f1ea',
                 wing='#86847e', wingBar='#43423e', wingLight='#d0cec6', tail='#86847e', tailBar='#43423e',
                 leg='#cdcbc4', talon='#2a2828', beak='#dcc066', cere='#c0aa58', tuft='#8c8a84', bib='#f4f3ec', chin='#33322f'),
        upper='grey', under='greystreak', discpat='rings'),
    'eagle': dict(
        shape=dict(k=1.24, bw=1.12, bh=1.08, bd=1.06, hw=1.0, hh=0.94, flat=0.45, breast=2.2, legw=2.8,
                   tufts=dict(len=10.5, w=5.8, x=0.34, lean=42, back=0.9), ex=0.23, er=1.95, tail=1.05, fluff=0.12),
        col=dict(up='#9c6a3c', upDark='#33241a', upLight='#dcb884', under='#c89460', underMark='#33241a', underLow='#d6a872',
                 disc='#c89c6a', discDark='#8a6038', ruff='#2e2218', ruffLight='#6e5034', brow='#e6d0a8',
                 wing='#946436', wingBar='#34241a', wingLight='#d4ae7a', tail='#9a6a3e', tailBar='#34241a',
                 leg='#d0a468', talon='#2a2422', beak='#2e2a28', cere='#423a36', tuft='#3a2a1c', bib='#efe4d0'),
        upper='mottled', under='eagle', discpat='eagle'),
}

# special skins: toy variants built on the tawny's shape (one model each, whatever the species underneath)
SKINS = {
    'gingerbread': dict(base='tawny', shape=dict(k=1.0, er=1.95, toes='bristled'),
                        col=dict(dough='#b8783e', baked='#7e4a24', icing='#f6efe2', candy='#c0544e', mint='#6e9a72', gold='#d8b064',
                                 beak='#d89a52', talon='#7e4a24')),
    'snowman': dict(base='tawny', shape=dict(k=1.02, bw=1.06, er=1.95, toes='feathered', tufts=None),
                    col=dict(snow='#f2f3ee', shade='#c8d4d6', coal='#34322e', carrot='#d8803c', twig='#6a4a30', scarf='#b2504a',
                             scarf2='#efe6d4', talon='#34322e')),
    'celestial': dict(base='tawny', shape=dict(k=1.0, er=1.95, tufts=dict(len=4.0, w=4.4, x=0.29, lean=26, back=0.2)),
                      col=dict(night='#3a3f66', deep='#262a48', dusk='#5a6290', star='#f2dc9a', gold='#d8b45c', glow='#f6ecc4',
                               talon='#d8b45c', beak='#d8b45c')),
    'meowl': dict(base='tawny', shape=dict(k=1.0, er=2.0, toes='feathered', cat=True),
                  col=dict(fur='#c98a52', stripe='#8a5232', muzzle='#f4e8d4', ear='#e8a8a0', nose='#d8847c', belly='#f2e2c8',
                           wing='#b87c4a', paw='#f0dcc0', talon='#5a3e2c', whisker='#f8f2e8')),
}

QUEEN = dict(base='snowy', shape=dict(fluff=0.12, k=1.08, bw=1.0, bh=1.12, bd=1.0, hw=0.98, hh=0.98, breast=1.6, leg=0.6, legw=2.4, toes='feathered',
                                      tufts=None, ex=0.215, er=1.8, tail=1.15, wing=1.1, queen=True),
             col=dict(cape='#8fb0c4', capeDark='#5e7c94', capeLight='#d6e6ea', fur='#f6f6f0', ice='#bcd8e0', iceLight='#eef6f6',
                      iceDeep='#7ea4b8', silver='#c8ccd0', gem='#9cc8d8'))


def get(mid):
    """The full spec of a model id: a species, a skin or 'queen'."""
    if mid in SPECIES:
        s = dict(SPECIES[mid])
        s['id'], s['kind'] = mid, 'species'
        return s
    if mid in SKINS or mid == 'queen':
        k = SKINS.get(mid, QUEEN)
        b = SPECIES[k['base']]
        sh = dict(b['shape'])
        sh.update(k['shape'])
        s = dict(b)
        s.update(id=mid, kind='skin' if mid != 'queen' else 'queen', shape=sh, skin=k['col'])
        return s
    raise KeyError(mid)


ALL = list(SPECIES) + list(SKINS) + ['queen']
