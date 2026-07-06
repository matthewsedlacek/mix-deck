import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Project } from "../lib/types";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => {
    api
      .get<{ projects: Project[] }>("/api/projects")
      .then(({ projects }) => setProjects(projects))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const { project } = await api.post<{ project: Project }>("/api/projects", {
      name,
      goalStatement: goal || undefined,
    });
    setProjects((p) => [project, ...p]);
    setName("");
    setGoal("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Projects</h1>
      <p className="text-deck-300 text-sm mb-6">
        Each project is a mix in progress. The editor arrives in Phase 2 — for now, sketch out what you want to make.
      </p>

      <form onSubmit={create} className="card mb-6 flex flex-col md:flex-row gap-3">
        <input
          className="input md:max-w-60"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="What are we going for? (e.g. sunset house set for the rooftop)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <button className="btn-primary shrink-0">New project</button>
      </form>

      {loading ? (
        <p className="text-deck-300">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="card text-center py-16 text-deck-300">
          No projects yet — start one above, or add tracks to your library first.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="card">
              <h2 className="font-semibold">{p.name}</h2>
              {p.goalStatement && <p className="text-deck-300 text-sm mt-1">{p.goalStatement}</p>}
              <p className="text-deck-300 text-xs mt-3">
                {p.masterBpm} BPM · {p._count?.clips ?? 0} clips · last edited{" "}
                {new Date(p.updatedAt).toLocaleDateString()}
                {p.createdBy ? ` · started by ${p.createdBy.name}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
