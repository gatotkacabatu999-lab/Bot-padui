# Dbrutals

Delivery operations dashboard, WhatsApp bot, and Expo driver application.

## Run & Operate

- `npm install` — install all npm workspace dependencies
- `npm run dev` — run the API (port 8080) and web dashboard (port 5173) locally
- `npm run typecheck` — full typecheck across all packages
- `npm run build` — typecheck + build the API and web dashboard
- `npm run codegen --workspace @workspace/api-spec` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `npm run push --workspace @workspace/db` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- npm-compatible workspaces (pnpm remains supported by Replit), Node.js 22+, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
