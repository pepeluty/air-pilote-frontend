import { useGameStore } from '../state/gameStore';
import {
  ENEMY_MAX_CONCURRENT,
  ENEMY_RADIUS,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_SPAWN_INTERVAL_MS,
} from '../constants';
import type { GameContext } from '../GameContext';
import type { System } from '../engine/TickerLoop';
import { Enemy } from '../entities/Enemy';

/** Clamp `v` to the closed range [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * SpawnSystem — periodically spawn enemies around the jet, capped + playing-gated.
 *
 * Each tick:
 *   1. PLAYING-GATE: only spawn while the live store phase is `'playing'`.
 *   2. Decrement the spawn timer; when it elapses AND the active enemy count is
 *      below `ENEMY_MAX_CONCURRENT`, spawn one enemy on a ring of
 *      `ENEMY_SPAWN_DISTANCE` around the jet at a random angle (clamped to the
 *      world), reset the timer, add the view to the world.
 *   3. Cull inactive enemies (destroyed by the CollisionSystem or off-world).
 *
 * The cap keeps the MVP manageable; the spawn ring keeps enemies just off-screen
 * so they approach the player rather than appearing on top of them.
 */
export function createSpawnSystem(ctx: GameContext): System {
  let timer = 0;

  return (dt: number): void => {
    const phase = useGameStore.getState().phase;
    if (phase !== 'playing') {
      // Still reap any enemies destroyed on the previous tick.
      cull(ctx);
      return;
    }

    timer -= dt;
    if (timer <= 0 && ctx.enemies.length < ENEMY_MAX_CONCURRENT) {
      timer = ENEMY_SPAWN_INTERVAL_MS;
      const angle = Math.random() * Math.PI * 2;
      const ex = clamp(
        ctx.jet.x + Math.cos(angle) * ENEMY_SPAWN_DISTANCE,
        ENEMY_RADIUS,
        ctx.mapBounds.width - ENEMY_RADIUS,
      );
      const ey = clamp(
        ctx.jet.y + Math.sin(angle) * ENEMY_SPAWN_DISTANCE,
        ENEMY_RADIUS,
        ctx.mapBounds.height - ENEMY_RADIUS,
      );
      const enemy = new Enemy(ex, ey);
      ctx.enemies.push(enemy);
      ctx.worldContainer.container.addChild(enemy.view);
    }

    cull(ctx);
  };
}

function cull(ctx: GameContext): void {
  // Reclaim enemies destroyed by the CollisionSystem or drifted off-world.
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const enemy = ctx.enemies[i];
    if (!enemy.isActive()) {
      enemy.destroy();
      ctx.enemies.splice(i, 1);
    }
  }
}
