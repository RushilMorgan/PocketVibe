import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Safety check: VITE_GEMINI_API_KEY must never be bundled into a production build.
// It is a dev-only fallback; production uses the Supabase edge function instead.
if (process.env.NODE_ENV === 'production' && process.env.VITE_GEMINI_API_KEY) {
  console.error(
    '\n⛔  BUILD BLOCKED: VITE_GEMINI_API_KEY is set in a production build.\n' +
    '    This key would be compiled into the JS bundle and become publicly readable.\n' +
    '    Unset VITE_GEMINI_API_KEY before building for production.\n'
  );
  process.exit(1);
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
