import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return value;
}

const isProduction = process.env.NODE_ENV === "production";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  uploadsDir: path.resolve(process.env.UPLOADS_DIR ?? "uploads"),
  isProduction,
  // Dev-only: the Vite dev server origin allowed for CORS. In production the
  // built client is served from this same server, so no CORS is needed.
  corsOrigin: process.env.CORS_ORIGIN ?? (isProduction ? null : "http://localhost:5173"),
  // When set, serve the built SPA from this directory (production).
  clientDist: process.env.CLIENT_DIST ? path.resolve(process.env.CLIENT_DIST) : null,
  // Secure cookies require HTTPS. INSECURE_COOKIES=1 lets an IP-only deploy
  // (no domain/TLS yet) sign in over plain HTTP.
  secureCookies: isProduction && process.env.INSECURE_COOKIES !== "1",
};
