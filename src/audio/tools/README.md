# Audio build (audio3)

How `public/sfx/` was made: `fetch.py` downloads the BigSoundBank sources and records license evidence,
`spec.py` lists every new clip (source, cut, filters), the ambience beds and the file packs, `build.py`
renders the clips, packs every short sound into the `sfx_*.mp3` sprites and every loop into the
`pack_*.mp3` file packs, and writes `manifest.json` + `credits.json`; `credits_doc.py` rebuilds
`docs/AUDIO-CREDITS.md` and `docs/audio-licenses/`. `env.py` prints a recording's loud events (used to
pick cut points without listening). Run with `python3 -I <script> <worktree>`; the paths at the top of
`spec.py` point at the scratch folders of the machine that built it (raw downloads, the BUSHED checkout,
the earlier audio build's packs), so adjust them before rebuilding. Needs ffmpeg (libmp3lame) and numpy.
