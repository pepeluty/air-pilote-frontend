import { Container, Graphics } from 'pixi.js';
import { FALLBACK_JET_TYPES, JET_MAX_HEALTH, JET_NOSE_OFFSET } from '../constants';

/**
 * Stats describing a jet type — the SLOW/identity numbers that Describe a jet
 * (maxSpeed, cruiseSpeed, accelerationRate, defense, damage). Applied to the
 * spawned jet by `GameSystems` from the player's MenuScreen selection (design
 * Data Flow a / Decision #9). These never change per frame; per-frame state
 * (`currentSpeed`, `lastDirection`, `vx`/`vy`) lives below on the entity.
 *
 * Shape mirrors `JetTypeDto` (the backend/API contract) minus `id`/`name`; we
 * extract only the five tuning fields at spawn so the entity owns no identity
 * it does not need.
 */
export interface JetStats {
  maxSpeed: number;
  cruiseSpeed: number;
  /** Exponential-Euler `k`, stored PER SECOND (design Decision #3 / unit trap). */
  accelerationRate: number;
  /** 0-100. Applied by CollisionSystem as `actualDamage = ENEMY_CONTACT_DAMAGE * (1 - defense/100)` (PR 5). */
  defense: number;
  /** Per-projectile damage, applied by ShootingSystem (PR 5). */
  damage: number;
}

/**
 * The player's jet. Owns a Pixi `Graphics` display object (a simple filled
 * triangle — no asset loading for the MVP) and its per-frame state
 * (position, velocity, facing, health, currentSpeed, lastDirection).
 *
 * Per Design Decision #9, per-frame data (x/y/vx/vy/facing/currentSpeed/
 * lastDirection) lives HERE in the entity — NEVER in the Zustand store. Only
 * slow state (health, when it changes; see CollisionSystem) is bridged to the
 * store.
 *
 * The jet is spawned by `GameSystems` when the store phase transitions to
 * `'playing'`, at the world centre, with the selected jet type's stats. `facing`
 * is stored as the direction angle `atan2(dy, dx)` (radians); `0` points east,
 * `-PI/2` points north. The sprite is drawn pointing north, so
 * `view.rotation = facing + PI/2` orients it toward the movement direction.
 *
 * Movement model (design Decision #3 / #4, spec MODIFIED "Jet Movement"):
 *   - `currentSpeed` starts at 0 → a freshly-spawned jet is STATIONARY until the
 *     player gives input (no integration at spawn; see MovementSystem guard).
 *   - `lastDirection` starts at {0,0} and is NEVER reset after first input →
 *     releasing all keys makes the jet CRUISE in the last held direction at
 *     `cruiseSpeed` (it does NOT freeze).
 *   - `vx = lastDirection.dx * currentSpeed`, `vy = lastDirection.dy * currentSpeed`;
 *     the MovementSystem owns the Euler integrator and writes `currentSpeed` +
 *     `lastDirection` + `facing`. The Jet just integrates position from velocity.
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

  /** Selected jet type stats (design authoritative seed-values table). */
  readonly maxSpeed: number;
  readonly cruiseSpeed: number;
  readonly accelerationRate: number;
  readonly defense: number;
  readonly damage: number;

  /**
   * Per-frame speed (px/sec) driven by MovementSystem's exponential Euler
   * integrator toward `maxSpeed` (accelerate) or `cruiseSpeed` (cruise). 0 at
   * spawn → jet stationary until first input. NOT in the Zustand store (Design
   * Decision #9).
   */
  currentSpeed = 0;
  /**
   * Last normalized movement direction. {0,0} at spawn → jet stationary until
   * first input. Once input has been given, this is non-zero forever
   * (cruise-in-last-direction, design Decision #4); the MovementSystem never
   * resets it to {0,0}.
   */
  lastDirection: { dx: number; dy: number } = { dx: 0, dy: 0 };

  private readonly gfx: Graphics;
  private destroyed = false;

  constructor(options?: { x?: number; y?: number; health?: number; stats?: JetStats }) {
    this.x = options?.x ?? 0;
    this.y = options?.y ?? 0;
    this.health = options?.health ?? JET_MAX_HEALTH;

    // Default to the Balanced jet type (design FK default = FALLBACK_JET_TYPES[1])
    // when no stats are supplied — keeps standalone construction (tests, ad-hoc
    // spawns) working. GameSystems always supplies the player's selection.
    const stats = options?.stats ?? FALLBACK_JET_TYPES[1];
    this.maxSpeed = stats.maxSpeed;
    this.cruiseSpeed = stats.cruiseSpeed;
    this.accelerationRate = stats.accelerationRate;
    this.defense = stats.defense;
    this.damage = stats.damage;

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
   * The MovementSystem owns `currentSpeed`/`lastDirection`/`facing` (the
   * acceleration model + cruise-in-last-direction) and writes `vx`/`vy` each
   * tick; this method is pure position integration. Clamping to world bounds is
   * performed by the MovementSystem (it owns the map dimensions via
   * GameContext).
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