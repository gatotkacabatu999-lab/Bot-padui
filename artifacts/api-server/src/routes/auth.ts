/**
 * Auth endpoints:
 *   POST /auth/login   — validate APP_PASSWORD, set signed session cookie
 *   POST /auth/logout  — clear session cookie
 *   GET  /auth/status  — return { authenticated: boolean }
 */

import { Router } from 'express';
import {
  validatePassword,
  setAuthCookie,
  clearAuthCookie,
  isAuthenticated,
  isAuthEnabled,
} from '../lib/auth.js';

const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || !password) {
    res.status(400).json({ success: false, error: 'password required' });
    return;
  }
  if (!validatePassword(password)) {
    // Constant-time delay to mitigate timing attacks.
    setTimeout(() => {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }, 300);
    return;
  }
  setAuthCookie(res);
  res.status(200).json({ success: true });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true });
});

authRouter.get('/status', (req, res) => {
  res.status(200).json({
    authenticated: isAuthenticated(req),
    authEnabled: isAuthEnabled(),
  });
});

export default authRouter;
