import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { SharedToolPage } from './components/SharedToolPage';

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
    <Router />
  </StrictMode>,
);
