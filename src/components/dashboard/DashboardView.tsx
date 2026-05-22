import { useEffect } from 'react';
import AppShell from '../AppShell';
import DashboardHeader from './DashboardHeader';
import DashboardThumbZone from './DashboardThumbZone';
import AddSectionMenu from './AddSectionMenu';
import DashboardLandingPage from '../canvas/DashboardLandingPage';
import { useDashboard } from '../../hooks/useDashboard';
import type { SiteRow } from '../../hooks/useAuth';

interface DashboardViewProps {
  siteRow: SiteRow;
}

export default function DashboardView({ siteRow }: DashboardViewProps) {
  const { state, dispatch, focusSection, updateText, selectTheme, addBlock, saveChanges } =
    useDashboard(siteRow.config);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!state.toast) return;
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000);
    return () => clearTimeout(timer);
  }, [state.toast, dispatch]);

  return (
    <AppShell>
      <DashboardHeader
        subdomain={siteRow.subdomain}
        isDirty={state.isDirty}
        isSaving={state.isSaving}
        onSave={() => saveChanges(siteRow.id)}
      />

      <div className="flex-1 relative flex flex-col overflow-hidden">
        {/* Toast notification */}
        {state.toast && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-50 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap pointer-events-none"
            style={{
              background: state.toast.startsWith('Save failed')
                ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                : 'linear-gradient(135deg, #16a34a, #15803d)',
            }}
          >
            {state.toast}
          </div>
        )}

        {/* Live canvas */}
        <div className="canvas-scroll overflow-y-auto overflow-x-hidden" style={{ flex: '63' }}>
          <DashboardLandingPage
            siteConfig={state.siteConfig}
            focusedSection={state.focusedSection}
            onFocus={focusSection}
          />
        </div>

        {/* Context-aware thumb zone */}
        <DashboardThumbZone
          panel={state.thumbPanel}
          focusedSection={state.focusedSection}
          siteConfig={state.siteConfig}
          onUpdateText={updateText}
          onSelectTheme={selectTheme}
          onDone={() => focusSection(null)}
          onShowAddMenu={() => dispatch({ type: 'SHOW_ADD_MENU' })}
        />

        {/* Add Section overlay menu */}
        {state.showAddMenu && (
          <AddSectionMenu
            onAdd={addBlock}
            onClose={() => dispatch({ type: 'HIDE_ADD_MENU' })}
          />
        )}
      </div>
    </AppShell>
  );
}
