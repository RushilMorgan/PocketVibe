import type { AppConfig } from '../../types';
import GroceryTracker from './blueprints/GroceryTracker';
import ChoreRoulette from './blueprints/ChoreRoulette';

interface PocketVibeCanvasProps {
  appConfig: AppConfig;
  simulatePartner: boolean;
  shimmeringBlockId: string | null;
  onCycleGroceryStatus: (id: string) => void;
  onSpinChores: () => void;
}

export default function PocketVibeCanvas({
  appConfig,
  simulatePartner,
  shimmeringBlockId,
  onCycleGroceryStatus,
  onSpinChores,
}: PocketVibeCanvasProps) {
  const sharedProps = {
    simulatePartner,
    shimmeringBlockId,
    accentColor: appConfig.accentColor,
    styleSlider: appConfig.styleSlider,
  };

  return (
    <div style={{ flex: '63', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {appConfig.blueprint === 'grocery' ? (
        <GroceryTracker
          {...sharedProps}
          groceryItems={appConfig.groceryItems}
          onCycleStatus={onCycleGroceryStatus}
        />
      ) : (
        <ChoreRoulette
          {...sharedProps}
          choreItems={appConfig.choreItems}
          onSpin={onSpinChores}
        />
      )}
    </div>
  );
}
