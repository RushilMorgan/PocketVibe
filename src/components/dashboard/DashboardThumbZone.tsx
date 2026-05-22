import type { DashboardThumbPanel, DashboardFocus, ThemeName, SiteConfig } from '../../types';
import MasterPanel from './panels/MasterPanel';
import TextEditPanel from './panels/TextEditPanel';
import PalettePanel from './panels/PalettePanel';

interface DashboardThumbZoneProps {
  panel: DashboardThumbPanel;
  focusedSection: DashboardFocus;
  siteConfig: SiteConfig;
  onUpdateText: (field: 'headline' | 'subheadline', value: string) => void;
  onSelectTheme: (theme: ThemeName) => void;
  onDone: () => void;
  onShowAddMenu: () => void;
}

export default function DashboardThumbZone({
  panel,
  focusedSection,
  siteConfig,
  onUpdateText,
  onSelectTheme,
  onDone,
  onShowAddMenu,
}: DashboardThumbZoneProps) {
  const isTextEdit =
    panel === 'text-edit' &&
    (focusedSection === 'headline' || focusedSection === 'subheadline');

  return (
    <div
      className="shrink-0 bg-white rounded-t-3xl overflow-hidden"
      style={{
        flex: '30',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.07), 0 -1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="w-8 h-1 bg-gray-200 rounded-full" />
      </div>

      <div className="overflow-hidden">
        {panel === 'master' && <MasterPanel onAddSection={onShowAddMenu} />}

        {isTextEdit && (
          <TextEditPanel
            field={focusedSection as 'headline' | 'subheadline'}
            value={siteConfig[focusedSection as 'headline' | 'subheadline']}
            onChange={(value) =>
              onUpdateText(focusedSection as 'headline' | 'subheadline', value)
            }
            onDone={onDone}
          />
        )}

        {panel === 'palette' && (
          <PalettePanel
            currentTheme={siteConfig.theme}
            onSelectTheme={onSelectTheme}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}
