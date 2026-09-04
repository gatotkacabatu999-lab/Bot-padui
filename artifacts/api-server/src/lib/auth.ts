/**
 * Server-side authentication utilities.
 *
 * Auth is cookie-based: a signed HttpOnly cookie `dbrutals_session` is set
 * on successful login and checked by `requireAuth` middleware.
 *
 * Auth is only enforced when `APP_PASSWORD` is set in the environment.
 * When the variable is absent (local dev without config), all requests pass.
 */

import type { Request, Response, NextFunction } from 'express';

const COOKIE_NAME = 'dbrutals_session';
const COOKIE_VALUE = 'authenticated';

/** True when APP_PASSWORD env var is configured. */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Returns true if the supplied password matches APP_PASSWORD. */
export function validatePassword(password: string): boolean {
  const stored = process.env.APP_PASSWORD;
  if (!stored) return true; // auth disabled — always accept
  return password === stored;
}

/** Set the auth cookie on the response. */
export function setAuthCookie(res: Response): void {
  res.cookie(COOKIE_NAME, COOKIE_VALUE, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/** Clear the auth cookie on the response. */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}

/** Returns true if the request carries a valid signed session cookie. */
export function isAuthenticated(req: Request): boolean {
  if (!isAuthEnabled()) return true;
  return req.signedCookies?.[COOKIE_NAME] === COOKIE_VALUE;
}

/**
 * Express middleware that rejects unauthenticated requests with 401.
 * Skipped entirely when auth is disabled (APP_PASSWORD not set).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnabled()) {
    next();
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
}
