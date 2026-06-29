import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { JetTypeDto } from '../api/client';
import { useGameStore } from '../../game/state/gameStore';
import { FALLBACK_JET_TYPES } from '../../game/constants';

/**
 * Menu screen (spec "Game Phases — Start game" + "Jet Type Selection"). Shows
 * the title, an optional high score (fetched on mount), a 3-card jet-type
 * selection fetched from `GET /jet-types` (falling back to `FALLBACK_JET_TYPES`
 * on failure — spec "Fetch failure falls back to constants"), a Start button
 * that flips the store to a fresh playing session (disabled until a jet is
 * selected — spec "Cannot start without selecting"), and a Logout button.
 *
 * Design Decision #8 — selection is inline here (no separate route). The
 * selection persists in the store as `selectedJetTypeId` + cached `jetStats`
 * (design Data Flow a); `GameSystems` reads `jetStats` at spawn (PR 4) and
 * `GameOverScreen` sends `selectedJetTypeId` to the records POST (PR 6).
 *
 * `playStartedAt` is stamped on start so GameOverScreen can compute
 * `durationMs` for the score-persistence POST (design Data Flow c).
 */
export function MenuScreen(): JSX.Element {
  const setStore = useGameStore((s) => s.set);
  const selectedJetTypeId = useGameStore((s) => s.selectedJetTypeId);
  const [highScore, setHighScore] = useState<number | null>(null);
  // Start from the fallback so the cards render immediately (no loading flash);
  // overwrite on a successful fetch. Spec "Display three jet types" + "Fetch
  // failure falls back to constants" — degraded mode keeps the game playable.
  const [jetTypes, setJetTypes] = useState<JetTypeDto[]>(FALLBACK_JET_TYPES);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getJetTypes()
      .then((types) => {
        if (!active) return;
        if (Array.isArray(types) && types.length > 0) {
          setJetTypes(types);
          setFetchFailed(false);
        }
        // Empty catalog: keep the fallback already in state (degraded mode).
      })
      .catch(() => {
        if (!active) return;
        // Spec "Fetch failure falls back to constants" — backend unreachable
        // or @Public route errored; keep the game playable with the constants.
        setJetTypes(FALLBACK_JET_TYPES);
        setFetchFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

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

  function selectJetType(jetType: JetTypeDto): void {
    // design Data Flow a: store both the id (Start precondition + records
    // POST) and the full stats (read by GameSystems at spawn, PR 4).
    setStore({ selectedJetTypeId: jetType.id, jetStats: jetType });
  }

  function startGame(): void {
    // Spec "Start game": precondition is `selectedJetTypeId` set. The button
    // is disabled when null (below), so this guard is a defensive backup.
    if (!selectedJetTypeId) return;
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

  const canStart = selectedJetTypeId !== null;

  return (
    <div className="screen menu">
      <h1>Air-Pilote</h1>
      {highScore !== null && <p className="high-score">High Score: {highScore}</p>}

      <div className="jet-select" role="group" aria-label="Select a jet type">
        {jetTypes.map((jet) => {
          const selected = jet.id === selectedJetTypeId;
          return (
            <button
              key={jet.id}
              type="button"
              className={`jet-card${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              onClick={() => selectJetType(jet)}
            >
              <span className="jet-card-name">{jet.name}</span>
              <span className="jet-card-stats">
                <span>Speed: {jet.maxSpeed}</span>
                <span>Defense: {jet.defense}</span>
                <span>Damage: {jet.damage}</span>
              </span>
            </button>
          );
        })}
      </div>

      {fetchFailed && (
        <p className="fetch-warn">Jet catalog unavailable — showing fallback types.</p>
      )}

      <button type="button" onClick={startGame} disabled={!canStart}>
        Start Game
      </button>
      {!canStart && <p className="select-hint">Select a jet type to start.</p>}

      <button type="button" className="secondary" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}