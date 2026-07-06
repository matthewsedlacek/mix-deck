import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  uploadsDir: path.resolve(process.env.UPLOADS_DIR ?? "uploads"),
  isProduction: process.env.NODE_ENV === "production",
};
