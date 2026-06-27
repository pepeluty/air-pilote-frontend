// Vitest global setup.
//
// 1. Wires jest-dom matchers (toBeInTheDocument, etc.) for component tests.
// 2. Mocks `pixi.js` globally — jsdom has no WebGL, so every Pixi construct
//    (Application/Container/Graphics/Ticker) is replaced by a minimal stand-in
//    that records children + position + rotation and exposes the chainable
//    draw/fill/stroke methods the entities call. This keeps entity/system/world
//    unit tests focused on BEHAVIOR (movement math, cooldowns, collisions,
//    camera clamping) without touching real rendering.
import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('pixi.js', () => {
  class Container {
    children: Container[] = [];
    position = {
      x: 0,
      y: 0,
      set(x: number, y: number): void {
        this.x = x;
        this.y = y;
      },
    };
    rotation = 0;
    destroyed = false;

    addChild<T extends Container>(child: T): T {
      this.children.push(child);
      return child;
    }

    removeChild<T extends Container>(child: T): T {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      return child;
    }

    removeChildren(): Container[] {
      const out = this.children;
      this.children = [];
      return out;
    }

    destroy(): void {
      this.destroyed = true;
    }
  }

  // Graphics extends Container and gains the chainable draw methods the
  // entities use (poly/circle/rect/fill/stroke). All are no-ops returning
  // `this` so construction never throws.
  class Graphics extends Container {
    poly(): this {
      return this;
    }
    circle(): this {
      return this;
    }
    rect(): this {
      return this;
    }
    fill(): this {
      return this;
    }
    stroke(): this {
      return this;
    }
    beginFill(): this {
      return this;
    }
    endFill(): this {
      return this;
    }
  }

  class Ticker {
    deltaMS = 16.67;
    add(): void {
      /* no-op */
    }
    remove(): void {
      /* no-op */
    }
    start(): void {
      /* no-op */
    }
    stop(): void {
      /* no-op */
    }
    destroy(): void {
      /* no-op */
    }
  }

  class Application {
    ticker = new Ticker();
    stage = new Container();
    canvas =
      typeof document !== 'undefined'
        ? document.createElement('canvas')
        : ({} as HTMLCanvasElement);

    async init(): Promise<void> {
      /* no-op */
    }

    destroy(): void {
      /* no-op */
    }
  }

  return { Container, Graphics, Ticker, Application };
});