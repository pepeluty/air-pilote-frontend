import { Application } from 'pixi.js';
import { type Phase, useGameStore } from '../state/gameStore';
import { TickerLoop, type System } from './TickerLoop';
import { WorldContainer } from './WorldContainer';
import { GameSystems } from './GameSystems';

export type { System } from './TickerLoop';

export interface EngineOptions {
  /** Logical render width in CSS pixels (the canvas is appended to the host). */
  width?: number;
  /** Logical render height in CSS pixels. */
  height?: number;
  /** World map width used for camera clamping (px). */
  mapWidth?: number;
  /** World map height used for camera clamping (px). */
  mapHeight?: number;
  /** Canvas background color. */
  background?: string;
}

/**
 * Owns the PixiJS `Application`, the scrollable `WorldContainer`, and the
 * `TickerLoop`. Subscribes to the Zustand `gameStore.phase` and drives the
 * ticker accordingly (design Data Flow a' and Architecture Decision #9):
 *
 *   'menu'     -> ticker.stop(), clear the stage
 *   'playing'  -> ticker.start()
 *   'paused'   -> ticker.stop() (state retained on stage)
 *   'gameOver' -> ticker.stop()
 *
 * Lifecycle (manual PIXI.Application + React overlay — Decision #1):
 *   1. `new Engine(opts)`
 *   2. `await engine.init(host)` — async (Pixi v8 async init); appends the
 *      canvas to `host`, wires the ticker, subscribes to the store.
 *   3. On phase -> 'playing' (new game): a `GameSystems` instance is built,
 *      which spawns the jet, attaches input, and registers the five systems
 *      (movement, shooting, spawn, enemy AI, collision) with the ticker. They
 *      run each tick while 'playing'. On resume from 'paused' the existing
 *      instance is retained (state on stage).
 *   4. `engine.destroy()` — unsubscribes from the store, stops the ticker,
 *      tears down the game systems, and destroys the Pixi application (removing
 *      the canvas). Safe to call even if `init()` has not resolved yet
 *      (init()'s await checks the `destroyed` flag).
 */
export class Engine {
  private readonly app: Application;
  private readonly world: WorldContainer;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly width: number;
  private readonly height: number;
  private readonly background: string;

  private tickerLoop: TickerLoop | null = null;
  private gameSystems: GameSystems | null = null;
  private unsubscribe: (() => void) | null = null;
  private initialized = false;
  private destroyed = false;

  constructor(options: EngineOptions = {}) {
    this.app = new Application();
    this.world = new WorldContainer();
    this.width = options.width ?? 960;
    this.height = options.height ?? 600;
    this.mapWidth = options.mapWidth ?? 2000;
    this.mapHeight = options.mapHeight ?? 2000;
    this.background = options.background ?? '#0b1020';
  }

  /** Initialize Pixi and wire the store subscription. Async (Pixi v8). */
  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.width,
      height: this.height,
      background: this.background,
      antialias: true,
      // Do NOT auto-start the loop; the phase subscription controls it.
      autoStart: false,
    });

    // If destroy() was called while we were awaiting init(), clean up and bail.
    if (this.destroyed) {
      this.app.destroy({ removeView: true }, { children: true });
      return;
    }

    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world.container);

    this.tickerLoop = new TickerLoop(this.app);

    // Slow-state bridge -> Pixi: react to phase changes from the store.
    // `prevPhase` lets us distinguish a resume (paused -> playing) from a new
    // game (menu/gameOver -> playing).
    this.unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (state.phase !== prevState.phase) {
        this.onPhaseChange(state.phase, prevState.phase);
      }
    });

    this.initialized = true;
    // Apply the phase we started in (e.g. entering 'playing' from a menu).
    this.onPhaseChange(useGameStore.getState().phase, null);
  }

  /**
   * Apply a phase transition to the engine.
   *
   *   'playing' (from 'paused')  -> resume: keep entities/systems, start ticker.
   *   'playing' (otherwise)      -> new game: rebuild GameSystems, start ticker.
   *   'paused'                   -> stop ticker (state retained on stage).
   *   'gameOver'                 -> stop ticker (death frame retained).
   *   'menu'                     -> stop ticker, tear down systems, clear stage.
   */
  private onPhaseChange(phase: Phase, prevPhase: Phase | null): void {
    if (!this.tickerLoop) return;
    switch (phase) {
      case 'playing':
        if (prevPhase === 'paused') {
          // Resume: the jet + enemies + systems are still on stage.
          this.tickerLoop.start();
        } else {
          // New game: discard any stale session, spawn a fresh jet + systems.
          this.destroyGameSystems();
          this.gameSystems = new GameSystems(
            this,
            this.world,
            { width: this.width, height: this.height },
            { width: this.mapWidth, height: this.mapHeight },
          );
          this.tickerLoop.start();
        }
        break;
      case 'paused':
        this.tickerLoop.stop();
        break;
      case 'gameOver':
        this.tickerLoop.stop();
        break;
      case 'menu':
        this.tickerLoop.stop();
        this.destroyGameSystems();
        this.clearStage();
        break;
    }
  }

  /** Tear down the per-game systems + entities (if any). */
  private destroyGameSystems(): void {
    if (this.gameSystems) {
      this.gameSystems.destroy();
      this.gameSystems = null;
    }
  }

  /** Remove every world child (terrain placeholder + entities). */
  private clearStage(): void {
    this.world.container.removeChildren();
  }

  /** Register a per-frame system. Systems run only while the ticker is running. */
  addSystem(system: System): void {
    this.tickerLoop?.addSystem(system);
  }

  removeSystem(system: System): void {
    this.tickerLoop?.removeSystem(system);
  }

  /** Accessor for systems (e.g. a camera-follow system) to use the world. */
  getWorld(): WorldContainer {
    return this.world;
  }

  /** Accessor used by tests / diagnostics. */
  getView(): { width: number; height: number; mapWidth: number; mapHeight: number } {
    return {
      width: this.width,
      height: this.height,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
    };
  }

  /** Full teardown — unsubscribe, stop the loop, tear down systems, destroy Pixi. Idempotent. */
  destroy(): void {
    this.destroyed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.destroyGameSystems();
    this.tickerLoop?.destroy();
    this.tickerLoop = null;
    if (this.initialized) {
      this.app.destroy({ removeView: true }, { children: true });
    }
    this.initialized = false;
  }
}