/**
 * WorldContainer — camera unit tests (task 4.6; spec frontend-game-client:
 * "Top-down Scrollable Camera" — Follow jet within world, Clamp at world edge).
 *
 * Tests the camera formula directly against the real WorldContainer (pixi.js
 * mocked so `position.set`/`position.x` are plain JS).
 *
 * Camera formula (from the WorldContainer docs / design Data Flow a):
 *   position.x = clamp(viewportW/2 - targetX, viewportW - mapW, 0)
 *   position.y = clamp(viewportH/2 - targetY, viewportH - mapH, 0)
 *   (map <= viewport → center the world: (viewport - map) / 2)
 */
import { describe, it, expect } from 'vitest';
import { WorldContainer } from '../WorldContainer';

describe('WorldContainer — Top-down Scrollable Camera spec', () => {
  it('follow centers the camera on the target within the world', () => {
    const world = new WorldContainer();
    const viewportW = 960;
    const viewportH = 600;
    const mapW = 2000;
    const mapH = 2000;
    const targetX = 1000; // map centre
    const targetY = 1000;

    world.follow(targetX, targetY, viewportW, viewportH, mapW, mapH);

    // Centred: the target world-pixel maps to the viewport centre.
    // position.x = viewportW/2 - targetX = 480 - 1000 = -520
    expect(world.x).toBe(480 - 1000);
    expect(world.y).toBe(300 - 1000);
  });

  it('clamp at edge: does not reveal area outside the world map (spec: Clamp at world edge)', () => {
    const world = new WorldContainer();
    const viewportW = 960;
    const viewportH = 600;
    const mapW = 2000;
    const mapH = 2000;

    // Target well beyond the east/south edge of the map.
    world.follow(5000, 5000, viewportW, viewportH, mapW, mapH);

    // The camera is clamped at the far edge: position = viewport - map.
    // Going further must NOT move the camera past this clamp.
    expect(world.x).toBe(viewportW - mapW); // 960 - 2000 = -1040
    expect(world.y).toBe(viewportH - mapH); // 600 - 2000 = -1400

    // Driving the target even further should not unlock the clamp.
    world.follow(9_999, 9_999, viewportW, viewportH, mapW, mapH);
    expect(world.x).toBe(viewportW - mapW);
    expect(world.y).toBe(viewportH - mapH);

    // And the west/north edge clamps at 0 (no empty margin to the left/top).
    world.follow(-500, -500, viewportW, viewportH, mapW, mapH);
    expect(world.x).toBe(0);
    expect(world.y).toBe(0);
  });

  it('centers the world when the map is smaller than the viewport (no negative margin)', () => {
    const world = new WorldContainer();
    const viewportW = 960;
    const viewportH = 600;
    const mapW = 800; // smaller than viewport → center instead of clamping
    const mapH = 400;

    world.follow(0, 0, viewportW, viewportH, mapW, mapH);

    expect(world.x).toBe((viewportW - mapW) / 2); // 80
    expect(world.y).toBe((viewportH - mapH) / 2); // 100
  });
});