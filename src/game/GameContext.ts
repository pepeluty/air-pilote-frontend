import type { Jet } from './entities/Jet';
import type { Projectile } from './entities/Projectile';
import type { Enemy } from './entities/Enemy';
import type { WorldContainer } from './engine/WorldContainer';
import type { InputState } from './input/KeyboardInput';

/**
 * Shared context injected (via closure) into every system. This is the design's
 * `GameContext` — the bundle of references a system needs each tick.
 *
 * NOTE on the Zustand store: systems read phase and write score/health/phase by
 * importing `useGameStore` directly and calling `useGameStore.getState()` /
 * `.set(...)` at the moment of use. This matches the `Engine.ts` pattern from
 * PR 5 (it also imports `useGameStore` directly) and guarantees LIVE state
 * access (a snapshot captured here at construction would go stale). It also
 * keeps the context free of store plumbing, so `GameContext` is purely
 * structural refs (entities, world, viewport, map, input).
 */
export interface GameContext {
  /** The player jet. Spawned once per game at the world centre. */
  jet: Jet;
  /** Scrollable world container — systems add entity views to it and drive the camera. */
  worldContainer: WorldContainer;
  /** Active player projectiles (managed by ShootingSystem). */
  projectiles: Projectile[];
  /** Active enemies (managed by SpawnSystem). */
  enemies: Enemy[];
  /** Logical viewport size in CSS px (the Pixi canvas size). */
  viewport: { width: number; height: number };
  /** World/map bounds; the jet is clamped within `[0,mapW] x [0,mapH]`. */
  mapBounds: { width: number; height: number };
  /** Held-key state (InputSystem). */
  input: InputState;
}
