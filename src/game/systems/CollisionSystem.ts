import { useGameStore } from '../state/gameStore';
import {
  ENEMY_CONTACT_DAMAGE,
  ENEMY_RADIUS,
  JET_RADIUS,
  PROJECTILE_RADIUS,
  SCORE_PER_KILL,
} from '../constants';
import type { GameContext } from '../GameContext';
import type { System } from '../engine/TickerLoop';
import { cullInactive } from './cull';

/** Minimal positional shape for circle-overlap hit testing. */
interface Positioned {
  x: number;
  y: number;
}

/** Circle-overlap test: `dist^2 <= (ra + rb)^2` (no sqrt needed). */
function circleOverlap(a: Positioned, ra: number, b: Positioned, rb: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = ra + rb;
  return dx * dx + dy * dy <= r * r;
}

/**
 * CollisionSystem — overlap detection + slow-state bridge to the Zustand store.
 *
 * Design Data Flow a (terminal step):
 *   `CollisionSystem -> overlap? enemy destroyed (+score) | player damaged
 *    (-health) -> on change event -> Zustand set(score|health|phase)`.
 *
 * Two overlap checks per tick:
 *   (a) Projectile <-> Enemy: on overlap, the projectile is consumed and the
 *       enemy takes damage; if the enemy dies it is removed and the SCORE
 *       INCREMENTS (spec: "enemy is removed and the player score increments").
 *   (b) Enemy <-> Jet: on overlap, the enemy is removed and the jet takes
 *       `ENEMY_CONTACT_DAMAGE` damage (spec: "player health decreases by a
 *       defined amount and the enemy is removed").
 *
 * Zustand State Bridge (CRITICAL — Design Decision #9):
 *   The store is written ONLY on a genuine change event — score increments on
 *   a kill, health decreases on damage, phase flips to `'gameOver'` when health
 *   hits zero. It is NOT written per frame, and per-frame positions never enter
 *   the store. When health reaches 0, `set({ phase: 'gameOver' })` is published;
 *   the Engine's store.phase subscription then stops the ticker (the system
 *   loop halts on the next subscription tick).
 */
export function createCollisionSystem(ctx: GameContext): System {
  return (): void => {
    const { jet, projectiles, enemies } = ctx;

    // (a) Projectiles vs enemies.
    for (let i = 0; i < projectiles.length; i++) {
      const projectile = projectiles[i];
      if (!projectile.isActive()) continue;
      for (let j = 0; j < enemies.length; j++) {
        const enemy = enemies[j];
        if (!enemy.isActive()) continue;
        if (circleOverlap(projectile, PROJECTILE_RADIUS, enemy, ENEMY_RADIUS)) {
          projectile.deactivate(); // consumed
          enemy.takeDamage(1);
          if (!enemy.isActive()) {
            const nextScore = useGameStore.getState().score + SCORE_PER_KILL;
            useGameStore.getState().set({ score: nextScore });
          }
          break;
        }
      }
    }

    // (b) Enemies vs jet.
    for (let k = 0; k < enemies.length; k++) {
      const enemy = enemies[k];
      if (!enemy.isActive()) continue;
      if (circleOverlap(jet, JET_RADIUS, enemy, ENEMY_RADIUS)) {
        enemy.takeDamage(enemy.health); // remove the enemy (deals contact damage)
        const nextHealth = jet.takeDamage(ENEMY_CONTACT_DAMAGE);
        // Publish health ONLY when it actually changes (once per damage event).
        if (nextHealth !== useGameStore.getState().health) {
          useGameStore.getState().set({ health: nextHealth });
        }
        if (nextHealth <= 0 && useGameStore.getState().phase !== 'gameOver') {
          useGameStore.getState().set({ phase: 'gameOver' });
        }
      }
    }

    // Reclaim consumed/off-world entities.
    cullInactive(projectiles);
    cullInactive(enemies);
  };
}
