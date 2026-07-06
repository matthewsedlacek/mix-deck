import { guess } from "web-audio-beat-detector";
import { keyToCamelot } from "../camelot";

export interface AnalysisResult {
  durationMs: number;
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  peaks: number[];
}

const PEAK_BUCKETS = 1200;
const KEY_SAMPLE_RATE = 11025; // downsampled for the key worker — plenty for chroma
const MAX_ANALYSIS_SECONDS = 180; // whole-track key rarely changes; cap the work

/** Decode an uploaded file and compute duration, waveform peaks, BPM and key — all client-side. */
export async function analyzeAudioFile(file: File): Promise<AnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const [bpm, key] = await Promise.all([detectBpm(buffer), detectKey(buffer)]);
    return {
      durationMs: Math.round(buffer.duration * 1000),
      bpm,
      key,
      camelot: key ? keyToCamelot(key) : null,
      peaks: computePeaks(buffer),
    };
  } finally {
    void ctx.close();
  }
}

async function detectBpm(buffer: AudioBuffer): Promise<number | null> {
  try {
    // Uses OfflineAudioContext internally, so it doesn't block the UI.
    const { bpm } = await guess(buffer);
    return bpm;
  } catch {
    return null; // no clear beat (ambient, spoken word) — user can tap tempo
  }
}

function detectKey(buffer: AudioBuffer): Promise<string | null> {
  const samples = downmixAndResample(buffer, KEY_SAMPLE_RATE, MAX_ANALYSIS_SECONDS);
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./keyWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ key: string | null }>) => {
      worker.terminate();
      resolve(e.data.key);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    worker.postMessage({ samples, sampleRate: KEY_SAMPLE_RATE }, [samples.buffer]);
  });
}

function downmixAndResample(buffer: AudioBuffer, targetRate: number, maxSeconds: number): Float32Array {
  const ratio = buffer.sampleRate / targetRate;
  const sourceLength = Math.min(buffer.length, buffer.sampleRate * maxSeconds);
  const outLength = Math.floor(sourceLength / ratio);
  const out = new Float32Array(outLength);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < outLength; i++) {
    const src = Math.floor(i * ratio);
    let sum = 0;
    for (const ch of channels) sum += ch[src];
    out[i] = sum / channels.length;
  }
  return out;
}

/** Min/max pairs per bucket, normalized to [-1, 1] — the format wavesurfer accepts as pre-decoded peaks. */
function computePeaks(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(data.length / PEAK_BUCKETS));
  const peaks: number[] = [];
  for (let b = 0; b < PEAK_BUCKETS; b++) {
    const start = b * bucketSize;
    if (start >= data.length) break;
    let min = 1;
    let max = -1;
    for (let i = start; i < Math.min(start + bucketSize, data.length); i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    peaks.push(max, min);
  }
  return peaks;
}
