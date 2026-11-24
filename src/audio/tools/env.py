"""Print the loud events of a recording so cut points can be picked without listening.
usage: python3 -I env.py FILE [threshold_db_below_peak=24] [min_gap_s=0.12]"""
import subprocess, sys
import numpy as np


def load(path, sr=22050):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32), sr


def events(x, sr, below=24.0, gap=0.12, hop=0.01):
    h = int(sr * hop)
    n = len(x) // h
    fr = x[: n * h].reshape(n, h)
    rms = np.sqrt((fr ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    peak = db.max()
    floor = np.percentile(db, 20)
    thr = max(peak - below, floor + 6)
    on = db > thr
    ev = []
    i = 0
    while i < n:
        if on[i]:
            j = i
            last = i
            while j < n and (on[j] or (j - last) * hop < gap):
                if on[j]: last = j
                j += 1
            seg = x[i * h:(last + 1) * h]
            spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) if len(seg) > 32 else np.zeros(2)
            fq = np.fft.rfftfreq(len(seg), 1 / sr) if len(seg) > 32 else np.zeros(2)
            cen = float((spec * fq).sum() / (spec.sum() + 1e-9))
            dom = float(fq[spec.argmax()]) if len(seg) > 32 else 0
            ev.append((i * hop, (last + 1) * hop, float(db[i:last + 1].max()), cen, dom))
            i = j
        else:
            i += 1
    return ev, peak, floor


if __name__ == '__main__':
    p = sys.argv[1]
    below = float(sys.argv[2]) if len(sys.argv) > 2 else 24
    gap = float(sys.argv[3]) if len(sys.argv) > 3 else 0.12
    x, sr = load(p)
    ev, peak, floor = events(x, sr, below, gap)
    print(f'{p.split("/")[-1]}: {len(x)/sr:.2f}s peak {peak:.1f} dB floor {floor:.1f} dB, {len(ev)} events')
    for a, b, d, c, dom in ev[:60]:
        print(f'  {a:7.2f}-{b:7.2f} ({b-a:5.2f}s) {d:6.1f} dB  centroid {c:6.0f} Hz  dominant {dom:6.0f} Hz')
