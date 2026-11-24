# syntax=docker/dockerfile:1

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
# scripts/ must exist before `npm ci` (postinstall copies the Stockfish WASM)
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build

# --- serve ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
