import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so the dev server config stays untouched.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
