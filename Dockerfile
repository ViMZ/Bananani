# syntax=docker/dockerfile:1.7

# ---------- stage build ----------
FROM node:24-bookworm-slim AS build

# better-sqlite3 est un binding natif → besoin de la toolchain au build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps avec cache des layers
COPY package.json package-lock.json ./
RUN npm ci

# Code source
COPY . .

# Build SvelteKit (adapter-node → ./build)
RUN npm run build

# Reinstall en prod uniquement, puis prune
RUN npm prune --omit=dev


# ---------- stage runtime ----------
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8080 \
    HOST=0.0.0.0

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Volume pour SQLite + uploads (monté par fly)
VOLUME /data

EXPOSE 8080

CMD ["node", "build"]
