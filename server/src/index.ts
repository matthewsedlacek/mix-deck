import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { libraryRouter } from "./routes/library.js";
import { projectsRouter } from "./routes/projects.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

app.set("trust proxy", 1); // behind Caddy in production
if (env.corsOrigin) app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" })); // peaks payloads
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/library", libraryRouter);
app.use("/api/projects", projectsRouter);

// Uploaded audio + peaks. Auth-gated; per-studio isolation is by unguessable path segment (v1).
fs.mkdirSync(env.uploadsDir, { recursive: true });
app.use("/files", requireAuth, express.static(env.uploadsDir));

// Production: serve the built SPA from this server (same origin as the API).
if (env.clientDist) {
  const indexHtml = path.join(env.clientDist, "index.html");
  app.use(express.static(env.clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/files")) return next();
    res.sendFile(indexHtml); // SPA fallback for client-side routes
  });
}

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
