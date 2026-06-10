import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initAnalytics } from './lib/analytics';

// Route-level code splitting: visitors opening a shared link don't download the
// whole app, and app users don't download the shared-page bundle.
const App = lazy(() => import('./App'));
const SharedToolPage = lazy(() =>
  import('./components/SharedToolPage').then(m => ({ default: m.SharedToolPage })),
);

initAnalytics();

function BootFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <span className="text-violet-500 text-2xl animate-pulse">✦</span>
    </div>
  );
}

function Router() {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/s\/([a-z0-9]+)/i);
  if (match) {
    const params = new URLSearchParams(window.location.search);
    return (
      <SharedToolPage
        shareSlug={match[1]}
        adminToken={params.get('admin') ?? undefined}
        participantToken={params.get('p') ?? undefined}
      />
    );
  }
  return <App />;
}

const root = document.getElementById('app');
if (!root) throw new Error('Root element #app not found');

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<BootFallback />}>
      <Router />
    </Suspense>
  </StrictMode>,
);
