/**
 * Camelot wheel helpers. Keys are named like "A minor" / "F# major";
 * Camelot codes are 1A..12A (minor) and 1B..12B (major).
 */

const MINOR_WHEEL = ["A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "D♭"]; // 1A..12A
const MAJOR_WHEEL = ["B", "F♯", "D♭", "A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E"]; // 1B..12B

const NOTE_ALIASES: Record<string, string> = {
  "C#": "D♭", Db: "D♭", "D#": "E♭", Eb: "E♭", "F#": "F♯", Gb: "F♯",
  "G#": "A♭", Ab: "A♭", "A#": "B♭", Bb: "B♭",
};

function normalizeNote(note: string): string {
  const trimmed = note.trim();
  return NOTE_ALIASES[trimmed] ?? trimmed.replace("#", "♯").replace(/b$/, "♭");
}

/** "F♯ minor" -> "11A"; returns null if unparseable. */
export function keyToCamelot(keyName: string): string | null {
  const match = keyName.trim().match(/^([A-G][#♯b♭]?)\s*(major|minor|maj|min)$/i);
  if (!match) return null;
  const note = normalizeNote(match[1]);
  const isMinor = match[2].toLowerCase().startsWith("min");
  const wheel = isMinor ? MINOR_WHEEL : MAJOR_WHEEL;
  const idx = wheel.indexOf(note);
  return idx === -1 ? null : `${idx + 1}${isMinor ? "A" : "B"}`;
}

/** Harmonic-mixing-friendly neighbors: same code, ±1 on the wheel, and relative major/minor. */
export function compatibleCamelot(code: string): string[] {
  const match = code.match(/^(\d{1,2})([AB])$/);
  if (!match) return [];
  const num = Number(match[1]);
  const letter = match[2];
  const up = (num % 12) + 1;
  const down = ((num + 10) % 12) + 1;
  return [`${num}${letter}`, `${up}${letter}`, `${down}${letter}`, `${num}${letter === "A" ? "B" : "A"}`];
}

/** Display helper: "A minor / 8A". */
export function keyWithCamelot(keyName: string): string {
  const camelot = keyToCamelot(keyName);
  return camelot ? `${keyName} / ${camelot}` : keyName;
}
