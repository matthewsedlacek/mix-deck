# Builds both workspaces and runs the API server, which also serves the SPA.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY client client
COPY server server
RUN cd server && npx prisma generate && npm run build
RUN cd client && npm run build

FROM node:20-slim
# Prisma needs the openssl binary to pick the right query engine
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    CLIENT_DIST=/app/client/dist \
    UPLOADS_DIR=/data/uploads
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server/package.json server/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/client/dist client/dist
WORKDIR /app/server
EXPOSE 4000
# Apply any pending migrations, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
