import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { useGameStore } from '../../game/state/gameStore';

/**
 * Menu screen (spec "Game Phases — Start game"). Shows the title, an optional
 * high score (fetched on mount), a Start button that flips the store to a fresh
 * playing session, and a Logout button that calls the backend + clears local
 * auth state.
 *
 * `playStartedAt` is stamped here so GameOverScreen can compute `durationMs`
 * for the score-persistence POST (design Data Flow c).
 */
export function MenuScreen(): JSX.Element {
  const setStore = useGameStore((s) => s.set);
  const [highScore, setHighScore] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getHighScore()
      .then((hs) => {
        if (active) setHighScore(hs);
      })
      .catch(() => {
        // Not yet authenticated for records or backend unavailable — leave null.
      });
    return () => {
      active = false;
    };
  }, []);

  function startGame(): void {
    setStore({
      phase: 'playing',
      score: 0,
      health: 100,
      playStartedAt: Date.now(),
    });
  }

  async function handleLogout(): Promise<void> {
    try {
      await api.logout();
    } catch {
      // Backend unavailable — still clear local auth so the user can leave.
    }
    setStore({ isAuthenticated: false });
  }

  return (
    <div className="screen menu">
      <h1>Air-Pilote</h1>
      {highScore !== null && <p className="high-score">High Score: {highScore}</p>}
      <button type="button" onClick={startGame}>
        Start Game
      </button>
      <button type="button" className="secondary" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
