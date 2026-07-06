import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { analyzeAudioFile } from "../lib/analysis/analyze";
import { compatibleCamelot } from "../lib/camelot";
import { effectiveBpm, effectiveKey, type AudioFile } from "../lib/types";

type SortField = "title" | "artist" | "bpm" | "camelot" | "durationMs" | "createdAt";

interface UploadJob {
  name: string;
  status: "uploading" | "analyzing" | "error";
  message?: string;
}

const COPYRIGHT_NOTE_KEY = "mixdeck.copyrightNoteSeen";

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Daft Punk - One More Time.mp3" -> { artist, title } */
function parseFilename(name: string): { title: string; artist?: string } {
  const base = name.replace(/\.[^.]+$/, "");
  const dash = base.match(/^(.+?)\s*-\s*(.+)$/);
  return dash ? { artist: dash[1].trim(), title: dash[2].trim() } : { title: base };
}

export default function Library() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: 1 | -1 }>({ field: "createdAt", dir: -1 });
  const [search, setSearch] = useState("");
  const [compatWith, setCompatWith] = useState<string>("");
  const [showCopyrightNote, setShowCopyrightNote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const { files } = await api.get<{ files: AudioFile[] }>("/api/library");
    setFiles(files);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  async function handleFiles(list: FileList | File[]) {
    if (!localStorage.getItem(COPYRIGHT_NOTE_KEY)) {
      setShowCopyrightNote(true);
      localStorage.setItem(COPYRIGHT_NOTE_KEY, "1");
    }
    for (const file of Array.from(list)) {
      void uploadOne(file);
    }
  }

  async function uploadOne(file: File) {
    const job: UploadJob = { name: file.name, status: "uploading" };
    setJobs((j) => [...j, job]);
    const setJob = (patch: Partial<UploadJob>) =>
      setJobs((j) => j.map((x) => (x === job ? Object.assign(job, patch) : x)));

    try {
      const meta = parseFilename(file.name);
      const form = new FormData();
      form.append("file", file);
      form.append("title", meta.title);
      if (meta.artist) form.append("artist", meta.artist);
      const { file: created } = await api.postForm<{ file: AudioFile }>("/api/library", form);

      setJob({ status: "analyzing" });
      const analysis = await analyzeAudioFile(file);
      await api.post(`/api/library/${created.id}/analysis`, analysis);

      setJobs((j) => j.filter((x) => x !== job));
      await refresh();
    } catch (err) {
      setJob({ status: "error", message: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
  }

  const visible = useMemo(() => {
    let out = files;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((f) => f.title.toLowerCase().includes(q) || (f.artist ?? "").toLowerCase().includes(q));
    }
    if (compatWith) {
      const allowed = new Set(compatibleCamelot(compatWith));
      out = out.filter((f) => f.camelot && allowed.has(f.camelot));
    }
    const { field, dir } = sort;
    return [...out].sort((a, b) => {
      const av = field === "bpm" ? (effectiveBpm(a) ?? 0) : ((a[field] as string | number | null) ?? "");
      const bv = field === "bpm" ? (effectiveBpm(b) ?? 0) : ((b[field] as string | number | null) ?? "");
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [files, search, compatWith, sort]);

  const camelotCodes = useMemo(
    () => [...new Set(files.map((f) => f.camelot).filter((c): c is string => !!c))].sort(),
    [files],
  );

  const toggleSort = (field: SortField) =>
    setSort((s) => ({ field, dir: s.field === field ? ((s.dir * -1) as 1 | -1) : 1 }));

  const header = (field: SortField, label: string) => (
    <th
      className="text-left px-4 py-3 font-medium text-deck-300 cursor-pointer hover:text-deck-100 select-none"
      onClick={() => toggleSort(field)}
    >
      {label} {sort.field === field ? (sort.dir === 1 ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Library</h1>
          <p className="text-deck-300 text-sm mt-1">
            Audio you own — uploads are analyzed for BPM and key automatically.
          </p>
        </div>
        <button className="btn-primary" onClick={() => inputRef.current?.click()}>
          Add tracks
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.flac,.m4a,.aac,audio/*"
          multiple
          hidden
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
      </div>

      {showCopyrightNote && (
        <div className="card mb-6 border-glow-600/50 text-sm flex justify-between gap-4">
          <p className="text-deck-300">
            <span className="text-deck-100 font-medium">A friendly note:</span> upload music you have the rights to —
            purchased files, royalty-free packs, or your own recordings. Exports are for your personal use.
          </p>
          <button className="text-glow-400 shrink-0 cursor-pointer" onClick={() => setShowCopyrightNote(false)}>
            Got it
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed transition-colors mb-6 px-6 py-8 text-center ${
          dragOver ? "border-glow-500 bg-glow-500/5" : "border-deck-600 text-deck-300"
        }`}
      >
        Drag & drop MP3, WAV, FLAC or M4A files here
      </div>

      {jobs.length > 0 && (
        <div className="space-y-2 mb-6">
          {jobs.map((job, i) => (
            <div key={i} className="card !py-3 flex items-center justify-between text-sm">
              <span className="truncate">{job.name}</span>
              {job.status === "error" ? (
                <span className="text-red-400">
                  {job.message}{" "}
                  <button className="underline cursor-pointer" onClick={() => setJobs((j) => j.filter((x) => x !== job))}>
                    dismiss
                  </button>
                </span>
              ) : (
                <span className="text-glow-400 animate-pulse">
                  {job.status === "uploading" ? "Uploading…" : "Finding the beat…"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          className="input max-w-xs"
          placeholder="Search title or artist"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-56" value={compatWith} onChange={(e) => setCompatWith(e.target.value)}>
          <option value="">All keys</option>
          {camelotCodes.map((c) => (
            <option key={c} value={c}>
              Blends with {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-deck-300">Loading…</p>
      ) : visible.length === 0 && files.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-lg font-medium mb-2">Add your first tracks</p>
          <p className="text-deck-300 text-sm">
            Drop in a few songs you own to get started. We'll detect their BPM and key so blending is easy.
          </p>
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-deck-700">
              <tr>
                {header("title", "Title")}
                {header("artist", "Artist")}
                {header("bpm", "BPM")}
                {header("camelot", "Key")}
                {header("durationMs", "Length")}
                {header("createdAt", "Added")}
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id} className="border-b border-deck-800 last:border-0 hover:bg-deck-800/50">
                  <td className="px-4 py-3">
                    <Link to={`/library/${f.id}`} className="font-medium hover:text-glow-400">
                      {f.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-deck-300">{f.artist ?? "—"}</td>
                  <td className="px-4 py-3">{effectiveBpm(f) ? Math.round(effectiveBpm(f)!) : "—"}</td>
                  <td className="px-4 py-3">
                    {effectiveKey(f) ?? "—"}
                    {f.camelot && <span className="text-deck-300"> · {f.camelot}</span>}
                  </td>
                  <td className="px-4 py-3 text-deck-300">{formatDuration(f.durationMs)}</td>
                  <td className="px-4 py-3 text-deck-300">{new Date(f.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
