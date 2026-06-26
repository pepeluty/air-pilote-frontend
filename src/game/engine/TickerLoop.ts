import { Application, Ticker } from 'pixi.js';

/**
 * A system is a per-frame update function. `dt` is the delta time in
 * milliseconds since the previous tick (Pixi `Ticker.deltaMS`).
 *
 * The Pixi system iface `update(dt, ctx)` from the design reduces to this for
 * the engine-level registration surface; richer contexts (jet, projectiles,
 * world) are injected by systems themselves in PR 6.
 */
export type System = (dt: number) => void;

/**
 * Wraps the PixiJS v8 Ticker. Owns the ordered list of registered systems and
 * drives them every tick. The ticker IS the game loop — no custom
 * requestAnimationFrame (design Decision #1).
 *
 * Lifecycle: constructed AFTER `app.init()` (the ticker must be ready).
 * `start()`/`stop()` resume/pause the ticker; the systems array is retained
 * across stop/start so `paused` keeps the world state on stage (design a').
 * `destroy()` detaches the tick callback and clears systems.
 */
export class TickerLoop {
  private readonly app: Application;
  private readonly systems: System[] = [];
  private running = false;
  private readonly tickFn: (ticker: Ticker) => void;

  constructor(app: Application) {
    this.app = app;
    this.tickFn = (ticker: Ticker): void => {
      const dt = ticker.deltaMS;
      for (const system of this.systems) system(dt);
    };
    // Register once; it only executes while the ticker is running.
    this.app.ticker.add(this.tickFn);
  }

  /** Resume the game loop. No-op if already running. */
  start(): void {
    if (this.running) return;
    this.app.ticker.start();
    this.running = true;
  }

  /**
   * Pause the game loop. State is retained on the stage (the last rendered
   * framebuffer stays visible), per design ('paused' -> ticker.stop()).
   */
  stop(): void {
    if (!this.running) return;
    this.app.ticker.stop();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  removeSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index >= 0) this.systems.splice(index, 1);
  }

  clear(): void {
    this.systems.length = 0;
  }

  /** Detach the tick callback and drop all systems. */
  destroy(): void {
    this.app.ticker.remove(this.tickFn);
    this.systems.length = 0;
    this.running = false;
  }
}