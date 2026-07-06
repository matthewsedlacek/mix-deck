import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

// Phase 1 skeleton: create/list/rename projects so the editor (Phase 2) has a home.
export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { studioId: req.auth.studioId },
    include: { createdBy: { select: { id: true, name: true } }, _count: { select: { clips: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ projects });
});

projectsRouter.post("/", async (req, res) => {
  const body = z
    .object({ name: z.string().min(1).max(120), goalStatement: z.string().max(500).optional() })
    .parse(req.body);
  const project = await prisma.project.create({
    data: {
      studioId: req.auth.studioId,
      name: body.name,
      goalStatement: body.goalStatement ?? "",
      createdById: req.auth.userId,
    },
  });
  res.json({ project });
});

projectsRouter.patch("/:id", async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).max(120).optional(),
      goalStatement: z.string().max(500).optional(),
      masterBpm: z.number().min(40).max(220).optional(),
      masterKey: z.string().nullable().optional(),
    })
    .parse(req.body);
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.studioId !== req.auth.studioId) return res.status(404).json({ error: "Project not found" });
  const updated = await prisma.project.update({ where: { id: project.id }, data: body });
  res.json({ project: updated });
});

projectsRouter.delete("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.studioId !== req.auth.studioId) return res.status(404).json({ error: "Project not found" });
  await prisma.project.delete({ where: { id: project.id } });
  res.json({ ok: true });
});
