# Provider-neutral preparation only. Supply a reviewed immutable Node 22.23.4
# image digest at build time; no guessed digest or registry credential is supplied.
ARG NODE_IMAGE
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
