import AppShell from './components/AppShell';
import PVHeader from './components/PVHeader';
import PocketVibeCanvas from './components/canvas/PocketVibeCanvas';
import CompanionSheet from './components/thumbzone/CompanionSheet';
import { usePocketVibe } from './hooks/usePocketVibe';

export default function App() {
  const {
    state,
    dispatch,
    shufflePaletteWithShimmer,
    makePunchierWithShimmer,
    addSectionWithShimmer,
    spinChores,
    sendMessageWithEffect,
  } = usePocketVibe();

  return (
    <AppShell>
      <PVHeader
        simulatePartner={state.simulatePartner}
        currentBlueprint={state.appConfig.blueprint}
        onToggleSimulate={() => dispatch({ type: 'TOGGLE_SIMULATE_PARTNER' })}
        onSwapBlueprint={(id) => dispatch({ type: 'SWAP_BLUEPRINT', payload: id })}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <PocketVibeCanvas
          appConfig={state.appConfig}
          simulatePartner={state.simulatePartner}
          shimmeringBlockId={state.shimmeringBlockId}
          onCycleGroceryStatus={(id) => dispatch({ type: 'CYCLE_GROCERY_STATUS', payload: id })}
          onSpinChores={spinChores}
        />
        <CompanionSheet
          companion={state.companion}
          appConfig={state.appConfig}
          onSelectArchetype={(a) => dispatch({ type: 'SELECT_ARCHETYPE', payload: a })}
          onSetCustomName={(n) => dispatch({ type: 'SET_CUSTOM_NAME', payload: n })}
          onConfirm={() => dispatch({ type: 'CONFIRM_COMPANION' })}
          onSendMessage={sendMessageWithEffect}
          onSliderChange={(v) => dispatch({ type: 'SET_STYLE_SLIDER', payload: v })}
          onShufflePalette={shufflePaletteWithShimmer}
          onMakePunchier={makePunchierWithShimmer}
          onAddSection={addSectionWithShimmer}
        />
      </div>
    </AppShell>
  );
}
