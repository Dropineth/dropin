import {
  auditAttestationInputSchema,
  type AuditAttestation,
  type AuditAttestationInput,
} from "@dropin/schemas/satellite-proof";
import { buildAuditAttestation } from "../root-builder.js";

export class DeterministicAuditAdapter {
  readonly adapterId = "deterministic-satellite-audit-adapter/v1";
  readonly mockOnly = true;

  ingest(input: AuditAttestationInput): AuditAttestation {
    return buildAuditAttestation(auditAttestationInputSchema.parse(input));
  }
}
