import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofDeviceAttestationAdapter } from "./device-attestation-adapter.js";
import {
  minimizeCanopyProofDeviceAttestationReceipt,
  type CanopyProofDeviceAttestationVerificationFact,
  type CanopyProofDurableDeviceAttestationReceipt,
  type CanopyProofEffectiveDeviceAttestationProjection,
} from "./evidence-device-attestation-adapter-authority.js";
import type { CanopyProofEvidenceDeviceAttestationFact } from "./evidence-custody-authority.js";

export interface CanopyProofDeviceAttestationAdapterDurablePort {
  getDeviceAttestation(
    attestationId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceDeviceAttestationFact>;

  findVerification(
    attestationId: string,
    organizationId: string,
    challengeHash: string,
  ): Promise<CanopyProofDeviceAttestationVerificationFact | undefined>;

  commitVerification(input: Readonly<{
    receipt: CanopyProofDurableDeviceAttestationReceipt;
    organizationId: string;
    verifierAgentId: string;
  }>): Promise<CanopyProofDeviceAttestationVerificationFact>;

  getEffectiveProjection(
    attestationId: string,
    organizationId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEffectiveDeviceAttestationProjection>;
}

const commandSchema = z
  .object({
    organizationId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    attestationId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    verifierAgentId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    idempotencyKey: z.string().trim().min(8).max(256),
    requestedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export class CanopyProofDeviceAttestationAdapterOrchestrator {
  constructor(
    private readonly durable: CanopyProofDeviceAttestationAdapterDurablePort,
    private readonly adapter: CanopyProofDeviceAttestationAdapter,
  ) {}

  getStatus() {
    return {
      service: "canopyproof-device-attestation-adapter-orchestrator" as const,
      routeMounted: false as const,
      productionActivated: false as const,
      externalCallsInsideDatabaseTransaction: false as const,
      challengeCommitmentOnly: true as const,
      durableOnlineNonceStoreImplemented: false as const,
      rawSignaturePersisted: false as const,
      baseAttestationMutated: false as const,
      finalProofAuthority: false as const,
    };
  }

  async verifyAttestation(input: Readonly<z.input<typeof commandSchema>>) {
    const command = commandSchema.parse(input);
    const requestedAt = canonicalInstant(command.requestedAt);
    const attestation = await this.durable.getDeviceAttestation(
      command.attestationId,
      command.organizationId,
    );
    const idempotencyKeyHash = hashJson({
      kind: "canopyproof-device-attestation-idempotency-key-v1",
      organizationId: command.organizationId,
      attestationId: command.attestationId,
      verifierAgentId: command.verifierAgentId,
      operation: "evidence.device-attestation.verify",
      value: command.idempotencyKey,
    });
    const challengeHash = hashJson({
      kind: "canopyproof-device-attestation-challenge-commitment-v1",
      organizationId: command.organizationId,
      attestationId: attestation.id,
      attestationRoot: attestation.attestationRoot,
      idempotencyKeyHash,
      requestedAt,
    });
    const existing = await this.durable.findVerification(
      command.attestationId,
      command.organizationId,
      challengeHash,
    );
    if (existing) {
      return {
        verification: existing,
        projection: await this.durable.getEffectiveProjection(
          command.attestationId,
          command.organizationId,
          requestedAt,
        ),
      };
    }
    const verified = await this.adapter.verifyAttestation(attestation, {
      now: requestedAt,
      correlationId: `e1a-${idempotencyKeyHash.slice(0, 32)}`,
      challengeHash,
    });
    const verification = await this.durable.commitVerification({
      receipt: minimizeCanopyProofDeviceAttestationReceipt(verified),
      organizationId: command.organizationId,
      verifierAgentId: command.verifierAgentId,
    });
    return {
      verification,
      projection: await this.durable.getEffectiveProjection(
        command.attestationId,
        command.organizationId,
        requestedAt,
      ),
    };
  }
}

function canonicalInstant(value: string) {
  const canonical = new Date(value).toISOString();
  if (canonical !== value) throw new Error("CANOPYPROOF_E1A_TIMESTAMP_INVALID");
  return canonical;
}
