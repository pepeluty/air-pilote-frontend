/**
 * Zustand State Bridge — Vitest unit tests (task 4.7; spec frontend-game-client:
 * "Zustand State Bridge" — Slow state publish, Per-frame data isolation).
 *
 * Proves the SLOW-STATE BRIDGE contract (Design Decision #9):
 *   (a) Slow-state publish: a genuine change event (an enemy kill) writes to
 *       the store EXACTLY ONCE per change — never per frame.
 *   (b) Per-frame data isolation: N ticks of a system that continuously
 *       integrates entity positions DOES NOT leak x/y/vx/vy into the store, and
 *       the store's `set` is not invoked for per-frame transforms at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../gameStore';
import { createMovementSystem } from '../../systems/MovementSystem';
import { createCollisionSystem } from '../../systems/CollisionSystem';
import { Jet } from '../../entities/Jet';
import { Projectile } from '../../entities/Projectile';
import { Enemy } from '../../entities/Enemy';
import { WorldContainer } from '../../engine/WorldContainer';
import { SCORE_PER_KILL } from '../../constants';
import type { GameContext } from '../../GameContext';
import type { InputState } from '../../input/KeyboardInput';

function fakeInput(right = false): InputState & { flags: { right: boolean } } {
  const flags = { right };
  return {
    flags,
    isUp: () => false,
    isDown: () => false,
    isLeft: () => false,
    isRight: () => flags.right,
    isShoot: () => false,
    isAccelerate: () => false,
  } as InputState & { flags: { right: boolean } };
}

function resetStore(): void {
  useGameStore.setState({
    phase: 'playing',
    score: 0,
    health: 100,
    isAuthenticated: false,
    playStartedAt: null,
  });
}

describe('Zustand State Bridge — Slow state publish (spec)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('publishes score EXACTLY ONCE per change event (not per frame)', () => {
    const jet = new Jet({ x: 100, y: 100 });
    const enemy = new Enemy(500, 500);
    const projectile = new Projectile(500, 500, 0, -520);
    const ctx: GameContext = {
      jet,
      worldContainer: new WorldContainer(),
      projectiles: [projectile],
      enemies: [enemy],
      viewport: { width: 960, height: 600 },
      mapBounds: { width: 2000, height: 2000 },
      input: fakeInput(),
    };
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0); // one collision tick → one kill event (dt unused)

    // Exactly one store write, and it is the slow-state score change.
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({ score: SCORE_PER_KILL });
    expect(useGameStore.getState().score).toBe(SCORE_PER_KILL);
  });
});

describe('Zustand State Bridge — Per-frame data isolation (spec)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('N ticks of movement never touch the store with per-frame positions (x/y/vx/vy stay in Pixi)', () => {
    const jet = new Jet({ x: 500, y: 500 });
    const world = new WorldContainer();
    const input = fakeInput(true); // hold RIGHT continuously
    const ctx: GameContext = {
      jet,
      worldContainer: world,
      projectiles: [],
      enemies: [],
      viewport: { width: 960, height: 600 },
      mapBounds: { width: 2000, height: 2000 },
      input,
    };
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');
    const move = createMovementSystem(ctx);

    // Drive 100 ticks of continuous movement — the integration runs every
    // tick and updates entity positions, but the store must NEVER be written.
    for (let i = 0; i < 100; i++) move(16);

    // The store's `set` was never invoked for per-frame data.
    expect(setSpy).not.toHaveBeenCalled();

    // The jet DID move (per-frame data is real, just local to the entity).
    expect(jet.x).toBeGreaterThan(500);

    // The store holds ONLY slow state — no per-frame keys leaked in.
    const state = useGameStore.getState() as unknown as Record<string, unknown>;
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
    expect(state.vx).toBeUndefined();
    expect(state.vy).toBeUndefined();
    expect(state.facing).toBeUndefined();
    // Slow-state shape is unchanged.
    expect(state.phase).toBe('playing');
    expect(state.score).toBe(0);
    expect(state.health).toBe(100);
  });
});