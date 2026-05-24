import React from 'react';
import AppShell from './components/AppShell';
import PVHeader from './components/PVHeader';
import { HomeScreen } from './components/HomeScreen';
import { MyCreations } from './components/MyCreations';
import { CreationComposer } from './components/CreationComposer';
import { TemplateRenderer } from './components/templates/TemplateRenderer';
import { usePocketVibe } from './hooks/usePocketVibe';

export default function App() {
  const {
    state,
    activeCreation,
    openCreation,
    goHome,
    goToMyCreations,
    startNewCreation,
    improveCreation,
    confirmNewCreation,
    dismissPendingAction,
    deleteCreation,
    duplicateCreation,
    updateCreationContent,
  } = usePocketVibe();

  const { view, creations, activeCreationId, isGenerating, processingStatus, pendingAction, messages, accentColor } = state;

  return (
    <AppShell>
      {/* Header */}
      <PVHeader
        view={view}
        activeCreation={activeCreation}
        creationsCount={creations.length}
        accentColor={accentColor}
        onBack={goHome}
        onGoMyCreations={goToMyCreations}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        {view === 'home' && (
          <HomeScreen
            onPrompt={startNewCreation}
            isGenerating={isGenerating}
          />
        )}

        {view === 'creation' && (
          <div className="flex flex-col h-full overflow-hidden relative">
            {/* Summary message from AI */}
            {activeCreation?.status === 'ready' && activeCreation.summary && messages.length > 0 && (
              <div className="mx-4 mt-3 px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600 leading-relaxed flex-shrink-0">
                {activeCreation.summary}
              </div>
            )}

            {/* Generating overlay */}
            {isGenerating && (
              <div className="flex-shrink-0 mx-4 mt-3 px-4 py-3 rounded-xl bg-violet-50 flex items-center gap-2">
                <span className="text-base animate-pulse">✨</span>
                <span className="text-sm text-violet-700 font-medium">
                  {processingStatus ?? 'Making something for you…'}
                </span>
              </div>
            )}

            {/* Canvas */}
            {activeCreation && activeCreation.status !== 'generating' ? (
              <div className="flex-1 overflow-y-auto pb-24">
                <TemplateRenderer
                  creation={activeCreation}
                  onContentChange={updateCreationContent}
                />
              </div>
            ) : !isGenerating && (
              <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
                Nothing to show yet
              </div>
            )}

            {/* Error state */}
            {activeCreation?.status === 'error' && (
              <div className="mx-4 mb-4 px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 flex-shrink-0">
                Something went wrong. Tap ✨ below and try again.
              </div>
            )}

            {/* Composer */}
            <CreationComposer
              activeCreation={activeCreation}
              messages={messages}
              isGenerating={isGenerating}
              processingStatus={processingStatus}
              onNew={startNewCreation}
              onImprove={(req) => improveCreation(req, 'improve')}
              onAdd={(req) => improveCreation(req, 'add')}
            />
          </div>
        )}

        {view === 'my-creations' && (
          <MyCreations
            creations={creations}
            activeCreationId={activeCreationId}
            onOpen={openCreation}
            onDelete={deleteCreation}
            onDuplicate={duplicateCreation}
            onBack={activeCreation ? () => { openCreation(activeCreation.id); } : goHome}
          />
        )}
      </div>

      {/* New-creation guard dialog */}
      {pendingAction?.type === 'new-creation' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismissPendingAction} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full">
            <h3 className="font-bold text-gray-900 text-base mb-2">Start something new?</h3>
            <p className="text-sm text-gray-500 mb-5">
              You have "{activeCreation?.title}" open. It's already saved — starting fresh won't delete it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={dismissPendingAction}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50"
              >
                Keep it
              </button>
              <button
                onClick={confirmNewCreation}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
