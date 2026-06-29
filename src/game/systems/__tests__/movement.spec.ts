/**
 * MovementSystem — Vitest unit tests (task 7.4; spec frontend-game-client
 * MODIFIED "Jet Movement": exponential Euler acceleration, cruise-in-last-
 * direction, diagonal normalize × currentSpeed, stationary spawn).
 *
 * Tests BEHAVIOR via the real MovementSystem + real Jet + real WorldContainer,
 * with pixi.js mocked (no WebGL). A fake InputState drives directional input
 * and accelerate (Shift). Uses the Balanced jet type (FALLBACK_JET_TYPES[1])
 * by default: maxSpeed=360, cruiseSpeed=200, accelerationRate=5.0.
 *
 * Replaces the earlier JET_SPEED-constant tests with current-speed-based
 * assertions matching the exponential Euler integrator (design Decision #3).
 */
import { describe, it, expect, vi } from 'vitest';
import { createMovementSystem } from '../MovementSystem';
import { Jet } from '../../entities/Jet';
import { WorldContainer } from '../../engine/WorldContainer';
import type { GameContext } from '../../GameContext';
import type { InputState } from '../../input/KeyboardInput';

/** Mutable fake input — tests flip flags between ticks. */
function makeInput(over: {
  isUp?: boolean;
  isDown?: boolean;
  isLeft?: boolean;
  isRight?: boolean;
  isShoot?: boolean;
  isAccelerate?: boolean;
} = {}): InputState & { flags: Record<string, boolean> } {
  const flags: Record<string, boolean> = {
    up: over.isUp ?? false,
    down: over.isDown ?? false,
    left: over.isLeft ?? false,
    right: over.isRight ?? false,
    shoot: over.isShoot ?? false,
    accelerate: over.isAccelerate ?? false,
  };
  return {
    flags,
    isUp: () => flags.up,
    isDown: () => flags.down,
    isLeft: () => flags.left,
    isRight: () => flags.right,
    isShoot: () => flags.shoot,
    isAccelerate: () => flags.accelerate,
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

describe('MovementSystem — exponential Euler + cruise-in-last-direction (spec MODIFIED "Jet Movement")', () => {
  // ── Diagonal movement ────────────────────────────────────────────────────

  it('diagonal movement normalizes direction so magnitude = currentSpeed (NOT JET_SPEED)', () => {
    const { ctx, jet, input } = makeCtx({ jet: new Jet({ x: 1000, y: 1000 }) });

    // Hold RIGHT + UP simultaneously → should normalize to ~(0.707, -0.707).
    input.flags.right = true;
    input.flags.up = true;
    const move = createMovementSystem(ctx);
    move(16);

    // After one tick with Balanced (cruiseSpeed=200, accelRate=5.0, no Shift):
    // target = 200 (cruise), currentSpeed += (200 - 0) * 5.0 * 0.016 = 16
    expect(jet.currentSpeed).toBeGreaterThan(0);

    // Direction should be normalized (~0.707)
    const dirMag = Math.hypot(jet.lastDirection.dx, jet.lastDirection.dy);
    expect(Math.abs(dirMag - 1)).toBeLessThan(0.01);

    // Velocity magnitude should equal currentSpeed (NOT JET_SPEED=320)
    const velMag = Math.hypot(jet.vx, jet.vy);
    expect(Math.abs(velMag - jet.currentSpeed)).toBeLessThan(1e-6);
  });

  // ── Cruise in last direction ─────────────────────────────────────────────

  it('cruise-in-last-direction: hold direction then release → jet keeps moving at cruiseSpeed', () => {
    const { ctx, jet, input } = makeCtx({ jet: new Jet({ x: 1000, y: 1000 }) });
    const move = createMovementSystem(ctx);

    // Tick 1-5: hold RIGHT + accelerate → speeds up well above cruiseSpeed.
    input.flags.right = true;
    input.flags.accelerate = true;
    for (let i = 0; i < 5; i++) move(100); // 0.5s total

    // Capture the speed after ramp (should be well above cruiseSpeed=200).
    const rampedSpeed = jet.currentSpeed;
    expect(rampedSpeed).toBeGreaterThan(jet.cruiseSpeed); // was accelerating

    // Tick 6+: release all input (no keys at all).
    input.flags.right = false;
    input.flags.accelerate = false;
    move(50); // 0.05s of decay — still above cruiseSpeed

    // Jet did NOT stop: lastDirection retained, currentSpeed decays toward
    // cruiseSpeed (200). After 0.05s of decay it should still be > cruiseSpeed.
    expect(jet.currentSpeed).toBeGreaterThan(jet.cruiseSpeed);
    expect(jet.currentSpeed).toBeLessThan(rampedSpeed); // decaying
    // The jet should have moved in the rightward direction.
    expect(jet.x).toBeGreaterThan(1000);
    // lastDirection is {1, 0} (right), NOT {0, 0}
    expect(jet.lastDirection.dx).toBe(1);
    expect(jet.lastDirection.dy).toBe(0);
  });

  it('cruise-in-last-direction: hold direction then release → jet cruises at cruiseSpeed in last direction (does NOT freeze)', () => {
    const { ctx, jet, input } = makeCtx({ jet: new Jet({ x: 1000, y: 1000 }) });
    const move = createMovementSystem(ctx);

    // Tick 1: hold RIGHT (no accelerate) → moves at cruiseSpeed.
    input.flags.right = true;
    move(16);
    expect(jet.lastDirection.dx).toBe(1);
    expect(jet.currentSpeed).toBeGreaterThan(0);

    // Tick 2-5: release all input → should keep moving in last direction at cruiseSpeed.
    input.flags.right = false;
    const xBefore = jet.x;
    for (let i = 0; i < 5; i++) move(16);

    // Jet kept moving rightward (did NOT freeze).
    expect(jet.x).toBeGreaterThan(xBefore);
    // currentSpeed approaches cruiseSpeed (200).
    expect(jet.currentSpeed).toBeGreaterThan(0);
    expect(jet.currentSpeed).toBeLessThanOrEqual(jet.cruiseSpeed + 1);
  });

  // ── Spawn stationary ─────────────────────────────────────────────────────

  it('spawn stationary: no input after spawn → position unchanged, currentSpeed = 0', () => {
    const startX = 500;
    const startY = 500;
    const { ctx, jet } = makeCtx({ jet: new Jet({ x: startX, y: startY }) });
    const move = createMovementSystem(ctx);

    // No keys held across several ticks.
    for (let i = 0; i < 10; i++) move(16);

    expect(jet.currentSpeed).toBe(0);
    expect(jet.vx).toBe(0);
    expect(jet.vy).toBe(0);
    expect(jet.x).toBe(startX);
    expect(jet.y).toBe(startY);
    // Facing is retained (default north).
    expect(jet.facing).toBe(-Math.PI / 2);
  });

  // ── Exponential acceleration ─────────────────────────────────────────────

  it('exponential acceleration: direction + Shift → currentSpeed ramps toward maxSpeed (approaches, not equals)', () => {
    const { ctx, jet, input } = makeCtx({ jet: new Jet({ x: 1000, y: 1000 }) });
    const move = createMovementSystem(ctx);

    // Hold RIGHT + accelerate (Shift).
    input.flags.right = true;
    input.flags.accelerate = true;

    // Multiple ticks to build up speed.
    for (let i = 0; i < 60; i++) move(16); // ~1 second of acceleration

    // currentSpeed should be close to maxSpeed (360) but not equal (exponential
    // approach asymptotically). After 1s with k=5.0, should be ~99.3% of target.
    expect(jet.currentSpeed).toBeGreaterThan(300);
    expect(jet.currentSpeed).toBeLessThan(360);
    // vx should match currentSpeed (direction = right = {1,0})
    expect(Math.abs(jet.vx - jet.currentSpeed)).toBeLessThan(1e-6);
    expect(jet.vy).toBe(0);
  });

  // ── Release accelerate ───────────────────────────────────────────────────

  it('release accelerate: ramp up with Shift, release → currentSpeed decays toward cruiseSpeed', () => {
    const { ctx, jet, input } = makeCtx({ jet: new Jet({ x: 1000, y: 1000 }) });
    const move = createMovementSystem(ctx);

    // Phase 1: Accelerate for ~0.5s to build speed well above cruise.
    input.flags.right = true;
    input.flags.accelerate = true;
    for (let i = 0; i < 30; i++) move(16);
    const beforeRelease = jet.currentSpeed;
    expect(beforeRelease).toBeGreaterThan(jet.cruiseSpeed + 50);

    // Phase 2: Release Shift but keep direction → decays toward cruiseSpeed.
    input.flags.accelerate = false;
    for (let i = 0; i < 60; i++) move(16); // ~1 second of decay

    // After decay, currentSpeed is trending toward cruiseSpeed (200).
    expect(jet.currentSpeed).toBeLessThan(beforeRelease);
    expect(jet.currentSpeed).toBeGreaterThanOrEqual(jet.cruiseSpeed * 0.9);
    // Jet is still moving rightward.
    expect(jet.x).toBeGreaterThan(1000);
  });

  // ── Camera follow ────────────────────────────────────────────────────────

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
    // The jet should actually have moved.
    expect(jet.x).toBeGreaterThan(1000);
  });
});
