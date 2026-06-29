import type { GameContext } from '../GameContext';
import type { System } from '../engine/TickerLoop';

/** Clamp `v` to the closed range [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * MovementSystem — exponential Euler acceleration + cruise-in-last-direction.
 *
 * Replaces the earlier constant-speed/freeze model (design Decision #3 and #4;
 * spec MODIFIED "Jet Movement": "no directional input → cruises at cruiseSpeed
 * in the last held direction; does NOT freeze").
 *
 * Each tick (design Data Flow b):
 *   1. Read held movement keys (WASD/arrows) into a direction vector (dx, dy);
 *      read accelerate (Shift) separately.
 *   2. `hasInput = dx || dy`. If hasInput: NORMALIZE the vector (so diagonal
 *      speed never exceeds cardinal speed), write it to `jet.lastDirection`
 *      (NEVER reset to {0,0} after first input — Decision #4), and update
 *      `jet.facing = atan2(dy, dx)` so the jet orients toward movement.
 *   3. `target = (hasInput && accelerate) ? maxSpeed : cruiseSpeed`.
 *   4. Exponential Euler integrator (frame-rate independent; `k` is per SECOND
 *      on the jet, `dt` is ms from the Pixi ticker, so divide by 1000):
 *
 *        if (hasInput || hasLastDir)
 *          jet.currentSpeed += (target - jet.currentSpeed) * accelerationRate * (dt / 1000)
 *
 *      The guard is what makes a freshly-spawned jet stationary: at spawn
 *      `hasInput=false` and `lastDirection={0,0}` → `hasLastDir=false` → no
 *      integration → `currentSpeed` stays 0 → jet does not move. Once input
 *      has been given once, `hasLastDir` is true forever, so releasing all
 *      keys still runs integration with `target=cruiseSpeed` → the jet keeps
 *      moving in `lastDirection` (cruise, NOT freeze).
 *
 *   5. `jet.vx = lastDirection.dx * currentSpeed`; `jet.vy = lastDirection.dy
 *      * currentSpeed`. Releasing accelerate (but keeping direction) decays
 *      `currentSpeed` exponentially toward `cruiseSpeed` (spec "Release
 *      accelerate"); holding accelerate ramps it exponentially toward
 *      `maxSpeed` (spec "Exponential acceleration").
 *   6. `jet.update(dt)` integrates position from velocity (px/sec × ms / 1000).
 *   7. Clamp the jet within world bounds `[0, mapW] x [0, mapH]` (spec: "jet is
 *      clamped within world bounds").
 *   8. `worldContainer.follow(...)` scrolls + clamps the camera (spec: "Follow
 *      jet within world" / "Clamp at world edge").
 *
 * Per-frame position data stays in the entity/Pixi — the Zustand store is NOT
 * touched here (Design Decision #9 / Zustand State Bridge spec).
 */
export function createMovementSystem(ctx: GameContext): System {
  return (dt: number): void => {
    const { jet, input, worldContainer, viewport, mapBounds } = ctx;

    let dx = 0;
    let dy = 0;
    if (input.isLeft()) dx -= 1;
    if (input.isRight()) dx += 1;
    if (input.isUp()) dy -= 1;
    if (input.isDown()) dy += 1;

    const hasInput = dx !== 0 || dy !== 0;
    const hasLastDir = jet.lastDirection.dx !== 0 || jet.lastDirection.dy !== 0;

    if (hasInput) {
      // Normalize so diagonals don't exceed cardinal speed.
      const len = Math.hypot(dx, dy);
      const ndx = dx / len;
      const ndy = dy / len;
      // Remember the last held direction. Once set, NEVER cleared back to {0,0}
      // (Decision #4 — cruise-in-last-direction on input release).
      jet.lastDirection = { dx: ndx, dy: ndy };
      // Orient the jet toward the movement direction.
      jet.facing = Math.atan2(ndy, ndx);
    }

    // Target speed: maxSpeed only while accelerating AND holding a direction.
    // Cruising (no accelerate, or no input but a remembered direction) targets
    // cruiseSpeed — this is what decays currentSpeed toward cruise on release.
    const accelerating = hasInput && input.isAccelerate();
    const target = accelerating ? jet.maxSpeed : jet.cruiseSpeed;

    // Exponential Euler integrator (design Decision #3, unit trap: k per SECOND).
    // Guard: only integrate when there is a direction to move along — current
    // input OR a remembered lastDirection. At spawn (both zero) the guard fails
    // → currentSpeed stays 0 → jet stationary (spec "No input" at spawn).
    if (hasInput || hasLastDir) {
      jet.currentSpeed += (target - jet.currentSpeed) * jet.accelerationRate * (dt / 1000);
    }

    // Velocity comes from lastDirection × currentSpeed. When the player releases
    // all input, lastDirection is retained → the jet cruises in that direction
    // at cruiseSpeed (does NOT freeze — spec MODIFIED "No input").
    jet.vx = jet.lastDirection.dx * jet.currentSpeed;
    jet.vy = jet.lastDirection.dy * jet.currentSpeed;

    jet.update(dt);

    // Clamp within world bounds (camera clamping is handled by follow()).
    jet.x = clamp(jet.x, 0, mapBounds.width);
    jet.y = clamp(jet.y, 0, mapBounds.height);
    jet.syncView();

    // Camera: translate the world so the jet stays in view, clamped at edges.
    worldContainer.follow(
      jet.x,
      jet.y,
      viewport.width,
      viewport.height,
      mapBounds.width,
      mapBounds.height,
    );
  };
}