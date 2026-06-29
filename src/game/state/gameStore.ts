import { create } from 'zustand';
import type { JetTypeDto } from '../../ui/api/client';

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
  /**
   * The jet type the player selected on the MenuScreen (design Data Flow a).
   * Null until a card is clicked; the Start Game precondition requires this to
   * be set (spec "Start game" scenario). Sent to the backend as `jetTypeId` in
   * the score-persistence POST.
   */
  selectedJetTypeId: string | null;
  /**
   * Cached stats of the selected jet type. Read by `GameSystems` at spawn to
   * construct the `Jet` entity with the right maxSpeed/cruiseSpeed/accel/damage/
   * defense (design Decision #9 — per-frame state stays in the entity, but the
   * selected type's base stats live here so React + Pixi share one source).
   * Null until a card is clicked.
   */
  jetStats: JetTypeDto | null;
  /** Apply a partial update to the store. Used by both Pixi systems and React. */
  set: (partial: Partial<GameStore>) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  phase: 'menu',
  score: 0,
  health: 100,
  isAuthenticated: false,
  playStartedAt: null,
  selectedJetTypeId: null,
  jetStats: null,
  set: (partial) => set(partial),
}));