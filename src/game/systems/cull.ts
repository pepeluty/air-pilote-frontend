/**
 * Minimal contract for entities that the cull pass can reap: query liveness and
 * free resources. `Projectile`, `Enemy` (and `Jet`) satisfy this structurally.
 */
export interface Cullable {
  isActive(): boolean;
  destroy(): void;
}

/**
 * Remove every inactive entity from `arr`, freeing its Pixi resources, in place.
 * Iterates backwards so splicing during iteration is safe. `destroy()` is
 * idempotent, so calling it on an already-destroyed entity (e.g. one destroyed
 * by the CollisionSystem) is a safe no-op.
 */
export function cullInactive<T extends Cullable>(arr: T[]): void {
  for (let i = arr.length - 1; i >= 0; i--) {
    const entity = arr[i];
    if (!entity.isActive()) {
      entity.destroy();
      arr.splice(i, 1);
    }
  }
}
