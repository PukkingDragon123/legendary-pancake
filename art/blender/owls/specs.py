"""Hoot Hollow's owls (v4): one spec per model, from field-guide descriptions of the real birds.

Units are millimetres in the game's frame (y up, +z the owl's front); a tawny stands ~44 mm (src/owl/model.ts MM).

shape (all optional; the tawny's are the defaults):
  k       overall size          bw bh bd  body half width / height / depth factors      breast  breast bulge factor
  pear    narrower shoulders    fluff     ragged, lumpy plumage in the silhouette (a great grey, a snowy)
  hw hh hd  head factors        hy        head height offset (mm)                        flat    0 domed .. 1 flat crown
  disc    'lobes' | 'heart' | 'round'      discr  disc lobe radius (share of the head's half width)   dish  disc depth
  ex ey   eye half spacing (share of half width), eye height (share of the head's top)    er  the ink dot's radius (mm)
  leg     visible leg (mm)      legw  leg radius   legx  half distance between the feet
  toes    'feathered' | 'bristled' | 'bare'       beak  bill size          tail  wing  lengths
  tufts   None or dict(len, w, x, lean, fwd)       dens  atlas texels per mm (fits down if it must)
col: the plumage's colours (hex): up/upDark/upLight (upperparts), under/underLow (underparts), crown, throat, disc,
  discDark, ruff, ruffLine, ruffLight, brow, bristle, wing, covert, primary, wingBar, underwing, tail, leg, toe, talon,
  beak, cere, tuft, tuftLight.
pat: the markings per tract (plume.Painter.markfn): upper, under, crown, disc, covert, flight, tail, leg.
"""

def streak(c, w=0.28, L=3.4, ds=1.6, du=1.7, keep=0.55, a=0.85, lo=0.0, hi=1.0):
    """A stroke layer of streaks: long thin dark marks down the flow (plume.Painter.stroke_layers); lo..hi: the share of
    the tract (top to bottom) it covers."""
    return dict(c=c, ds=ds, du=du, L=L, W=w, keep=keep, a=a, lo=lo, hi=hi)


def bar(c, w=0.55, L=0.22, ds=0.85, du=1.15, keep=0.4, a=0.6, lo=0.0, hi=1.0):
    """A stroke layer of bars: short marks wide across the flow (barring, vermiculation)."""
    return dict(c=c, ds=ds, du=du, L=L, W=w, keep=keep, a=a, shape=2.4, lo=lo, hi=hi)


def fleck(c, r=0.22, ds=1.0, du=1.1, keep=0.5, a=0.9, lo=0.0, hi=1.0, glow=0.0):
    """A stroke layer of round flecks (spots, pearls, snow-flecks)."""
    return dict(c=c, ds=ds, du=du, L=r * 2, W=r, keep=keep, a=a, shape=2.0, lo=lo, hi=hi, glow=glow)


