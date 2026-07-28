import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { PrismaCanopyProofEnvironmentalProofLifecycleRepository } from
  "./environmental-proof-lifecycle-postgres.js";
import {
  CanopyProofPublicExplorerError,
} from "./public-explorer.js";
import {
  PrismaCanopyProofPublicTransparencyRepository,
  type CanopyProofPublicTransparencySourceResolver,
} from "./public-transparency-postgres.js";
import type { CanopyProofPublicTransparencyProjection } from "./public-transparency-authority.js";
import type { PrismaCanopyProofTrustRegistryService } from "./trust-registry.js";

type ExplorerTransaction = Prisma.TransactionClient;

export type CanopyProofPublicExplorerRepositoryStatus = {
  readonly service: "canopyproof-public-explorer-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly anonymousMutationAllowed: false;
  readonly locatorAppendOnly: true;
  readonly tenantContextRequired: true;
  readonly bypassRlsRequired: false;
  readonly currentSourceReResolved: true;
};

export type CanopyProofPublicExplorerHistoryResult = {
  readonly projections: readonly CanopyProofPublicTransparencyProjection[];
  readonly nextCursor: string | null;
};

const publicProjectIdSchema = z.string().regex(/^cp_public_project_[a-f0-9]{24}$/);
const publicationIdSchema = z.string().regex(/^cp_public_transparency_[a-f0-9]{24}$/);
const timestampSchema = z.string().datetime({ offset: true });
const historyLimitSchema = z.number().int().min(1).max(50);
const locatorRowSchema = z.object({
  publication_id: publicationIdSchema,
  public_project_id: publicProjectIdSchema,
  public_organization_id: z.string().regex(/^cp_public_org_[a-f0-9]{24}$/),
  organization_id: z.string().min(1).max(256),
  publication_root: z.string().regex(/^[a-f0-9]{64}$/),
  published_at_value: z.coerce.date(),
  audit_event_root: z.string().regex(/^[a-f0-9]{64}$/),
});

type LocatorRow = z.output<typeof locatorRowSchema>;

export class PrismaCanopyProofPublicExplorerRepository {
  private readonly transparencyRepository: PrismaCanopyProofPublicTransparencyRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly resolveCurrentSource: CanopyProofPublicTransparencySourceResolver,
  ) {
    this.transparencyRepository = new PrismaCanopyProofPublicTransparencyRepository(prisma);
  }

  getStatus(): CanopyProofPublicExplorerRepositoryStatus {
    return {
      service: "canopyproof-public-explorer-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      anonymousMutationAllowed: false,
      locatorAppendOnly: true,
      tenantContextRequired: true,
      bypassRlsRequired: false,
      currentSourceReResolved: true,
    };
  }

  async getProject(publicProjectIdInput: string, evaluatedAtInput: string) {
    const publicProjectId = parsePublicProjectId(publicProjectIdInput);
    const evaluatedAt = parseTimestamp(evaluatedAtInput);
    return this.read(async (transaction) => {
      const locator = await requireLatestProjectLocator(transaction, publicProjectId);
      await setTenantContext(transaction, locator.organization_id);
      return this.projectAndVerifyLocator(transaction, locator, evaluatedAt);
    });
  }

  async getProjectHistory(
    publicProjectIdInput: string,
    input: Readonly<{ evaluatedAt: string; limit?: number; cursor?: string | null }>,
  ): Promise<CanopyProofPublicExplorerHistoryResult> {
    const publicProjectId = parsePublicProjectId(publicProjectIdInput);
    const evaluatedAt = parseTimestamp(input.evaluatedAt);
    const limit = historyLimitSchema.parse(input.limit ?? 20);
    const cursor = input.cursor ? publicationIdSchema.parse(input.cursor) : null;
    return this.read(async (transaction) => {
      const locators = await listProjectLocators(transaction, publicProjectId, limit + 1, cursor);
      if (locators.length === 0 && cursor) return { projections: [], nextCursor: null };
      if (locators.length === 0) throw notFound();
      const page = locators.slice(0, limit);
      const organizationId = page[0]!.organization_id;
      if (page.some((locator) => locator.organization_id !== organizationId)) {
        throw sourceInvalid();
      }
      await setTenantContext(transaction, organizationId);
      const projections: CanopyProofPublicTransparencyProjection[] = [];
      for (const locator of page) {
        projections.push(await this.projectAndVerifyLocator(transaction, locator, evaluatedAt));
      }
      return {
        projections,
        nextCursor: locators.length > limit ? page.at(-1)!.publication_id : null,
      };
    });
  }

  async verifyPublication(publicationIdInput: string, evaluatedAtInput: string) {
    const publicationId = publicationIdSchema.parse(publicationIdInput);
    const evaluatedAt = parseTimestamp(evaluatedAtInput);
    return this.read(async (transaction) => {
      const locator = await requirePublicationLocator(transaction, publicationId);
      await setTenantContext(transaction, locator.organization_id);
      return this.projectAndVerifyLocator(transaction, locator, evaluatedAt);
    });
  }

  private async projectAndVerifyLocator(
    transaction: ExplorerTransaction,
    locator: LocatorRow,
    evaluatedAt: string,
  ) {
    const projection = await this.transparencyRepository.projectPublicationInTransaction(
      transaction,
      locator.organization_id,
      locator.publication_id,
      evaluatedAt,
      this.resolveCurrentSource,
    );
    if (
      projection.publicProjectId !== locator.public_project_id ||
      projection.publicOrganizationId !== locator.public_organization_id ||
      projection.publicationId !== locator.publication_id ||
      projection.publicationRoot !== locator.publication_root
    ) {
      throw sourceInvalid();
    }
    return projection;
  }

  private async read<T>(operation: (transaction: ExplorerTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    } catch (error) {
      if (error instanceof CanopyProofPublicExplorerError) throw error;
      if (error instanceof z.ZodError) {
        throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID", {
          cause: error,
        });
      }
      throw sourceInvalid(error);
    }
  }
}

