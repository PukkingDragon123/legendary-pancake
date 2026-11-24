# What the audio3 build makes. Every clip is cut from a recording (see sources.py / BUSHED / the packs the
# earlier audio build downloaded); nothing is synthesised.
#
# A variant is a dict:
#   src   'bsb:NNNN' | 'bu:<dir>/<name>' (BUSHED sfx, .ogg) | 'kenney:<name>' | 'rd:<name>' (rubberduck wood/metal)
#   t, d  start / duration in seconds of the source (d None = to the end)
#   pitch playback-rate change (speed and pitch together, like a slower/faster tape)
#   hp/lp filter corners in Hz;  peak target peak dBFS (default -3);  fo fade-out seconds (default auto)
#   layers [(variant, offset_s, gain_db), ...] mixed on top;  concat [(variant, gap_s), ...] appended after
import os

SCR = '/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad'
BUSHED = SCR + '/refs4/lpx-bushed/games/bushed'
PATHS = {
    'raw': SCR + '/audio3/raw',
    'bu': BUSHED + '/public/assets/sfx',
    'kenney': SCR + '/sfx-raw/50-rpg-sound-effects/RPGsounds_Kenney.zip.d/OGG',
    'rd': SCR + '/sfx-raw/100-cc0-metal-and-wood-sfx/100-CC0-wood-metal-SFX.zip.d',
}


def V(src, t=0.0, d=None, **k):
    return dict(src=src, t=t, d=d, **k)


