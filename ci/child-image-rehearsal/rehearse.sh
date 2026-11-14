#!/usr/bin/env bash
set -euo pipefail
if [[ $# != 3 ]]; then
  printf '%s\n' 'Usage: bash rehearse.sh ABSOLUTE_CANDIDATE_REPO ABSOLUTE_ROLLBACK_REPO ABSOLUTE_NEW_OUTPUT_DIR' >&2
  exit 2
fi
exec node "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/rehearse.mjs" "$1" "$2" "$3"
