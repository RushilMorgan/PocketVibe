import type { Metadata, Viewport } from 'next';
import { ServiceWorker } from '@/components/service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: 'HeyToolie',
  description: 'Share any link. Get the useful version back.',
  // app/manifest.ts is linked automatically.
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'HeyToolie' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
