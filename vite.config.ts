import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
  ],
  build: {
    rollupOptions: {
      // Multi-page: each standalone tool page gets its own HTML entry with
      // hardcoded SEO meta + structured data, served via a vercel.json rewrite.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'recipe-extractor': fileURLToPath(new URL('./recipe-extractor.html', import.meta.url)),
        'idea-board': fileURLToPath(new URL('./idea-board.html', import.meta.url)),
      },
    },
  },
})
