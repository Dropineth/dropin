import { z } from "zod";
import {
  minimizeCanopyProofMalwareScanReceipt,
  type CanopyProofDurableMalwareScanReceipt,
  type CanopyProofEvidenceMediaProviderVerificationBundle,
  type CanopyProofEvidenceMediaScannerVerificationBundle,
} from "./evidence-media-adapter-authority.js";
import type {
  CanopyProofEvidenceMediaObjectFact,
  CanopyProofEvidenceMediaUploadIntentFact,
} from "./evidence-media-authority.js";
import type { CanopyProofMalwareScannerAdapter } from "./malware-scanner-adapter.js";
import type {
  CanopyProofAdapterVerifiedStoredObjectReceipt,
  CanopyProofObjectStorageAdapter,
} from "./object-storage-adapter.js";

export type CanopyProofEvidenceMediaAdapterOrchestratorStatus = {
  readonly service: "canopyproof-evidence-media-adapter-orchestrator";
  readonly routeMounted: false;
  readonly productionActivated: false;
  readonly externalCallsInsideDatabaseTransaction: false;
  readonly providerReceiptRequired: true;
  readonly scannerSignatureRequired: true;
  readonly rawSignaturePersisted: false;
  readonly uploadGrantPersisted: false;
  readonly finalProofAuthority: false;
};

export interface CanopyProofEvidenceMediaAdapterDurablePort {
  getEvidenceMediaUploadIntent(
    intentId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceMediaUploadIntentFact>;

  getEvidenceMediaObject(
    objectId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceMediaObjectFact>;

  findEvidenceMediaProviderVerificationForIntent(
    intentId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceMediaProviderVerificationBundle | undefined>;

  findEvidenceMediaScannerVerificationForObject(
    objectId: string,
    organizationId: string,
  ): Promise<CanopyProofEvidenceMediaScannerVerificationBundle | undefined>;

  commitEvidenceMediaProviderVerification(
    receipt: CanopyProofAdapterVerifiedStoredObjectReceipt,
    organizationId: string,
    agentId: string,
    idempotencyKey: string,
  ): Promise<CanopyProofEvidenceMediaProviderVerificationBundle>;

  commitEvidenceMediaScannerVerification(
    receipt: CanopyProofDurableMalwareScanReceipt,
    organizationId: string,
    agentId: string,
    idempotencyKey: string,
  ): Promise<CanopyProofEvidenceMediaScannerVerificationBundle>;
}

const commandSchema = z
  .object({
    organizationId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    agentId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    idempotencyKey: z.string().trim().min(8).max(256),
    correlationId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    now: z.string().datetime(),
  })
  .strict();

const providerCommandSchema = commandSchema.extend({
  intentId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
});

const scannerCommandSchema = commandSchema.extend({
  objectId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
});

export class CanopyProofEvidenceMediaAdapterOrchestrator {
  constructor(
    private readonly durable: CanopyProofEvidenceMediaAdapterDurablePort,
    private readonly objectStorage: CanopyProofObjectStorageAdapter,
    private readonly malwareScanner: CanopyProofMalwareScannerAdapter,
  ) {}

  getStatus(): CanopyProofEvidenceMediaAdapterOrchestratorStatus {
    return {
      service: "canopyproof-evidence-media-adapter-orchestrator",
      routeMounted: false,
      productionActivated: false,
      externalCallsInsideDatabaseTransaction: false,
      providerReceiptRequired: true,
      scannerSignatureRequired: true,
      rawSignaturePersisted: false,
      uploadGrantPersisted: false,
      finalProofAuthority: false,
    };
  }

  async verifyStoredObject(input: Readonly<z.input<typeof providerCommandSchema>>) {
    const command = providerCommandSchema.parse(input);
    const existing = await this.durable.findEvidenceMediaProviderVerificationForIntent(
      command.intentId,
      command.organizationId,
    );
    if (existing) return existing;

    const intent = await this.durable.getEvidenceMediaUploadIntent(
      command.intentId,
      command.organizationId,
    );
    const receipt = await this.objectStorage.verifyStoredObject(intent, {
      now: canonicalInstant(command.now),
      correlationId: command.correlationId,
    });
    return this.durable.commitEvidenceMediaProviderVerification(
      receipt,
      command.organizationId,
      command.agentId,
      command.idempotencyKey,
    );
  }

  async scanStoredObject(input: Readonly<z.input<typeof scannerCommandSchema>>) {
    const command = scannerCommandSchema.parse(input);
    const existing = await this.durable.findEvidenceMediaScannerVerificationForObject(
      command.objectId,
      command.organizationId,
    );
    if (existing) return existing;

    const object = await this.durable.getEvidenceMediaObject(
      command.objectId,
      command.organizationId,
    );
    const providerVerification = await this.durable.findEvidenceMediaProviderVerificationForIntent(
      object.intentId,
      command.organizationId,
    );
    if (
      !providerVerification ||
      providerVerification.object.id !== object.id ||
      providerVerification.object.objectRoot !== object.objectRoot ||
      providerVerification.verification.objectId !== object.id ||
      providerVerification.verification.objectRoot !== object.objectRoot
    ) {
      throw new Error("CANOPYPROOF_E2A_PROVIDER_VERIFICATION_REQUIRED");
    }
    const verifiedReceipt = await this.malwareScanner.scanObject(object, {
      now: canonicalInstant(command.now),
      correlationId: command.correlationId,
    });
    return this.durable.commitEvidenceMediaScannerVerification(
      minimizeCanopyProofMalwareScanReceipt(verifiedReceipt),
      command.organizationId,
      command.agentId,
      command.idempotencyKey,
    );
  }
}

function canonicalInstant(value: string) {
  const canonical = new Date(value).toISOString();
  if (canonical !== value) {
    throw new Error("CANOPYPROOF_MEDIA_ADAPTER_NON_CANONICAL_TIMESTAMP");
  }
  return canonical;
}
