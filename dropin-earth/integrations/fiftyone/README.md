# CanopyProof FiftyOne Integration

Status: non-production foundation only. Deployment is prohibited until the
approval gate in `docs/RFC_VISUAL_EVIDENCE_INTELLIGENCE.md` opens.

This directory contains the disposable review-workbench boundary. FiftyOne is
never a source of truth. The authoritative queue, candidate, decision, field,
license, provenance, and audit records remain in CanopyProof.

## Components

- `adapter/manifest.ts`: creates and verifies short-lived, signed, queue-bound
  manifests without storage or database credentials.
- `plugins/canopyproof-review/`: an allowlisted plugin that can call only the
  local identity-aware review proxy.
- `tests/`: isolated plugin client tests that do not require FiftyOne or real
  media.
- `docker/`: deployment requirements. No unpinned base image is supplied.

The plugin cannot verify evidence, issue a certificate, publish an ESG metric,
release funding, modify raw evidence, change governance, or access secrets.

No real institutional dataset, VineLiDAR bytes, Ariel Scans imagery, private
location, credential, or production endpoint belongs in this directory.
