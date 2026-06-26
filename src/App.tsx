import { useEffect, useRef } from 'react';
import { Engine } from './game/engine/Engine';
import { useGameStore } from './game/state/gameStore';
import { AuthScreen } from './ui/screens/AuthScreen';
import { MenuScreen } from './ui/screens/MenuScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';
import { PausedScreen } from './ui/screens/PausedScreen';
import { HUD } from './ui/hud/HUD';
import './App.css';

/**
 * Phase-based screen router with an auth gate. Subscribes to the Zustand store
 * and renders the matching screen — the React <- store direction of the
 * bidirectional bridge (design Decision #9).
 *
 * Auth gate: when `isAuthenticated` is false the AuthScreen is shown regardless
 * of phase. Once authenticated the phase router drives the screen:
 *   menu          → MenuScreen
 *   playing       → GameCanvas + HUD
 *   paused        → GameCanvas + HUD + PausedScreen overlay
 *   gameOver      → GameOverScreen
 *
 * The canvas (and Engine) is mounted for both 'playing' AND 'paused' so it
 * survives the playing<->paused transition — paused retains state on stage
 * (design Data Flow a'). It is destroyed when the subtree leaves (menu/gameOver).
 */
export function App(): JSX.Element {
  const phase = useGameStore((s) => s.phase);
  const isAuthenticated = useGameStore((s) => s.isAuthenticated);
  const showCanvas = isAuthenticated && (phase === 'playing' || phase === 'paused');
  const showHud = showCanvas;

  return (
    <div className="app">
      {!isAuthenticated && <AuthScreen />}

      {isAuthenticated && phase === 'menu' && <MenuScreen />}

      {showCanvas && <GameCanvas />}

      {showHud && <HUD />}

      {isAuthenticated && phase === 'paused' && <PausedScreen />}

      {isAuthenticated && phase === 'gameOver' && <GameOverScreen />}
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