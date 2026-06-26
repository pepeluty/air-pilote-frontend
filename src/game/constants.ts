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
export const ENEMY_MAX_HEALTH = 1;
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
