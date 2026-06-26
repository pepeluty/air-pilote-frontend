import { Container } from 'pixi.js';

/** Clamp `v` to the closed range [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * The scrollable game world: a PIXI.Container holding terrain + entities. The
 * Engine adds it to the stage and systems add their display objects to it.
 *
 * The camera is implemented by TRANSLATING this container in the opposite
 * direction of the target — moving the container left makes the world appear to
 * scroll right. `follow()` centers the camera on a target (the jet) and CLAMPS
 * it to the world map bounds so the camera never reveals area outside the
 * terrain (spec "Top-down Scrollable Camera" / "Clamp at world edge").
 */
export class WorldContainer {
  readonly container: Container;

  constructor() {
    this.container = new Container();
    // `cullable` would be set up with a cull area later (PR 6+); nothing for now.
  }

  /**
   * Center the camera on `(targetX, targetY)` and clamp to the map.
   *
   * Camera formula (design):
   *   position.x = clamp(viewportW/2 - targetX, viewportW - mapW, 0)
   *   position.y = clamp(viewportH/2 - targetY, viewportH - mapH, 0)
   *
   * When the map is smaller than the viewport, the world is centered instead of
   * clamped (no negative empty margin).
   */
  follow(
    targetX: number,
    targetY: number,
    viewportWidth: number,
    viewportHeight: number,
    mapWidth: number,
    mapHeight: number,
  ): void {
    this.container.position.set(
      this.clampAxis(targetX, viewportWidth, mapWidth),
      this.clampAxis(targetY, viewportHeight, mapHeight),
    );
  }

  /**
   * Smoothed (lerp) follow toward the same clamped target. Not required for the
   * MVP but provided for nicer feel. `smoothing` is 0..1 (higher = snappier).
   */
  followLerp(
    targetX: number,
    targetY: number,
    viewportWidth: number,
    viewportHeight: number,
    mapWidth: number,
    mapHeight: number,
    smoothing = 0.12,
  ): void {
    const targetXc = this.clampAxis(targetX, viewportWidth, mapWidth);
    const targetYc = this.clampAxis(targetY, viewportHeight, mapHeight);
    const px = this.container.position.x + (targetXc - this.container.position.x) * smoothing;
    const py = this.container.position.y + (targetYc - this.container.position.y) * smoothing;
    this.container.position.set(px, py);
  }

  /** Clamp one axis using the camera formula. */
  private clampAxis(target: number, viewport: number, map: number): number {
    if (map > viewport) {
      // Map larger than viewport: clamp so the camera never shows outside the map.
      return clamp(viewport / 2 - target, viewport - map, 0);
    }
    // Map smaller (or equal) than viewport: center the world.
    return (viewport - map) / 2;
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  get x(): number {
    return this.container.position.x;
  }

  get y(): number {
    return this.container.position.y;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}