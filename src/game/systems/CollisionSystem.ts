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
 * Design Data Flow c (combat multi-hit + defense):
 *   projectile ∩ enemy ─> enemy.takeDamage(projectile.damage)
 *                          ├─ health<=0 → enemy removed + score += SCORE_PER_KILL
 *                          └─ health>0  → enemy survives (multi-hit), projectile consumed, NO score
 *   enemy ∩ jet ─> actualDamage = ENEMY_CONTACT_DAMAGE * (1 - jet.defense/100)
 *                 ─> jet.takeDamage(actualDamage) ─> enemy removed
 *                 ─> health<=0 → phase = 'gameOver'
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

    // (a) Projectiles vs enemies — multi-hit (design Decision #5).
    for (let i = 0; i < projectiles.length; i++) {
      const projectile = projectiles[i];
      if (!projectile.isActive()) continue;
      for (let j = 0; j < enemies.length; j++) {
        const enemy = enemies[j];
        if (!enemy.isActive()) continue;
        if (circleOverlap(projectile, PROJECTILE_RADIUS, enemy, ENEMY_RADIUS)) {
          projectile.deactivate(); // consumed (even on a non-killing hit)
          enemy.takeDamage(projectile.damage); // jet.damage per hit
          if (!enemy.isActive()) {
            // Destroyed: score increments ONLY on the killing hit (spec
            // "Enemy survives first hit" → no score while health > 0).
            const nextScore = useGameStore.getState().score + SCORE_PER_KILL;
            useGameStore.getState().set({ score: nextScore });
          }
          break;
        }
      }
    }

    // (b) Enemies vs jet — contact damage reduced by jet.defense % (Decision #6).
    for (let k = 0; k < enemies.length; k++) {
      const enemy = enemies[k];
      if (!enemy.isActive()) continue;
      if (circleOverlap(jet, JET_RADIUS, enemy, ENEMY_RADIUS)) {
        enemy.takeDamage(enemy.health); // remove the enemy (deals contact damage)
        const actualDamage = ENEMY_CONTACT_DAMAGE * (1 - jet.defense / 100);
        const nextHealth = jet.takeDamage(actualDamage);
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
