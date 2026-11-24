// The sound manifest (public/sfx/manifest.json), its audio sprites and file packs. Kept free of Web
// Audio so it can be tested in node.
//   sprites  short sounds live in a few category files ("sfx_ui.mp3", "sfx_home.mp3"...), decoded
//            whole; a file entry "sfx_home.mp3#box_tape_2" names a clip, whose start and length
//            (seconds) are listed under `sprites`.
//   packs    long loops, music and the alarms are whole MP3 files stored back to back in a few
//            "pack_*.mp3" files; "pack_beds.mp3#amb_rain" names a member, whose byte range is listed
//            under `packs`. Only that member is fetched (HTTP range, or sliced from the whole file)
//            and decoded, so a pack costs no more memory than the loop that plays.

export interface Entry { files: string[]; gain?: number; loop?: boolean; category?: string; alias?: string }
export interface Sprite { dur: number; clips: Record<string, [number, number]> }
export interface Pack { bytes: number; clips: Record<string, [number, number]> }
export interface Manifest { version: number; sounds: Record<string, Entry>; sprites?: Record<string, Sprite>; packs?: Record<string, Pack> }
/** A sprite clip has start/dur (seconds); a pack member has its byte range; a plain file has neither. */
export interface Ref { file: string; clip: string | null; start: number; dur: number | null; bytes: [number, number] | null }

/** "file.mp3#clip" -> the file and clip name (clip null for a plain file). */
export function parseRef(ref: string): { file: string; clip: string | null } {
  const i = ref.indexOf('#');
  return i < 0 ? { file: ref, clip: null } : { file: ref.slice(0, i), clip: ref.slice(i + 1) };
}

/** Where a manifest file entry plays from: a whole file, a span of a sprite or a member of a pack. Null if unknown. */
export function resolveRef(man: Manifest, ref: string): Ref | null {
  const { file, clip } = parseRef(ref);
  if (!clip) return { file, clip: null, start: 0, dur: null, bytes: null };
  const span = man.sprites?.[file]?.clips[clip];
  if (span) return { file, clip, start: span[0], dur: span[1], bytes: null };
  const b = man.packs?.[file]?.clips[clip];
  return b ? { file, clip, start: 0, dur: null, bytes: [b[0], b[1]] } : null;
}

/** Every audio file a set of sounds needs (sprites once). */
export function filesFor(man: Manifest, ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) for (const f of man.sounds[id]?.files ?? []) out.add(parseRef(f).file);
  return [...out];
}

/** Problems with a manifest: unknown clips, clips outside their sprite, overlapping clips. */
export function validate(man: Manifest): string[] {
  const errs: string[] = [];
  for (const [id, e] of Object.entries(man.sounds)) {
    if (!e.files?.length) errs.push(`${id}: no files`);
    for (const f of e.files ?? []) if (!resolveRef(man, f)) errs.push(`${id}: unknown clip ${f}`);
    if (e.loop && e.files.length !== 1) errs.push(`${id}: a loop needs exactly one file`);
  }
  for (const [file, sp] of Object.entries(man.sprites ?? {})) {
    const spans = Object.entries(sp.clips).sort((a, b) => a[1][0] - b[1][0]);
    let end = 0;
    for (const [clip, [s, d]] of spans) {
      if (!(d > 0)) errs.push(`${file}#${clip}: empty`);
      if (s < end - 1e-6) errs.push(`${file}#${clip}: overlaps the clip before it`);
      if (s + d > sp.dur + 1e-6) errs.push(`${file}#${clip}: runs past the end of the sprite`);
      end = s + d;
    }
  }
  for (const [file, pk] of Object.entries(man.packs ?? {})) {
    const spans = Object.entries(pk.clips).sort((a, b) => a[1][0] - b[1][0]);
    let end = 0;
    for (const [clip, [a, b]] of spans) {
      if (a !== end) errs.push(`${file}#${clip}: does not start where the member before it ends`);
      if (!(b > a)) errs.push(`${file}#${clip}: empty`);
      end = b;
    }
    if (end !== pk.bytes) errs.push(`${file}: members cover ${end} of ${pk.bytes} bytes`);
  }
  return errs;
}
