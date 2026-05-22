import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      {/* Phone shell — 390×844 on desktop, full-screen on mobile */}
      <div
        className="relative flex flex-col overflow-hidden bg-white"
        style={{
          width: '390px',
          height: '844px',
          maxWidth: '100vw',
          maxHeight: '100dvh',
          borderRadius: 'clamp(0px, 3vw, 44px)',
          boxShadow:
            '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
