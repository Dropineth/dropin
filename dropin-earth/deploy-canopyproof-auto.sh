#!/usr/bin/env bash
# Production-only compatibility entrypoint for CanopyProof Cloudflare deployment.
#
# The production launch path is intentionally boring: one public domain, one API Worker
# route, and the same fail-closed deploy script used by CI. Testnet can still exist as a
# separately configured deployment, but this entrypoint no longer fans out across environments.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export CANOPYPROOF_DOMAIN="${CANOPYPROOF_DOMAIN:-canopyproof.org}"
export CANOPYPROOF_ZONE_NAME="${CANOPYPROOF_ZONE_NAME:-canopyproof.org}"
export CF_PROJECT_NAME="${CF_PROJECT_NAME:-canopyproof}"
export WORKER_NAME="${WORKER_NAME:-canopyproof-api-proxy}"
export WORKER_ROUTE="${WORKER_ROUTE:-canopyproof.org/api/*}"
export WORKER_ZONE_NAME="${WORKER_ZONE_NAME:-canopyproof.org}"
export DROPIN_CANOPYPROOF_MODE="${DROPIN_CANOPYPROOF_MODE:-production}"
export DROPIN_ALLOWED_ORIGINS="${DROPIN_ALLOWED_ORIGINS:-https://canopyproof.org,https://www.canopyproof.org}"
export DROPIN_ALLOW_ADMIN_PROXY="${DROPIN_ALLOW_ADMIN_PROXY:-false}"
export DROPIN_SMOKE_BASE_URL="${DROPIN_SMOKE_BASE_URL:-https://canopyproof.org}"

exec "$SCRIPT_DIR/scripts/deploy-canopyproof.sh" "$@"
