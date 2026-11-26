/**
 * Copies the Stockfish WASM build into public/engine so the browser can load
 * the engine as a same-origin worker (the .js loader expects the .wasm file
 * to sit right next to it).
 *
 * Runs automatically on `npm install` via the postinstall script.
 */
import { copyFile, mkdir, access, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'node_modules', 'stockfish', 'bin')
const target = path.join(root, 'public', 'engine')

const files = [
  ['bin', 'stockfish-19-lite-single.js'],
  ['bin', 'stockfish-19-lite-single.wasm'],
  ['bin', 'stockfish-19-asm.js'],
  ['root', 'Copying.txt'],
]

const WASM_FALLBACK_SHIM = `// Fallback when WebAssembly.instantiateStreaming fails (e.g. compressed synthetic Response).
if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiateStreaming === 'function') {
  const _origInstantiateStreaming = WebAssembly.instantiateStreaming.bind(WebAssembly);
  WebAssembly.instantiateStreaming = function (source, importObject) {
    return Promise.resolve(source).then(function (res) {
      const clone = res && typeof res.clone === 'function' ? res.clone() : null;
      return _origInstantiateStreaming(res, importObject).catch(function (err) {
        if (!clone) throw err;
        return clone.arrayBuffer().then(function (buf) {
          return WebAssembly.instantiate(buf, importObject);
        });
      });
    });
  };
}
`

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

  const engineJsPath = path.join(target, 'stockfish-19-lite-single.js')
  const engineJs = await readFile(engineJsPath, 'utf8')
  if (!engineJs.includes('_origInstantiateStreaming')) {
    await writeFile(engineJsPath, WASM_FALLBACK_SHIM + engineJs, 'utf8')
  }

  console.log(`[engine] Copied Stockfish 19 (lite, single-threaded) to public/engine.`)
}

await main()
