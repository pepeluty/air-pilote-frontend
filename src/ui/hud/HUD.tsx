import { useGameStore } from '../../game/state/gameStore';

/**
 * HUD overlay (spec "HUD Overlay"). A non-moving DOM layer above the canvas
 * showing current score and health. The container is `pointer-events: none` so
 * it never steals canvas input; only the Pause button re-enables pointer events.
 *
 * Subscribes to the Zustand store (design Decision #9 — React reads slow state).
 * Rendered only while phase is 'playing' or 'paused' (App.tsx gate). Health bar
 * colour: green > 50, yellow 25-50, red < 25.
 */
function healthClass(health: number): string {
  if (health > 50) return 'health-green';
  if (health >= 25) return 'health-yellow';
  return 'health-red';
}

export function HUD(): JSX.Element {
  const score = useGameStore((s) => s.score);
  const health = useGameStore((s) => s.health);
  const setStore = useGameStore((s) => s.set);

  const clamped = Math.max(0, Math.min(100, health));

  return (
    <div className="hud">
      <div className="hud-stats">
        <span className="hud-score">Score: {score}</span>
        <span className={`hud-health ${healthClass(health)}`}>
          Health: {health}
          <span className="health-bar">
            <span
              className="health-bar-fill"
              style={{ width: `${clamped}%` }}
            />
          </span>
        </span>
      </div>
      <button
        type="button"
        className="hud-pause"
        onClick={() => setStore({ phase: 'paused' })}
      >
        Pause
      </button>
    </div>
  );
}
