import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The only Node API this file needs; avoids pulling in @types/node.
declare const process: { env: Record<string, string | undefined> }

/** `chess`, `/chess` and `/chess/` all mean `/chess/`; empty means the root. */
function normalizeBase(value = ''): string {
  const path = value.replace(/^\/+|\/+$/g, '')
  return path ? `/${path}/` : '/'
}

const base = normalizeBase(process.env.BASE_PATH)

export default defineConfig(({ isSsrBuild }) => ({
  // Sub-path the app is served from. Read by both `build` and `preview`.
  base,
  plugins: [react()],
  build: {
    // The server bundle (`npm run build:server`) needs no copy of public/.
    copyPublicDir: !isSsrBuild,
  },
  // The server bundle carries its dependencies (ws, chess.js), so the runtime
  // image needs no node_modules.
  ssr: {
    noExternal: true,
  },
  server: {
    port: 5173,
    // Online play in development: run `npm run dev:server` next to `npm run dev`.
    proxy: {
      [`${base}ws`]: { target: 'ws://localhost:4173', ws: true },
    },
  },
  preview: {
    // Behind a reverse proxy the Host header is the public domain (or the
    // container name). Preview serves only the public static build.
    allowedHosts: true,
  },
}))
