import type { BottomSheetContext, ThemeName, SiteBuilderAction } from '../../types';
import AINudge from './AINudge';
import PalettePicker from './PalettePicker';
import LaunchButton from './LaunchButton';
import ChatInput from './ChatInput';

interface ThumbZoneProps {
  context: BottomSheetContext;
  currentTheme: ThemeName;
  dispatch: React.Dispatch<SiteBuilderAction>;
}

const AI_NUDGE_MESSAGE =
  "Boom! I built your first draft. 🐾 Let's make it match your style. Tap anywhere on your website background to change the vibe.";

export default function ThumbZone({ context, currentTheme, dispatch }: ThumbZoneProps) {
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

      {/* Context-aware panel — each child transition fades in */}
      <div className="overflow-hidden">
        {context === 'idle' && <ChatInput />}
        {context === 'nudge' && <AINudge message={AI_NUDGE_MESSAGE} />}
        {context === 'palette' && (
          <PalettePicker currentTheme={currentTheme} dispatch={dispatch} />
        )}
        {context === 'launch' && <LaunchButton dispatch={dispatch} />}
      </div>
    </div>
  );
}
