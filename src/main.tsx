import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useGameStore } from './game/state/gameStore';
import './index.css';

// NOTE: StrictMode intentionally NOT enabled. PixiJS v8 Application init is
// async and StrictMode double-invokes effects in dev (mount -> unmount ->
// mount), which would briefly create two canvases. The engine handles
// destroy-before-init via its `destroyed` guard, but a single root keeps the
// lifecycle simple for the game/React split (design Decision #1).
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(<App />);

// DEV-ONLY test hook: expose the Zustand store on `window` so the Playwright
// E2E suite can drive DOM-level phase transitions (gameOver / pause / resume)
// WITHOUT rendering the Pixi canvas — headless Chromium has no WebGL, so the
// game can't be driven to completion via pixel input. The phase router is
// pure store + React (DOM-level), so this keeps E2E honest. Stripped from the
// production bundle? The import remains but the guard body is dead code under
// `import.meta.env.DEV === false` (Vite inlines it); harmless either way.
if (import.meta.env.DEV) {
  (window as unknown as { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;
}