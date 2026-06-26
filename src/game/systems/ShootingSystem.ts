import { useGameStore } from '../state/gameStore';
import { PROJECTILE_COOLDOWN_MS, PROJECTILE_SPEED } from '../constants';
import type { GameContext } from '../GameContext';
import type { System } from '../engine/TickerLoop';
import { Projectile } from '../entities/Projectile';
import { cullInactive } from './cull';

/**
 * ShootingSystem — fire projectiles from the jet, gated by cooldown AND phase.
 *
 * Design Data Flow a: `ShootingSystem -> Projectile.spawn (cooldown; blocked
 * unless phase === 'playing')`.
 *
 * Each tick:
 *   1. Decrement the cooldown timer by `dt`.
 *   2. PLAYING-GATE: read the LIVE phase from the store; if not `'playing'`,
 *      do not spawn (spec: "no projectile spawns" when paused/menu/gameOver).
 *      (The ticker is also stopped on those phases, so this is a belt-and-
 *      suspenders contract check.)
 *   3. If shoot input is held AND the cooldown has elapsed: spawn ONE
 *      projectile from the jet's nose along `facing`, add it to the world, and
 *      reset the cooldown. Subsequent shots within the cooldown are ignored
 *      (spec: "subsequent shots within the cooldown are ignored").
 *   4. Move all active projectiles and cull inactive ones (off-world or
 *      consumed by the CollisionSystem).
 *
 * Hold-to-fire is supported: holding shoot fires one projectile per cooldown
 * interval.
 */
export function createShootingSystem(ctx: GameContext): System {
  let cooldownMs = 0;

  return (dt: number): void => {
    cooldownMs -= dt;

    const phase = useGameStore.getState().phase;
    if (phase === 'playing' && ctx.input.isShoot() && cooldownMs <= 0) {
      const jet = ctx.jet;
      const nose = jet.nose();
      const dir = jet.facingVector();
      const projectile = new Projectile(
        nose.x,
        nose.y,
        dir.dx * PROJECTILE_SPEED,
        dir.dy * PROJECTILE_SPEED,
      );
      ctx.projectiles.push(projectile);
      ctx.worldContainer.container.addChild(projectile.view);
      cooldownMs = PROJECTILE_COOLDOWN_MS;
    }

    // Advance projectiles and reclaim inactive ones.
    const { projectiles, mapBounds } = ctx;
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.isActive()) {
        p.update(dt, mapBounds.width, mapBounds.height);
      }
    }
    cullInactive(projectiles);
  };
}
