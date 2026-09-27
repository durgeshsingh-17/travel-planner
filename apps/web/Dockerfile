# syntax=docker/dockerfile:1
# Build from the repository root:  docker build -f apps/web/Dockerfile -t travel-web .

FROM node:22-bookworm-slim AS build
RUN npm install -g npm@11
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace web --include-workspace-root
COPY apps/web apps/web
RUN npm run build --workspace web

# The SSR bundle only needs Node built-ins, so the runtime carries just the build output.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /repo/apps/web/dist/web ./dist/web
ENV NODE_ENV=production PORT=4000
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/web/server/server.mjs"]
