import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { AUTH_COOKIE, cookieOptions, requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

const credentials = {
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
};

// Creates a new Studio with its first member.
authRouter.post("/register", async (req, res) => {
  const body = z.object({ studioName: z.string().min(1).max(80), ...credentials }).parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return res.status(409).json({ error: "That email is already registered" });

  const studio = await prisma.studio.create({ data: { name: body.studioName } });
  const user = await prisma.user.create({
    data: {
      studioId: studio.id,
      name: body.name,
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 10),
    },
  });
  res.cookie(AUTH_COOKIE, signToken({ userId: user.id, studioId: studio.id }), cookieOptions);
  res.json({ user: publicUser(user), studio });
});

// Second person joins an existing Studio using its invite code (the studio id, shown in Settings).
authRouter.post("/join", async (req, res) => {
  const body = z.object({ inviteCode: z.string().min(1), ...credentials }).parse(req.body);
  const studio = await prisma.studio.findUnique({ where: { id: body.inviteCode.trim() } });
  if (!studio) return res.status(404).json({ error: "No studio found for that invite code" });
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return res.status(409).json({ error: "That email is already registered" });

  const user = await prisma.user.create({
    data: {
      studioId: studio.id,
      name: body.name,
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 10),
    },
  });
  res.cookie(AUTH_COOKIE, signToken({ userId: user.id, studioId: studio.id }), cookieOptions);
  res.json({ user: publicUser(user), studio });
});

authRouter.post("/login", async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: user.studioId } });
  res.cookie(AUTH_COOKIE, signToken({ userId: user.id, studioId: user.studioId }), cookieOptions);
  res.json({ user: publicUser(user), studio });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) return res.status(401).json({ error: "Not signed in" });
  const studio = await prisma.studio.findUniqueOrThrow({
    where: { id: user.studioId },
    include: { users: { select: { id: true, name: true, email: true } } },
  });
  res.json({ user: publicUser(user), studio });
});

function publicUser(user: { id: string; studioId: string; name: string; email: string; lessonProgress: unknown }) {
  return {
    id: user.id,
    studioId: user.studioId,
    name: user.name,
    email: user.email,
    lessonProgress: user.lessonProgress,
  };
}
