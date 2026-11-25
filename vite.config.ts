import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The only Node API this file needs; avoids pulling in @types/node.
declare const process: { env: Record<string, string | undefined> }

/** `chess`, `/chess` and `/chess/` all mean `/chess/`; empty means the root. */
function normalizeBase(value = ''): string {
  const path = value.replace(/^\/+|\/+$/g, '')
  return path ? `/${path}/` : '/'
}

export default defineConfig({
  // Sub-path the app is served from. Read by both `build` and `preview`.
  base: normalizeBase(process.env.BASE_PATH),
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    // Behind a reverse proxy the Host header is the public domain (or the
    // container name). Preview serves only the public static build.
    allowedHosts: true,
  },
})
