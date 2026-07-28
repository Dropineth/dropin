import { z } from "zod";
import {
  minimizeCanopyProofMetadataExtractionReceipt,
  type CanopyProofDurableMetadataExtractionReceipt,
  type CanopyProofEvidenceMetadataExtractionVerificationFact,
  type CanopyProofEffectiveMetadataExtractionProjection,
} from "./evidence-metadata-adapter-authority.js";
import type {
  CanopyProofEvidenceMetadataExtractionAuthority,
  CanopyProofEvidenceMetadataExtractionFact,
} from "./evidence-metadata-retention-authority.js";
import type { CanopyProofMetadataExtractionRequestFact } from
  "./evidence-metadata-orchestration-authority.js";
import type {
  CanopyProofMetadataExtractorAdapter,
  CanopyProofMetadataExtractorPolicyDescriptor,
} from "./metadata-extractor-adapter.js";

export type CanopyProofMetadataExtractionResult = Readonly<{
  request: CanopyProofMetadataExtractionRequestFact;
  extraction: CanopyProofEvidenceMetadataExtractionFact;
  verification: CanopyProofEvidenceMetadataExtractionVerificationFact;
  projection: CanopyProofEffectiveMetadataExtractionProjection;
}>;

export type CanopyProofPreparedMetadataExtraction = Readonly<{
  request: CanopyProofMetadataExtractionRequestFact;
  authority: CanopyProofEvidenceMetadataExtractionAuthority;
}>;

export interface CanopyProofMetadataExtractionOrchestrationDurablePort {
  prepareMetadataExtractionRequest(input: Readonly<{
    organizationId: string;
    objectId: string;
    requesterAgentId: string;
    idempotencyKey: string;
    requestedAt: string;
    policy: CanopyProofMetadataExtractorPolicyDescriptor;
  }>): Promise<CanopyProofPreparedMetadataExtraction>;

  findMetadataExtractionResult(
    prepared: CanopyProofPreparedMetadataExtraction,
  ): Promise<CanopyProofMetadataExtractionResult | undefined>;

  assertMetadataExtractionDispatchAuthorized(
    prepared: CanopyProofPreparedMetadataExtraction,
    dispatchedAt: string,
  ): Promise<void>;

  commitMetadataExtractionResult(input: Readonly<{
    prepared: CanopyProofPreparedMetadataExtraction;
    receipt: CanopyProofDurableMetadataExtractionReceipt;
    verifierAgentId: string;
  }>): Promise<CanopyProofMetadataExtractionResult>;
}

export type CanopyProofMetadataExtractionOrchestratorStatus = {
  readonly service: "canopyproof-metadata-extraction-orchestrator";
  readonly routeMounted: false;
  readonly productionActivated: false;
  readonly requestCommittedBeforeExternalIo: true;
  readonly currentAuthorityRecheckedBeforeExternalIo: true;
  readonly externalCallsInsideDatabaseTransaction: false;
  readonly rawSignaturePersisted: false;
  readonly exactlyOnceExternalExecutionClaimed: false;
  readonly finalProofAuthority: false;
};

const commandSchema = z
  .object({
    organizationId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    objectId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    requesterAgentId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    verifierAgentId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/),
    idempotencyKey: z.string().trim().min(8).max(256),
    requestedAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => new Date(value).toISOString() === value),
  })
  .strict();

export class CanopyProofMetadataExtractionOrchestrator {
  constructor(
    private readonly durable: CanopyProofMetadataExtractionOrchestrationDurablePort,
    private readonly extractor: CanopyProofMetadataExtractorAdapter,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  getStatus(): CanopyProofMetadataExtractionOrchestratorStatus {
    return {
      service: "canopyproof-metadata-extraction-orchestrator",
      routeMounted: false,
      productionActivated: false,
      requestCommittedBeforeExternalIo: true,
      currentAuthorityRecheckedBeforeExternalIo: true,
      externalCallsInsideDatabaseTransaction: false,
      rawSignaturePersisted: false,
      exactlyOnceExternalExecutionClaimed: false,
      finalProofAuthority: false,
    };
  }

  async extractMetadata(input: Readonly<z.input<typeof commandSchema>>) {
    const command = commandSchema.parse(input);
    const policy = this.extractor.getPolicyDescriptor();
    const prepared = await this.durable.prepareMetadataExtractionRequest({
      organizationId: command.organizationId,
      objectId: command.objectId,
      requesterAgentId: command.requesterAgentId,
      idempotencyKey: command.idempotencyKey,
      requestedAt: command.requestedAt,
      policy,
    });
    const completed = await this.durable.findMetadataExtractionResult(prepared);
    if (completed) return completed;

    const dispatchedAt = commandSchema.shape.requestedAt.parse(this.clock());
    await this.durable.assertMetadataExtractionDispatchAuthorized(prepared, dispatchedAt);

    const verifiedReceipt = await this.extractor.extractMetadata(prepared.authority, {
      now: prepared.request.requestedAt,
      correlationId: prepared.request.id,
    });
    return this.durable.commitMetadataExtractionResult({
      prepared,
      receipt: minimizeCanopyProofMetadataExtractionReceipt(verifiedReceipt),
      verifierAgentId: command.verifierAgentId,
    });
  }
}
