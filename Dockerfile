# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
# scripts/ must exist before `npm ci` (postinstall copies the Stockfish WASM)
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4173
HEALTHCHECK CMD wget -qO- http://127.0.0.1:4173/ >/dev/null || exit 1
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
