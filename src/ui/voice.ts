// Pip's speaking voice. When the app runs as a claude.ai Artifact the host can read text aloud
// (the `tts` capability); everywhere else this resolves to null and the read-aloud buttons hide.
export interface Tts {
  speak(text: string | { text: string; voice?: string; rate?: number }[], o?: { voice?: string; rate?: number }): Promise<void>;
  stop(): void;
  onState(f: (s: { state: string; reason?: string }) => void): void;
}
let pending: Promise<Tts | null> | null = null;
export function voice(): Promise<Tts | null> {
  const host = (window as any).claude;
  if (!host?.use) return Promise.resolve(null);
  return (pending ??= Promise.resolve(host.use('tts')).catch(() => null));
}
