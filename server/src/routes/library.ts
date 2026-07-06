import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

const ACCEPTED_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(env.uploadsDir, req.auth.studioId);
      fs.mkdir(dir, { recursive: true }).then(
        () => cb(null, dir),
        (err) => cb(err, dir),
      );
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ACCEPTED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase()));
  },
});

libraryRouter.get("/", async (req, res) => {
  const files = await prisma.audioFile.findMany({
    where: { studioId: req.auth.studioId },
    include: { regions: true, uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ files });
});

libraryRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file received (MP3, WAV, FLAC, AAC/M4A)" });
  const { title, artist } = z
    .object({ title: z.string().min(1).max(200), artist: z.string().max(200).optional() })
    .parse(req.body);

  const file = await prisma.audioFile.create({
    data: {
      studioId: req.auth.studioId,
      title,
      artist: artist || null,
      durationMs: 0, // filled in by the client analysis pass
      fileUrl: `/files/${req.auth.studioId}/${req.file.filename}`,
      uploadedById: req.auth.userId,
    },
  });
  res.json({ file });
});

// Persist client-computed analysis (BPM, key, peaks) so it runs once per file.
libraryRouter.post("/:id/analysis", async (req, res) => {
  const body = z
    .object({
      durationMs: z.number().int().positive(),
      bpm: z.number().positive().nullable(),
      key: z.string().nullable(),
      camelot: z.string().nullable(),
      peaks: z.array(z.number()),
    })
    .parse(req.body);

  const file = await getOwnedFile(req.params.id, req.auth.studioId);
  if (!file) return res.status(404).json({ error: "File not found" });

  const peaksName = `${path.parse(file.fileUrl).name}.peaks.json`;
  await fs.writeFile(path.join(env.uploadsDir, req.auth.studioId, peaksName), JSON.stringify(body.peaks));

  const updated = await prisma.audioFile.update({
    where: { id: file.id },
    data: {
      durationMs: body.durationMs,
      bpm: body.bpm,
      key: body.key,
      camelot: body.camelot,
      peaksUrl: `/files/${req.auth.studioId}/${peaksName}`,
    },
  });
  res.json({ file: updated });
});

// Manual overrides (tap tempo, half/double-time, key correction) and title edits.
libraryRouter.patch("/:id", async (req, res) => {
  const body = z
    .object({
      title: z.string().min(1).max(200).optional(),
      artist: z.string().max(200).nullable().optional(),
      bpmManual: z.number().positive().nullable().optional(),
      keyManual: z.string().nullable().optional(),
      camelot: z.string().nullable().optional(),
    })
    .parse(req.body);

  const file = await getOwnedFile(req.params.id, req.auth.studioId);
  if (!file) return res.status(404).json({ error: "File not found" });

  const updated = await prisma.audioFile.update({ where: { id: file.id }, data: body });
  res.json({ file: updated });
});

libraryRouter.delete("/:id", async (req, res) => {
  const file = await getOwnedFile(req.params.id, req.auth.studioId);
  if (!file) return res.status(404).json({ error: "File not found" });

  await prisma.audioFile.delete({ where: { id: file.id } });
  for (const url of [file.fileUrl, file.peaksUrl]) {
    if (url) await fs.rm(path.join(env.uploadsDir, url.replace(/^\/files\//, "")), { force: true });
  }
  res.json({ ok: true });
});

libraryRouter.post("/:id/regions", async (req, res) => {
  const body = z
    .object({ label: z.string().min(1).max(80), startMs: z.number().int().min(0), endMs: z.number().int().positive() })
    .refine((r) => r.endMs > r.startMs, "Region must end after it starts")
    .parse(req.body);

  const file = await getOwnedFile(req.params.id, req.auth.studioId);
  if (!file) return res.status(404).json({ error: "File not found" });

  const region = await prisma.namedRegion.create({ data: { audioFileId: file.id, ...body } });
  res.json({ region });
});

libraryRouter.delete("/:id/regions/:regionId", async (req, res) => {
  const file = await getOwnedFile(req.params.id, req.auth.studioId);
  if (!file) return res.status(404).json({ error: "File not found" });

  await prisma.namedRegion.deleteMany({ where: { id: req.params.regionId, audioFileId: file.id } });
  res.json({ ok: true });
});

async function getOwnedFile(id: string, studioId: string) {
  const file = await prisma.audioFile.findUnique({ where: { id } });
  return file && file.studioId === studioId ? file : null;
}