# id: (sprite, category, manifest gain, [variants])
NEW = {
    # ---------------------------------------------------------------- desk, paper, books, transitions
    'tick_wood': ('ui', 'ui', 0.45, [V('rd:wood_hit_01', 0, 0.15, pitch=1.25, peak=-4), V('rd:wood_hit_03', 0, 0.18, pitch=1.15, peak=-4), V('rd:wood_close_01', 0, 0.2, pitch=1.3, peak=-4)]),
    'tick_paper': ('ui', 'ui', 0.5, [V('bsb:0785', 3.5, 0.24, hp=300, fo=0.08, peak=-4), V('bsb:0785', 8.25, 0.2, hp=300, fo=0.07, peak=-4), V('bsb:0785', 9.25, 0.24, hp=300, fo=0.08, peak=-4)]),
    'tick_brass': ('ui', 'ui', 0.4, [V('kenney:metalLatch', 0.02, 0.2, peak=-5), V('kenney:metalClick', 0.24, 0.15, peak=-5), V('kenney:metalClick', 0, 0.16, pitch=1.2, peak=-5)]),
    'page_turn': ('ui', 'foley', 0.5, [V('bu:cabin/page_turn_1'), V('bu:cabin/page_turn_2'), V('bu:cabin/page_turn_3'), V('bu:cabin/page_turn_4')]),
    'book_open': ('ui', 'foley', 0.55, [V('kenney:bookOpen', 0, 0.15, peak=-4, layers=[(V('bu:cabin/paper_rustle_3', 0, 0.6), 0.04, -9)])]),
    'book_close': ('ui', 'foley', 0.6, [V('bsb:1410', 0.3, 0.6, lp=6000), V('bsb:1411', 0.08, 0.6, lp=6000), V('bsb:1412', 0.18, 0.6, lp=6000)]),
    'paper_rustle': ('ui', 'foley', 0.45, [V('bu:cabin/paper_rustle_1'), V('bu:cabin/paper_rustle_2'), V('bu:cabin/paper_rustle_3')]),
    'paper_crumple': ('ui', 'foley', 0.45, [V('bsb:0670', 6.25, 0.9, fo=0.25), V('bsb:0670', 12.6, 0.6, fo=0.2)]),
    'scribble': ('ui', 'foley', 0.4, [V('bu:cabin/pencil_scribble_1', 0, 1.4, fo=0.3), V('bu:cabin/pencil_scribble_2', 0, 1.4, fo=0.3)]),
    'whoosh': ('ui', 'transition', 0.4, [V('bsb:1795', 0.05, 0.7, lp=4500), V('bsb:1799', 0.08, 0.45, pitch=0.85, lp=4000), V('bsb:1802', 0.05, 0.35, pitch=0.8, lp=3500), V('bsb:1798', 0.1, 0.4, pitch=0.9, lp=4000)]),
    'whoosh_soft': ('ui', 'transition', 0.35, [V('bsb:0572', 3.45, 0.5, pitch=0.7, lp=2500), V('bsb:0573', 2.48, 0.45, pitch=0.7, lp=2500)]),
    'whoosh_cloth': ('ui', 'transition', 0.4, [V('kenney:cloth1', 0.05, 0.55), V('kenney:cloth3', 0.03, 0.45), V('bsb:0013', 0.8, 0.45)]),
    'clock_chime': ('ui', 'foley', 0.45, [V('bsb:3360', 2.9, 5.0, fo=1.6, peak=-4)]),
    # ---------------------------------------------------------------- magic, gacha, shop, particles
    'star_shimmer': ('magic', 'magic', 0.45, [V('bsb:2079', 0.05, 2.0, hp=600, lp=11000), V('bsb:2080', 0.05, 1.35, hp=600, lp=11000), V('bsb:2087', 0.03, 2.0, hp=600, lp=11000)]),
    'chime_sweep': ('magic', 'magic', 0.4, [V('bsb:2687', 5.1, 2.6, fo=1.0), V('bsb:2687', 12.0, 2.5, fo=1.0)]),
    'reveal_common': ('magic', 'magic', 0.5, [V('bsb:1867', 0.03, 1.7, fo=0.6)]),
    'reveal_rare': ('magic', 'magic', 0.5, [V('bsb:1398', 0.05, 1.8, fo=0.7, layers=[(V('bsb:1871', 0, 1.1), 0.15, -5)])]),
    'reveal_epic': ('magic', 'magic', 0.5, [V('bsb:0920', 10.15, 3.0, fo=1.0, layers=[(V('bsb:2087', 0.03, 2.0, hp=600), 0.0, -8)])]),
    'shop_bell': ('magic', 'shop', 0.5, [V('bsb:3588', 0.0, 3.3, fo=1.0), V('bu:cabin/shop_bell_1')]),
    'till': ('magic', 'shop', 0.55, [V('bu:cabin/cash_register_1'), V('bu:cabin/cash_register_2')]),
    'coins_pour': ('magic', 'shop', 0.5, [V('bu:cabin/coins_1'), V('bu:cabin/coins_2')]),
    'desk_bell': ('magic', 'shop', 0.45, [V('bsb:0479', 0.0, 2.6, fo=1.2, peak=-4, lp=11000)]),
    'pop_sparkle': ('magic', 'particle', 0.35, [
        V('bsb:0648', 0.2, 0.35, pitch=1.6, lp=6000, peak=-6, layers=[(V('bsb:1278', 6.0, 0.5, hp=2000, fo=0.3), 0.02, -10)]),
        V('bsb:0648', 0.2, 0.35, pitch=1.85, lp=7000, peak=-6, layers=[(V('bsb:1278', 15.2, 0.45, hp=2000, fo=0.3), 0.02, -10)])]),
    'pop_puff': ('magic', 'particle', 0.35, [
        V('bsb:0576', 2.5, 0.3, pitch=1.3, lp=1800, peak=-6, layers=[(V('kenney:cloth3', 0.05, 0.3), 0.0, -6)]),
        V('bsb:0576', 4.18, 0.3, pitch=1.45, lp=2000, peak=-6, layers=[(V('kenney:cloth1', 0.08, 0.3), 0.0, -7)])]),
    'sparkle_fizz': ('magic', 'particle', 0.3, [V('bsb:1278', 14.5, 1.2, fi=0.15, fo=0.5, hp=1500)]),
    # ---------------------------------------------------------------- house, furniture, build mode, moving boxes, globe
    'place_wood': ('home', 'build', 0.55, [V('bu:wood/wood_stack_1', pitch=0.8), V('bu:wood/wood_stack_3', pitch=0.78), V('bu:wood/wood_stack_5', pitch=0.82), V('bsb:1588', 0, 0.3, pitch=0.75, lp=3000)]),
    'place_soft': ('home', 'build', 0.55, [V('bsb:0576', 0.03, 0.3), V('bsb:0576', 0.86, 0.3), V('bsb:0576', 3.3, 0.32)]),
    'place_glass': ('home', 'build', 0.45, [V('bsb:1204', 9.1, 0.45), V('bsb:0627', 1.1, 0.6), V('bsb:1204', 6.27, 0.4)]),
    'place_metal': ('home', 'build', 0.45, [V('bsb:0087', 5.42, 0.4, lp=10000), V('bsb:0087', 8.62, 0.5, lp=10000), V('bsb:1195', 9.48, 0.35, lp=10000)]),
    'place_paper': ('home', 'build', 0.45, [V('bu:cabin/paper_rustle_3', 0, 0.5), V('bsb:0785', 2.62, 0.5, hp=250)]),
    'place_plant': ('home', 'build', 0.5, [V('bsb:1588', 0, 0.3, pitch=0.6, lp=1500, layers=[(V('bu:foliage/foliage_rustle_2'), 0.03, -4)])]),
    'place_land': ('home', 'build', 0.5, [V('bu:wood/wood_stack_2', pitch=0.7, layers=[(V('bsb:0576', 4.18, 0.3), 0.0, -6)]), V('bu:wood/wood_stack_4', pitch=0.72, layers=[(V('bsb:0576', 5.08, 0.3), 0.0, -6)])]),
    'drawer_open': ('home', 'build', 0.5, [V('bu:cabin/drawer_open_1'), V('bu:cabin/drawer_open_2')]),
    'drawer_close': ('home', 'build', 0.5, [V('bu:cabin/drawer_close_1'), V('bu:cabin/drawer_close_2')]),
    'door_open': ('home', 'house', 0.45, [V('bu:cabin/door_creak_open_1')]),
    'door_close': ('home', 'house', 0.45, [V('bu:cabin/door_creak_close_1', 0, 2.6, fo=0.8)]),
    'floor_creak': ('home', 'house', 0.35, [V('bu:cabin/floor_creak_1'), V('bu:cabin/floor_creak_2'), V('bu:cabin/floor_creak_3')]),
    'glass_clink': ('home', 'build', 0.4, [V('bu:cabin/bottle_clink_1'), V('bu:cabin/bottle_clink_2'), V('bu:cabin/bottle_clink_3')]),
    'box_tape': ('home', 'box', 0.55, [V('bsb:0298', 0.0, 1.1, fo=0.25), V('bsb:0299', 0.0, 1.0, fo=0.25), V('bsb:0297', 2.85, 1.15, fo=0.25)]),
    'box_tear': ('home', 'box', 0.5, [V('bsb:0018', 0.05, 0.8, pitch=0.8, lp=5000), V('bsb:0018', 1.7, 1.1, pitch=0.8, lp=5000), V('bsb:3239', 0.15, 0.6, pitch=0.78, lp=5000)]),
    'box_open': ('home', 'box', 0.55, [V('bsb:3239', 0.15, 0.6, pitch=0.7, lp=4500, layers=[(V('bsb:0576', 5.08, 0.3, pitch=0.85), 0.12, -2)]),
                                       V('bsb:0018', 4.6, 0.4, pitch=0.7, lp=4500, layers=[(V('bsb:0576', 5.97, 0.3, pitch=0.85), 0.1, -2)])]),
    'globe_spin': ('home', 'globe', 0.45, [V('bsb:1795', 0.05, 0.7, pitch=0.8, lp=3000, layers=[(V('bsb:0305', 0.05, 1.2, pitch=1.15, lp=5000), 0.0, -4)]),
                                           V('bsb:0140', 10.0, 1.6, hp=2000, lp=9000, fi=0.05, fo=0.8, layers=[(V('bsb:1799', 0.08, 0.45, pitch=0.75, lp=3000), 0.0, -3)])]),
    'pin_tap': ('home', 'globe', 0.45, [V('bsb:1580', 0.1, 0.3, pitch=1.25), V('bsb:1580', 0.1, 0.3, layers=[(V('bsb:0087', 5.42, 0.3), 0.0, -8)]), V('kenney:metalClick', 0.24, 0.12, pitch=1.3)]),
    'match_strike': ('home', 'house', 0.45, [V('bu:fire/match_strike_1')]),
    # ---------------------------------------------------------------- the meadow: Pip's hops by surface, birds, frogs, the oak creaking
    'hop_grass': ('nature', 'step', 0.45, [V('bsb:1839', 0.8, 0.35, pitch=1.25), V('bsb:1840', 0.85, 0.35, pitch=1.2), V('bsb:0854', 1.3, 0.45, pitch=1.15), V('bsb:0854', 5.0, 0.4, pitch=1.2)]),
    'hop_wood': ('nature', 'step', 0.4, [V('bsb:1841', 0.52, 0.35, pitch=1.3), V('bsb:1842', 0.57, 0.35, pitch=1.25), V('bu:foot/foot_wood_1', pitch=1.25), V('bu:foot/foot_wood_2', pitch=1.3)]),
    'hop_snow': ('nature', 'step', 0.45, [V('bsb:2890', 2.58, 0.55, pitch=1.2), V('bsb:2890', 6.17, 0.55, pitch=1.25), V('bsb:2890', 11.1, 0.5, pitch=1.2), V('bu:foot/foot_snow_1', pitch=1.2)]),
    'hop_wet': ('nature', 'step', 0.4, [V('bu:foot/foot_mud_1', pitch=1.25), V('bu:foot/foot_mud_2', pitch=1.25)]),
    'leaf_rustle': ('nature', 'foliage', 0.4, [V('bu:foliage/foliage_rustle_1'), V('bu:foliage/foliage_rustle_2'), V('bu:foliage/foliage_rustle_3')]),
    'bird_song': ('nature', 'nature', 0.35, [V('bu:wild/bird_songbird_2'), V('bu:wild/bird_songbird_3'), V('bu:wild/bird_songbird_4')]),
    'bird_thrush': ('nature', 'nature', 0.35, [V('bu:wild/bird_thrush_1'), V('bu:wild/bird_thrush_2'), V('bu:wild/bird_thrush_3')]),
    'woodpecker': ('nature', 'nature', 0.3, [V('bu:wild/bird_woodpecker_2')]),
    'frog_peep': ('nature', 'nature', 0.3, [V('bu:wild/animal_frogs_1'), V('bu:wild/animal_frogs_3'), V('bu:wild/animal_frogs_4')]),
    'tree_creak': ('nature', 'house', 0.35, [V('bu:tree/tree_creak_1', fo=1.0), V('bu:tree/tree_creak_3', fo=1.0)]),
    # ---------------------------------------------------------------- owls: real calls per species, wings, feathers
    'owl_tawny': ('owl', 'owl', 0.5, [V('bsb:1763', 0.12, 0.85, concat=[(V('bsb:1763', 5.2, 1.3), 1.1)]), V('bsb:1764', 0.08, 0.9, concat=[(V('bsb:1764', 5.2, 1.3), 1.0)]),
                                      V('bsb:3459', 0.15, 1.05), V('bsb:3460', 0.55, 0.7)]),
    'owl_kewick': ('owl', 'owl', 0.45, [V('bsb:0429', 5.1, 0.65, hp=500), V('bsb:0429', 10.5, 0.6, hp=500), V('bsb:0429', 21.15, 0.7, hp=500), V('bsb:0429', 23.95, 0.65, hp=500)]),
    'owl_barn': ('owl', 'owl', 0.3, [V('bsb:1403', 0.28, 1.85, lp=3800, fo=0.6), V('bsb:1403', 3.8, 1.95, lp=3800, fo=0.6)]),
    'owl_longeared': ('owl', 'owl', 0.5, [V('bsb:0937', 0.85, 1.0, hp=150), V('bsb:0937', 3.7, 3.3, hp=150, fo=0.5), V('bsb:0936', 3.0, 1.4, hp=150)]),
    'owl_horned': ('owl', 'owl', 0.5, [V('bu:wild/bird_owl_horned_2', 0.05, 3.8), V('bu:wild/bird_owl_horned_4', 0.05, 3.3), V('bu:wild/bird_owl_horned_6')]),
    'owl_barred': ('owl', 'owl', 0.45, [V('bu:wild/bird_owl_barred_1', 1.5, 1.8), V('bu:wild/bird_owl_barred_3', 1.65, 1.1), V('bu:wild/bird_owl_barred_2')]),
    'owl_wing': ('owl', 'owl', 0.45, [V('bsb:2891', 0.22, 1.4, lp=6000), V('bsb:2892', 0.15, 1.0, lp=6000), V('bsb:0476', 0.2, 1.6, lp=6000)]),
    'feather_ruffle': ('owl', 'owl', 0.4, [V('bsb:0013', 0.78, 0.5), V('bsb:0013', 0.05, 0.45), V('kenney:cloth1', 0.05, 0.55, pitch=1.2, lp=7000)]),
    # ---------------------------------------------------------------- weather one-shots
    'thunder': ('weather', 'weather', 0.55, [V('bu:weather/weather_thunder_2', 0, 7.5, fo=2.5), V('bu:weather/weather_thunder_5', 0, 7.5, fo=2.5), V('bu:weather/weather_thunder_8')]),
    'thunder_far': ('weather', 'weather', 0.45, [V('bu:weather/weather_thunder_1', 0, 7.0, lp=900, fo=2.5), V('bu:weather/weather_thunder_6', 0, 7.0, lp=900, fo=2.5)]),
    'wind_gust': ('weather', 'weather', 0.4, [V('bsb:0908', 3.6, 7.0, hp=100, fi=1.5, fo=2.5, peak=-4), V('bsb:0908', 16.5, 6.5, hp=100, fi=1.2, fo=2.5, peak=-4), V('bsb:0908', 44.0, 6.0, hp=100, fi=1.2, fo=2.0, peak=-4)]),
}

