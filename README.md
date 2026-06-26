# Air-Pilote — Frontend

2D top-down (cenital) jet game client for **Air-Pilote**.

## Stack

- **Vite** — dev server + bundler
- **React + TypeScript** — DOM overlay UI (HUD, menus, auth)
- **PixiJS** — canvas render engine + ticker game loop (manual `PIXI.Application`)
- **Zustand** — slow-state bridge between Pixi (per-frame) and React (UI)
- **Vitest + React Testing Library** — unit tests
- **Playwright** — end-to-end tests

## Architecture

Pixi owns the canvas and ticker; React owns the DOM overlay (HUD, menus, auth
screens). Zustand bridges slow game-facing state (score, health, phase) both
directions: Pixi emits change events → store → HUD re-renders, and React UI
writes phase commands → store → Pixi subscribes. Per-frame data stays in Pixi
and never floods the store.

## Repo

This is one of three independent git repos in the Air-Pilote workspace:

- `frontend/` — this repo (game client)
- `backend/` — NestJS + PostgreSQL API
- `openspec/` — SDD planning context (OpenSpec artifacts)

The workspace root is **not** a git repo by design. Each repo deploys and rolls
back independently.
