import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prompts are read from /prompts at runtime; make sure Vercel bundles them.
  outputFileTracingIncludes: { '/api/**': ['./prompts/**'] },
  // Diagram validation runs mermaid under jsdom; both load files dynamically
  // and break when bundled, so Node requires them at runtime instead.
  serverExternalPackages: ['mermaid', 'jsdom', 'sharp'],
  async headers() {
    return [
      {
        // Browsers must always revalidate the worker so updates roll out.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
