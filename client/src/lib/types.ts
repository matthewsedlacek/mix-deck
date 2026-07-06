export interface User {
  id: string;
  studioId: string;
  name: string;
  email: string;
  lessonProgress: Record<string, unknown>;
}

export interface Studio {
  id: string;
  name: string;
  users?: { id: string; name: string; email: string }[];
}

export interface NamedRegion {
  id: string;
  audioFileId: string;
  label: string;
  startMs: number;
  endMs: number;
}

export interface AudioFile {
  id: string;
  studioId: string;
  title: string;
  artist: string | null;
  durationMs: number;
  bpm: number | null;
  bpmManual: number | null;
  key: string | null;
  keyManual: string | null;
  camelot: string | null;
  fileUrl: string;
  peaksUrl: string | null;
  artworkUrl: string | null;
  createdAt: string;
  regions?: NamedRegion[];
  uploadedBy?: { id: string; name: string };
}

export interface Project {
  id: string;
  name: string;
  goalStatement: string;
  masterBpm: number;
  masterKey: string | null;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  _count?: { clips: number };
}

/** The BPM/key a file effectively has: manual override wins over detected. */
export function effectiveBpm(f: AudioFile): number | null {
  return f.bpmManual ?? f.bpm;
}
export function effectiveKey(f: AudioFile): string | null {
  return f.keyManual ?? f.key;
}
