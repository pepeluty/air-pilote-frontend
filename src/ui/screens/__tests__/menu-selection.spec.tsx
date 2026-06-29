/**
 * MenuScreen — jet selection Vitest unit tests (task 7.4; spec frontend-game-
 * client ADDED "Jet Type Selection": Display three jet types, Select a jet type,
 * Cannot start without selecting, Fetch failure falls back to constants).
 *
 * Tests BEHAVIOR via the real MenuScreen component + real Zustand store + real
 * FALLBACK_JET_TYPES constants. The `getJetTypes` API call is mocked via
 * `vi.mock` so tests control the fetch outcome (success / failure). Pixi.js is
 * pre-mocked by the global test setup (src/test/setup.ts).
 *
 * Pattern follows the existing FE unit tests: spy on store.set, assert DOM
 * presence via screen queries, and verify store state after user interaction.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MenuScreen } from '../MenuScreen';
import { useGameStore } from '../../../game/state/gameStore';
import { FALLBACK_JET_TYPES } from '../../../game/constants';
import * as api from '../../api/client';

/** Reset the store + API mock between tests. */
function resetState(): void {
  useGameStore.setState({
    phase: 'menu',
    selectedJetTypeId: null,
    jetStats: null,
    isAuthenticated: true,
  });
}

/** Spy on `api.getJetTypes` and optionally make it return a custom value. */
function mockGetJetTypes(types: typeof FALLBACK_JET_TYPES | null = null): void {
  if (types) {
    vi.mocked(api.getJetTypes).mockResolvedValue(types);
  } else {
    // Default: resolve with the full seed catalog matching FALLBACK_JET_TYPES.
    vi.mocked(api.getJetTypes).mockResolvedValue(FALLBACK_JET_TYPES);
  }
}

function mockGetJetTypesFailure(): void {
  vi.mocked(api.getJetTypes).mockRejectedValue(new Error('Network error'));
}

/** Stub getHighScore so menu renders without a network error for high-score. */
function mockGetHighScore(): void {
  vi.mocked(api.getHighScore).mockResolvedValue(null);
}

beforeEach(() => {
  resetState();
  // Mock every API call the MenuScreen makes.
  vi.spyOn(api, 'getJetTypes');
  vi.spyOn(api, 'getHighScore');
  mockGetHighScore();
});

describe('MenuScreen — Jet Type Selection (spec ADDED "Jet Type Selection")', () => {
  it('renders three jet type cards with names and stats (spec: Display three jet types)', async () => {
    mockGetJetTypes();
    render(<MenuScreen />);

    // Wait for the API fetch to resolve and cards to render.
    await waitFor(() => {
      expect(screen.getByText('Interceptor')).toBeInTheDocument();
    });
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Heavy')).toBeInTheDocument();

    // Each card should show stats.
    expect(screen.getByText(/Speed: 460/)).toBeInTheDocument();
    expect(screen.getByText(/Defense: 10/)).toBeInTheDocument();
    expect(screen.getByText(/Damage: 30/)).toBeInTheDocument();
  });

  it('clicking a card sets selectedJetTypeId and jetStats in the store (spec: Select a jet type)', async () => {
    mockGetJetTypes();
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');
    render(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Interceptor')).toBeInTheDocument();
    });

    // Click the Balanced card (index 1).
    fireEvent.click(screen.getByText('Balanced'));

    expect(setSpy).toHaveBeenCalledWith({
      selectedJetTypeId: FALLBACK_JET_TYPES[1].id,
      jetStats: FALLBACK_JET_TYPES[1],
    });
    expect(useGameStore.getState().selectedJetTypeId).toBe(FALLBACK_JET_TYPES[1].id);
  });

  it('Start button is disabled when no jet type is selected (spec: Cannot start without selecting)', async () => {
    mockGetJetTypes();
    render(<MenuScreen />);

    // The Start button should be disabled initially (no selection).
    const startButton = screen.getByRole('button', { name: /Start Game/ });
    expect(startButton).toBeDisabled();

    // Select a jet type → button becomes enabled.
    await waitFor(() => {
      expect(screen.getByText('Interceptor')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Heavy'));

    expect(startButton).not.toBeDisabled();
  });

  it('Start button is enabled after selecting a jet type (spec: Start game)', async () => {
    mockGetJetTypes();
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');
    render(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Interceptor')).toBeInTheDocument();
    });

    // Select a jet and then Start.
    fireEvent.click(screen.getByText('Balanced'));
    fireEvent.click(screen.getByRole('button', { name: /Start Game/ }));

    // store.set was called with phase 'playing', score 0, health 100.
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'playing', score: 0, health: 100 }),
    );
  });

  it('fetch failure falls back to FALLBACK_JET_TYPES and shows a degraded banner (spec: Fetch failure falls back to constants)', async () => {
    mockGetJetTypesFailure();
    render(<MenuScreen />);

    // On failure, the screen should still render 3 cards from the fallback.
    await waitFor(() => {
      expect(screen.getByText('Interceptor')).toBeInTheDocument();
    });
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Heavy')).toBeInTheDocument();

    // A warning banner should be visible.
    expect(screen.getByText(/Jet catalog unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/showing fallback types/)).toBeInTheDocument();

    // Selecting should still work with fallback data.
    fireEvent.click(screen.getByText('Heavy'));
    expect(useGameStore.getState().selectedJetTypeId).toBe(FALLBACK_JET_TYPES[2].id);
  });
});
