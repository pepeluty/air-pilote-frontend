import type { GameContext } from '../GameContext';
import type { System } from '../engine/TickerLoop';

/** Clamp `v` to the closed range [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * MovementSystem — player input -> jet movement -> camera follow.
 *
 * Each tick (design Data Flow a):
 *   1. Read held movement keys (WASD/arrows) into a direction vector (dx, dy).
 *   2. If input present: NORMALIZE the vector so diagonal speed is not greater
 *      than cardinal speed (spec: "moves diagonally at a normalized combined
 *      magnitude"), scale by `jet.speed`, set velocity, and update `facing`
 *      so the jet orients toward the movement direction.
 *   3. If no input: zero velocity (spec: "jet maintains its current position
 *      within the world"); `facing` is retained on the jet.
 *   4. `jet.update(dt)` integrates position.
 *   5. Clamp the jet within world bounds `[0, mapW] x [0, mapH]` (spec: "jet is
 *      clamped within world bounds").
 *   6. `worldContainer.follow(...)` scrolls + clamps the camera (spec:
 *      "Follow jet within world" / "Clamp at world edge").
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

    if (dx !== 0 || dy !== 0) {
      // Normalize so diagonals don't exceed cardinal speed.
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      jet.vx = dx * jet.speed;
      jet.vy = dy * jet.speed;
      jet.facing = Math.atan2(dy, dx);
    } else {
      jet.vx = 0;
      jet.vy = 0;
      // facing retained -> jet keeps its last orientation.
    }

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
