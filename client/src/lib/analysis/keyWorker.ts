/**
 * Musical key detection worker: chromagram (Goertzel per semitone) +
 * Krumhansl-Schmuckler profile matching. Runs off the main thread so
 * the UI stays responsive during import.
 */

const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

interface KeyRequest {
  samples: Float32Array;
  sampleRate: number;
}

self.onmessage = (e: MessageEvent<KeyRequest>) => {
  const { samples, sampleRate } = e.data;
  const key = detectKey(samples, sampleRate);
  (self as unknown as Worker).postMessage({ key });
};

function detectKey(samples: Float32Array, sampleRate: number): string | null {
  if (samples.length < sampleRate * 5) return null; // too short to judge

  const frameSize = 8192;
  const hop = frameSize; // non-overlapping is plenty for a whole-track estimate
  const chroma = new Float64Array(12);

  // C2..B5 — the pitch range where tonality lives.
  const freqs: number[] = [];
  for (let midi = 36; midi < 84; midi++) freqs.push(440 * Math.pow(2, (midi - 69) / 12));

  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    for (let p = 0; p < freqs.length; p++) {
      const energy = goertzel(samples, start, frameSize, freqs[p], sampleRate);
      chroma[p % 12] += Math.sqrt(energy);
    }
  }

  let best = { score: -Infinity, name: null as string | null };
  for (let root = 0; root < 12; root++) {
    const maj = correlate(chroma, KRUMHANSL_MAJOR, root);
    const min = correlate(chroma, KRUMHANSL_MINOR, root);
    if (maj > best.score) best = { score: maj, name: `${NOTE_NAMES[root]} major` };
    if (min > best.score) best = { score: min, name: `${NOTE_NAMES[root]} minor` };
  }
  return best.name;
}

function goertzel(samples: Float32Array, start: number, length: number, freq: number, sampleRate: number): number {
  const omega = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < start + length; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/** Pearson correlation between the chroma vector and a key profile rotated to `root`. */
function correlate(chroma: Float64Array, profile: number[], root: number): number {
  const n = 12;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += chroma[i];
    sumY += profile[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const x = chroma[(root + i) % 12] - meanX;
    const y = profile[i] - meanY;
    num += x * y;
    denX += x * x;
    denY += y * y;
  }
  return denX && denY ? num / Math.sqrt(denX * denY) : 0;
}
