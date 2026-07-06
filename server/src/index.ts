import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { libraryRouter } from "./routes/library.js";
import { projectsRouter } from "./routes/projects.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" })); // peaks payloads
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/library", libraryRouter);
app.use("/api/projects", projectsRouter);

// Uploaded audio + peaks. Auth-gated; per-studio isolation is by unguessable path segment (v1).
fs.mkdirSync(env.uploadsDir, { recursive: true });
app.use("/files", requireAuth, express.static(env.uploadsDir));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.errors[0]?.message ?? "Invalid request" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end" });
});

app.listen(env.port, () => {
  console.log(`MixDeck server listening on http://localhost:${env.port}`);
});