SPECIES = {
    # Strix aluco, rufous morph: warm chestnut upperparts streaked and vermiculated dark, a row of white scapular spots,
    # buff underparts with bold dark shaft streaks crossed by fine bars, a plain buff-brown disc ringed dark, pale brows
    'tawny': dict(
        shape=dict(),
        col=dict(up='#8f5631', upDark='#3a2214', upLight='#ead6b4', under='#cfa06c', underLow='#e0c49c', crown='#87502c',
                 throat='#cfa982', disc='#b98a5e', discDark='#7a5232', ruff='#5a3820', ruffLine='#2e1c12', ruffLight='#a8784e',
                 brow='#ecdcbc', bristle='#e6d4b2', wing='#86522e', covert='#8f5631', primary='#7a4c2c', wingBar='#3a2214',
                 underwing='#e2cfae', tail='#82502e', leg='#d9bf98', toe='#b8a090', skin='#b8a090', talon='#3a3230',
                 beak='#d8c690', cere='#a89470', gape='#9a6a58'),
        pat=dict(upper={'spots': {'c': 'upLight', 'at': 0.7, 'x': 0.6, 'r': 0.28, 'keep': 0.16}},
                 under={},
                 crown={},
                 strokes=dict(upper=[streak('upDark', w=0.3, L=2.6, ds=1.25, du=1.35, keep=0.6), bar('#5c3620', keep=0.45, a=0.55)],
                              under=[streak('#4a2a18', w=0.26, L=3.6, keep=0.6), bar('#5a3420', w=0.5, keep=0.4, a=0.7)],
                              crown=[streak('upDark', w=0.22, L=1.8, ds=0.9, du=0.95, keep=0.6)]),
                 covert={'streak': {'c': 'upDark', 'w': 0.18, 'keep': 0.7}, 'spots': {'c': 'upLight', 'at': 0.74, 'x': 0.55, 'r': 0.3, 'keep': 0.35}},
                 flight={'bars': {'c': 'wingBar', 'n': 3.5, 'w': 0.3, 'a': 0.85}, 'edgepale': {'c': '#c8a070', 'at': 0.8, 'a': 0.5}},
                 tail={'bars': {'c': 'wingBar', 'n': 3.0, 'w': 0.28, 'a': 0.8}},
                 leg={'bars': {'c': '#c6a888', 'n': 2.0, 'w': 0.2, 'a': 0.4, 'keep': 0.5}}),
        eyering=-0.25, eyelid=-0.3, brows=0.6, rings=dict(period=1.15, w=0.16, a=0.35), discedge=-0.12),
    # Tyto alba: golden-buff upperparts veiled in grey with fine black-and-white pearls, silky white underparts with a few
    # dark dots, a white heart face edged in a fine golden-brown rim, long feathered legs, bristled toes
    'barn': dict(
        shape=dict(k=0.98, bw=0.84, bh=1.12, bd=0.88, pear=0.2, hw=0.92, hh=1.02, hd=0.84, hy=-0.6, flat=0.45, leg=7.5, legw=1.45, legx=3.8,
                   toes='bristled', disc='heart', discr=0.6, ex=0.4, ey=0.12, er=1.3, dish=1.2, wing=1.2, tail=0.75, beak=0.95),
        col=dict(up='#cf9b56', upDark='#8a8582', upLight='#f8f4ea', under='#f6efe2', underLow='#faf6ee', crown='#cfa060',
                 throat='#f6f0e4', disc='#f7f2e8', discDark='#d8c0a6', ruff='#d0a266', ruffLine='#8a5a34', ruffLight='#e8c690',
                 brow='#f8f2e6', bristle='#efe2d0', wing='#d4a462', covert='#c99c5e', primary='#dcb27a', wingBar='#8c8480',
                 underwing='#f6f0e6', tail='#d6aa6c', leg='#f4eee2', toe='#b6a6a0', skin='#b6a6a0', talon='#3a3232',
                 beak='#eadccc', cere='#d8c4b2', gape='#b08880', shadow='#a89c94'),
        pat=dict(upper={'verm': {'c': '#9c9690', 'f': 10, 'w': 0.5, 'a': 0.75}, 'dot': {'c': '#fbf8f2', 'at': 0.82, 'r': 0.18, 'ring': '#2e2826', 'keep': 0.6}},
                 under={},
                 strokes=dict(under=[fleck('#4a3a34', r=0.13, ds=1.6, du=1.8, keep=0.22, a=0.85)],
                              upper=[bar('#8e8884', w=0.8, L=0.5, ds=1.1, du=1.3, keep=0.5, a=0.45)]),
                 crown={'verm': {'c': '#9c9690', 'f': 10, 'w': 0.45, 'a': 0.7}, 'dot': {'c': '#fbf8f2', 'at': 0.8, 'r': 0.2, 'ring': '#2e2826', 'keep': 0.5}},
                 covert={'verm': {'c': '#9c9690', 'f': 9, 'w': 0.5, 'a': 0.75}, 'dot': {'c': '#fbf8f2', 'at': 0.82, 'r': 0.18, 'ring': '#2e2826', 'keep': 0.55}},
                 flight={'bars': {'c': 'wingBar', 'n': 3.0, 'w': 0.18, 'a': 0.7}, 'verm': {'c': '#b0a69a', 'f': 7, 'w': 0.3, 'a': 0.4}},
                 tail={'bars': {'c': 'wingBar', 'n': 3.2, 'w': 0.16, 'a': 0.65}}),
        eyering=-0.08, eyelid=-0.35, brows=0.0, ruffline=0.9, bristles=0.3, toebristle=0.35, discedge=0.0, plush=0.92),
    # Bubo scandiacus (a lightly marked bird): snow white, scattered dark chevrons and spots on the crown, back and wings,
    # a few bars low on the flanks, small head, heavily feathered 'slippers' over the toes
    'snowy': dict(
        shape=dict(k=1.12, bw=1.16, bh=1.02, bd=1.12, breast=1.4, pear=0.2, hw=0.92, hh=0.88, hd=0.96, flat=0.35, leg=1.2, legw=3.0, legx=4.4,
                   toes='feathered', discr=0.4, ex=0.42, er=1.5, dish=0.45, fluff=0.55, tail=0.9),
        col=dict(up='#f2f2ec', upDark='#3e3834', upLight='#fbfbf6', under='#f6f6f0', underLow='#fafaf6', crown='#f4f4ee',
                 throat='#f8f8f2', disc='#f8f8f3', discDark='#dcdcd2', ruff='#ecece4', ruffLine='#cfcfc4', ruffLight='#fbfbf6',
                 brow='#fbfbf8', bristle='#f2f2ec', wing='#efefe8', covert='#f2f2ec', primary='#f4f4ee', wingBar='#3e3834',
                 underwing='#f8f8f4', tail='#f2f2ec', leg='#fafaf5', toe='#cfc8c0', skin='#cfc8c0', talon='#2a2626',
                 beak='#36322f', cere='#4a4440', gape='#7a5a54', shadow='#9aa6b8'),
        pat=dict(upper={}, under={}, crown={},
                 strokes=dict(upper=[bar('upDark', w=0.55, L=0.34, ds=1.4, du=1.6, keep=0.42, a=0.92)],
                              under=[bar('#5a524c', w=0.45, L=0.22, ds=1.7, du=2.0, keep=0.16, a=0.8, lo=0.45)],
                              crown=[fleck('upDark', r=0.17, ds=0.9, du=1.0, keep=0.35, a=0.9)]),
                 covert={'chevron': {'c': 'upDark', 'at': 0.78, 'w': 0.09, 'ang': 0.3, 'keep': 0.5}},
                 flight={'bars': {'c': 'wingBar', 'n': 2.4, 'w': 0.1, 'a': 0.75, 'keep': 0.7}},
                 tail={'bars': {'c': 'wingBar', 'n': 2.0, 'w': 0.1, 'a': 0.6, 'keep': 0.6}}),
        eyering=-0.05, eyelid=-0.12, brows=0.0, ruffline=0.3, bristles=0.4, rings=None, ao=0.55, beaktip=0.2, plush=1.08),
    # Athene cunicularia: earth-brown upperparts boldly spotted white, a sandy-buff breast barred brown, white brows and
    # chin, a flat round head without tufts, long bare grey legs
    'burrowing': dict(
        shape=dict(k=0.84, bw=0.82, bh=0.88, bd=0.92, hw=0.86, hh=0.86, hd=0.9, flat=0.55, leg=11.0, legw=0.95, legx=3.2, toes='bare',
                   discr=0.42, ex=0.43, ey=0.1, er=1.45, dish=0.6, tail=0.6, wing=0.92),
        col=dict(up='#8a6a4a', upDark='#4a3524', upLight='#f4ead6', under='#e8d8bc', underLow='#f2e8d6', crown='#86664a',
                 throat='#f6f0e2', disc='#bfa078', discDark='#8a6c4c', ruff='#6e5238', ruffLine='#4a3524', ruffLight='#d8c4a0',
                 brow='#f8f4ea', bristle='#f2eadc', wing='#86664a', covert='#8a6a4a', primary='#7c5e42', wingBar='#4a3524',
                 underwing='#efe4d0', tail='#80624a', leg='#efe6d6', toe='#a8a09a', skin='#a8a09a', talon='#2e2a28',
                 beak='#d6cca0', cere='#b0a888', gape='#9a7060'),
        pat=dict(upper={}, under={}, crown={},
                 strokes=dict(upper=[fleck('upLight', r=0.3, ds=1.1, du=1.25, keep=0.62)],
                              under=[bar('#8a6a4a', w=0.85, L=0.55, ds=1.1, du=1.5, keep=0.8, a=0.85, hi=0.7)],
                              crown=[fleck('upLight', r=0.2, ds=0.75, du=0.85, keep=0.6)]),
                 covert={'spots': {'c': 'upLight', 'at': 0.66, 'x': 0.4, 'r': 0.34, 'keep': 0.8, 'two': 1}},
                 flight={'bars': {'c': 'upLight', 'n': 3.2, 'w': 0.2, 'a': 0.85}},
                 tail={'bars': {'c': 'upLight', 'n': 2.6, 'w': 0.2, 'a': 0.8}}),
        eyering=-0.25, eyelid=-0.2, brows=1.0, ruffline=0.5, discedge=-0.1),
    # Aegolius acadicus: tiny, a big round head with no tufts, chocolate upperparts with white spots, a crown finely
    # streaked white, white underparts with broad chestnut streaks, a pale buff face with a white V between the eyes
    'sawwhet': dict(
        shape=dict(k=0.76, bw=0.9, bh=0.78, hw=1.12, hh=1.1, hd=1.0, hy=-0.4, flat=0.0, leg=1.2, legw=1.9, legx=4.0, discr=0.43, ex=0.42,
                   ey=0.0, er=1.6, dish=0.8, tail=0.6, wing=0.82),
        col=dict(up='#74482c', upDark='#40261a', upLight='#f6efe2', under='#f4ede0', underLow='#f6f1e8', crown='#6e4429',
                 throat='#f6efe4', disc='#e8d8c0', discDark='#a8805c', ruff='#7a4e32', ruffLine='#5a3622', ruffLight='#f2e8d8',
                 brow='#faf6ee', bristle='#f8f2e8', wing='#6e4429', covert='#74482c', primary='#6a4228', wingBar='#f2e8d8',
                 underwing='#efe6d8', tail='#6a4228', leg='#f2e8d8', toe='#c8b8a6', skin='#c8b8a6', talon='#2e2826',
                 beak='#2e2a28', cere='#4a4440', gape='#8a6058'),
        pat=dict(upper={}, under={}, crown={},
                 strokes=dict(upper=[fleck('upLight', r=0.24, ds=1.0, du=1.15, keep=0.42)],
                              under=[streak('#9a5c38', w=0.48, L=3.0, ds=1.35, du=1.55, keep=0.78, a=0.9)],
                              crown=[streak('upLight', w=0.13, L=1.4, ds=0.7, du=0.75, keep=0.7, a=0.9)]),
                 covert={'spots': {'c': 'upLight', 'at': 0.72, 'x': 0.4, 'r': 0.32, 'keep': 0.6}},
                 flight={'spots': {'c': 'upLight', 'at': 0.6, 'x': 0.7, 'r': 0.2, 'keep': 1.0, 'two': 1}},
                 tail={'bars': {'c': 'upLight', 'n': 2.0, 'w': 0.16, 'a': 0.8}}),
        eyering=-0.3, eyelid=-0.4, brows=1.0, ruffline=0.6, discedge=-0.15, beaktip=0.2),
    # Bubo virginianus: long ear tufts, mottled grey-brown upperparts, a rufous-orange facial disc rimmed black, a white
    # throat bib, buff-grey underparts finely barred dark, pale brows
    'horned': dict(
        shape=dict(k=1.1, bw=1.1, bh=1.08, bd=1.04, breast=1.2, hw=0.98, hh=0.92, hd=0.96, flat=0.6, discr=0.43, ex=0.43, er=1.5, dish=0.9,
                   tufts=dict(len=11.0, w=4.6, x=0.42, lean=12, fwd=-1.0), tail=1.0, fluff=0.15),
        col=dict(up='#7a6650', upDark='#33281e', upLight='#d4c4a6', under='#d2bc98', underLow='#e2d2b6', crown='#6e5a46',
                 throat='#f6f0e4', disc='#c98848', discDark='#9a6030', ruff='#2a201a', ruffLine='#1e1814', ruffLight='#6e5a46',
                 brow='#ece2cc', bristle='#efe6d4', wing='#756250', covert='#7a6650', primary='#6c5a48', wingBar='#33281e',
                 underwing='#e0d0b4', tail='#726050', leg='#dccaa8', toe='#b8a898', skin='#b8a898', talon='#262220',
                 beak='#33302e', cere='#4a4440', gape='#7a5a50', tuft='#3a2e24', tuftLight='#a08a6c'),
        pat=dict(upper={'edgepale': {'c': 'upLight', 'at': 0.75, 'a': 0.45}}, under={}, crown={},
                 strokes=dict(upper=[bar('#3e3226', w=0.7, L=0.22, ds=0.6, du=1.0, keep=0.55, a=0.75), streak('upDark', w=0.22, L=2.2, ds=1.3, du=1.4, keep=0.4)],
                              under=[bar('#3e3226', w=0.95, L=0.15, ds=0.55, du=1.4, keep=0.8, a=0.85, lo=0.12), streak('#4a3a2c', w=0.12, L=2.4, keep=0.35, a=0.6)],
                              crown=[bar('#3e3226', w=0.6, L=0.2, ds=0.55, du=0.9, keep=0.55, a=0.75)]),
                 covert={'verm': {'c': '#3e3226', 'f': 8, 'w': 0.4, 'a': 0.8}, 'edgepale': {'c': 'upLight', 'at': 0.7, 'a': 0.5}},
                 flight={'bars': {'c': 'wingBar', 'n': 3.6, 'w': 0.28, 'a': 0.85}},
                 tail={'bars': {'c': 'wingBar', 'n': 3.4, 'w': 0.26, 'a': 0.85}},
                 leg={'bars': {'c': '#b09878', 'n': 2.0, 'w': 0.18, 'a': 0.4, 'keep': 0.5}}),
        eyering=0.1, eyelid=-0.35, brows=0.9, ruffline=0.9, discedge=0.1, tuftedge=0.6, beaktip=0.3),
    # Strix nebulosa: huge round face of concentric grey rings, a white 'bow tie' with a black chin spot, no tufts, long
    # tail, soft grey plumage finely vermiculated and streaked, small yellow-eyed (here: ink-dot) gaze
    'greatgrey': dict(
        shape=dict(k=1.16, bw=1.06, bh=1.08, bd=1.02, breast=1.1, hw=1.22, hh=1.12, hd=1.0, flat=0.15, disc='round', discr=0.74, ex=0.34,
                   ey=0.04, er=1.1, dish=1.1, tail=1.45, fluff=0.5),
        col=dict(up='#8a8882', upDark='#3e3d3a', upLight='#d6d4cc', under='#b8b6ae', underLow='#c8c6be', crown='#878580',
                 throat='#b4b2aa', disc='#a8a69e', discDark='#4e4d48', ruff='#4a4945', ruffLine='#2e2d2a', ruffLight='#bcbab2',
                 brow='#f2f1ea', bristle='#f2f1ea', wing='#84827c', covert='#8a8882', primary='#7c7a74', wingBar='#3e3d3a',
                 underwing='#cfcdc6', tail='#86847e', leg='#c4c2ba', toe='#9a948c', skin='#9a948c', talon='#2a2828',
                 beak='#d8bc5c', cere='#bca860', gape='#8a6a58', chin='#22211f'),
        pat=dict(upper={'edgepale': {'c': 'upLight', 'at': 0.7, 'a': 0.55}}, under={}, crown={'edgepale': {'c': 'upLight', 'at': 0.7, 'a': 0.45}},
                 strokes=dict(upper=[bar('#55544f', w=0.6, L=0.16, ds=0.5, du=0.9, keep=0.5, a=0.7), streak('upDark', w=0.2, L=2.4, ds=1.3, du=1.4, keep=0.5)],
                              under=[streak('#3e3d3a', w=0.22, L=3.4, ds=1.4, du=1.5, keep=0.7, a=0.85), bar('#66655f', w=0.5, L=0.15, ds=0.6, du=1.0, keep=0.4, a=0.6)],
                              crown=[bar('#55544f', w=0.5, L=0.15, ds=0.5, du=0.8, keep=0.5, a=0.7)]),
                 covert={'verm': {'c': '#5a5954', 'f': 10, 'w': 0.4, 'a': 0.7}, 'edgepale': {'c': 'upLight', 'at': 0.7, 'a': 0.6}},
                 flight={'bars': {'c': 'wingBar', 'n': 4.0, 'w': 0.26, 'a': 0.8}},
                 tail={'bars': {'c': 'wingBar', 'n': 4.5, 'w': 0.22, 'a': 0.8}}),
        eyering=-0.1, eyelid=-0.5, brows=0.95, ruffline=0.85, rings=dict(period=1.05, w=0.2, a=0.75), discedge=0.0, bowtie=True, beaktip=0.0),
    # Bubo bubo: the biggest, orange-buff and tawny, heavy black streaks down the breast thinning to fine bars on the
    # belly, mottled dark upperparts, long tufts angled out, a tawny face rimmed dark, a pale throat
    'eagle': dict(
        shape=dict(k=1.24, bw=1.1, bh=1.08, bd=1.06, breast=1.3, hw=1.0, hh=0.92, hd=0.98, flat=0.5, discr=0.42, ex=0.43, er=1.65, dish=0.8,
                   legw=2.6, tufts=dict(len=10.0, w=5.2, x=0.42, lean=40, fwd=-0.8), tail=1.05, fluff=0.12),
        col=dict(up='#9a6a3c', upDark='#2e2014', upLight='#dcb886', under='#d0a066', underLow='#dcb47e', crown='#8e6036',
                 throat='#f0e4ca', disc='#c89a68', discDark='#8a6038', ruff='#2e2216', ruffLine='#1e1610', ruffLight='#7a5634',
                 brow='#e8d2a8', bristle='#eadcc0', wing='#90633a', covert='#9a6a3c', primary='#8a5e36', wingBar='#2e2014',
                 underwing='#e0c8a0', tail='#966840', leg='#d8b07a', toe='#b89c7a', skin='#b89c7a', talon='#24201e',
                 beak='#2e2a28', cere='#423a36', gape='#7a5040', tuft='#2e2216', tuftLight='#b08856'),
        pat=dict(upper={'edgepale': {'c': 'upLight', 'at': 0.72, 'a': 0.5}}, under={}, crown={},
                 strokes=dict(upper=[streak('upDark', w=0.36, L=2.8, ds=1.2, du=1.3, keep=0.75, a=0.9), bar('#4a3220', w=0.6, L=0.2, ds=0.6, du=1.0, keep=0.45, a=0.6)],
                              under=[streak('#2a1c12', w=0.34, L=4.2, ds=1.5, du=1.45, keep=0.85, a=0.92, hi=0.62), bar('#5a3c22', w=0.75, L=0.14, ds=0.5, du=1.2, keep=0.7, a=0.75, lo=0.35)],
                              crown=[streak('upDark', w=0.28, L=1.8, ds=0.85, du=0.9, keep=0.7, a=0.9)]),
                 covert={'streak': {'c': 'upDark', 'w': 0.26, 'keep': 0.85}, 'edgepale': {'c': 'upLight', 'at': 0.7, 'a': 0.55}},
                 flight={'bars': {'c': 'wingBar', 'n': 3.8, 'w': 0.3, 'a': 0.85}},
                 tail={'bars': {'c': 'wingBar', 'n': 3.4, 'w': 0.28, 'a': 0.85}},
                 leg={'bars': {'c': '#a07850', 'n': 2.0, 'w': 0.16, 'a': 0.45, 'keep': 0.6}}),
        eyering=0.05, eyelid=-0.4, brows=0.75, ruffline=0.9, discedge=0.12, tuftbars=4, tuftedge=0.62, beaktip=0.2),
}

