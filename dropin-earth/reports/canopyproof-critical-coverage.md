# CanopyProof Critical Coverage

Status: PASS

Generated: 2026-08-11T11:35:32.326Z

| Module | Statements | Branches | Functions | Lines | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| satellite-state-machine | 99.92% | 98.18% | 100% | 99.92% | PASS |
| satellite-schema-root | 100% | 96.88% | 100% | 100% | PASS |
| satellite-deterministic-adapters | 100% | 100% | 100% | 100% | PASS |
| mobile-evidence-vault | 98.34% | 96.55% | 100% | 98.34% | PASS |
| mobile-sync-authority | 99.77% | 95.95% | 100% | 99.77% | PASS |
| security-authorization | 99.46% | 97.67% | 100% | 99.46% | PASS |
| kms-verify-only | 98.92% | 97.01% | 100% | 98.92% | PASS |
| metadata-extraction | 99.38% | 96.72% | 100% | 99.38% | PASS |
| effective-media-orchestration | 100% | 97.96% | 100% | 100% | PASS |
| audit-challenge-invariants | 99.81% | 96.62% | 100% | 99.81% | PASS |
| global-spatial-disclosure | 99.77% | 96.03% | 100% | 99.77% | PASS |

## File Results

| File | Statements | Branches | Functions | Lines | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `packages/dropin-protocol/src/canopy-state-machine.ts` | 99.92% | 98.18% | 100% | 99.92% | PASS |
| `packages/schemas/src/satellite-proof.schema.ts` | 100% | 97.37% | 100% | 100% | PASS |
| `services/satellite-ingestor/src/root-builder.ts` | 100% | 96.15% | 100% | 100% | PASS |
| `services/satellite-ingestor/src/adapters/audit-adapter.ts` | 100% | 100% | 100% | 100% | PASS |
| `services/satellite-ingestor/src/adapters/landsat-adapter.ts` | 100% | 100% | 100% | 100% | PASS |
| `services/satellite-ingestor/src/adapters/planet-adapter.ts` | 100% | 100% | 100% | 100% | PASS |
| `services/satellite-ingestor/src/adapters/sar-adapter.ts` | 100% | 100% | 100% | 100% | PASS |
| `services/satellite-ingestor/src/adapters/sentinel-adapter.ts` | 100% | 100% | 100% | 100% | PASS |
| `apps/web/src/lib/canopyproof-mobile-evidence-vault.ts` | 98.34% | 96.55% | 100% | 98.34% | PASS |
| `services/api/src/domain/canopyproof/mobile-evidence-sync-admission.ts` | 100% | 97.37% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/mobile-evidence-sync-authority.ts` | 99.69% | 95.45% | 100% | 99.69% | PASS |
| `services/api/src/domain/canopyproof/authorization-binding.ts` | 100% | 99.3% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/security-policy.ts` | 99.18% | 96.18% | 100% | 99.18% | PASS |
| `services/api/src/domain/canopyproof/aws-kms-managed-signature-verifier.ts` | 98.92% | 97.01% | 100% | 98.92% | PASS |
| `services/api/src/domain/canopyproof/fixed-http-metadata-extractor-provider.ts` | 100% | 98.08% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/metadata-extractor-adapter.ts` | 99.15% | 95.71% | 100% | 99.15% | PASS |
| `services/api/src/domain/canopyproof/evidence-metadata-orchestration-authority.ts` | 100% | 96.88% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/evidence-metadata-orchestrator.ts` | 100% | 100% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/challenge-cases.ts` | 100% | 98.85% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/database-audit-transparency.ts` | 100% | 98.18% | 100% | 100% | PASS |
| `services/api/src/domain/canopyproof/environmental-proof-challenge-authority.ts` | 99.69% | 95.59% | 100% | 99.69% | PASS |
| `services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-authority.ts` | 99.77% | 96.03% | 100% | 99.77% | PASS |
