# syntax=docker/dockerfile:1

# ── Build: the static app (dist/) and the self-contained server (dist-server/)
FROM node:22-alpine AS build
WORKDIR /app
# scripts/ must exist before `npm ci` (postinstall copies the Stockfish WASM)
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
# Sub-path to serve the app from, e.g. /chess/.
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN npm run build

# ── Run: Node serves the app and the online-play WebSocket; no node_modules
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4173
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 4173
HEALTHCHECK CMD p="${BASE_PATH#/}"; p="${p%/}"; wget -qO- "http://127.0.0.1:4173/${p:+$p/}healthz" >/dev/null || exit 1
CMD ["node", "dist-server/index.js"]
