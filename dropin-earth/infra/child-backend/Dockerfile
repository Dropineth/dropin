# Provider-neutral preparation only. Official image digest was read back and
# its Node version verified; release approval and image scanning remain separate.
ARG NODE_IMAGE=node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
FROM ${NODE_IMAGE} AS builder
ARG NODE_IMAGE
ARG CHILD_BUILD_SHA
RUN case "$NODE_IMAGE" in *@sha256:*) ;; *) exit 1;; esac
RUN test "$(node --version)" = v22.23.4 && npm install --global npm@10.9.4
WORKDIR /build
COPY . .
RUN npm ci --ignore-scripts --include=optional
RUN CHILD_BUILD_SHA="$CHILD_BUILD_SHA" npm run build:child-backend

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=10000 CHILD_BACKEND_MODE=disabled
COPY --from=builder --chown=node:node /build/dist/child-backend/ /app/
USER node
EXPOSE 10000
STOPSIGNAL SIGTERM
# Migrations use a separately approved owner process; never run on API startup.
CMD ["node", "server.mjs"]
