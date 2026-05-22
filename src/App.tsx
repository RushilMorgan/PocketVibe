import AppShell from './components/AppShell';
import PVHeader from './components/PVHeader';
import PocketVibeCanvas from './components/canvas/PocketVibeCanvas';
import CompanionSheet from './components/thumbzone/CompanionSheet';
import { usePocketVibe } from './hooks/usePocketVibe';

export default function App() {
  const { state, dispatch, processPrompt } = usePocketVibe();

  return (
    <AppShell>
      <PVHeader
        simulatePartner={state.simulatePartner}
        currentColor={state.appConfig.accentColor}
        onToggleSimulate={() => dispatch({ type: 'TOGGLE_SIMULATE_PARTNER' })}
        onLoadPreset={(preset) => dispatch({ type: 'LOAD_PRESET', payload: preset })}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <PocketVibeCanvas
          appConfig={state.appConfig}
          simulatePartner={state.simulatePartner}
          shimmeringBlockId={state.shimmeringBlockId}
          onInteract={(blockId, itemId) => dispatch({ type: 'INTERACT_BLOCK', payload: { blockId, itemId } })}
        />
        <CompanionSheet
          companion={state.companion}
          appConfig={state.appConfig}
          onSelectArchetype={(a: any) => dispatch({ type: 'SELECT_ARCHETYPE', payload: a })}
          onSetCustomName={(n: string) => dispatch({ type: 'SET_CUSTOM_NAME', payload: n })}
          onConfirm={() => dispatch({ type: 'CONFIRM_COMPANION' })}
          onPrompt={(text: string) => processPrompt(text)}
          onSliderChange={(v: number) => dispatch({ type: 'SET_STYLE_SLIDER', payload: v })}
        />
      </div>
    </AppShell>
  );
}