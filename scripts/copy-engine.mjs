/**
 * Copies the Stockfish WASM build into public/engine so the browser can load
 * the engine as a same-origin worker (the .js loader expects the .wasm file
 * to sit right next to it).
 *
 * Runs automatically on `npm install` via the postinstall script.
 */
import { copyFile, mkdir, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'node_modules', 'stockfish', 'bin')
const target = path.join(root, 'public', 'engine')

const files = [
  ['bin', 'stockfish-19-lite-single.js'],
  ['bin', 'stockfish-19-lite-single.wasm'],
  ['root', 'Copying.txt'],
]

async function main() {
  try {
    await access(source)
  } catch {
    // Stockfish is not installed yet (e.g. a production install without devDeps).
    console.warn('[engine] node_modules/stockfish not found — skipping engine copy.')
    return
  }

  await mkdir(target, { recursive: true })
  await Promise.all(
    files.map(([location, file]) =>
      copyFile(
        location === 'bin' ? path.join(source, file) : path.join(root, 'node_modules', 'stockfish', file),
        path.join(target, file),
      ),
    ),
  )
  console.log(`[engine] Copied Stockfish 19 (lite, single-threaded) to public/engine.`)
}

await main()
