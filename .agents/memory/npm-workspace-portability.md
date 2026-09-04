---
name: npm workspace portability
description: Why this dual npm/pnpm workspace intentionally does not commit package-lock.json.
---

Use npm-compatible dependency versions and workspace scripts, while retaining
the pnpm configuration required by Replit-managed artifact workflows.

**Why:** A clean `npm install` works, but npm 11 produces a workspace lockfile
that fails on the next install with `Invalid Version`. Committing that lockfile
would make fresh GitHub checkouts fail.

**How to apply:** Keep GitHub CI on `npm install` rather than `npm ci` until the
npm lockfile bug is confirmed fixed. Validate npm changes in a clean checkout
without pnpm-created `node_modules`, while also restarting Replit workflows to
confirm pnpm compatibility.