/**
 * Component smoke tests — every major component renders without throwing.
 * Full interaction paths are covered in reducer.test.ts.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { AppConfig } from '../types';
import BlockRenderer from '../components/canvas/BlockRenderer';
import PocketVibeCanvas from '../components/canvas/PocketVibeCanvas';
import PVHeader from '../components/PVHeader';
import AppShell from '../components/AppShell';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const BASE_CONFIG: AppConfig = {
  blocks: [],
  accentColor: '#7c3aed',
  styleSlider: 30,
};

const noop = vi.fn();

// ── AppShell ───────────────────────────────────────────────────────────────────

describe('AppShell', () => {
  it('renders children inside the phone frame', () => {
    render(<AppShell><span data-testid="child">hello</span></AppShell>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

// ── PVHeader ───────────────────────────────────────────────────────────────────

describe('PVHeader', () => {
  it('renders the PocketVibe AI brand name', () => {
    render(
      <PVHeader
        simulatePartner={false}
        currentColor="#7c3aed"
        onToggleSimulate={noop}
        onLoadPreset={noop}
      />,
    );
    expect(screen.getByText('PocketVibe AI')).toBeInTheDocument();
  });

  it('shows Live badge when simulatePartner is true', () => {
    render(
      <PVHeader
        simulatePartner={true}
        currentColor="#7c3aed"
        onToggleSimulate={noop}
        onLoadPreset={noop}
      />,
    );
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });

  it('calls onToggleSimulate when sim button clicked', () => {
    const toggle = vi.fn();
    render(
      <PVHeader
        simulatePartner={false}
        currentColor="#7c3aed"
        onToggleSimulate={toggle}
        onLoadPreset={noop}
      />,
    );
    fireEvent.click(screen.getByText(/sim/i));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('calls onLoadPreset with "grocery" when Grocery button clicked', () => {
    const loadPreset = vi.fn();
    render(
      <PVHeader
        simulatePartner={false}
        currentColor="#7c3aed"
        onToggleSimulate={noop}
        onLoadPreset={loadPreset}
      />,
    );
    fireEvent.click(screen.getByText(/grocery/i));
    expect(loadPreset).toHaveBeenCalledWith('grocery');
  });

  it('calls onLoadPreset with "blank" when Blank button clicked', () => {
    const loadPreset = vi.fn();
    render(
      <PVHeader
        simulatePartner={false}
        currentColor="#7c3aed"
        onToggleSimulate={noop}
        onLoadPreset={loadPreset}
      />,
    );
    fireEvent.click(screen.getByText(/blank/i));
    expect(loadPreset).toHaveBeenCalledWith('blank');
  });
});

// ── BlockRenderer ──────────────────────────────────────────────────────────────

describe('BlockRenderer — hero_banner', () => {
  it('renders title, subtitle, and CTA button', () => {
    render(
      <BlockRenderer
        block={{ type: 'hero_banner', id: 'h1', title: 'Hello Canvas', subtitle: 'Subtitle text', ctaLabel: 'Start Now' }}
        appConfig={BASE_CONFIG}
        onInteract={noop}
      />,
    );
    expect(screen.getByText('Hello Canvas')).toBeInTheDocument();
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    expect(screen.getByText('Start Now')).toBeInTheDocument();
  });

  it('calls onInteract with blockId when CTA is clicked', () => {
    const interact = vi.fn();
    render(
      <BlockRenderer
        block={{ type: 'hero_banner', id: 'hero-1', title: 'T', subtitle: 'S', ctaLabel: 'Go' }}
        appConfig={BASE_CONFIG}
        onInteract={interact}
      />,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(interact).toHaveBeenCalledWith('hero-1');
  });
});

describe('BlockRenderer — interactive_list', () => {
  const LIST_BLOCK = {
    type: 'interactive_list' as const,
    id: 'list-1',
    title: 'My Tasks',
    items: [
      { id: 'i1', label: 'Buy coffee', icon: '☕', state: 'Pending' },
      { id: 'i2', label: 'Write tests', icon: '✅', state: 'Done' },
    ],
  };

  it('renders title and all item labels', () => {
    render(<BlockRenderer block={LIST_BLOCK} appConfig={BASE_CONFIG} onInteract={noop} />);
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.getByText('Buy coffee')).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('calls onInteract with blockId and itemId when item is clicked', () => {
    const interact = vi.fn();
    render(<BlockRenderer block={LIST_BLOCK} appConfig={BASE_CONFIG} onInteract={interact} />);
    fireEvent.click(screen.getByText('Buy coffee').closest('button')!);
    expect(interact).toHaveBeenCalledWith('list-1', 'i1');
  });

  it('renders without title when title is omitted', () => {
    const noTitle = { ...LIST_BLOCK, title: undefined };
    render(<BlockRenderer block={noTitle} appConfig={BASE_CONFIG} onInteract={noop} />);
    expect(screen.queryByText('My Tasks')).not.toBeInTheDocument();
  });
});

describe('BlockRenderer — action_button', () => {
  it('renders label text', () => {
    render(
      <BlockRenderer
        block={{ type: 'action_button', id: 'btn-1', label: 'Launch App', icon: '🚀' }}
        appConfig={BASE_CONFIG}
        onInteract={noop}
      />,
    );
    expect(screen.getByText('Launch App')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <BlockRenderer
        block={{ type: 'action_button', id: 'btn-1', label: 'Go', icon: '🚀' }}
        appConfig={BASE_CONFIG}
        onInteract={noop}
      />,
    );
    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('calls onInteract when button is clicked', () => {
    const interact = vi.fn();
    render(
      <BlockRenderer
        block={{ type: 'action_button', id: 'btn-2', label: 'Click Me' }}
        appConfig={BASE_CONFIG}
        onInteract={interact}
      />,
    );
    fireEvent.click(screen.getByText('Click Me'));
    expect(interact).toHaveBeenCalledWith('btn-2');
  });
});

describe('BlockRenderer — metrics_row', () => {
  it('renders all metric labels and values', () => {
    render(
      <BlockRenderer
        block={{
          type: 'metrics_row',
          id: 'mx-1',
          metrics: [
            { label: 'Balance', value: '$4,200' },
            { label: 'Streak',  value: '12 days' },
          ],
        }}
        appConfig={BASE_CONFIG}
        onInteract={noop}
      />,
    );
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('$4,200')).toBeInTheDocument();
    expect(screen.getByText('Streak')).toBeInTheDocument();
    expect(screen.getByText('12 days')).toBeInTheDocument();
  });
});

// ── PocketVibeCanvas ───────────────────────────────────────────────────────────

describe('PocketVibeCanvas', () => {
  it('shows empty state message when blocks array is empty', () => {
    render(
      <PocketVibeCanvas
        appConfig={BASE_CONFIG}
        simulatePartner={false}
        shimmeringBlockId={null}
        onInteract={noop}
      />,
    );
    expect(screen.getByText(/generative canvas is empty/i)).toBeInTheDocument();
  });

  it('renders a hero block when present', () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      blocks: [{ type: 'hero_banner', id: 'h1', title: 'Test Hero', subtitle: 'Sub', ctaLabel: 'Go' }],
    };
    render(
      <PocketVibeCanvas
        appConfig={config}
        simulatePartner={false}
        shimmeringBlockId={null}
        onInteract={noop}
      />,
    );
    expect(screen.getByText('Test Hero')).toBeInTheDocument();
  });

  it('renders multiple blocks in order', () => {
    const config: AppConfig = {
      ...BASE_CONFIG,
      blocks: [
        { type: 'hero_banner',   id: 'h1', title: 'Hero One',   subtitle: '', ctaLabel: '' },
        { type: 'action_button', id: 'b1', label: 'Action One' },
      ],
    };
    render(
      <PocketVibeCanvas
        appConfig={config}
        simulatePartner={false}
        shimmeringBlockId={null}
        onInteract={noop}
      />,
    );
    expect(screen.getByText('Hero One')).toBeInTheDocument();
    expect(screen.getByText('Action One')).toBeInTheDocument();
  });
});
