/**
 * Frontend auth utilities — talks to /api/auth/* on the same origin.
 * Because both the frontend and API are served from the same Replit domain,
 * the browser sends the HttpOnly session cookie automatically with every request.
 */

export interface AuthStatus {
  authenticated: boolean;
  authEnabled: boolean;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch('/api/auth/status');
    if (!res.ok) return { authenticated: false, authEnabled: true };
    return await res.json() as AuthStatus;
  } catch {
    return { authenticated: false, authEnabled: false };
  }
}

export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: body.error ?? 'Invalid password' };
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}