# special skins: built on the tawny's shape (one model each, whatever the species underneath)
SKINS = {
    'gingerbread': dict(base='tawny', shape=dict(k=1.0, fluff=0.0, toes='bare', legw=2.4, dish=0.6),
                        col=dict(dough='#b8743a', baked='#7a441e', icing='#fbf4e8', candy='#c8463e', mint='#5e9a6a', gold='#e0b45a',
                                 beak='#e0a858', talon='#7a441e', toe='#b8743a', cere='#d89448', gape='#7a3a28'),
                        relief=1.3),
    'snowman': dict(base='tawny', shape=dict(k=1.02, bw=1.06, fluff=0.0, toes='feathered', tufts=None, dish=0.5),
                    col=dict(snow='#f4f7f8', shade='#c4d2da', coal='#2a2826', carrot='#e07a2c', twig='#6a4a30', scarf='#b8443c',
                             scarf2='#f2e8d6', talon='#2a2826', beak='#e07a2c', cere='#e07a2c', toe='#f4f7f8', leg='#f4f7f8', gape='#8a4a34'),
                    relief=0.9),
    # the night sky's own owl: deep indigo feathers fringed in gold, dusted with stars that glow in the dark
    'celestial': dict(base='tawny', shape=dict(k=1.0, tufts=dict(len=5.6, w=4.0, x=0.42, lean=22, fwd=-0.8)),
                      col=dict(up='#2c3466', upDark='#1a1f44', upLight='#e8c060', under='#46528e', underLow='#56629e', crown='#2a3262',
                               throat='#4a5694', disc='#4a5694', discDark='#262c5a', ruff='#1c2248', ruffLine='#e8c060', ruffLight='#6a76b4',
                               brow='#f0d890', bristle='#8a96cc', wing='#283060', covert='#2c3466', primary='#222850', wingBar='#e8c060',
                               underwing='#46528e', tail='#283060', leg='#46528e', toe='#46528e', skin='#46528e', talon='#e8c060',
                               beak='#e8c060', cere='#c8a040', gape='#5a3a58', tuft='#1c2248', tuftLight='#e8c060',
                               star='#fff2c4', gold='#e8c060'),
                      pat=dict(upper={'edgepale': {'c': 'gold', 'at': 0.82, 'a': 0.55}}, under={}, crown={},
                               covert={'edgepale': {'c': 'gold', 'at': 0.8, 'a': 0.6}},
                               flight={'bars': {'c': '#3a4278', 'n': 3.0, 'w': 0.25, 'a': 0.6}, 'edgepale': {'c': 'gold', 'at': 0.85, 'a': 0.5}},
                               tail={'bars': {'c': '#3a4278', 'n': 3.0, 'w': 0.25, 'a': 0.6}},
                               strokes=dict(upper=[fleck('star', r=0.11, ds=0.8, du=0.9, keep=0.32, a=1.0, glow=1.2), fleck('gold', r=0.2, ds=2.2, du=2.4, keep=0.4, a=1.0, glow=0.6)],
                                            under=[fleck('star', r=0.1, ds=0.8, du=0.9, keep=0.28, a=1.0, glow=1.2), fleck('gold', r=0.18, ds=2.4, du=2.6, keep=0.3, a=1.0, glow=0.6)],
                                            crown=[fleck('star', r=0.1, ds=0.7, du=0.8, keep=0.3, a=1.0, glow=1.2)])),
                      eyering=0.15, eyelid=0.2, brows=0.7, rings=dict(period=1.15, w=0.14, a=0.4), emissive=True, beaktip=0.0),
    # a kitten's face on an owl's body: ginger tabby fur, a cream muzzle and bib, striped wings and tail
    'meowl': dict(base='tawny', shape=dict(k=1.0, cat=True, toes='feathered', hw=1.04, hh=0.98, hd=0.98),
                  col=dict(fur='#d08c50', stripe='#8a4c28', muzzle='#f6ead6', ear='#eaa8a0', nose='#d8847c', belly='#f2e2c8',
                           paw='#f2dfc4', talon='#5a3e2c', whisker='#fbf6ee', mouth='#6a3a2a',
                           up='#d08c50', upDark='#8a4c28', upLight='#f6ead6', under='#f2e2c8', underLow='#f6eadb', crown='#d08c50',
                           throat='#f6ead6', wing='#c07e48', covert='#d08c50', primary='#b87444', wingBar='#8a4c28', underwing='#f2e2c8',
                           tail='#c07e48', leg='#f2dfc4', toe='#f2dfc4', skin='#e0a49a', tuft='#d08c50'),
                  pat=dict(upper={}, under={}, crown={},
                           covert={'bars': {'c': 'stripe', 'n': 2.0, 'w': 0.3, 'a': 0.8}},
                           flight={'bars': {'c': 'stripe', 'n': 2.4, 'w': 0.32, 'a': 0.85}},
                           tail={'bars': {'c': 'stripe', 'n': 2.0, 'w': 0.34, 'a': 0.85}},
                           strokes=dict(upper=[bar('stripe', w=1.4, L=0.75, ds=2.1, du=2.4, keep=0.75, a=0.85)],
                                        under=[fleck('#c89060', r=0.3, ds=1.8, du=2.0, keep=0.3, a=0.6, lo=0.25)])),
                  plush=0.85),
}


def get(mid):
    """The full spec of a model id: a species or a skin."""
    if mid in SPECIES:
        s = dict(SPECIES[mid])
        s['id'], s['kind'] = mid, 'species'
        return s
    if mid in SKINS:
        k = SKINS[mid]
        b = SPECIES[k['base']]
        sh = dict(b['shape'])
        sh.update(k['shape'])
        s = dict(b)
        s.update({kk: v for kk, v in k.items() if kk not in ('base', 'shape', 'col')})
        col = dict(b['col'])
        col.update(k['col'])
        s.update(id=mid, kind='skin', shape=sh, col=col, skin=k['col'])
        return s
    raise KeyError(mid)


ALL = list(SPECIES) + list(SKINS)
