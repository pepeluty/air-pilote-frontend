/**
 * CollisionSystem — Vitest unit tests (task 4.6; spec frontend-game-client:
 * "Basic Enemy AI" — Enemy destroyed by projectile, Enemy damages player;
 * "Game Phases" — Player death → phase gameOver).
 *
 * Tests BEHAVIOR via the real CollisionSystem + real Jet/Projectile/Enemy. The
 * Zustand `set` is spied on to prove the slow-state bridge publishes exactly
 * the score/health/phase change events (Design Decision #9).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCollisionSystem } from '../CollisionSystem';
import { Jet } from '../../entities/Jet';
import { Projectile } from '../../entities/Projectile';
import { Enemy } from '../../entities/Enemy';
import { WorldContainer } from '../../engine/WorldContainer';
import { useGameStore } from '../../state/gameStore';
import { SCORE_PER_KILL, ENEMY_CONTACT_DAMAGE } from '../../constants';
import type { GameContext } from '../../GameContext';
import type { InputState } from '../../input/KeyboardInput';

const NO_INPUT: InputState = {
  isUp: () => false,
  isDown: () => false,
  isLeft: () => false,
  isRight: () => false,
  isShoot: () => false,
};

function makeCtx(jet: Jet, projectiles: Projectile[], enemies: Enemy[]): GameContext {
  return {
    jet,
    worldContainer: new WorldContainer(),
    projectiles,
    enemies,
    viewport: { width: 960, height: 600 },
    mapBounds: { width: 2000, height: 2000 },
    input: NO_INPUT,
  };
}

function resetStore(): void {
  useGameStore.setState({ phase: 'playing', score: 0, health: 100, playStartedAt: null });
}

describe('CollisionSystem — Basic Enemy AI + Player death specs', () => {
  beforeEach(() => {
    resetStore();
  });

  it('enemy destroyed by projectile: enemy removed and score increments (spec)', () => {
    const jet = new Jet({ x: 100, y: 100 }); // far from the contact point
    const enemy = new Enemy(500, 500);
    const projectile = new Projectile(500, 500, 0, -520);
    const ctx = makeCtx(jet, [projectile], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0); // single tick (dt unused by the collision system)

    // Enemy + projectile consumed and culled from the arrays.
    expect(ctx.enemies).toHaveLength(0);
    expect(ctx.projectiles).toHaveLength(0);
    expect(enemy.isActive()).toBe(false);

    // Score bridge published once with { score: SCORE_PER_KILL }.
    expect(setSpy).toHaveBeenCalledWith({ score: SCORE_PER_KILL });
    expect(useGameStore.getState().score).toBe(SCORE_PER_KILL);
  });

  it('enemy damages the player: health decreases and the enemy is removed (spec)', () => {
    const jet = new Jet({ x: 300, y: 300, health: 100 });
    const enemy = new Enemy(300, 300); // overlaps the jet
    const ctx = makeCtx(jet, [], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0);

    expect(ctx.enemies).toHaveLength(0);
    expect(enemy.isActive()).toBe(false);
    // health published exactly once with the reduced value.
    expect(setSpy).toHaveBeenCalledWith({ health: 100 - ENEMY_CONTACT_DAMAGE });
    expect(useGameStore.getState().health).toBe(100 - ENEMY_CONTACT_DAMAGE);
    // Phase does NOT change (player still alive) — no gameOver publish.
    expect(setSpy).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'gameOver' }));
    expect(useGameStore.getState().phase).toBe('playing');
  });

  it('health reaching zero transitions phase to gameOver (spec: Player death)', () => {
    const jet = new Jet({ x: 300, y: 300, health: ENEMY_CONTACT_DAMAGE });
    const enemy = new Enemy(300, 300);
    const ctx = makeCtx(jet, [], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0);

    expect(useGameStore.getState().health).toBe(0);
    expect(useGameStore.getState().phase).toBe('gameOver');
    // The bridge MUST publish the phase change event.
    expect(setSpy).toHaveBeenCalledWith({ phase: 'gameOver' });
  });
});