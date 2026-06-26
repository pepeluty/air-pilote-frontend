import { Container, Graphics } from 'pixi.js';
import { JET_MAX_HEALTH, JET_NOSE_OFFSET, JET_SPEED } from '../constants';

/**
 * The player's jet. Owns a Pixi `Graphics` display object (a simple filled
 * triangle — no asset loading for the MVP) and its per-frame state
 * (position, velocity, facing, health).
 *
 * Per Design Decision #9, per-frame data (x/y/vx/vy/facing) lives HERE in the
 * entity — NEVER in the Zustand store. Only slow state (health, when it
 * changes; see CollisionSystem) is bridged to the store.
 *
 * The jet is spawned by `GameSystems` when the store phase transitions to
 * `'playing'`, at the world centre. `facing` is stored as the direction angle
 * `atan2(dy, dx)` (radians); `0` points east, `-PI/2` points north. The sprite
 * is drawn pointing north, so `view.rotation = facing + PI/2` orients it toward
 * the movement direction (spec: "jet faces or orient toward the movement
 * direction").
 */
export class Jet {
  readonly view: Container;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Movement direction angle in radians (atan2(dy, dx)). Retained on no-input. */
  facing = -Math.PI / 2;
  health: number;
  readonly speed: number;

  private readonly gfx: Graphics;
  private destroyed = false;

  constructor(options?: { x?: number; y?: number; health?: number; speed?: number }) {
    this.x = options?.x ?? 0;
    this.y = options?.y ?? 0;
    this.health = options?.health ?? JET_MAX_HEALTH;
    this.speed = options?.speed ?? JET_SPEED;

    this.gfx = new Graphics();
    // Triangle pointing north (tip at -Y). Body colour: cyan; dark outline.
    this.gfx.poly([-12, 14, 0, -16, 12, 14]);
    this.gfx.fill(0x4ad6ff, 1);
    this.gfx.stroke({ width: 2, color: 0x0b1020 });
    this.view = this.gfx;

    this.syncView();
  }

  /**
   * Integrate position from velocity and sync the display object. `dt` is in
   * milliseconds (Pixi `Ticker.deltaMS`); velocity is px/sec.
   *
   * Clamping to world bounds is performed by the MovementSystem (it owns the
   * map dimensions via GameContext); this method is pure integration.
   */
  update(dt: number): void {
    this.x += (this.vx * dt) / 1000;
    this.y += (this.vy * dt) / 1000;
    this.syncView();
  }

  /** Apply the entity's position + orientation to the Pixi display object. */
  syncView(): void {
    this.view.position.set(this.x, this.y);
    // Orient the north-pointing sprite toward `facing`.
    this.view.rotation = this.facing + Math.PI / 2;
  }

  /** Reduce health by `amount`. Returns the resulting health. */
  takeDamage(amount: number): number {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  getHealth(): number {
    return this.health;
  }

  /** Unit vector along the jet's facing direction (used to spawn projectiles). */
  facingVector(): { dx: number; dy: number } {
    return { dx: Math.cos(this.facing), dy: Math.sin(this.facing) };
  }

  /** World-space point where projectiles should spawn (the nose). */
  nose(): { x: number; y: number } {
    return {
      x: this.x + Math.cos(this.facing) * JET_NOSE_OFFSET,
      y: this.y + Math.sin(this.facing) * JET_NOSE_OFFSET,
    };
  }

  /** Free Pixi resources and detach from the world. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.view.destroy({ children: true });
  }
}
