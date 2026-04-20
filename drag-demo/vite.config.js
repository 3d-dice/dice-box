import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))

// Standalone dev config for the drag demo. Serves this folder and uses
// ../public as the static asset root so /assets/dice-box/... resolves.
export default defineConfig({
  root: here,
  publicDir: path.resolve(here, '../public'),
  server: {
    fs: {
      // allow importing from ../src
      allow: [path.resolve(here, '..')],
    },
  },
})