# New ambience beds: separate looping files (stereo). (src, t, d, filters, layers[(src, t, d, gain_db, filters)])
AMB = {
    'amb_day': dict(src='bu:amb/amb_forest_day', t=5, d=40, lufs=-24, cat='ambient', gain=0.5),
    'amb_dusk': dict(src='bu:amb/amb_forest_dusk', t=4, d=40, lufs=-24, cat='ambient', gain=0.5),
    'amb_peepers': dict(src='bu:amb/amb_forest_night', t=10, d=40, lufs=-25, cat='ambient', gain=0.5),
    'amb_rain_roof': dict(src='bu:amb/amb_rain_roof', t=0, d=30, lufs=-23, cat='ambient', gain=0.5, kbps=80),
    'amb_room': dict(src='bu:amb/amb_cabin', t=0, d=26, lufs=-27, cat='ambient', gain=0.5, layers=[('bu:fire/fire_stove', 0, 26, -5, '')]),
    'amb_snow': dict(src='bsb:0904', t=62, d=40, lufs=-27, cat='ambient', gain=0.5, af='highpass=f=70,lowpass=f=2200'),
}

# Existing ids that become aliases of an existing loop file (so the ambience director gets its own
# loop of the same recording, separate from the sleep soundscape that may use the original id).
ALIAS = {'bed_rain': 'amb_rain', 'bed_wind': 'amb_wind', 'bed_stream': 'amb_stream', 'bed_fire': 'amb_fire'}

