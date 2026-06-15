import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Safety check: VITE_GEMINI_API_KEY should not be set in a production build.
// It is a dev-only fallback; production uses the Supabase edge function instead.
// The runtime guard in aiService.ts already blocks its use in production, but
// the string value would still appear in the bundle if this env var is set.
// Emit a loud warning rather than blocking the build (Vercel env vars can be
// cleaned up separately in the Vercel dashboard → Settings → Environment Variables).
if (process.env.NODE_ENV === 'production' && process.env.VITE_GEMINI_API_KEY) {
  console.warn(
    '\n⚠️   WARNING: VITE_GEMINI_API_KEY is set in a production build.\n' +
    '    The key string will be compiled into the public JS bundle.\n' +
    '    Remove it from Vercel → Settings → Environment Variables.\n' +
    '    The runtime guard prevents it from being used, but the string is still visible.\n'
  );
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // We write our own service worker (push + notification handlers); the
      // plugin only injects the precache manifest at self.__WB_MANIFEST.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // autoUpdate: a new deploy's worker activates and claims clients itself
      // (skipWaiting/clients.claim live in sw.ts), so users are never stranded
      // on a stale worker — the failure mode hand-rolled SWs are prone to.
      registerType: 'autoUpdate',
      // The whole app already ships a hand-written public/manifest.json that
      // every HTML entry links and vercel.json rewrites. That stays the single
      // source of truth (incl. the share_target) — the plugin only owns the SW.
      manifest: false,
      injectManifest: {
        // Precache hashed assets only — NOT *.html. Navigations always hit the
        // network so vercel.json's must-revalidate headers stay authoritative.
        globPatterns: ['**/*.{js,css,woff,woff2}'],
      },
      devOptions: {
        // Let the SW run in `vite dev` so push/share can be tested locally.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Multi-page: each standalone tool page gets its own HTML entry with
      // hardcoded SEO meta + structured data, served via a vercel.json rewrite.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'recipe-extractor': fileURLToPath(new URL('./recipe-extractor.html', import.meta.url)),
        'idea-board': fileURLToPath(new URL('./idea-board.html', import.meta.url)),
        'meal-planner': fileURLToPath(new URL('./meal-planner.html', import.meta.url)),
        budget: fileURLToPath(new URL('./budget.html', import.meta.url)),
        savings: fileURLToPath(new URL('./savings.html', import.meta.url)),
        workout: fileURLToPath(new URL('./workout.html', import.meta.url)),
        'event-planner': fileURLToPath(new URL('./event-planner.html', import.meta.url)),
        price: fileURLToPath(new URL('./price.html', import.meta.url)),
      },
    },
  },
})
