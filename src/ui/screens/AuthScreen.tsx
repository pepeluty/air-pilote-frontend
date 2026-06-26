import { useState, type FormEvent } from 'react';
import * as api from '../api/client';
import { useGameStore } from '../../game/state/gameStore';

/**
 * Auth screen (spec "Auth UI"): login + register on one screen, toggled by a
 * link. On success the store flips to `isAuthenticated: true` + `phase: 'menu'`
 * (spec "Register success"). On failure an error is shown WITHOUT changing
 * phase (spec "Login failure" — "displays an error without changing phase").
 *
 * Validation mirrors the backend password policy (R3): min 8, max 72, at least
 * one letter AND one number. The access token is saved by the API client inside
 * `login`/`register`; this component only updates the UI-facing store state.
 */
type Mode = 'login' | 'register';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordValid(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 72 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}

export function AuthScreen(): JSX.Element {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setStore = useGameStore((s) => s.set);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!passwordValid(password)) {
      setError('Password must be 8-72 chars with at least one letter and one number.');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await api.login(email, password);
      } else {
        await api.register(email, password);
      }
      // Success → transition to menu. The access token is already stored by
      // the client. Phase is ONLY changed here, on success (spec "Login failure"
      // requires no phase change on error).
      setStore({ isAuthenticated: true, phase: 'menu' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen auth">
      <h1>Air-Pilote</h1>
      <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        {mode === 'register' && (
          <label className="field">
            <span>Confirm Password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Register'}
        </button>
      </form>

      <button
        type="button"
        className="auth-toggle"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
          setConfirm('');
        }}
      >
        {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
