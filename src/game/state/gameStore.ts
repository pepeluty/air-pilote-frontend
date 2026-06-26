import { create } from 'zustand';

/**
 * Game-facing slow state bridged between Pixi (per-frame) and React (UI).
 *
 * Design Decision #9 — 3-layer FE state:
 *   - Pixi per-frame data (positions, velocities) stays in Pixi. NEVER here.
 *   - This Zustand store holds ONLY slow state: phase, score, health.
 *   - React UI reads/subscribes to this store; Pixi systems write change events
 *     here (score/health/phase) and subscribe to UI command changes (phase).
 *
 * The bridge is bidirectional (design Data Flow a + a'):
 *   Pixi -> store: CollisionSystem sets score/health; gameOver sets phase.
 *   React -> store: Start/Pause/Resume buttons set phase; Engine subscribes.
 */
export type Phase = 'menu' | 'playing' | 'paused' | 'gameOver';

export interface GameStore {
  phase: Phase;
  score: number;
  health: number;
  /**
   * UI auth gate (PR 7). False until a successful login/register flips it via
   * the AuthScreen. Colocated with game state for the MVP; could split into a
   * dedicated auth store later.
   */
  isAuthenticated: boolean;
  /**
   * Timestamp (ms) the current play session started, stamped on Start/Play
   * Again so GameOverScreen can compute `durationMs` for the score-persistence
   * POST (design Data Flow c). Null when not in a run.
   */
  playStartedAt: number | null;
  /** Apply a partial update to the store. Used by both Pixi systems and React. */
  set: (partial: Partial<GameStore>) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  phase: 'menu',
  score: 0,
  health: 100,
  isAuthenticated: false,
  playStartedAt: null,
  set: (partial) => set(partial),
}));