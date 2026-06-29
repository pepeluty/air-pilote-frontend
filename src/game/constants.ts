import type { JetTypeDto } from '../ui/api/client';

/**
 * Tuning constants for the Air-Pilote game layer (PR 6).
 *
 * World/viewport dimensions are NOT duplicated here: systems read them from the
 * `GameContext` (`ctx.viewport`, `ctx.mapBounds`), which the Engine owns. These
 * constants cover only entity behaviour tuning + scoring, so the feel of the
 * game lives in one place.
 *
 * Velocity units are px/sec. The ticker passes deltaMS, so integration is
 * `pos += vel * dt / 1000`.
 */

// --- Jet -----------------------------------------------------------------
export const JET_MAX_HEALTH = 100;
/** Jet movement speed in px/sec (calibrated for responsive control). */
export const JET_SPEED = 320;
/** Collision radius in px (circle-overlap hit testing). */
export const JET_RADIUS = 18;
/** Distance from the jet centre along `facing` where projectiles spawn. */
export const JET_NOSE_OFFSET = 20;

// --- Projectile ----------------------------------------------------------
export const PROJECTILE_SPEED = 520;
export const PROJECTILE_RADIUS = 4;
/** Minimum interval between shots in ms (fire cadence cap). */
export const PROJECTILE_COOLDOWN_MS = 250;

// --- Enemy ---------------------------------------------------------------
/**
 * Enemy health pool. 100 (was 1 in project-bootstrap) enables multi-hit per
 * design Decision #5: Interceptor dmg 30 → 4 hits, Balanced 45 → 3, Heavy 80
 * → 2. `takeDamage(amount)` decrements and flags destroyed at health <= 0.
 */
export const ENEMY_MAX_HEALTH = 100;
/** Homing speed in px/sec (slower than the jet so the player can escape). */
export const ENEMY_SPEED = 110;
export const ENEMY_RADIUS = 16;
/** Health removed from the jet on enemy contact. */
export const ENEMY_CONTACT_DAMAGE = 20;
/** Time between enemy spawns in ms. */
export const ENEMY_SPAWN_INTERVAL_MS = 1200;
/** Hard cap on simultaneous enemies (keeps the MVP manageable). */
export const ENEMY_MAX_CONCURRENT = 12;
/** Enemies spawn on a ring of this radius around the jet (px). */
export const ENEMY_SPAWN_DISTANCE = 520;

// --- Scoring -------------------------------------------------------------
export const SCORE_PER_KILL = 100;

// --- Jet types fallback --------------------------------------------------
/**
 * Frontend fallback for `GET /jet-types` (design Data Flow a). MUST match the
 * backend seed migration `Migration20260626000002_jet_types` exactly — same
 * fixed UUIDs, same values — so a test can assert FE/BE equality. Typed
 * against `JetTypeDto` so any drift fails at compile time.
 *
 *   Interceptor  …0001  maxSpeed 460  cruise 200  accel 4.0  defense 10  damage 30
 *   Balanced     …0002  maxSpeed 360  cruise 200  accel 5.0  defense 35  damage 45  ← FK default
 *   Heavy        …0003  maxSpeed 280  cruise 180  accel 6.0  defense 60  damage 80
 */
export const FALLBACK_JET_TYPES: JetTypeDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Interceptor',
    maxSpeed: 460,
    cruiseSpeed: 200,
    accelerationRate: 4.0,
    defense: 10,
    damage: 30,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Balanced',
    maxSpeed: 360,
    cruiseSpeed: 200,
    accelerationRate: 5.0,
    defense: 35,
    damage: 45,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Heavy',
    maxSpeed: 280,
    cruiseSpeed: 180,
    accelerationRate: 6.0,
    defense: 60,
    damage: 80,
  },
];
