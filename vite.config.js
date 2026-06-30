import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Unique id for THIS build. Baked into the bundle (__BUILD_ID__) and written to
// dist/version.json so a running tab can detect when a newer build is live and
// auto-reload — no more "press Ctrl+R to see the update".
const BUILD_ID = `${Date.now()}`

function emitVersionJson() {
  let outDir = 'dist'
  return {
    name: 'emit-version-json',
    configResolved(cfg) { outDir = cfg.build.outDir },
    closeBundle() {
      try {
        fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ v: BUILD_ID }))
      } catch (e) {
        console.warn('[emit-version-json] failed:', e?.message || e)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersionJson()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
