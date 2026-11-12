# Provider-neutral preparation only. Digest and version metadata were checked
# against the official Docker Library record; container execution, scanning and
# release approval are still required for this candidate.
ARG NODE_IMAGE=node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
FROM ${NODE_IMAGE} AS builder
ARG NODE_IMAGE
ARG CHILD_BUILD_SHA
RUN case "$NODE_IMAGE" in *@sha256:*) ;; *) exit 1;; esac
RUN test "$(node --version)" = v22.23.5 && npm install --global npm@10.9.4
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
