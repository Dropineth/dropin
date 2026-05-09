#!/usr/bin/env bash
# Deploy Dropin Earth / CanopyProof to Cloudflare with safe defaults.
#
# Default mode is dry-run. A live deployment requires:
#   DROPIN_DEPLOY_MODE=live
#   DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof.org
#   CLOUDFLARE_API_TOKEN=...
#   DROPIN_API_ORIGIN=https://...
#
# The script intentionally refuses to publish .next as a static Pages artifact.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

DOMAIN="${CANOPYPROOF_DOMAIN:-canopyproof.org}"
CF_PROJECT_NAME="${CF_PROJECT_NAME:-canopyproof}"
CF_BRANCH="${CF_BRANCH:-main}"
NEXT_APP_DIR="${DROPIN_NEXT_APP_DIR:-$PROJECT_DIR/apps/web}"
WORKER_NAME="${WORKER_NAME:-canopyproof-api-proxy}"
WORKER_ROUTE="${WORKER_ROUTE:-$DOMAIN/api/*}"
WORKER_ZONE_NAME="${WORKER_ZONE_NAME:-${CANOPYPROOF_ZONE_NAME:-canopyproof.org}}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-$PROJECT_DIR/infra/cloudflare/canopyproof-api-proxy.generated.wrangler.toml}"

DROPIN_DEPLOY_MODE="${DROPIN_DEPLOY_MODE:-dry-run}"
DROPIN_FRONTEND_DEPLOY_MODE="${DROPIN_FRONTEND_DEPLOY_MODE:-skip}"
DROPIN_CANOPYPROOF_MODE="${DROPIN_CANOPYPROOF_MODE:-production}"
DROPIN_ALLOWED_ORIGINS="${DROPIN_ALLOWED_ORIGINS:-https://$DOMAIN,https://www.$DOMAIN}"
DROPIN_ALLOW_ADMIN_PROXY="${DROPIN_ALLOW_ADMIN_PROXY:-false}"
DROPIN_SKIP_CI="${DROPIN_SKIP_CI:-false}"
DROPIN_RUN_ANCHOR_TEST="${DROPIN_RUN_ANCHOR_TEST:-false}"
DROPIN_RUN_SMOKE="${DROPIN_RUN_SMOKE:-true}"
DROPIN_SMOKE_BASE_URL="${DROPIN_SMOKE_BASE_URL:-https://$DOMAIN}"
DROPIN_NOTIFY_DEPLOYMENT="${DROPIN_NOTIFY_DEPLOYMENT:-true}"
DROPIN_NOTIFY_DRY_RUN="${DROPIN_NOTIFY_DRY_RUN:-false}"

SMOKE_WEB_STATUS="not-run"
SMOKE_READY_STATUS="not-run"
SMOKE_ADMIN_STATUS="not-run"
DEPLOY_COMPLETED="false"

log() {
  printf '%s\n' "==> $*"
}

warn() {
  printf '%s\n' "WARN: $*" >&2
}

fail() {
  printf '%s\n' "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

toml_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

json_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/}"
  printf '"%s"' "$value"
}

is_live() {
  [[ "$DROPIN_DEPLOY_MODE" == "live" ]]
}

validate_mode() {
  case "$DROPIN_DEPLOY_MODE" in
    dry-run|live) ;;
    *) fail "DROPIN_DEPLOY_MODE must be dry-run or live." ;;
  esac

  case "$DROPIN_FRONTEND_DEPLOY_MODE" in
    skip|auto|pages-static|opennext) ;;
    *) fail "DROPIN_FRONTEND_DEPLOY_MODE must be skip, auto, pages-static, or opennext." ;;
  esac

  case "$DROPIN_CANOPYPROOF_MODE" in
    testnet|production) ;;
    *) fail "DROPIN_CANOPYPROOF_MODE must be testnet or production." ;;
  esac
}

