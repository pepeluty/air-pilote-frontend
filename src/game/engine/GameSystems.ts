import { FALLBACK_JET_TYPES, JET_MAX_HEALTH } from '../constants';
import { Jet } from '../entities/Jet';
import type { Projectile } from '../entities/Projectile';
import type { Enemy } from '../entities/Enemy';
import type { WorldContainer } from './WorldContainer';
import type { System } from './TickerLoop';
import { KeyboardInput } from '../input/KeyboardInput';
import type { GameContext } from '../GameContext';
import { createMovementSystem } from '../systems/MovementSystem';
import { createShootingSystem } from '../systems/ShootingSystem';
import { createSpawnSystem } from '../systems/SpawnSystem';
import { createEnemyAISystem } from '../systems/EnemyAISystem';
import { createCollisionSystem } from '../systems/CollisionSystem';
import { useGameStore } from '../state/gameStore';

/**
 * Minimal registrar a host (the Engine) must satisfy: register/unregister a
 * per-frame system with the ticker. The Engine implements this structurally
 * (`addSystem`/`removeSystem`), so no hard dependency on the Engine class
 * (avoids a circular import).
 */
export interface SystemRegistrar {
  addSystem(system: System): void;
  removeSystem(system: System): void;
}

/**
 * Owns the full per-game runtime: the input listener, the jet, the
 * projectile/enemy pools, the `GameContext`, and the five systems wired into
 * the ticker.
 *
 * Lifecycle (design Data Flow a / a'):
 *   - `new GameSystems(...)` is called by the Engine when phase transitions to
 *     `'playing'` from `menu`/`gameOver` (a NEW game). It spawns the jet at the
 *     world centre, attaches keyboard input, builds the context, creates the
 *     systems in execution order (movement -> shooting -> spawn -> AI ->
 *     collision) and registers them.
 *   - On resume from `'paused'` the Engine does NOT rebuild this: the existing
 *     instance is retained (entities + systems on stage) and only the ticker is
 *     restarted (state retained, design a').
 *   - `destroy()` unregisters the systems, detaches input, and frees every
 *     entity's Pixi resources. Called by the Engine on `'menu'` (and on full
 *     Engine teardown).
 *
 * The store is intentionally NOT held here: systems import `useGameStore` and
 * read/write it live (see GameContext doc).
 */
export class GameSystems {
  private readonly registrar: SystemRegistrar;
  private readonly input: KeyboardInput;
  private readonly jet: Jet;
  private readonly projectiles: Projectile[] = [];
  private readonly enemies: Enemy[] = [];
  private readonly systems: System[];
  private destroyed = false;

  constructor(
    registrar: SystemRegistrar,
    worldContainer: WorldContainer,
    viewport: { width: number; height: number },
    mapBounds: { width: number; height: number },
  ) {
    this.registrar = registrar;

    // Input (InputSystem).
    this.input = new KeyboardInput();
    this.input.attach();

    // Spawn the jet at the world centre, full health. Per-type stats come from
    // the player's MenuScreen selection (design Data Flow a): read the cached
    // `jetStats` from the store; when no selection yet (e.g. before PR 6 wires
    // the MenuScreen + Start precondition), fall back to the Balanced jet type
    // (FALLBACK_JET_TYPES[1] — the FK default) so the game stays playable.
    const { jetStats } = useGameStore.getState();
    const selectedStats = jetStats ?? FALLBACK_JET_TYPES[1];
    this.jet = new Jet({
      x: mapBounds.width / 2,
      y: mapBounds.height / 2,
      health: JET_MAX_HEALTH,
      stats: {
        maxSpeed: selectedStats.maxSpeed,
        cruiseSpeed: selectedStats.cruiseSpeed,
        accelerationRate: selectedStats.accelerationRate,
        defense: selectedStats.defense,
        damage: selectedStats.damage,
      },
    });
    worldContainer.container.addChild(this.jet.view);

    // Build the shared context injected (via closure) into every system.
    const ctx: GameContext = {
      jet: this.jet,
      worldContainer,
      projectiles: this.projectiles,
      enemies: this.enemies,
      viewport,
      mapBounds,
      input: this.input,
    };

    // Systems in execution order (matches design Data Flow a).
    this.systems = [
      createMovementSystem(ctx),
      createShootingSystem(ctx),
      createSpawnSystem(ctx),
      createEnemyAISystem(ctx),
      createCollisionSystem(ctx),
    ];
    for (const system of this.systems) {
      registrar.addSystem(system);
    }
  }

  /** Tear down: unregister systems, detach input, free entities. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const system of this.systems) {
      this.registrar.removeSystem(system);
    }
    this.input.detach();

    for (const projectile of this.projectiles) projectile.destroy();
    for (const enemy of this.enemies) enemy.destroy();
    this.jet.destroy();
    this.projectiles.length = 0;
    this.enemies.length = 0;
  }
}