# existing one-shots -> sprite
OLD_SPRITE = {
    'ui': 'ui', 'notify': 'ui', 'voice': 'ui', 'timer': 'ui', 'breath': 'ui',
    'reward': 'magic', 'teleport': 'magic',
    'step': 'nature', 'foliage': 'nature', 'nature': 'nature',
    'pet': 'owl', 'garden': 'home',
}
OLD_FOLEY = {'clock_tick': 'ui', 'clock_wind': 'ui', 'paper_flip': 'ui', 'pencil': 'ui', 'stamp': 'ui',
             'drawer': 'home', 'fabric': 'home', 'wood_knock': 'home', 'door_creak': 'home',
             'wings_flutter': 'owl', 'yawn': 'owl', 'coin_purse': 'magic', 'owl_hoot': 'owl', 'sparkle': 'magic'}

SPRITE_FILE = {'ui': 'sfx_ui.mp3', 'magic': 'sfx_magic.mp3', 'home': 'sfx_home.mp3', 'nature': 'sfx_nature.mp3',
               'owl': 'sfx_owl.mp3', 'weather': 'sfx_weather.mp3'}
SPRITE_KBPS = {'ui': 80, 'magic': 80, 'home': 80, 'nature': 80, 'owl': 80, 'weather': 64}
# long loops: whole MP3 files packed back to back, grouped by when they play
PACKS = {
    'pack_beds.mp3': ['amb_day', 'amb_dusk', 'amb_peepers', 'amb_snow', 'amb_room', 'amb_rain_roof', 'amb_rain', 'amb_wind', 'amb_stream', 'amb_fire'],
    'pack_sleep.mp3': ['amb_birds', 'amb_brown', 'amb_forest_night', 'amb_night', 'amb_waves', 'music_lullaby'],
    'pack_music.mp3': ['music_cozy', 'music_breath', 'alarm_musicbox', 'alarm_kalimba', 'alarm_birds', 'alarm_bells'],
}
