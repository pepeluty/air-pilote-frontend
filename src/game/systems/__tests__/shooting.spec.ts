/**
 * ShootingSystem — Vitest unit tests (task 4.5; spec frontend-game-client:
 * "Shooting" — Fire projectile, Fire blocked outside playing phase).
 *
 * Tests BEHAVIOR via the real ShootingSystem + real Projectile + real
 * WorldContainer, with pixi.js mocked. A fake InputState drives shoot input;
 * the live Zustand phase is flipped directly to exercise the playing-gate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createShootingSystem } from '../ShootingSystem';
import { Jet } from '../../entities/Jet';
import { WorldContainer } from '../../engine/WorldContainer';
import { useGameStore } from '../../state/gameStore';
import { PROJECTILE_COOLDOWN_MS } from '../../constants';
import type { GameContext } from '../../GameContext';
import type { InputState } from '../../input/KeyboardInput';

function makeInput(shoot = false): InputState & { flags: { shoot: boolean } } {
  const flags = { shoot };
  return {
    flags,
    isUp: () => false,
    isDown: () => false,
    isLeft: () => false,
    isRight: () => false,
    isShoot: () => flags.shoot,
    isAccelerate: () => false,
  } as InputState & { flags: { shoot: boolean } };
}

function makeCtx(): { ctx: GameContext; input: InputState & { flags: { shoot: boolean } } } {
  const jet = new Jet({ x: 1000, y: 1000 });
  const worldContainer = new WorldContainer();
  const input = makeInput();
  const ctx: GameContext = {
    jet,
    worldContainer,
    projectiles: [],
    enemies: [],
    viewport: { width: 960, height: 600 },
    mapBounds: { width: 2000, height: 2000 },
    input,
  };
  return { ctx, input };
}

function resetStore(): void {
  useGameStore.setState({ phase: 'playing', score: 0, health: 100 });
}

describe('ShootingSystem — Shooting spec', () => {
  beforeEach(() => {
    resetStore();
  });

  it('fires one projectile, blocks the next shot by cooldown, then fires again once the cooldown elapses', () => {
    const { ctx, input } = makeCtx();
    const shoot = createShootingSystem(ctx);
    input.flags.shoot = true;

    // First tick: cooldown starts at 0 → fires exactly one projectile.
    shoot(16);
    expect(ctx.projectiles).toHaveLength(1);

    // Immediate second tick: cooldown just reset to PROJECTILE_COOLDOWN_MS so
    // subsequent shots within the cooldown are ignored (spec).
    shoot(16);
    expect(ctx.projectiles).toHaveLength(1);

    // Advance well past the cooldown in a single tick → fires again.
    shoot(PROJECTILE_COOLDOWN_MS + 50);
    expect(ctx.projectiles).toHaveLength(2);
  });

  it('blocks fire outside the playing phase (paused)', () => {
    const { ctx, input } = makeCtx();
    const shoot = createShootingSystem(ctx);
    input.flags.shoot = true;
    useGameStore.setState({ phase: 'paused' });

    shoot(16);
    expect(ctx.projectiles).toHaveLength(0);
  });

  it('blocks fire when phase is menu', () => {
    const { ctx, input } = makeCtx();
    const shoot = createShootingSystem(ctx);
    input.flags.shoot = true;
    useGameStore.setState({ phase: 'menu' });

    shoot(16);
    expect(ctx.projectiles).toHaveLength(0);
  });

  it('blocks fire when phase is gameOver', () => {
    const { ctx, input } = makeCtx();
    const shoot = createShootingSystem(ctx);
    input.flags.shoot = true;
    useGameStore.setState({ phase: 'gameOver' });

    shoot(16);
    expect(ctx.projectiles).toHaveLength(0);
  });
});