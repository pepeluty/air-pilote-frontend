import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { useGameStore } from '../../game/state/gameStore';

/**
 * Game-over screen (spec "Player death" + design Data Flow c). On mount it
 * POSTs the final score + duration to /game-records (best-effort — a failed
 * save does not block the end-of-game UI). "Play Again" starts a fresh session;
 * "Back to Menu" returns to the menu.
 *
 * The score and `playStartedAt` are read once via `useGameStore.getState()`
 * inside the mount effect so the persist call fires exactly once (no
 * exhaustive-deps churn) while the displayed score stays reactive.
 */
export function GameOverScreen(): JSX.Element {
  const score = useGameStore((s) => s.score);
  const setStore = useGameStore((s) => s.set);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const { score: finalScore, playStartedAt } = useGameStore.getState();
    const durationMs = playStartedAt != null ? Date.now() - playStartedAt : 0;
    api
      .saveGameRecord(finalScore, durationMs)
      .then(() => {
        if (active) setSaved(true);
      })
      .catch(() => {
        // Persistence failed (session expired / network). The game still ends;
        // the record is simply not saved this session.
      });
    return () => {
      active = false;
    };
  }, []);

  function playAgain(): void {
    setStore({
      phase: 'playing',
      score: 0,
      health: 100,
      playStartedAt: Date.now(),
    });
  }

  function backToMenu(): void {
    setStore({ phase: 'menu' });
  }

  return (
    <div className="screen overlay game-over">
      <h2>Game Over</h2>
      <p>Score: {score}</p>
      <p className="save-status">{saved ? 'Score saved.' : 'Saving score…'}</p>
      <button type="button" onClick={playAgain}>
        Play Again
      </button>
      <button type="button" className="secondary" onClick={backToMenu}>
        Back to Menu
      </button>
    </div>
  );
}
