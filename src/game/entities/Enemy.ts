import { Container, Graphics } from 'pixi.js';
import { ENEMY_MAX_HEALTH, ENEMY_RADIUS } from '../constants';

/**
 * An enemy entity. Owns a Pixi `Graphics` shape (a red diamond — visually
 * distinct from the cyan jet) and its per-frame state.
 *
 * Movement AI is owned by `EnemyAISystem` (homing toward the jet), which sets
 * the enemy's velocity each tick; this class's `update()` is pure integration
 * (apply velocity, sync view, deactivate off-world). This keeps the decision
 * logic in a system and the integration in the entity, matching the design Data
 * Flow (`EnemyAISystem -> Enemy.update`).
 *
 * Lifecycle: spawned by SpawnSystem (only while phase === 'playing'); destroyed
 * by CollisionSystem on projectile overlap (score increments) or on jet contact
 * (jet takes damage); culled when inactive. `destroy()` is idempotent.
 */
export class Enemy {
  readonly view: Container;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  health: number;
  private active: boolean;
  private destroyed = false;

  private readonly gfx: Graphics;

  constructor(x: number, y: number, health: number = ENEMY_MAX_HEALTH) {
    this.x = x;
    this.y = y;
    this.health = health;
    this.active = true;

    this.gfx = new Graphics();
    // Red diamond (rotated square) centred at origin.
    this.gfx.poly([0, -ENEMY_RADIUS, ENEMY_RADIUS, 0, 0, ENEMY_RADIUS, -ENEMY_RADIUS, 0]);
    this.gfx.fill(0xff4d4d, 1);
    this.gfx.stroke({ width: 2, color: 0x0b1020 });
    this.view = this.gfx;

    this.syncView();
  }

  /**
   * Integrate position from velocity and sync the display object. Deactivates
   * when leaving the world bounds (enemies that somehow drift off are
   * reclaimed). `dt` in ms; velocity in px/sec.
   */
  update(dt: number, mapWidth: number, mapHeight: number): void {
    this.x += (this.vx * dt) / 1000;
    this.y += (this.vy * dt) / 1000;
    if (this.x < 0 || this.x > mapWidth || this.y < 0 || this.y > mapHeight) {
      this.active = false;
    }
    this.syncView();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Apply damage; mark inactive when health drops to zero (cull reclaims it). */
  takeDamage(amount: number = 1): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.active = false;
    }
  }

  private syncView(): void {
    this.view.position.set(this.x, this.y);
  }

  /** Free Pixi resources and detach from the world. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.view.destroy({ children: true });
  }
}
