import { useEffect, useRef } from 'react';
import { Engine } from './game/engine/Engine';
import { useGameStore } from './game/state/gameStore';
import './App.css';

/**
 * Phase-based screen router (skeleton). Subscribes to `phase` from the Zustand
 * store and renders the matching screen. This is the React <- store
 * direction of the bidirectional bridge (design Decision #9).
 *
 * Full screens (Auth/Menu/GameOver/Paused) + HUD are PR 7 (task 3.7). The
 * placeholders here exist only to prove the phase router + the Start/Pause
 * command path (React -> store): buttons call `store.set({ phase })` and the
 * Engine subscribes to those changes.
 */
export function App(): JSX.Element {
  const phase = useGameStore((s) => s.phase);
  const showCanvas = phase === 'playing' || phase === 'paused';

  return (
    <div className="app">
      {phase === 'menu' && <MenuPlaceholder />}

      {/* Mounted for both 'playing' AND 'paused' so the canvas (and engine)
          survives the playing<->paused transition — paused retains state. */}
      {showCanvas && <GameCanvas />}

      {phase === 'playing' && <HudPlaceholder />}
      {phase === 'paused' && <PauseOverlay />}
      {phase === 'gameOver' && <GameOverPlaceholder />}
    </div>
  );
}

/**
 * Mounts the PixiJS Engine into a host div. Created when entering the game
 * (playing/paused), destroyed on unmount (gameOver/menu leave this subtree).
 */
function GameCanvas(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const engine = new Engine({ mapWidth: 2000, mapHeight: 2000 });
    engine.init(host).catch((err: unknown) => {
      // Surface init failures; the engine is a no-op until it resolves.
      // eslint-disable-next-line no-console
      console.error('Engine init failed:', err);
    });

    return () => {
      engine.destroy();
    };
  }, []);

  return <div ref={hostRef} className="game-canvas" />;
}

function MenuPlaceholder(): JSX.Element {
  const setPhase = useGameStore((s) => s.set);
  return (
    <div className="screen menu">
      <h1>Air-Pilote</h1>
      <p>Menu (skeleton)</p>
      <button type="button" onClick={() => setPhase({ phase: 'playing' })}>
        Start Game
      </button>
    </div>
  );
}

function HudPlaceholder(): JSX.Element {
  const score = useGameStore((s) => s.score);
  const health = useGameStore((s) => s.health);
  const setPhase = useGameStore((s) => s.set);
  return (
    <div className="hud">
      <span>Score: {score}</span>
      <span>Health: {health}</span>
      <button type="button" onClick={() => setPhase({ phase: 'paused' })}>
        Pause
      </button>
    </div>
  );
}

function PauseOverlay(): JSX.Element {
  const setPhase = useGameStore((s) => s.set);
  return (
    <div className="screen overlay">
      <h2>Paused</h2>
      <button type="button" onClick={() => setPhase({ phase: 'playing' })}>
        Resume
      </button>
    </div>
  );
}

function GameOverPlaceholder(): JSX.Element {
  const score = useGameStore((s) => s.score);
  const setPhase = useGameStore((s) => s.set);
  return (
    <div className="screen overlay">
      <h2>Game Over</h2>
      <p>Score: {score}</p>
      <button type="button" onClick={() => setPhase({ phase: 'menu' })}>
        Back to Menu
      </button>
    </div>
  );
}