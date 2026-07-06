import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export const AUTH_COOKIE = "mixdeck_token";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.secureCookies,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export interface AuthPayload {
  userId: string;
  studioId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    req.auth = jwt.verify(token, env.jwtSecret) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired — sign in again" });
  }
}
