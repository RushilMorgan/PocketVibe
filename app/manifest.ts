import type { MetadataRoute } from 'next';

/**
 * PWA manifest. share_target puts HeyToolie in the Android share sheet; the
 * OS POSTs title/text/url to /share (see app/share/route.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'HeyToolie',
    short_name: 'HeyToolie',
    description: 'Share any link. Get the useful version back.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf9',
    theme_color: '#fafaf9',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    share_target: {
      action: '/share',
      method: 'POST',
      enctype: 'application/x-www-form-urlencoded',
      params: { title: 'title', text: 'text', url: 'url' },
    },
  };
}
