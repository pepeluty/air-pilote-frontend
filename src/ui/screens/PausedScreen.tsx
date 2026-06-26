import { useGameStore } from '../../game/state/gameStore';

/**
 * Pause overlay (spec "Game Phases"; design Data Flow a' — paused retains state
 * on stage). Rendered ON TOP of the live canvas + HUD so the frozen world stays
 * visible behind the semi-transparent overlay. "Resume" flips back to playing;
 * "Quit to Menu" abandons the run.
 */
export function PausedScreen(): JSX.Element {
  const setStore = useGameStore((s) => s.set);

  return (
    <div className="screen overlay paused">
      <h2>Paused</h2>
      <button type="button" onClick={() => setStore({ phase: 'playing' })}>
        Resume
      </button>
      <button type="button" className="secondary" onClick={() => setStore({ phase: 'menu' })}>
        Quit to Menu
      </button>
    </div>
  );
}
