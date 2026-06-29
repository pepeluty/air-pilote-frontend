/**
 * MovementSystem — Vitest unit tests (task 4.5; spec frontend-game-client:
 * "Jet Movement" — Diagonal movement, No input; camera "Follow jet within
 * world").
 *
 * Tests BEHAVIOR via the real MovementSystem + real Jet + real WorldContainer,
 * with pixi.js mocked (no WebGL). A fake InputState drives directional input
 * and a spy on WorldContainer.follow verifies the camera path.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMovementSystem } from '../MovementSystem';
import { Jet } from '../../entities/Jet';
import { WorldContainer } from '../../engine/WorldContainer';
import { JET_SPEED } from '../../constants';
import type { GameContext } from '../../GameContext';
import type { InputState } from '../../input/KeyboardInput';

/** Mutable fake input — tests flip the directional flags between ticks. */
function makeInput(over: Partial<Record<keyof InputState, boolean>> = {}): InputState & {
  flags: Record<'up' | 'down' | 'left' | 'right' | 'shoot', boolean>;
} {
  const flags = {
    up: over.isUp ?? false,
    down: over.isDown ?? false,
    left: over.isLeft ?? false,
    right: over.isRight ?? false,
    shoot: over.isShoot ?? false,
  };
  return {
    flags,
    isUp: () => flags.up,
    isDown: () => flags.down,
    isLeft: () => flags.left,
    isRight: () => flags.right,
    isShoot: () => flags.shoot,
    isAccelerate: () => false,
  } as InputState & { flags: typeof flags };
}

/** Build a fully wired GameContext for the movement system. */
function makeCtx(over: { jet?: Jet; input?: InputState } = {}): {
  ctx: GameContext;
  jet: Jet;
  worldContainer: WorldContainer;
  input: InputState & { flags: Record<string, boolean> };
} {
  const jet = over.jet ?? new Jet({ x: 1000, y: 1000 });
  const worldContainer = new WorldContainer();
  const input = (over.input ?? makeInput()) as InputState & {
    flags: Record<string, boolean>;
  };
  const ctx: GameContext = {
    jet,
    worldContainer,
    projectiles: [],
    enemies: [],
    viewport: { width: 960, height: 600 },
    mapBounds: { width: 2000, height: 2000 },
    input,
  };
  return { ctx, jet, worldContainer, input };
}

describe('MovementSystem — Jet Movement spec', () => {
  it('diagonal hold normalizes the direction so magnitude equals cardinal speed (NOT faster)', () => {
    const { ctx, jet, input } = makeCtx({ jet: new Jet({ x: 1000, y: 1000 }) });

    // Cardinal reference: hold RIGHT only → (1,0), |v| = JET_SPEED.
    input.flags.right = true;
    const move = createMovementSystem(ctx);
    move(16);
    const cardinalMagnitude = Math.hypot(jet.vx, jet.vy);
    expect(Math.abs(cardinalMagnitude - JET_SPEED)).toBeLessThan(1e-6);

    // Diagonal: hold RIGHT + UP → diagonal vector normalized to same magnitude.
    input.flags.up = true;
    move(16);
    const diagonalMagnitude = Math.hypot(jet.vx, jet.vy);
    // Diagonal MUST NOT exceed cardinal speed — that is the whole point of
    // normalization (spec: "moves diagonally at a normalized combined
    // magnitude").
    expect(diagonalMagnitude).toBeLessThanOrEqual(JET_SPEED + 1e-6);
    expect(Math.abs(diagonalMagnitude - JET_SPEED)).toBeLessThan(1e-6);
    // And the jet orients toward the movement direction.
    expect(jet.facing).not.toBe(-Math.PI / 2); // changed from default north
  });

  it('no input holds the jet in place: velocity zeroed, position maintained', () => {
    const startX = 432;
    const startY = 567;
    const { ctx, jet } = makeCtx({ jet: new Jet({ x: startX, y: startY }) });
    const move = createMovementSystem(ctx);

    // No keys held → velocity zeroed, position unchanged across several ticks.
    for (let i = 0; i < 5; i++) move(16);

    expect(jet.vx).toBe(0);
    expect(jet.vy).toBe(0);
    expect(jet.x).toBe(startX);
    expect(jet.y).toBe(startY);
    // Facing is retained (default), not reset to anything else.
    expect(jet.facing).toBe(-Math.PI / 2);
  });

  it('after movement, WorldContainer.follow is called with the jet position + viewport + map args (spec: Follow jet within world)', () => {
    const { ctx, jet, worldContainer, input } = makeCtx({
      jet: new Jet({ x: 1000, y: 1000 }),
    });
    const followSpy = vi.spyOn(worldContainer, 'follow');
    input.flags.right = true;

    const move = createMovementSystem(ctx);
    move(100); // 0.1s of movement

    expect(followSpy).toHaveBeenCalledTimes(1);
    const args = followSpy.mock.calls[0];
    expect(args[0]).toBeCloseTo(jet.x, 6);
    expect(args[1]).toBeCloseTo(jet.y, 6);
    expect(args[2]).toBe(ctx.viewport.width);
    expect(args[3]).toBe(ctx.viewport.height);
    expect(args[4]).toBe(ctx.mapBounds.width);
    expect(args[5]).toBe(ctx.mapBounds.height);
    // The jet should actually have moved (velocity applied + integrated).
    expect(jet.x).toBeGreaterThan(1000);
  });
});