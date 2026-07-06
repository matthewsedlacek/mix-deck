import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Studio, User } from "../lib/types";

type Mode = "login" | "register" | "join";

const MODES: { id: Mode; label: string }[] = [
  { id: "login", label: "Sign in" },
  { id: "register", label: "Start a studio" },
  { id: "join", label: "Join a studio" },
];

export default function Welcome() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ studioName: "", inviteCode: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : mode === "register"
            ? { studioName: form.studioName, name: form.name, email: form.email, password: form.password }
            : { inviteCode: form.inviteCode, name: form.name, email: form.email, password: form.password };
      const { user, studio } = await api.post<{ user: User; studio: Studio }>(`/api/auth/${mode}`, payload);
      setSession(user, studio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2">
          Mix<span className="text-glow-500">Deck</span>
        </h1>
        <p className="text-center text-deck-300 mb-8">Learn to blend music together — two decks, two of you.</p>

        <div className="card">
          <div className="flex gap-1 mb-6 bg-deck-800 rounded-lg p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  mode === m.id ? "bg-deck-700 text-deck-100" : "text-deck-300 hover:text-deck-100"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <input
                className="input"
                placeholder="Studio name (e.g. Matt & Sam's Studio)"
                value={form.studioName}
                onChange={set("studioName")}
                required
              />
            )}
            {mode === "join" && (
              <input
                className="input"
                placeholder="Invite code (from your partner's Settings)"
                value={form.inviteCode}
                onChange={set("inviteCode")}
                required
              />
            )}
            {mode !== "login" && (
              <input className="input" placeholder="Your name" value={form.name} onChange={set("name")} required />
            )}
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={set("email")}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password (8+ characters)"
              value={form.password}
              onChange={set("password")}
              required
              minLength={mode === "login" ? undefined : 8}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? "One sec…" : MODES.find((m) => m.id === mode)!.label}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
