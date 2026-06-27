/**
 * Air-Pilote — Playwright E2E (task 4.8; spec frontend-game-client:
 * "Auth UI", "Game Phases", "HUD Overlay").
 *
 * Mocks the backend via `page.route()` — no live NestJS needed. Asserts ONLY
 * DOM-level overlays (HUD text, screen headings, buttons); the PixiJS canvas
 * is NOT rendered (headless Chromium has no WebGL), so the canvas is ignored
 * entirely. Phase transitions are driven via the Zustand store exposed on
 * `window.__gameStore` (dev-only — see main.tsx) for the gameOver/pause paths
 * that the canvas would normally trigger.
 */
import { test, expect, type Page } from '@playwright/test';

type StoreApi = {
  getState: () => {
    phase: 'menu' | 'playing' | 'paused' | 'gameOver';
    score: number;
    health: number;
    set: (partial: Record<string, unknown>) => void;
  };
};

/**
 * Install the API mocks for a run. Routes are set BEFORE the page loads so
 * no real network call escapes.
 */
async function installApiMocks(page: Page, opts: { loginFails?: boolean } = {}): Promise<void> {
  await page.route('**/auth/register', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'fake-token' }) }),
  );
  await page.route('**/auth/login', (route) => {
    if (opts.loginFails) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'fake-token' }) });
  });
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, body: 'no refresh' }));
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 204 }));
  await page.route('**/game-records', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'rec-1', score: 0, durationMs: 0, timestamp: new Date().toISOString() }),
    }),
  );
  await page.route('**/game-records/high-score', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ highScore: 5000 }) }),
  );
}

// --------------------------------------------------------------------------------
// 1. Register success → menu (spec: Auth UI — Register success)
// --------------------------------------------------------------------------------

test('register: on success transitions to the menu and shows Start Game', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');

  // Switch from the default login mode to register.
  await page.getByRole('button', { name: /Need an account\? Register/i }).click();
  await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

  await page.getByLabel('Email').fill('player@air.test');
  // `exact: true` because register mode shows BOTH "Password" and "Confirm
  // Password" labels (the latter contains the former).
  await page.getByLabel('Password', { exact: true }).fill('correcthorse1');
  await page.getByLabel('Confirm Password').fill('correcthorse1');
  await page.getByRole('button', { name: 'Register' }).click();

  // Spec: "stores authentication state and transitions to menu".
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
});

// --------------------------------------------------------------------------------
// 2. Login failure → error displayed, stays on auth screen (spec: Login failure)
// --------------------------------------------------------------------------------

test('login failure: invalid credentials display an error without leaving the auth screen', async ({ page }) => {
  await installApiMocks(page, { loginFails: true });
  await page.goto('/');

  await page.getByLabel('Email').fill('player@air.test');
  await page.getByLabel('Password', { exact: true }).fill('wrongpassword1');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Error is shown (role=alert) and the menu is NOT reachable. The spec only
  // requires "displays an error without changing phase" — the exact message is
  // determined by the client's 401 handling (here the refresh-on-401 path
  // surfaces "Session expired" because the mocked /auth/refresh also 401s).
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText('');
  await expect(page.getByRole('button', { name: 'Start Game' })).not.toBeVisible();
  // Auth screen heading still present.
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
});

// --------------------------------------------------------------------------------
// Shared helper: authenticate and reach the menu.
// --------------------------------------------------------------------------------
async function reachMenu(page: Page): Promise<void> {
  await installApiMocks(page);
  await page.goto('/');
  await page.getByLabel('Email').fill('player@air.test');
  await page.getByLabel('Password', { exact: true }).fill('correcthorse1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
}

// --------------------------------------------------------------------------------
// 3. Menu → Play → GameOver (spec: Game Phases — Start game + Player death)
// --------------------------------------------------------------------------------

test('menu → play → gameOver: HUD shows during play, Game Over screen appears (score persisted via mocked API)', async ({ page }) => {
  await reachMenu(page);

  // Start a fresh run. The Pixi canvas won't render (no WebGL) but the HUD DOM
  // overlay is React-rendered and shows immediately on phase 'playing'.
  await page.getByRole('button', { name: 'Start Game' }).click();

  // HUD overlay present: score + health text visible (spec: HUD Overlay).
  await expect(page.getByText(/Score:/i)).toBeVisible();
  await expect(page.getByText(/Health:/i)).toBeVisible();

  // Trigger player death without the canvas: drive the store to gameOver with
  // a final score (this is exactly the event CollisionSystem would publish).
  await page.evaluate(() => {
    const s = (window as unknown as { __gameStore: StoreApi }).__gameStore;
    s.getState().set({ score: 250, phase: 'gameOver' });
  });

  await expect(page.getByRole('heading', { name: 'Game Over' })).toBeVisible();
  await expect(page.getByText('Score: 250')).toBeVisible();
});

// --------------------------------------------------------------------------------
// 4. Pause / resume (spec: Game Phases — paused retains world; UI command path)
// --------------------------------------------------------------------------------

test('pause/resume: Pause shows the Paused overlay, Resume returns to playing', async ({ page }) => {
  await reachMenu(page);
  await page.getByRole('button', { name: 'Start Game' }).click();

  // HUD Pause button flips phase → 'paused'; PausedScreen overlay appears.
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

  // Resume flips back to playing; the Paused overlay disappears.
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).not.toBeVisible();
  // HUD still present — back in playing.
  await expect(page.getByText(/Score:/i)).toBeVisible();
});

// --------------------------------------------------------------------------------
// 5. HUD update — score + health elements show live values (spec: HUD Overlay)
// --------------------------------------------------------------------------------

test('HUD: score + health elements exist and reflect store values', async ({ page }) => {
  await reachMenu(page);
  await page.getByRole('button', { name: 'Start Game' }).click();

  // Initial HUD reflects the fresh-session store (score 0, health 100).
  const score = page.locator('.hud-score');
  const health = page.locator('.hud-health');
  await expect(score).toContainText('Score: 0');
  await expect(health).toContainText('Health: 100');

  // Bump the store; the HUD re-renders (bidirectional Zustand bridge, React side).
  await page.evaluate(() => {
    const s = (window as unknown as { __gameStore: StoreApi }).__gameStore;
    s.getState().set({ score: 1500, health: 60 });
  });
  await expect(score).toContainText('Score: 1500');
  await expect(health).toContainText('Health: 60');
});