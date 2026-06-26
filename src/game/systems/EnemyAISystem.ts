import { ENEMY_SPEED } from '../constants';
import type { GameContext } from '../GameContext';
import type { System } from '../engine/TickerLoop';

/**
 * EnemyAISystem — simple homing AI: steer every active enemy toward the jet.
 *
 * Design Data Flow a: `EnemyAISystem -> Enemy.update`. The DECISION (where to
 * go) lives here; the INTEGRATION (apply velocity) lives in `Enemy.update`.
 *
 * Each tick, for every active enemy: compute the unit vector toward the jet,
 * set velocity = unit * `ENEMY_SPEED`, then `enemy.update(dt, mapW, mapH)`
 * integrates + syncs the view + deactivates off-world enemies. Enemies are
 * slower than the jet so the player can maneuver away.
 */
export function createEnemyAISystem(ctx: GameContext): System {
  return (dt: number): void => {
    const { jet, enemies, mapBounds } = ctx;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.isActive()) continue;

      const dx = jet.x - enemy.x;
      const dy = jet.y - enemy.y;
      const len = Math.hypot(dx, dy) || 1;
      enemy.vx = (dx / len) * ENEMY_SPEED;
      enemy.vy = (dy / len) * ENEMY_SPEED;
      enemy.update(dt, mapBounds.width, mapBounds.height);
    }
  };
}
