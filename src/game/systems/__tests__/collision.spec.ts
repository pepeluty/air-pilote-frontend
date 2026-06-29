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
import { SCORE_PER_KILL, ENEMY_CONTACT_DAMAGE, FALLBACK_JET_TYPES } from '../../constants';

/**
 * Default jet (`new Jet({...})` with no stats) uses the Balanced fallback
 * (constants.ts FALLBACK_JET_TYPES[1]): defense=35, damage=45. Contact damage is
 * reduced by defense % per design Decision #6:
 *   actualDamage = ENEMY_CONTACT_DAMAGE * (1 - jet.defense / 100)
 *                = 20 * (1 - 35/100) = 13.
 * Projectile damage (45) destroys a 100-health enemy in one hit.
 */
const BALANCED_DEFENSE = 35;
const BALANCED_DAMAGE = 45;
const EXPECTED_CONTACT_DAMAGE = ENEMY_CONTACT_DAMAGE * (1 - BALANCED_DEFENSE / 100);
import type { GameContext } from '../../GameContext';
import type { InputState } from '../../input/KeyboardInput';

const NO_INPUT: InputState = {
  isUp: () => false,
  isDown: () => false,
  isLeft: () => false,
  isRight: () => false,
  isShoot: () => false,
  isAccelerate: () => false,
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

/** Heavy jet type stats (FALLBACK_JET_TYPES[2]) — for multi-hit + defense tests. */
const HEAVY_DEFENSE = 60;
const HEAVY_DAMAGE = 80;
const HEAVY_EXPECTED_CONTACT_DAMAGE = ENEMY_CONTACT_DAMAGE * (1 - HEAVY_DEFENSE / 100); // 20 * 0.4 = 8

describe('CollisionSystem — Basic Enemy AI + Player death specs', () => {
  beforeEach(() => {
    resetStore();
  });

  it('enemy destroyed by projectile: enemy removed and score increments (spec)', () => {
    const jet = new Jet({ x: 100, y: 100 }); // far from the contact point
    // Enemy health set to one shot's damage (45) so a single projectile kills
    // it — exercises the destroy→score→cull pipeline in one tick.
    const enemy = new Enemy(500, 500, BALANCED_DAMAGE);
    // Projectile carries jet.damage (Balanced=45) — one hit kills (spec
    // "Enemy destroyed by projectile").
    const projectile = new Projectile(500, 500, 0, -520, BALANCED_DAMAGE);
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

  it('enemy survives first hit: multi-hit, no score until destroyed (spec)', () => {
    const jet = new Jet({ x: 100, y: 100 });
    // Full 100-health enemy — Balanced damage 45 needs 3 hits (⌈100/45⌉=3,
    // design Decision #5). First hit must NOT destroy it and must NOT score.
    const enemy = new Enemy(500, 500);
    const projectile = new Projectile(500, 500, 0, -520, BALANCED_DAMAGE);
    const ctx = makeCtx(jet, [projectile], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0);

    // Enemy survives: still active, health reduced by jet.damage (100-45=55).
    expect(enemy.isActive()).toBe(true);
    expect(enemy.health).toBe(100 - BALANCED_DAMAGE);
    expect(ctx.enemies).toHaveLength(1); // not culled
    // Projectile is consumed regardless (deactivated on any hit) + culled.
    expect(ctx.projectiles).toHaveLength(0);
    // NO slow-state change events on a surviving hit — no score, health, phase.
    expect(setSpy).not.toHaveBeenCalled();
    expect(useGameStore.getState().score).toBe(0);
  });

  it('enemy damages the player: health decreases and the enemy is removed (spec)', () => {
    const jet = new Jet({ x: 300, y: 300, health: 100 });
    const enemy = new Enemy(300, 300); // overlaps the jet
    const ctx = makeCtx(jet, [], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0);

    expect(ctx.enemies).toHaveLength(0);
    expect(enemy.isActive()).toBe(false);
    // Contact damage reduced by jet.defense % (Decision #6): 20*(1-35/100)=13.
    expect(setSpy).toHaveBeenCalledWith({ health: 100 - EXPECTED_CONTACT_DAMAGE });
    expect(useGameStore.getState().health).toBe(100 - EXPECTED_CONTACT_DAMAGE);
    // Phase does NOT change (player still alive) — no gameOver publish.
    expect(setSpy).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'gameOver' }));
    expect(useGameStore.getState().phase).toBe('playing');
  });

  // ── Multi-hit (spec "Enemy destroyed by projectile: multiple hits") ──────

  it('multi-hit: enemy health 100, damage 80 (Heavy) → 2 hits destroys + score (spec)', () => {
    const jet = new Jet({ x: 100, y: 100 });
    // Full-health enemy (100) with Heavy damage (80) → needs 2 hits.
    const enemy = new Enemy(500, 500, 100);
    // Start with only ONE projectile — second one added after first tick.
    const projectile1 = new Projectile(500, 500, 0, -520, HEAVY_DAMAGE);
    const ctx = makeCtx(jet, [projectile1], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    const collide = createCollisionSystem(ctx);

    // First hit: health 100 → 20, survives, NO score.
    collide();
    expect(enemy.isActive()).toBe(true);
    expect(enemy.health).toBe(100 - HEAVY_DAMAGE); // 20
    expect(ctx.enemies).toHaveLength(1);
    expect(setSpy).not.toHaveBeenCalled();

    // Second hit: push a fresh projectile, collide again.
    setSpy.mockClear();
    ctx.projectiles.push(new Projectile(500, 500, 0, -520, HEAVY_DAMAGE));

    collide();
    expect(enemy.isActive()).toBe(false);
    expect(ctx.enemies).toHaveLength(0);
    expect(setSpy).toHaveBeenCalledWith({ score: SCORE_PER_KILL });
  });

  // ── Defense % contact damage (spec "Enemy damages player" with Heavy) ─────

  it('defense percentage reduces contact damage: defense 60 → actualDamage = ENEMY_CONTACT_DAMAGE * 0.4 = 8 (spec)', () => {
    // Jet with Heavy stats: defense=60, health set to survive.
    const jet = new Jet({ x: 300, y: 300, health: 100, stats: FALLBACK_JET_TYPES[2] });
    const enemy = new Enemy(300, 300); // overlaps jet

    // Pre-assert the math: 20 * (1 - 60/100) = 8.
    expect(HEAVY_EXPECTED_CONTACT_DAMAGE).toBe(8);

    const ctx = makeCtx(jet, [], [enemy]);
    const setSpy = vi.spyOn(useGameStore.getState(), 'set');

    createCollisionSystem(ctx)(0);

    // Health decreased by exactly 8 (not 20, not 13).
    expect(useGameStore.getState().health).toBe(100 - 8);
    expect(setSpy).toHaveBeenCalledWith({ health: 92 });
  });

  it('health reaching zero transitions phase to gameOver (spec: Player death)', () => {
    // Health set to exactly one contact-hit's worth of damage (defense % applies).
    const jet = new Jet({ x: 300, y: 300, health: EXPECTED_CONTACT_DAMAGE });
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