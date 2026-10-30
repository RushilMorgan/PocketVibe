import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prompts are read from /prompts at runtime; make sure Vercel bundles them.
  outputFileTracingIncludes: { '/api/**': ['./prompts/**'] },
};

export default nextConfig;