export function createCanopyProofPublicExplorerSourceResolver(input: Readonly<{
  trustRegistry: PrismaCanopyProofTrustRegistryService;
  lifecycleRepository: PrismaCanopyProofEnvironmentalProofLifecycleRepository;
}>): CanopyProofPublicTransparencySourceResolver {
  return async (query, transaction) => {
    const record = await input.trustRegistry.getEnvironmentalProofRecordInTransaction(
      transaction,
      query.recordId,
      query.organizationId,
    );
    if (record.projectId !== query.projectId) throw sourceInvalid();
    const governedRecordProjection = await input.trustRegistry.getEnvironmentalProofRecordStatusInTransaction(
      transaction,
      query.recordId,
      query.organizationId,
    );
    const lifecycleBinding = await input.lifecycleRepository.getLifecycleBindingInTransaction(
      transaction,
      query.organizationId,
      query.lifecycleBindingId,
    );
    const signatureReceipt = await input.lifecycleRepository.getSignatureReceiptInTransaction(
      transaction,
      query.organizationId,
      query.signatureReceiptId,
    );
    const lifecycleProjection = await input.lifecycleRepository.projectLifecycleInTransaction(
      transaction,
      query.organizationId,
      query.lifecycleBindingId,
      query.evaluatedAt,
    );
    return {
      record,
      governedRecordProjection,
      lifecycleBinding,
      lifecycleProjection,
      signatureReceipt,
    };
  };
}

async function requireLatestProjectLocator(
  transaction: ExplorerTransaction,
  publicProjectId: string,
): Promise<LocatorRow> {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT publication_id, public_project_id, public_organization_id, organization_id,
      publication_root, published_at AS published_at_value, audit_event_root
    FROM transparency.public_transparency_query_catalog
    WHERE public_project_id = ${publicProjectId}
    ORDER BY published_at DESC, publication_id DESC
    LIMIT 1
  `);
  if (rows.length !== 1) throw notFound();
  return locatorRowSchema.parse(rows[0]);
}

async function requirePublicationLocator(
  transaction: ExplorerTransaction,
  publicationId: string,
): Promise<LocatorRow> {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT publication_id, public_project_id, public_organization_id, organization_id,
      publication_root, published_at AS published_at_value, audit_event_root
    FROM transparency.public_transparency_query_catalog
    WHERE publication_id = ${publicationId}
    LIMIT 1
  `);
  if (rows.length !== 1) throw notFound();
  return locatorRowSchema.parse(rows[0]);
}

async function listProjectLocators(
  transaction: ExplorerTransaction,
  publicProjectId: string,
  limit: number,
  cursor: string | null,
): Promise<LocatorRow[]> {
  if (cursor) {
    const cursorRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT publication_id, public_project_id, public_organization_id, organization_id,
        publication_root, published_at AS published_at_value, audit_event_root
      FROM transparency.public_transparency_query_catalog
      WHERE publication_id = ${cursor} AND public_project_id = ${publicProjectId}
      LIMIT 1
    `);
    if (cursorRows.length !== 1) throw notFound();
    const cursorRow = locatorRowSchema.parse(cursorRows[0]);
    const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT publication_id, public_project_id, public_organization_id, organization_id,
        publication_root, published_at AS published_at_value, audit_event_root
      FROM transparency.public_transparency_query_catalog
      WHERE public_project_id = ${publicProjectId}
        AND (published_at, publication_id) < (${cursorRow.published_at_value}, ${cursorRow.publication_id})
      ORDER BY published_at DESC, publication_id DESC
      LIMIT ${limit}
    `);
    return rows.map((row) => locatorRowSchema.parse(row));
  }
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT publication_id, public_project_id, public_organization_id, organization_id,
      publication_root, published_at AS published_at_value, audit_event_root
    FROM transparency.public_transparency_query_catalog
    WHERE public_project_id = ${publicProjectId}
    ORDER BY published_at DESC, publication_id DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => locatorRowSchema.parse(row));
}

async function setTenantContext(transaction: ExplorerTransaction, organizationIdInput: string) {
  const organizationId = z.string().min(1).max(256).parse(organizationIdInput);
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config('app.organization_id', ${organizationId}, true)
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT set_config('app.actor_id', 'public-explorer-read', true)
  `);
}

function parsePublicProjectId(value: string) {
  try {
    return publicProjectIdSchema.parse(value);
  } catch (error) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID", {
      cause: error,
    });
  }
}

function parseTimestamp(value: string) {
  try {
    const timestamp = timestampSchema.parse(value);
    const date = new Date(timestamp);
    if (date.toISOString() !== timestamp) throw new Error("timestamp is not canonical");
    return timestamp;
  } catch (error) {
    throw new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID", {
      cause: error,
    });
  }
}

function notFound() {
  return new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND");
}

function sourceInvalid(cause?: unknown) {
  return new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID", {
    ...(cause === undefined ? {} : { cause }),
  });
}
