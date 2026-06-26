/**
 * Fetch wrapper for the Air-Pilote backend (design Decision #6).
 *
 * Access token: held in module memory (NOT localStorage — it would be readable
 * by any XSS payload) and attached as `Authorization: Bearer <token>`. The
 * refresh token lives in an httpOnly Secure SameSite=Strict cookie set by the
 * backend, so it is sent automatically with `credentials: 'include'` and is
 * never readable by JavaScript.
 *
 * Refresh-on-401: when a protected call returns 401, a single in-flight
 * refresh is attempted. Concurrent 401s share one refresh promise to avoid a
 * "refresh storm". On success the original request is retried once with the
 * new token. On failure the access token is cleared and `ApiError(401,
 * 'Session expired')` is thrown so the UI can return to the auth screen.
 *
 * Endpoints (specs backend-identity / backend-game-records):
 *   POST /auth/register            { email, password } → { accessToken }
 *   POST /auth/login               { email, password } → { accessToken }
 *   POST /auth/refresh             (cookie)            → { accessToken }
 *   POST /auth/logout              (cookie)            → 204
 *   POST /game-records             { score, durationMs } → 201 GameRecordDto
 *   GET  /game-records/high-score                      → { highScore: number | null }
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// --- Access token storage (module memory; never persisted to localStorage) --

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

// --- Response shapes -------------------------------------------------------

/** Auth responses carry the access token in the body; the refresh is a cookie. */
interface AuthResponseBody {
  accessToken: string;
}

/** Persisted game record returned by POST /game-records (spec: 201). */
export interface GameRecordDto {
  id: string;
  score: number;
  durationMs: number;
  timestamp: string;
}

/** High-score response: `null` when the player has no records (spec). */
interface HighScoreDto {
  highScore: number | null;
}

// --- Errors ----------------------------------------------------------------

/** Thrown for non-2xx responses; carries the HTTP status for UI branching. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// --- Single in-flight refresh (prevents refresh storms) --------------------

let refreshPromise: Promise<boolean> | null = null;

/**
 * POST /auth/refresh. The refresh token is in the httpOnly cookie, sent
 * automatically with `credentials: 'include'`. Returns `true` when a new
 * access token was obtained and saved.
 */
async function doRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) return false;
    const body = (await response.json()) as AuthResponseBody;
    if (!body?.accessToken) return false;
    setAccessToken(body.accessToken);
    return true;
  } catch {
    // Network error or malformed body — refresh did not succeed.
    return false;
  }
}

// --- Core fetch wrapper ----------------------------------------------------

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Refresh-on-401: never recurse on the refresh endpoint itself.
  if (response.status === 401 && !url.includes('/auth/refresh')) {
    // Single in-flight refresh — concurrent 401s await the same promise.
    if (!refreshPromise) refreshPromise = doRefresh();
    const refreshed = await refreshPromise;
    refreshPromise = null;
    if (refreshed) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set('Authorization', `Bearer ${accessToken}`);
      return fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: retryHeaders,
        credentials: 'include',
      });
    }
    clearAccessToken();
    throw new ApiError(401, 'Session expired');
  }

  return response;
}

// --- Convenience verbs (parse JSON, throw ApiError on non-2xx) -------------

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body?.message ?? message;
    } catch {
      // No JSON body — fall back to statusText.
    }
    throw new ApiError(response.status, message);
  }
  // 204 No Content or an empty body (e.g. logout) → resolve with undefined.
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function get<T>(url: string): Promise<T> {
  const response = await apiFetch(url, { method: 'GET' });
  return parseJson<T>(response);
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiFetch(url, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseJson<T>(response);
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiFetch(url, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseJson<T>(response);
}

export async function del<T>(url: string): Promise<T> {
  const response = await apiFetch(url, { method: 'DELETE' });
  return parseJson<T>(response);
}

// --- Auth helpers ----------------------------------------------------------

/**
 * POST /auth/register. Saves the access token from the response body; the
 * refresh token is set as an httpOnly cookie by the backend. Returns the token.
 */
export async function register(email: string, password: string): Promise<string> {
  const body = await post<AuthResponseBody>('/auth/register', { email, password });
  setAccessToken(body.accessToken);
  return body.accessToken;
}

/** POST /auth/login. Saves the access token from the response body. Returns it. */
export async function login(email: string, password: string): Promise<string> {
  const body = await post<AuthResponseBody>('/auth/login', { email, password });
  setAccessToken(body.accessToken);
  return body.accessToken;
}

/** Explicit refresh (e.g. on app boot). Returns whether a token was obtained. */
export async function refresh(): Promise<boolean> {
  return doRefresh();
}

/** POST /auth/logout. Clears the access token; the backend clears the cookie. */
export async function logout(): Promise<void> {
  try {
    await post<void>('/auth/logout');
  } finally {
    clearAccessToken();
  }
}

// --- Game records helpers --------------------------------------------------

/** POST /game-records. Returns the persisted record (spec: 201). */
export async function saveGameRecord(score: number, durationMs: number): Promise<GameRecordDto> {
  return post<GameRecordDto>('/game-records', { score, durationMs });
}

/** GET /game-records/high-score. Returns `null` when the player has no records. */
export async function getHighScore(): Promise<number | null> {
  const body = await get<HighScoreDto>('/game-records/high-score');
  return body.highScore;
}
