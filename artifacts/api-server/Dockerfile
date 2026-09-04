# Build context is the monorepo root (see /railway.json -> build.dockerfilePath),
# because this workspace package depends on sibling packages under /lib/*.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install full workspace so pnpm can link @workspace/* packages ----
# (pnpm's frozen-lockfile check needs every workspace member's package.json
# present, so we copy the whole repo rather than cherry-picking files.)
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile --filter @workspace/api-server...

# ---- build: bundle to a single self-contained dist/index.mjs ----
FROM deps AS build
RUN pnpm --filter @workspace/api-server build


# ---- runtime: esbuild bundles all deps, so the final image needs no node_modules ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/artifacts/api-server/dist ./dist
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
