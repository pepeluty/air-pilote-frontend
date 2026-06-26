/**
 * Keyboard input for the game. Tracks currently-held keys via `keydown`/
 * `keyup` listeners on `window` and exposes a directional + shoot query API.
 *
 * Movement: WASD OR arrow keys. Shoot: Space.
 * `attach()`/`detach()` manage listeners (detached on teardown to avoid
 * leaks). `preventDefault` is called on game keys so arrow/space don't scroll
 * the page.
 *
 * This is the "InputSystem" of the design Data Flow (Input -> InputSystem) —
 * read-only each tick by MovementSystem/ShootingSystem.
 */
export interface InputState {
  isUp(): boolean;
  isDown(): boolean;
  isLeft(): boolean;
  isRight(): boolean;
  isShoot(): boolean;
}

const MOVE_UP = new Set(['KeyW', 'ArrowUp']);
const MOVE_DOWN = new Set(['KeyS', 'ArrowDown']);
const MOVE_LEFT = new Set(['KeyA', 'ArrowLeft']);
const MOVE_RIGHT = new Set(['KeyD', 'ArrowRight']);
const SHOOT = new Set(['Space']);
const GAME_KEYS = new Set<string>([
  ...MOVE_UP,
  ...MOVE_DOWN,
  ...MOVE_LEFT,
  ...MOVE_RIGHT,
  ...SHOOT,
]);

export class KeyboardInput implements InputState {
  private readonly held = new Set<string>();
  private attached = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (GAME_KEYS.has(event.code)) {
      this.held.add(event.code);
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  attach(): void {
    if (this.attached) return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.held.clear();
    this.attached = false;
  }

  isUp(): boolean {
    return this.hasAny(MOVE_UP);
  }

  isDown(): boolean {
    return this.hasAny(MOVE_DOWN);
  }

  isLeft(): boolean {
    return this.hasAny(MOVE_LEFT);
  }

  isRight(): boolean {
    return this.hasAny(MOVE_RIGHT);
  }

  isShoot(): boolean {
    return this.hasAny(SHOOT);
  }

  private hasAny(codes: Set<string>): boolean {
    for (const code of codes) {
      if (this.held.has(code)) return true;
    }
    return false;
  }
}
