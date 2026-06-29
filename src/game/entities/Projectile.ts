import { Container, Graphics } from 'pixi.js';
import { PROJECTILE_RADIUS, PROJECTILE_SPEED } from '../constants';

/**
 * A player projectile (bullet). Owns a small Pixi `Graphics` circle and its
 * per-frame state. Projectiles travel along the jet's facing direction at spawn
 * time and are deactivated when they leave the world bounds (consumed by the
 * CollisionSystem on enemy hit, or culled by the ShootingSystem off-world).
 *
 * Lifecycle: spawned by ShootingSystem (only while phase === 'playing'); each
 * tick ShootingSystem moves it and culls inactive ones. CollisionSystem marks
 * it inactive (consumed) on enemy overlap. `destroy()` frees the Pixi view and
 * is idempotent (safe to call from both the collision path and the cull pass).
 */
export class Projectile {
  readonly view: Container;

  x: number;
  y: number;
  vx: number;
  vy: number;
  /**
   * Damage dealt on hit — the selected jet type's `damage` stat, supplied at
   * spawn by ShootingSystem (design Data Flow c / spec MODIFIED "Shooting":
   * "the projectile MUST deal `jet.damage` on hit"). Applied by
   * CollisionSystem via `enemy.takeDamage(projectile.damage)`.
   */
  readonly damage: number;
  private active: boolean;
  private destroyed = false;

  private readonly gfx: Graphics;

  constructor(x: number, y: number, vx: number, vy: number, damage: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.active = true;

    this.gfx = new Graphics();
    this.gfx.circle(0, 0, PROJECTILE_RADIUS);
    this.gfx.fill(0xfff3a0, 1);
    this.view = this.gfx;

    this.syncView();
  }

  /**
   * Move along velocity and sync the display object. Marks the projectile
   * inactive when it leaves the world bounds `[0, mapW] x [0, mapH]` so the
   * cull pass reclaims it. `dt` in ms; velocity in px/sec.
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

  /** Mark consumed (e.g. hit an enemy). Does NOT free the view (cull does that). */
  deactivate(): void {
    this.active = false;
  }

  /** Speed accessor for callers that construct projectiles from a facing. */
  static get speed(): number {
    return PROJECTILE_SPEED;
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
