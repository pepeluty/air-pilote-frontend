import { createRoot } from 'react-dom/client';
import { App } from './App';
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