validate_live_guardrails() {
  if ! is_live; then
    warn "Dry-run mode. Set DROPIN_DEPLOY_MODE=live and DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=$DOMAIN to deploy."
    return
  fi

  [[ "${DROPIN_CLOUDFLARE_DEPLOY_CONFIRM:-}" == "$DOMAIN" ]] || fail "Live deploy requires DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=$DOMAIN."
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || fail "Live deploy requires CLOUDFLARE_API_TOKEN in the environment."
  [[ -n "${DROPIN_API_ORIGIN:-}" ]] || fail "Live deploy requires DROPIN_API_ORIGIN."

  if [[ "$DROPIN_API_ORIGIN" != https://* ]]; then
    fail "Live deploy requires DROPIN_API_ORIGIN to use HTTPS."
  fi

  if [[ "$DROPIN_API_ORIGIN" =~ ^https?://(localhost|127\.0\.0\.1|\[::1\]|::1)(/|:|$) ]]; then
    fail "Live deploy refuses localhost API origins."
  fi
}

run_or_print() {
  if is_live; then
    "$@"
  else
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
  fi
}

run_shell_or_print() {
  local command="$1"
  if is_live; then
    bash -lc "$command"
  else
    printf 'DRY-RUN: %s\n' "$command"
  fi
}

build_deployment_notification() {
  local status="$1"
  local exit_code="${2:-0}"
  local sha="${GITHUB_SHA:-$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown')}"
  local ref="${GITHUB_REF_NAME:-$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || printf 'unknown')}"
  local actor="${GITHUB_ACTOR:-local-operator}"
  local run_url="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/${GITHUB_ACTION:-}"

  cat <<EOF
CanopyProof Production Deployment
Status: $status
Exit code: $exit_code
Domain: $DOMAIN
Mode: $DROPIN_DEPLOY_MODE
Frontend mode: $DROPIN_FRONTEND_DEPLOY_MODE
Worker route: $WORKER_ROUTE
Admin proxy: $DROPIN_ALLOW_ADMIN_PROXY
Smoke: web=$SMOKE_WEB_STATUS ready=$SMOKE_READY_STATUS admin-block=$SMOKE_ADMIN_STATUS
Ref: $ref
Commit: $sha
Operator: $actor
Run: $run_url
EOF
}

notify_deployment() {
  local status="$1"
  local exit_code="${2:-0}"

  [[ "$DROPIN_NOTIFY_DEPLOYMENT" == "true" ]] || return 0

  if [[ -z "${SLACK_WEBHOOK_URL:-}" && ( -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ) ]]; then
    return 0
  fi

  if ! is_live && [[ "$DROPIN_NOTIFY_DRY_RUN" != "true" ]]; then
    warn "Deployment notification secrets are configured, but external notifications are skipped in dry-run mode."
    return 0
  fi

  require_command curl

  local message
  message="$(build_deployment_notification "$status" "$exit_code")"

  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local slack_payload
    slack_payload="{\"text\":$(json_string "$message")}"
    curl -fsS -X POST \
      -H 'content-type: application/json' \
      --data "$slack_payload" \
      "$SLACK_WEBHOOK_URL" >/dev/null || warn "Slack deployment notification failed."
  fi

  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -fsS -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
      --data-urlencode "text=$message" \
      --data-urlencode "disable_web_page_preview=true" >/dev/null || warn "Telegram deployment notification failed."
  fi
}

notify_on_exit() {
  local exit_code=$?
  trap - EXIT

  if [[ "$exit_code" -eq 0 && "$DEPLOY_COMPLETED" == "true" ]]; then
    notify_deployment "success" "$exit_code" || true
  elif [[ "$exit_code" -ne 0 ]]; then
    notify_deployment "failed" "$exit_code" || true
  fi

  exit "$exit_code"
}

write_wrangler_config() {
  [[ -n "${DROPIN_API_ORIGIN:-}" ]] || fail "DROPIN_API_ORIGIN is required to generate Worker config."
  mkdir -p "$(dirname "$WRANGLER_CONFIG")"

  cat >"$WRANGLER_CONFIG" <<EOF
name = "$(toml_escape "$WORKER_NAME")"
main = "canopyproof-api-proxy.ts"
compatibility_date = "2026-05-09"
workers_dev = false

routes = [
  { pattern = "$(toml_escape "$WORKER_ROUTE")", zone_name = "$(toml_escape "$WORKER_ZONE_NAME")" }
]

[vars]
DROPIN_CANONICAL_HOST = "$(toml_escape "$DOMAIN")"
DROPIN_CANOPYPROOF_MODE = "$(toml_escape "$DROPIN_CANOPYPROOF_MODE")"
DROPIN_ALLOWED_ORIGINS = "$(toml_escape "$DROPIN_ALLOWED_ORIGINS")"
DROPIN_ALLOW_ADMIN_PROXY = "$(toml_escape "$DROPIN_ALLOW_ADMIN_PROXY")"
DROPIN_API_ORIGIN = "$(toml_escape "$DROPIN_API_ORIGIN")"
EOF

  log "Generated Wrangler config: $WRANGLER_CONFIG"
}

run_preflight() {
  cd "$PROJECT_DIR"
  if [[ "$DROPIN_SKIP_CI" == "true" ]]; then
    warn "Skipping npm run ci because DROPIN_SKIP_CI=true."
  else
    log "Running release preflight: npm run ci"
    run_or_print npm run ci
  fi

  if [[ "$DROPIN_RUN_ANCHOR_TEST" == "true" ]]; then
    log "Running Anchor tests"
    run_or_print npm run anchor:test
  fi
}

detect_frontend_mode() {
  local static_dir="${DROPIN_PAGES_OUTPUT_DIR:-$NEXT_APP_DIR/out}"
  local next_dir="$NEXT_APP_DIR/.next"

  if [[ -d "$static_dir" && -f "$static_dir/index.html" ]]; then
    printf 'pages-static|%s\n' "$static_dir"
    return
  fi

  if [[ -d "$next_dir/server/app" || -d "$next_dir/server/pages" || -f "$next_dir/BUILD_ID" ]]; then
    printf 'opennext|%s\n' "$next_dir"
    return
  fi

  printf 'missing|%s\n' "$NEXT_APP_DIR"
}

deploy_frontend() {
  cd "$PROJECT_DIR"

  local frontend_mode="$DROPIN_FRONTEND_DEPLOY_MODE"
  local detected_artifact=""

  if [[ "$frontend_mode" == "auto" ]]; then
    local detection
    detection="$(detect_frontend_mode)"
    frontend_mode="${detection%%|*}"
    detected_artifact="${detection#*|}"
    log "Auto-detected frontend mode: $frontend_mode ($detected_artifact)"

    if [[ "$frontend_mode" == "missing" ]]; then
      fail "No static export or .next build artifact found under $NEXT_APP_DIR. Run npm run build or use Cloudflare Git/OpenNext integration."
    fi
  fi

  case "$frontend_mode" in
    skip)
      warn "Skipping frontend deploy. Use Cloudflare Git integration or set DROPIN_FRONTEND_DEPLOY_MODE=pages-static/opennext."
      ;;
    pages-static)
      local output_dir="${DROPIN_PAGES_OUTPUT_DIR:-${detected_artifact:-$NEXT_APP_DIR/out}}"

      if [[ "$output_dir" == *"/.next"* || "$(basename "$output_dir")" == ".next" ]]; then
        fail "Refusing to publish .next as a static Pages artifact. Use OpenNext or a verified static export directory."
      fi

      [[ -d "$output_dir" ]] || fail "Static Pages output directory does not exist: $output_dir"
      [[ -f "$output_dir/index.html" ]] || fail "Static Pages output must include index.html: $output_dir"

      log "Deploying static frontend to Cloudflare Pages project $CF_PROJECT_NAME"
      run_or_print npx wrangler pages deploy "$output_dir" --project-name "$CF_PROJECT_NAME" --branch "$CF_BRANCH"
      ;;
    opennext)
      local command="${DROPIN_OPENNEXT_DEPLOY_COMMAND:-}"
      [[ -n "$command" ]] || fail "DROPIN_OPENNEXT_DEPLOY_COMMAND is required for opennext mode. Example: npm run deploy:opennext"

      if [[ -n "$detected_artifact" ]]; then
        log "Dynamic Next.js artifact detected at $detected_artifact; deploying with configured OpenNext command"
      else
        log "Deploying dynamic Next.js app with configured OpenNext command"
      fi
      run_shell_or_print "$command"
      ;;
  esac
}

deploy_worker() {
  cd "$PROJECT_DIR"
  write_wrangler_config
  log "Deploying API Worker $WORKER_NAME to route $WORKER_ROUTE"
  run_or_print npx wrangler deploy --config "$WRANGLER_CONFIG"
}

smoke_test() {
  if [[ "$DROPIN_RUN_SMOKE" != "true" ]]; then
    warn "Skipping smoke tests because DROPIN_RUN_SMOKE is not true."
    return
  fi

  if ! is_live; then
    warn "Skipping live smoke tests in dry-run mode."
    return
  fi

  require_command curl

  SMOKE_WEB_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$DROPIN_SMOKE_BASE_URL")"
  SMOKE_READY_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$DROPIN_SMOKE_BASE_URL/api/ready")"
  SMOKE_ADMIN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$DROPIN_SMOKE_BASE_URL/api/admin/launch/readiness")"

  [[ "$SMOKE_WEB_STATUS" =~ ^[23] ]] || fail "Frontend smoke failed with HTTP $SMOKE_WEB_STATUS."
  [[ "$SMOKE_READY_STATUS" =~ ^2 ]] || fail "API ready smoke failed with HTTP $SMOKE_READY_STATUS."
  [[ "$SMOKE_ADMIN_STATUS" == "403" ]] || fail "Admin proxy smoke expected 403, got HTTP $SMOKE_ADMIN_STATUS."

  log "Smoke tests passed: web=$SMOKE_WEB_STATUS ready=$SMOKE_READY_STATUS admin-block=$SMOKE_ADMIN_STATUS"
}

main() {
  validate_mode
  validate_live_guardrails

  require_command npm
  require_command npx

  log "CanopyProof Cloudflare deploy"
  log "Project directory: $PROJECT_DIR"
  log "Next app directory: $NEXT_APP_DIR"
  log "Domain: $DOMAIN"
  log "Mode: $DROPIN_DEPLOY_MODE"
  log "Frontend deploy mode: $DROPIN_FRONTEND_DEPLOY_MODE"
  log "Worker route: $WORKER_ROUTE"
  log "Admin proxy enabled: $DROPIN_ALLOW_ADMIN_PROXY"

  run_preflight
  deploy_frontend
  deploy_worker
  smoke_test

  DEPLOY_COMPLETED="true"
  log "Deployment flow complete for $DOMAIN"
}

trap notify_on_exit EXIT
main "$@"
