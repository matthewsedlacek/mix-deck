import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.js";
import { api } from "../lib/api";
import { keyToCamelot } from "../lib/camelot";
import { effectiveBpm, effectiveKey, type AudioFile } from "../lib/types";

const KEY_OPTIONS = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"].flatMap((n) => [
  `${n} major`,
  `${n} minor`,
]);

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<AudioFile | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [regionLabel, setRegionLabel] = useState("");
  const [taps, setTaps] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const selectionRegionRef = useRef<Region | null>(null);

  useEffect(() => {
    api
      .get<{ files: AudioFile[] }>("/api/library")
      .then(({ files }) => {
        const found = files.find((f) => f.id === id);
        if (found) setFile(found);
        else setError("Track not found");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!file || !containerRef.current) return;
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: file.fileUrl,
      peaks: undefined,
      waveColor: "#34344a",
      progressColor: "#ff8a3d",
      cursorColor: "#e8e8f0",
      height: 128,
      plugins: [regions],
    });
    wavesurferRef.current = ws;
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));

    regions.enableDragSelection({ color: "rgba(255, 138, 61, 0.2)" });
    regions.on("region-created", (region) => {
      // Keep only one in-progress selection at a time.
      if (selectionRegionRef.current && selectionRegionRef.current !== region) {
        selectionRegionRef.current.remove();
      }
      selectionRegionRef.current = region;
      setSelection({ start: region.start, end: region.end });
    });
    regions.on("region-updated", (region) => setSelection({ start: region.start, end: region.end }));

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      selectionRegionRef.current = null;
    };
  }, [file?.fileUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const bpm = file ? effectiveBpm(file) : null;
  const key = file ? effectiveKey(file) : null;

  const tapBpm = useMemo(() => {
    if (taps.length < 4) return null;
    const recent = taps.slice(-8);
    const intervals = recent.slice(1).map((t, i) => t - recent[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.round((60000 / avg) * 10) / 10;
  }, [taps]);

  async function patchFile(data: Partial<Pick<AudioFile, "bpmManual" | "keyManual" | "camelot">>) {
    if (!file) return;
    const { file: updated } = await api.patch<{ file: AudioFile }>(`/api/library/${file.id}`, data);
    setFile({ ...file, ...updated });
  }

  async function saveRegion() {
    if (!file || !selection || !regionLabel.trim()) return;
    const { region } = await api.post<{ region: NonNullable<AudioFile["regions"]>[number] }>(
      `/api/library/${file.id}/regions`,
      { label: regionLabel.trim(), startMs: Math.round(selection.start * 1000), endMs: Math.round(selection.end * 1000) },
    );
    setFile({ ...file, regions: [...(file.regions ?? []), region] });
    setRegionLabel("");
    selectionRegionRef.current?.remove();
    selectionRegionRef.current = null;
    setSelection(null);
  }

  async function deleteRegion(regionId: string) {
    if (!file) return;
    await api.delete(`/api/library/${file.id}/regions/${regionId}`);
    setFile({ ...file, regions: (file.regions ?? []).filter((r) => r.id !== regionId) });
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!file) return <p className="text-deck-300">Loading…</p>;

  return (
    <div>
      <Link to="/library" className="text-deck-300 hover:text-deck-100 text-sm">
        ← Library
      </Link>
      <div className="flex items-baseline gap-3 mt-2 mb-1">
        <h1 className="text-2xl font-bold">{file.title}</h1>
        {file.artist && <span className="text-deck-300">{file.artist}</span>}
      </div>
      <p className="text-deck-300 text-sm mb-6">
        {bpm ? `${Math.round(bpm)} BPM` : "BPM unknown"} · {key ? `${key}${file.camelot ? ` / ${file.camelot}` : ""}` : "Key unknown"}
      </p>

      <div className="card mb-6">
        <div ref={containerRef} />
        <div className="flex items-center gap-3 mt-4">
          <button className="btn-primary" onClick={() => void wavesurferRef.current?.playPause()}>
            {playing ? "Pause" : "Play"}
          </button>
          <span className="text-deck-300 text-sm">Drag on the waveform to select a region.</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-1">Named regions</h2>
          <p className="text-deck-300 text-sm mb-4">
            Mark reusable pieces — "intro", "drop", "vocal hook" — to drag straight into projects.
          </p>
          {selection && (
            <div className="flex gap-2 mb-4">
              <input
                className="input"
                placeholder={`Name for ${selection.start.toFixed(1)}s – ${selection.end.toFixed(1)}s`}
                value={regionLabel}
                onChange={(e) => setRegionLabel(e.target.value)}
              />
              <button className="btn-primary shrink-0" onClick={() => void saveRegion()} disabled={!regionLabel.trim()}>
                Save
              </button>
            </div>
          )}
          {(file.regions ?? []).length === 0 ? (
            <p className="text-deck-300 text-sm">No regions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(file.regions ?? []).map((r) => (
                <li key={r.id} className="flex justify-between items-center bg-deck-800 rounded-lg px-3 py-2">
                  <span>
                    <span className="font-medium">{r.label}</span>{" "}
                    <span className="text-deck-300">
                      {(r.startMs / 1000).toFixed(1)}s – {(r.endMs / 1000).toFixed(1)}s
                    </span>
                  </span>
                  <button className="text-deck-300 hover:text-red-400 cursor-pointer" onClick={() => void deleteRegion(r.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1">Corrections</h2>
          <p className="text-deck-300 text-sm mb-4">Detection isn't perfect — fix the BPM or key if it sounds off.</p>

          <div className="flex items-center gap-2 mb-3">
            <button
              className="btn-ghost"
              onClick={() => setTaps((t) => [...t.filter((x) => Date.now() - x < 3000), Date.now()])}
            >
              Tap tempo
            </button>
            {tapBpm && (
              <button className="btn-primary" onClick={() => void patchFile({ bpmManual: tapBpm })}>
                Use {tapBpm} BPM
              </button>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            <button className="btn-ghost" disabled={!bpm} onClick={() => void patchFile({ bpmManual: bpm! / 2 })}>
              ÷2 (half-time)
            </button>
            <button className="btn-ghost" disabled={!bpm} onClick={() => void patchFile({ bpmManual: bpm! * 2 })}>
              ×2 (double-time)
            </button>
            {file.bpmManual != null && (
              <button className="btn-ghost" onClick={() => void patchFile({ bpmManual: null })}>
                Reset to detected
              </button>
            )}
          </div>

          <label className="block text-sm text-deck-300 mb-1">Key override</label>
          <select
            className="input"
            value={file.keyManual ?? ""}
            onChange={(e) => {
              const value = e.target.value || null;
              void patchFile({ keyManual: value, camelot: value ? keyToCamelot(value) : file.key ? keyToCamelot(file.key) : null });
            }}
          >
            <option value="">Detected: {file.key ?? "unknown"}</option>
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k} {keyToCamelot(k) ? `(${keyToCamelot(k)})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
