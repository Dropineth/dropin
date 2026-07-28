import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import pino from "pino";
import { z } from "zod";
import {
  canopyProofGlobalCommandCenterApiVersion,
  canopyProofGlobalCommandCenterResponseSchema,
} from "@dropin/schemas/canopyproof-global-command-center";
import { CanopyProofAgentFrameworkService } from "./domain/canopyproof/agents.js";
import {
  CanopyProofAuditAttestationService,
  canopyProofAuditAttestationDecisions,
  canopyProofAuditAttestationScopes,
  type CanopyProofAuditAttestationDecision,
  type CanopyProofAuditAttestationScope,
} from "./domain/canopyproof/audit-attestations.js";
import {
  CanopyProofAuditExportManifestService,
  canopyProofAuditExportClassifications,
  canopyProofAuditExportScopes,
  type CanopyProofAuditExportClassification,
  type CanopyProofAuditExportScope,
} from "./domain/canopyproof/audit-export-manifests.js";
import {
  canopyProofDatabaseAuditTransparencyStatus,
  verifyCanopyProofDatabaseAuditStream,
} from "./domain/canopyproof/database-audit-transparency.js";
import {
  authenticateCanopyProofRequest,
  canopyProofAuthenticationStatus,
  CanopyProofAuthenticationError,
  requireCanopyProofAuthenticatedPrincipal,
  type CanopyProofAuthenticatedPrincipal,
} from "./domain/canopyproof/identity-authentication.js";
import {
  assertCanopyProofAuthorizationAssurance,
  bindCanopyProofAuthorizationPrincipal,
  canopyProofAuthorizationBindingStatus,
  CanopyProofAuthorizationError,
  PrismaCanopyProofAuthorizationRegistry,
  requireCanopyProofAuthorizationBinding,
  type CanopyProofAuthorizationAssurance,
  type CanopyProofAuthorizationBinding,
} from "./domain/canopyproof/authorization-binding.js";
import {
  canopyProofTrustRegistryConfigurationStatus,
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "./domain/canopyproof/trust-registry.js";
import {
  CanopyProofEarlyWarningService,
  type CanopyProofRiskAfterActionReviewReviewerRole,
  type CanopyProofRiskResponseClosureReviewerRole,
} from "./domain/canopyproof/early-warning.js";
import {
  CanopyProofDataQualityService,
  canopyProofDataQualityDecisions,
  canopyProofDataQualitySubjectTypes,
  type CanopyProofDataQualityDecision,
  type CanopyProofDataQualitySubjectType,
} from "./domain/canopyproof/data-quality.js";
import {
  CanopyProofChallengeCaseService,
  canopyProofChallengeCaseReasons,
  canopyProofChallengeCaseStatuses,
  canopyProofChallengeCaseSubjectTypes,
  type CanopyProofChallengeCaseReason,
  type CanopyProofChallengeCaseStatus,
  type CanopyProofChallengeCaseSubjectType,
} from "./domain/canopyproof/challenge-cases.js";
import {
  CanopyProofCertificateTransparencyService,
  canopyProofCertificateTransparencyStatuses,
  type CanopyProofCertificateTransparencyStatus,
} from "./domain/canopyproof/certificate-transparency.js";
import { CanopyProofEvidenceNetworkService } from "./domain/canopyproof/evidence-network.js";
import { CanopyProofFundingTransparencyService } from "./domain/canopyproof/funding-transparency.js";
import { buildCanopyProofGlobalCommandCenter } from "./domain/canopyproof/global-command-center.js";
import {
  CanopyProofGlobalCommandCenterError,
  PrismaCanopyProofGlobalCommandCenterRepository,
} from "./domain/canopyproof/global-command-center-postgres.js";
import {
  buildCanopyProofProofRecordSubjectId,
  CanopyProofGovernanceService,
  type CanopyProofGovernanceReviewerRole,
} from "./domain/canopyproof/governance.js";
import { CanopyProofIdentityService } from "./domain/canopyproof/identity.js";
import { CanopyProofInstitutionalReportingService } from "./domain/canopyproof/institutional-reporting.js";
import { CanopyProofMemoryService } from "./domain/canopyproof/memory.js";
import {
  CanopyProofMethodologyRegistryService,
  canopyProofMethodologyScopes,
  canopyProofMethodologyStatuses,
  type CanopyProofMethodologyScope,
  type CanopyProofMethodologyStatus,
} from "./domain/canopyproof/methodology-registry.js";
import {
  buildCanopyProofObservabilityStatus,
  buildCanopyProofOpenTelemetrySpan,
  buildCanopyProofRequestTelemetry,
  canopyProofTelemetryRouteTemplate,
  parseCanopyProofTraceparent,
  renderCanopyProofMetrics,
  serviceHealth,
} from "./domain/canopyproof/observability.js";
import { createCanopyProofOtlpHttpJsonExporter } from "./domain/canopyproof/opentelemetry-exporter.js";
import {
  CanopyProofPartnerService,
  canopyProofDataAccessAccountabilityDisclosureGovernanceStates,
  canopyProofDataAccessAccountabilityDisclosureStates,
  type CanopyProofDataAccessAccountabilityDisclosureGovernanceState,
  type CanopyProofDataAccessAccountabilityDisclosureState,
  type CanopyProofPartnerRole,
} from "./domain/canopyproof/partner-collaboration.js";
import {
  CanopyProofVerificationDecisionService,
  canopyProofVerificationDecisionKinds,
  canopyProofVerificationDecisionSubjectTypes,
  type CanopyProofVerificationDecisionKind,
  type CanopyProofVerificationDecisionReviewerRole,
  type CanopyProofVerificationDecisionSubjectType,
} from "./domain/canopyproof/verification-decisions.js";
import {
  CanopyProofProjectRegistryService,
  canopyProofProjectMonitoringEventTypes,
  canopyProofProjectMonitoringStates,
  canopyProofProjectStatuses,
  canopyProofProjectTypes,
  type CanopyProofProjectMonitoringEventType,
  type CanopyProofProjectMonitoringState,
  type CanopyProofProjectStatus,
  type CanopyProofProjectType,
} from "./domain/canopyproof/project-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofEvidenceTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAhinAction,
  type CanopyProofAuditEvent,
  type CanopyProofAuditVerificationEntry,
  type CanopyProofEvidenceType,
} from "./domain/canopyproof/proof-engine.js";
import {
  canopyProofEvidenceRegistrationStatuses,
  type CanopyProofEvidenceContributorRole,
  type CanopyProofEvidenceRegistrationStatus,
} from "./domain/canopyproof/evidence-registry.js";
import { PrismaCanopyProofEvidenceOfflineCommunityRepository } from "./domain/canopyproof/evidence-offline-community-postgres.js";
import { CanopyProofMobileEvidenceSyncAuthorityService } from "./domain/canopyproof/mobile-evidence-sync-authority.js";
import {
  PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority,
} from "./domain/canopyproof/mobile-evidence-sync-admission-postgres.js";
import {
  buildCanopyProofPublicRecord,
  buildCanopyProofPublicRecordIndex,
  type CanopyProofPublicRecordStatus,
} from "./domain/canopyproof/public-records.js";
import {
  CanopyProofService,
  type CanopyProofCertificateGovernanceApprovalSummary,
  type CanopyProofCertificateMonitoringEventSummary,
} from "./domain/canopyproof/proof-service.js";
import { CanopyProofResilienceService } from "./domain/canopyproof/resilience.js";
import {
  CanopyProofSecurityPolicyService,
  type CanopyProofAccessAction,
  type CanopyProofAccessClassification,
  type CanopyProofAccessPurpose,
  type CanopyProofAccessResource,
  type CanopyProofAccessRole,
  type CanopyProofAttributeAccessInput,
  type CanopyProofConflictStatus,
} from "./domain/canopyproof/security-policy.js";
import { TerraProofService, terraProofConnectorIds, type TerraProofConnectorId } from "./domain/canopyproof/terra-intelligence.js";
import {
  NasaGibsConnectorService,
  NasaGibsError,
  nasaGibsAttributionArtifactKinds,
  nasaGibsFreshnessStates,
  nasaGibsProjections,
  nasaGibsServiceTypes,
  renderNasaGibsMetrics,
  type NasaGibsActor,
  type NasaGibsAttributionArtifactKind,
  type NasaGibsFreshnessState,
  type NasaGibsProjection,
  type NasaGibsServiceType,
} from "./domain/canopyproof/nasa-gibs.js";
import { PrismaNasaGibsRepository } from "./domain/canopyproof/nasa-gibs-postgres.js";
import { CanopyProofVerificationQueueService } from "./domain/canopyproof/verification-queue.js";
import { createCanopyProofMobileEvidenceSyncRoutes } from "./routes/canopyproof/mobile-evidence-sync.js";
import { createCanopyProofSatelliteRoutes } from "./routes/canopyproof/satellite.js";
import { repository } from "./domain/repository.js";
import { LotteryService } from "./domain/lottery/lottery-service.js";
import { InMemoryLotteryRepository, PrismaLotteryRepository } from "./domain/lottery/lottery-repository.js";
import { CertificateService } from "./domain/impact/certificate-service.js";
import { EvidenceService } from "./domain/impact/evidence-service.js";
import { ImpactService } from "./domain/impact/impact-service.js";
import { InMemoryImpactRepository, PrismaImpactRepository } from "./domain/impact/impact-repository.js";
import { certificateDisclosure } from "./domain/impact/impact-engine.js";
import { InMemoryFundRepository, PrismaFundRepository } from "./domain/fund/fund-repository.js";
import { FundService } from "./domain/fund/fund-service.js";
import { settlementDisclosure } from "./domain/fund/fund-engine.js";
import { InMemoryPaymentRepository, PrismaPaymentRepository } from "./domain/payment/payment-repository.js";
import { PaymentService } from "./domain/payment/payment-service.js";
import { InMemoryRiskRepository, PrismaRiskRepository } from "./domain/risk/risk-repository.js";
import { RiskService } from "./domain/risk/risk-service.js";
import { InMemoryTelegramRepository, PrismaTelegramRepository } from "./domain/telegram/telegram-repository.js";
import { TelegramService } from "./domain/telegram/telegram-service.js";
import { InMemoryCampaignRepository, PrismaCampaignRepository } from "./domain/campaign/campaign-repository.js";
import { CampaignService } from "./domain/campaign/campaign-service.js";
import { InMemoryFeedbackRepository, PrismaFeedbackRepository } from "./domain/feedback/feedback-repository.js";
import { FeedbackService } from "./domain/feedback/feedback-service.js";
import { InMemoryStatusRepository, PrismaStatusRepository, StatusService } from "./domain/status/status-service.js";
import { ReadinessService } from "./domain/status/readiness-service.js";
import { MetricsService } from "./domain/status/metrics-service.js";
import { getPrisma } from "./lib/prisma.js";

const logger = pino({
  name: "dropin-api",
  level: process.env.LOG_LEVEL ?? "info",
});

const allowedOrigins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? "http://localhost:3001,http://localhost:3002,http://localhost:3003")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const lotteryRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryLotteryRepository()
    : new PrismaLotteryRepository(getPrisma());
const impactRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryImpactRepository()
    : new PrismaImpactRepository(getPrisma());
const impactService = new ImpactService(impactRepository);
const evidenceService = new EvidenceService(impactRepository);
const certificateService = new CertificateService(impactRepository);
const fundRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryFundRepository()
    : new PrismaFundRepository(getPrisma());
const fundService = new FundService(fundRepository, impactRepository);
const riskRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryRiskRepository()
    : new PrismaRiskRepository(getPrisma());
const paymentRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryPaymentRepository()
    : new PrismaPaymentRepository(getPrisma());
const paymentService = new PaymentService(paymentRepository, fundService, process.env.DROPIN_PAYMENT_MODE, riskRepository);
const campaignRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryCampaignRepository()
    : new PrismaCampaignRepository(getPrisma());
const campaignService = new CampaignService(campaignRepository, {
  lotteryRepo: lotteryRepository,
  paymentRepo: paymentRepository,
  fundRepo: fundRepository,
  impactRepo: impactRepository,
  riskRepo: riskRepository,
});
const lotteryService = new LotteryService(lotteryRepository, fundService, paymentService, campaignService);
const riskService = new RiskService(riskRepository, impactRepository, lotteryRepository, fundService, paymentService);
const feedbackRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryFeedbackRepository()
    : new PrismaFeedbackRepository(getPrisma());
const feedbackService = new FeedbackService(feedbackRepository);
const statusRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryStatusRepository()
    : new PrismaStatusRepository(getPrisma());
const statusService = new StatusService(statusRepository, {
  campaignRepo: campaignRepository,
  lotteryRepo: lotteryRepository,
  impactRepo: impactRepository,
  fundRepo: fundRepository,
  paymentRepo: paymentRepository,
  riskRepo: riskRepository,
  feedbackRepo: feedbackRepository,
  repositoryMode: process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL ? "memory" : "prisma",
  paymentMode: process.env.DROPIN_PAYMENT_MODE ?? "manual",
});
const readinessService = new ReadinessService(statusService, {
  campaignRepo: campaignRepository,
  lotteryRepo: lotteryRepository,
  impactRepo: impactRepository,
  fundRepo: fundRepository,
  paymentRepo: paymentRepository,
  riskRepo: riskRepository,
  feedbackRepo: feedbackRepository,
  repositoryMode: process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL ? "memory" : "prisma",
  paymentMode: process.env.DROPIN_PAYMENT_MODE ?? "manual",
});
const metricsService = new MetricsService(statusService);
const telegramRepository =
  process.env.DROPIN_REPOSITORY === "memory" || !process.env.DATABASE_URL
    ? new InMemoryTelegramRepository()
    : new PrismaTelegramRepository(getPrisma());
const telegramService = new TelegramService(
  telegramRepository,
  lotteryService,
  certificateService,
  riskRepository,
  process.env.TELEGRAM_AUTH_MODE,
  campaignService,
);

const canopyProofOtlpExporter = createCanopyProofOtlpHttpJsonExporter(process.env, {
  diagnostic: (diagnostic) => {
    logger.warn(
      {
        code: diagnostic.code,
        spanCount: diagnostic.spanCount,
        occurrence: diagnostic.occurrence,
        ...(diagnostic.attempt === undefined ? {} : { attempt: diagnostic.attempt }),
        ...(diagnostic.httpStatus === undefined ? {} : { httpStatus: diagnostic.httpStatus }),
      },
      "CanopyProof OTLP exporter diagnostic",
    );
  },
});

const canopyProofService = new CanopyProofService();

const canopyProofEvidenceNetworkService = new CanopyProofEvidenceNetworkService(canopyProofService);

const canopyProofVerificationQueueService = new CanopyProofVerificationQueueService(canopyProofService);

const canopyProofVerificationDecisionService = new CanopyProofVerificationDecisionService();

const canopyProofGovernanceService = new CanopyProofGovernanceService();

const canopyProofIdentityService = new CanopyProofIdentityService();

const canopyProofMemoryService = new CanopyProofMemoryService();

const canopyProofMethodologyService = new CanopyProofMethodologyRegistryService();

const canopyProofDataQualityService = new CanopyProofDataQualityService();

const canopyProofChallengeCaseService = new CanopyProofChallengeCaseService();

const canopyProofCertificateTransparencyService = new CanopyProofCertificateTransparencyService();

const terraProofService = new TerraProofService();

let nasaGibsConnectorService: NasaGibsConnectorService | undefined;

const canopyProofPartnerService = new CanopyProofPartnerService();

const canopyProofProjectRegistryService = new CanopyProofProjectRegistryService();

const canopyProofInstitutionalReportingService = new CanopyProofInstitutionalReportingService(canopyProofService, canopyProofPartnerService);

const canopyProofFundingService = new CanopyProofFundingTransparencyService();

const canopyProofEarlyWarningService = new CanopyProofEarlyWarningService();

const canopyProofAgentService = new CanopyProofAgentFrameworkService();

const canopyProofAuditAttestationService = new CanopyProofAuditAttestationService();

const canopyProofAuditExportManifestService = new CanopyProofAuditExportManifestService();

const canopyProofSecurityService = new CanopyProofSecurityPolicyService();

const canopyProofResilienceService = new CanopyProofResilienceService();

let canopyProofAuthorizationRegistry: PrismaCanopyProofAuthorizationRegistry | undefined;

let canopyProofTrustRegistryService: PrismaCanopyProofTrustRegistryService | undefined;

let canopyProofMobileEvidenceSyncService: CanopyProofMobileEvidenceSyncAuthorityService | undefined;

let canopyProofMobileEvidenceSyncAdmissionAuthority:
  PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority | undefined;

let canopyProofGlobalCommandCenterRepository: PrismaCanopyProofGlobalCommandCenterRepository | undefined;

type DropinApiEnvironment = {
  Variables: {
    canopyProofPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
    canopyProofAuthorizationBinding: CanopyProofAuthorizationBinding | undefined;
  };
};

type CanopyProofRbacRole = CanopyProofAccessRole;

const canopyProofPublicRecordStatuses = ["issued", "challenged", "revoked"] as const satisfies readonly CanopyProofPublicRecordStatus[];

type CanopyProofRequestActor = {
  readonly id: string;
  readonly role: CanopyProofRbacRole;
  readonly organizationId?: string;
  readonly authorizationSource: CanopyProofAuthorizationBinding["source"];
};

function canopyProofActor(
  c: Context<DropinApiEnvironment>,
  allowedRoles: readonly CanopyProofRbacRole[],
  assurance: CanopyProofAuthorizationAssurance = "participant",
): CanopyProofRequestActor {
  const principal = requireCanopyProofAuthenticatedPrincipal(c.get("canopyProofPrincipal"));
  const binding = requireCanopyProofAuthorizationBinding(c.get("canopyProofAuthorizationBinding"), principal);
  const typedRole = principal.role as CanopyProofRbacRole;
  if (!allowedRoles.includes(typedRole)) {
    throw new Error(`CANOPYPROOF_RBAC_DENIED: role ${typedRole} is not permitted for this CanopyProof action.`);
  }
  assertCanopyProofAuthorizationAssurance(binding, assurance);
  return {
    id: principal.actorId,
    role: typedRole,
    ...(binding.organizationId ? { organizationId: binding.organizationId } : {}),
    authorizationSource: binding.source,
  };
}

function assertCanopyProofActorOrganization(actor: CanopyProofRequestActor, organizationId: string) {
  if (actor.authorizationSource === "postgres" && actor.organizationId !== organizationId) {
    throw new Error("CANOPYPROOF_RBAC_DENIED: the authenticated organization does not own this governed resource.");
  }
}

function requireCanopyProofActorOrganizationId(actor: CanopyProofRequestActor) {
  if (actor.authorizationSource === "postgres" && !actor.organizationId) {
    throw new Error("CANOPYPROOF_RBAC_DENIED: a durable organization binding is required for this governed resource.");
  }
  return actor.organizationId;
}

function canopyProofDurableTrustRegistry(c: Context<DropinApiEnvironment>) {
  const binding = c.get("canopyProofAuthorizationBinding");
  if (binding?.source !== "postgres") return undefined;
  return (canopyProofTrustRegistryService ??= new PrismaCanopyProofTrustRegistryService(getPrisma()));
}

function canopyProofDurableMobileEvidenceSyncAuthority(c: Context<DropinApiEnvironment>) {
  const registry = canopyProofDurableTrustRegistry(c);
  if (!registry) return undefined;
  return (canopyProofMobileEvidenceSyncService ??= new CanopyProofMobileEvidenceSyncAuthorityService(
    registry,
    new PrismaCanopyProofEvidenceOfflineCommunityRepository(getPrisma()),
  ));
}

function canopyProofDurableMobileEvidenceSyncAdmissionAuthority(c: Context<DropinApiEnvironment>) {
  const registry = canopyProofDurableTrustRegistry(c);
  if (!registry) return undefined;
  return (canopyProofMobileEvidenceSyncAdmissionAuthority ??=
    new PrismaCanopyProofMobileEvidenceSyncAdmissionAuthority(getPrisma()));
}

function requireCanopyProofDurableVerificationRegistry(c: Context<DropinApiEnvironment>) {
  const durable = canopyProofDurableTrustRegistry(c);
  if (!durable) {
    throw new CanopyProofTrustRegistryError("CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE", 503);
  }
  return durable;
}

function requireCanopyProofDurableOrganizationId(actor: CanopyProofRequestActor) {
  const organizationId = requireCanopyProofActorOrganizationId(actor);
  if (!organizationId) {
    throw new Error("CANOPYPROOF_RBAC_DENIED: durable verification reads require an organization binding.");
  }
  return organizationId;
}

function canopyProofPublicDurableTrustRegistry() {
  const status = canopyProofTrustRegistryConfigurationStatus(process.env);
  if (status.mode === "postgresql") {
    return (canopyProofTrustRegistryService ??= new PrismaCanopyProofTrustRegistryService(getPrisma()));
  }
  if (status.production) {
    throw new CanopyProofTrustRegistryError("CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE", 503);
  }
  return undefined;
}

function nasaGibsConnector() {
  return (nasaGibsConnectorService ??= new NasaGibsConnectorService({
    repository: new PrismaNasaGibsRepository(getPrisma()),
    enabled: process.env.CANOPYPROOF_NASA_GIBS_ENABLED === "true",
  }));
}

function nasaGibsActor(actor: CanopyProofRequestActor, capabilities: readonly string[] = []): NasaGibsActor {
  const organizationId = requireCanopyProofActorOrganizationId(actor);
  if (!organizationId) {
    throw new Error("CANOPYPROOF_RBAC_DENIED: NASA GIBS access requires an organization-bound identity.");
  }
  return {
    id: actor.id,
    organizationId,
    role: actor.role,
    capabilities,
  };
}

async function nasaGibsSyncActor(actor: CanopyProofRequestActor): Promise<NasaGibsActor> {
  const capabilities = new Set<string>();
  if (actor.role === "admin") capabilities.add("nasa_gibs_catalog_sync");
  if (actor.authorizationSource === "postgres" && (actor.role === "agent" || actor.role === "researcher")) {
    const rows = await getPrisma().$queryRaw<Array<{ capabilities: string[] }>>`
      SELECT profile.capabilities
      FROM identity.agent_profiles profile
      JOIN identity.participants participant
        ON participant.id = profile.id
       AND participant.organization_id = ${actor.organizationId ?? ""}
      WHERE profile.id = ${actor.id}
        AND profile.status = 'active'
        AND 'nasa_gibs_catalog_sync' = ANY(profile.capabilities)
      UNION ALL
      SELECT ARRAY['nasa_gibs_catalog_sync']::text[] AS capabilities
      FROM organizations.memberships membership
      JOIN organizations.accreditations accreditation
        ON accreditation.organization_id = membership.organization_id
      WHERE membership.actor_id = ${actor.id}
        AND membership.organization_id = ${actor.organizationId ?? ""}
        AND membership.role = 'researcher'
        AND membership.status = 'active'
        AND accreditation.status = 'approved'
        AND 'nasa_gibs_catalog_sync' = ANY(accreditation.scope)
      LIMIT 1
    `;
    for (const capability of rows.flatMap((row) => row.capabilities)) capabilities.add(capability);
  }
  return nasaGibsActor(actor, [...capabilities].sort());
}

function canopyProofIdempotencyKey(c: Context<DropinApiEnvironment>) {
  return c.req.header("idempotency-key")?.trim() ?? "";
}

export function canopyProofRequiresPendingPartnerPersistence(path: string) {
  const normalizedPath = path.replace(/\/$/, "");
  if (
    /^\/canopyproof\/organizations\/[^/]+\/data-access-requests$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-requests\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-requests\/[^/]+\/deliveries$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-deliveries\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-deliveries\/[^/]+\/use-attestations$/.test(normalizedPath) ||
    /^\/canopyproof\/data-use-attestations\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-use-attestations\/[^/]+\/enforcement-cases$/.test(normalizedPath) ||
    /^\/canopyproof\/data-use-enforcement-cases\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-use-enforcement-cases\/[^/]+\/access-restrictions$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-requests\/[^/]+\/restrictions$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-restrictions\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-requests\/[^/]+\/accountability-packets$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-accountability-packets\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-accountability-packets\/[^/]+\/(verify|verifications)$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-accountability-verifications\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/data-access-accountability-packets\/[^/]+\/disclosures$/.test(normalizedPath) ||
    /^\/canopyproof\/public-accountability\/data-access-disclosures(?:\/status|\/[^/]+)?$/.test(normalizedPath) ||
    /^\/canopyproof\/public-accountability\/data-access-disclosures\/[^/]+\/challenges$/.test(normalizedPath) ||
    /^\/canopyproof\/public-accountability\/data-access-disclosure-challenges\/[^/]+(?:\/resolutions)?$/.test(
      normalizedPath,
    ) ||
    /^\/canopyproof\/public-accountability\/data-access-disclosure-resolutions\/[^/]+(?:\/notices)?$/.test(normalizedPath) ||
    /^\/canopyproof\/public-accountability\/data-access-disclosures\/[^/]+\/notices$/.test(normalizedPath) ||
    /^\/canopyproof\/public-accountability\/data-access-disclosure-notices\/[^/]+$/.test(normalizedPath)
  ) {
    return false;
  }
  if (
    normalizedPath.startsWith("/canopyproof/data-access-") ||
    normalizedPath.startsWith("/canopyproof/data-use-") ||
    normalizedPath.startsWith("/canopyproof/public-accountability/data-access-")
  ) {
    return true;
  }
  return (
    normalizedPath.startsWith("/canopyproof/organizations/") &&
    normalizedPath.includes("/data-access-requests")
  );
}

export function canopyProofRequiresPendingEvidencePersistence(path: string) {
  const normalizedPath = path.replace(/\/$/, "");
  if (
    normalizedPath === "/canopyproof/evidence/mobile-sync/status" ||
    /^\/canopyproof\/evidence\/mobile-sync\/(?:bindings|batches|recoveries)$/.test(normalizedPath)
  ) {
    return false;
  }
  if (normalizedPath === "/canopyproof/evidence") {
    return false;
  }
  if (
    /^\/canopyproof\/evidence\/(?:status|media|consent-receipts|devices|review-tasks|retention|sync-batches|custody-events)(?:\/|$)/.test(
      normalizedPath,
    )
  ) {
    return true;
  }
  if (/^\/canopyproof\/evidence\/[^/]+$/.test(normalizedPath)) {
    return false;
  }
  if (
    /^\/canopyproof\/evidence\/[^/]+\/(?:validation-runs|ai-analyses|human-reviews|challenges|corrections|reliance|final-decisions|final-verification)$/.test(normalizedPath)
  ) {
    return false;
  }
  return normalizedPath.startsWith("/canopyproof/evidence/");
}

export function canopyProofLegacyEvidenceNetworkEnabled(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return (
    environment.CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED === "true" &&
    environment.NODE_ENV !== "production" &&
    environment.DROPIN_CANOPYPROOF_MODE !== "production"
  );
}

export function canopyProofIsLegacyEvidenceNetworkRoute(path: string) {
  const normalizedPath = path.replace(/\/$/, "");
  return (
    normalizedPath === "/canopyproof/evidence-network/status" ||
    /^\/canopyproof\/evidence\/(?:media|consent-receipts|devices|review-tasks|retention|sync-batches|custody-events)(?:\/|$)/.test(
      normalizedPath,
    ) ||
    /^\/canopyproof\/evidence\/[^/]+\/(?:custody-events|community-attestations)(?:\/|$)/.test(normalizedPath)
  );
}

export function canopyProofRequiresPendingVerificationPersistence(path: string) {
  const normalizedPath = path.replace(/\/$/, "");
  if (
    /^\/canopyproof\/verification\/(?:validation-runs|ai-analyses|human-reviews|evidence-challenges|evidence-challenge-resolutions|evidence-corrections|evidence-final-decisions)\/[^/]+$/.test(normalizedPath) ||
    /^\/canopyproof\/verification\/evidence-challenges\/[^/]+\/resolutions$/.test(normalizedPath) ||
    /^\/canopyproof\/verification\/evidence-challenge-resolutions\/[^/]+\/corrections$/.test(normalizedPath)
  ) {
    return false;
  }
  return (
    normalizedPath.startsWith("/canopyproof/verification/queue") ||
    normalizedPath.startsWith("/canopyproof/verification/decisions") ||
    normalizedPath.startsWith("/canopyproof/verification/challenge-cases") ||
    normalizedPath.startsWith("/canopyproof/environmental-proof-candidates") ||
    normalizedPath.startsWith("/canopyproof/environmental-proof-records") ||
    normalizedPath.startsWith("/canopyproof/environmental-proof-challenges") ||
    normalizedPath.startsWith("/canopyproof/proof-records") ||
    normalizedPath.startsWith("/canopyproof/public-records") ||
    normalizedPath.startsWith("/canopyproof/certificates/transparency")
  );
}

function canopyProofPublicRecordStatusFromQuery(status: string | undefined) {
  if (!status) return undefined;
  if (!canopyProofPublicRecordStatuses.includes(status as CanopyProofPublicRecordStatus)) {
    throw new Error(`CanopyProof public record status is invalid: ${status}`);
  }
  return status as CanopyProofPublicRecordStatus;
}

function canopyProofAccountabilityDisclosureStateFromQuery(state: string | undefined) {
  if (!state) return undefined;
  if (!canopyProofDataAccessAccountabilityDisclosureStates.includes(state as CanopyProofDataAccessAccountabilityDisclosureState)) {
    throw new Error(`CanopyProof public accountability disclosure state is invalid: ${state}`);
  }
  return state as CanopyProofDataAccessAccountabilityDisclosureState;
}

function canopyProofAccountabilityDisclosureGovernanceStateFromQuery(state: string | undefined) {
  if (!state) return undefined;
  if (
    !canopyProofDataAccessAccountabilityDisclosureGovernanceStates.includes(
      state as CanopyProofDataAccessAccountabilityDisclosureGovernanceState,
    )
  ) {
    throw new Error(`CanopyProof public accountability disclosure governance state is invalid: ${state}`);
  }
  return state as CanopyProofDataAccessAccountabilityDisclosureGovernanceState;
}

function canopyProofAccountabilityDisclosureLimitFromQuery(value: string | undefined) {
  if (!value) return 50;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("CanopyProof public accountability disclosure limit must be an integer between 1 and 100.");
  }
  const limit = Number(value);
  if (limit > 100) {
    throw new Error("CanopyProof public accountability disclosure limit must be an integer between 1 and 100.");
  }
  return limit;
}

function canopyProofProjectTypeFromQuery(value: string | undefined) {
  if (!value) return undefined;
  if (!canopyProofProjectTypes.includes(value as CanopyProofProjectType)) {
    throw new Error(`CanopyProof project type is invalid: ${value}`);
  }
  return value as CanopyProofProjectType;
}

function canopyProofProjectStatusFromQuery(value: string | undefined) {
  if (!value) return undefined;
  if (!canopyProofProjectStatuses.includes(value as CanopyProofProjectStatus)) {
    throw new Error(`CanopyProof project status is invalid: ${value}`);
  }
  return value as CanopyProofProjectStatus;
}

function canopyProofProjectMonitoringStateFromQuery(value: string | undefined) {
  if (!value) return undefined;
  if (!canopyProofProjectMonitoringStates.includes(value as CanopyProofProjectMonitoringState)) {
    throw new Error(`CanopyProof project monitoring state is invalid: ${value}`);
  }
  return value as CanopyProofProjectMonitoringState;
}

function canopyProofProjectMonitoringTypeFromQuery(value: string | undefined) {
  if (!value) return undefined;
  if (!canopyProofProjectMonitoringEventTypes.includes(value as CanopyProofProjectMonitoringEventType)) {
    throw new Error(`CanopyProof project monitoring event type is invalid: ${value}`);
  }
  return value as CanopyProofProjectMonitoringEventType;
}

function canopyProofProjectLimitFromQuery(value: string | undefined) {
  if (!value) return 100;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("CanopyProof project limit must be an integer between 1 and 100.");
  }
  const limit = Number(value);
  if (limit > 100) {
    throw new Error("CanopyProof project limit must be an integer between 1 and 100.");
  }
  return limit;
}

function canopyProofEvidenceTypeFromQuery(value: string | undefined) {
  if (!value) return undefined;
  if (!canopyProofEvidenceTypes.includes(value as CanopyProofEvidenceType)) {
    throw new Error(`CanopyProof evidence type is invalid: ${value}`);
  }
  return value as CanopyProofEvidenceType;
}

function canopyProofEvidenceStatusFromQuery(value: string | undefined) {
  if (!value) return undefined;
  if (!canopyProofEvidenceRegistrationStatuses.includes(value as CanopyProofEvidenceRegistrationStatus)) {
    throw new Error(`CanopyProof evidence registration status is invalid: ${value}`);
  }
  return value as CanopyProofEvidenceRegistrationStatus;
}

function canopyProofEvidenceLimitFromQuery(value: string | undefined) {
  if (!value) return 100;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("CanopyProof evidence limit must be an integer between 1 and 100.");
  }
  const limit = Number(value);
  if (limit > 100) {
    throw new Error("CanopyProof evidence limit must be an integer between 1 and 100.");
  }
  return limit;
}

function canopyProofAuditAttestationScopeFromQuery(scope: string | undefined) {
  if (!scope) return undefined;
  if (!canopyProofAuditAttestationScopes.includes(scope as CanopyProofAuditAttestationScope)) {
    throw new Error(`CanopyProof audit attestation scope is invalid: ${scope}`);
  }
  return scope as CanopyProofAuditAttestationScope;
}

function canopyProofAuditAttestationDecisionFromQuery(decision: string | undefined) {
  if (!decision) return undefined;
  if (!canopyProofAuditAttestationDecisions.includes(decision as CanopyProofAuditAttestationDecision)) {
    throw new Error(`CanopyProof audit attestation decision is invalid: ${decision}`);
  }
  return decision as CanopyProofAuditAttestationDecision;
}

function canopyProofAuditExportScopeFromQuery(scope: string | undefined) {
  if (!scope) return undefined;
  if (!canopyProofAuditExportScopes.includes(scope as CanopyProofAuditExportScope)) {
    throw new Error(`CanopyProof audit export manifest scope is invalid: ${scope}`);
  }
  return scope as CanopyProofAuditExportScope;
}

function canopyProofAuditExportClassificationFromQuery(classification: string | undefined) {
  if (!classification) return undefined;
  if (!canopyProofAuditExportClassifications.includes(classification as CanopyProofAuditExportClassification)) {
    throw new Error(`CanopyProof audit export manifest classification is invalid: ${classification}`);
  }
  return classification as CanopyProofAuditExportClassification;
}

function canopyProofCanReadSensitiveAuditExports(actor: CanopyProofRequestActor) {
  return actor.role === "owner" || actor.role === "admin" || actor.role === "verifier" || actor.role === "researcher";
}

function canopyProofMethodologyScopeFromQuery(scope: string | undefined) {
  if (!scope) return undefined;
  if (!canopyProofMethodologyScopes.includes(scope as CanopyProofMethodologyScope)) {
    throw new Error(`CanopyProof methodology scope is invalid: ${scope}`);
  }
  return scope as CanopyProofMethodologyScope;
}

function canopyProofMethodologyStatusFromQuery(status: string | undefined) {
  if (!status) return undefined;
  if (!canopyProofMethodologyStatuses.includes(status as CanopyProofMethodologyStatus)) {
    throw new Error(`CanopyProof methodology status is invalid: ${status}`);
  }
  return status as CanopyProofMethodologyStatus;
}

function optionalNasaGibsServiceType(value: string | undefined): NasaGibsServiceType | undefined {
  if (value === undefined) return undefined;
  if (!nasaGibsServiceTypes.includes(value as NasaGibsServiceType)) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS serviceType filter is invalid.", 422);
  }
  return value as NasaGibsServiceType;
}

function optionalNasaGibsProjection(value: string | undefined): NasaGibsProjection | undefined {
  if (value === undefined) return undefined;
  if (!nasaGibsProjections.includes(value as NasaGibsProjection)) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS projection filter is invalid.", 422);
  }
  return value as NasaGibsProjection;
}

function optionalNasaGibsFreshness(value: string | undefined): NasaGibsFreshnessState | undefined {
  if (value === undefined) return undefined;
  if (!nasaGibsFreshnessStates.includes(value as NasaGibsFreshnessState)) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS freshness filter is invalid.", 422);
  }
  return value as NasaGibsFreshnessState;
}

function canopyProofCanReadDraftMethodologies(actor: CanopyProofRequestActor) {
  return actor.role === "owner" || actor.role === "admin" || actor.role === "verifier" || actor.role === "researcher";
}

function canopyProofDataQualitySubjectTypeFromQuery(subjectType: string | undefined) {
  if (!subjectType) return undefined;
  if (!canopyProofDataQualitySubjectTypes.includes(subjectType as CanopyProofDataQualitySubjectType)) {
    throw new Error(`CanopyProof data quality subject type is invalid: ${subjectType}`);
  }
  return subjectType as CanopyProofDataQualitySubjectType;
}

function canopyProofDataQualityDecisionFromQuery(decision: string | undefined) {
  if (!decision) return undefined;
  if (!canopyProofDataQualityDecisions.includes(decision as CanopyProofDataQualityDecision)) {
    throw new Error(`CanopyProof data quality decision is invalid: ${decision}`);
  }
  return decision as CanopyProofDataQualityDecision;
}

function canopyProofChallengeCaseSubjectTypeFromQuery(subjectType: string | undefined) {
  if (!subjectType) return undefined;
  if (!canopyProofChallengeCaseSubjectTypes.includes(subjectType as CanopyProofChallengeCaseSubjectType)) {
    throw new Error(`CanopyProof challenge case subject type is invalid: ${subjectType}`);
  }
  return subjectType as CanopyProofChallengeCaseSubjectType;
}

function canopyProofChallengeCaseStatusFromQuery(status: string | undefined) {
  if (!status) return undefined;
  if (!canopyProofChallengeCaseStatuses.includes(status as CanopyProofChallengeCaseStatus)) {
    throw new Error(`CanopyProof challenge case status is invalid: ${status}`);
  }
  return status as CanopyProofChallengeCaseStatus;
}

function canopyProofChallengeCaseReasonFromQuery(reason: string | undefined) {
  if (!reason) return undefined;
  if (!canopyProofChallengeCaseReasons.includes(reason as CanopyProofChallengeCaseReason)) {
    throw new Error(`CanopyProof challenge case reason is invalid: ${reason}`);
  }
  return reason as CanopyProofChallengeCaseReason;
}

function canopyProofCertificateTransparencyStatusFromQuery(status: string | undefined) {
  if (!status) return undefined;
  if (!canopyProofCertificateTransparencyStatuses.includes(status as CanopyProofCertificateTransparencyStatus)) {
    throw new Error(`CanopyProof certificate transparency status is invalid: ${status}`);
  }
  return status as CanopyProofCertificateTransparencyStatus;
}

function canopyProofVerificationDecisionSubjectTypeFromQuery(subjectType: string | undefined) {
  if (!subjectType) return undefined;
  if (!canopyProofVerificationDecisionSubjectTypes.includes(subjectType as CanopyProofVerificationDecisionSubjectType)) {
    throw new Error(`CanopyProof verification decision subject type is invalid: ${subjectType}`);
  }
  return subjectType as CanopyProofVerificationDecisionSubjectType;
}

function canopyProofVerificationDecisionKindFromQuery(decision: string | undefined) {
  if (!decision) return undefined;
  if (!canopyProofVerificationDecisionKinds.includes(decision as CanopyProofVerificationDecisionKind)) {
    throw new Error(`CanopyProof verification decision is invalid: ${decision}`);
  }
  return decision as CanopyProofVerificationDecisionKind;
}

const canopyProofAhinActions: readonly CanopyProofAhinAction[] = ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"] as const;

function canopyProofAuditVerificationEntriesFromRequest(input: unknown): readonly CanopyProofAuditVerificationEntry[] {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof audit verification request must be an object.");
  }
  const body = input as Record<string, unknown>;
  const rawEntries = Array.isArray(body.entries) ? body.entries : Array.isArray(body.events) ? body.events : undefined;
  if (!rawEntries || rawEntries.length === 0) {
    throw new Error("CanopyProof audit verification requires at least one event.");
  }
  return rawEntries.map((entry) => {
    if (typeof entry === "object" && entry !== null && "event" in entry) {
      const bundled = entry as Record<string, unknown>;
      const parsed: CanopyProofAuditVerificationEntry = {
        event: canopyProofAuditEventFromRequest(bundled.event),
        ...("payload" in bundled ? { payload: bundled.payload } : {}),
      };
      return parsed;
    }
    return { event: canopyProofAuditEventFromRequest(entry) };
  });
}

function canopyProofAuditEventFromRequest(input: unknown): CanopyProofAuditEvent {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof audit event must be an object.");
  }
  const event = input as Record<string, unknown>;
  const action = canopyProofAuditString(event, "action");
  if (!canopyProofAhinActions.includes(action as CanopyProofAhinAction)) {
    throw new Error("CanopyProof audit event action is invalid.");
  }
  return {
    id: canopyProofAuditString(event, "id"),
    action: action as CanopyProofAhinAction,
    actor: canopyProofAuditString(event, "actor"),
    entityType: canopyProofAuditString(event, "entityType") as CanopyProofAuditEvent["entityType"],
    entityId: canopyProofAuditString(event, "entityId"),
    previousRoot: canopyProofAuditString(event, "previousRoot"),
    payloadHash: canopyProofAuditString(event, "payloadHash"),
    eventRoot: canopyProofAuditString(event, "eventRoot"),
    createdAt: canopyProofAuditString(event, "createdAt"),
    rationale: canopyProofAuditString(event, "rationale"),
  };
}

function canopyProofAuditString(input: Record<string, unknown>, field: string) {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`CanopyProof audit event ${field} is required.`);
  }
  return value.trim();
}

function canopyProofProofRecordSubjectFromRequest(input: unknown) {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof proof record request must be an object before governance validation.");
  }
  const body = input as { projectId?: unknown; evidenceIds?: unknown; governanceApprovals?: unknown };
  if (typeof body.projectId !== "string" || !Array.isArray(body.evidenceIds) || !body.evidenceIds.every((item) => typeof item === "string")) {
    throw new Error("CanopyProof proof record governance validation requires projectId and evidenceIds.");
  }
  return buildCanopyProofProofRecordSubjectId({
    projectId: body.projectId,
    evidenceIds: body.evidenceIds,
  });
}

function canopyProofProjectIdFromRequest(input: unknown) {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof project-bound request must be an object.");
  }
  const projectId = (input as { projectId?: unknown }).projectId;
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new Error("CanopyProof project-bound request requires projectId.");
  }
  return projectId.trim();
}

function canopyProofGovernanceApprovalIdsFromRequest(input: unknown) {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof governance approvals must be attached to an object request.");
  }
  const body = input as { governanceApprovals?: unknown };
  if (!Array.isArray(body.governanceApprovals) || !body.governanceApprovals.every((item) => typeof item === "string")) {
    throw new Error("CanopyProof governance approval IDs are required before proof issuance.");
  }
  return body.governanceApprovals;
}

function canopyProofMonitoringEventIdsFromRequest(input: unknown) {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof monitoring event IDs must be attached to an object request.");
  }
  const value = (input as { monitoringEventIds?: unknown }).monitoringEventIds;
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error("CanopyProof monitoringEventIds must be an array of non-empty strings.");
  }
  return [...new Set(value.map((item) => item.trim()))].sort();
}

function canopyProofMonitoringEventSummariesFromRequest(input: unknown, projectId: string) {
  return canopyProofCertificateMonitoringEventSummaries(canopyProofMonitoringEventIdsFromRequest(input), projectId);
}

function canopyProofCertificateGovernanceApprovalSummaries(
  approvalIds: readonly string[],
): readonly CanopyProofCertificateGovernanceApprovalSummary[] {
  return approvalIds.map((approvalId) => {
    const approval = canopyProofGovernanceService.getApproval(approvalId);
    if (approval.subjectType !== "proof_record" || approval.decision !== "approve") {
      throw new Error(`CanopyProof certificate artifact cannot use governance approval ${approval.id}.`);
    }

    return {
      id: approval.id,
      subjectType: approval.subjectType,
      subjectId: approval.subjectId,
      policyId: approval.policyId,
      reviewer: approval.reviewer,
      reviewerRole: approval.reviewerRole,
      decision: approval.decision,
      rationale: approval.rationale,
      conflictDisclosure: approval.conflictDisclosure,
      decidedAt: approval.decidedAt,
      approvalHash: approval.approvalHash,
      auditEventRoot: approval.auditEvent.eventRoot,
    };
  });
}

function canopyProofCertificateMonitoringEventSummaries(
  eventIds: readonly string[],
  projectId: string,
): readonly CanopyProofCertificateMonitoringEventSummary[] {
  return eventIds.map((eventId) => {
    const event = canopyProofProjectRegistryService.getMonitoringEvent(eventId);
    if (event.projectId !== projectId) {
      throw new Error(`CanopyProof monitoring event ${event.id} does not belong to project ${projectId}.`);
    }
    if (event.state !== "accepted") {
      throw new Error(`CanopyProof monitoring event ${event.id} must be accepted before proof issuance.`);
    }
    return {
      id: event.id,
      projectId: event.projectId,
      eventType: event.eventType,
      state: event.state,
      observedAt: event.observedAt,
      observedBy: event.observedBy,
      evidenceIds: event.evidenceIds,
      terraSceneIds: event.terraSceneIds,
      eventHash: event.eventHash,
      auditEventRoot: event.auditEvent.eventRoot,
    };
  });
}

function canopyProofCertificateArtifactForRecord(recordId: string) {
  const record = canopyProofService.getProofRecord(recordId);
  const governanceApprovals = canopyProofCertificateGovernanceApprovalSummaries(record.governanceApprovals);
  const monitoringEvents = canopyProofCertificateMonitoringEventSummaries(record.monitoringEventIds, record.projectId);
  return canopyProofService.getProofRecordCertificate(record.id, governanceApprovals, monitoringEvents);
}

function seedCanopyProofProjectRegistry() {
  canopyProofProjectRegistryService.registerProject(
    {
      id: "project_v1_ggw_demo",
      organizationId: "cp_org_seed_great_green_wall",
      title: "Great Green Wall Demonstration Restoration Corridor",
      projectType: "reforestation",
      regionId: "region_ggw_sahel",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        areaHectares: 125.5,
        boundaryHash: "9".repeat(64),
      },
      targetTreeCount: 50000,
      biodiversityIndicators: ["native species mix", "pollinator corridor"],
      waterIndicators: ["soil moisture recovery", "runoff reduction"],
      climateRiskIndicators: ["drought exposure", "heat stress"],
      monitoringCadenceDays: 60,
      governancePolicyId: "canopyproof_policy_project_registry_v1",
      governanceApprovalId: "cp_governance_project_seed_approval_v1",
      status: "active",
      createdAt: "2026-07-08T00:00:00.000Z",
    },
    "system_canopyproof_project_registry",
  );
  canopyProofProjectRegistryService.registerProject(
    {
      id: "project_v1_institutional_demo",
      organizationId: "cp_org_seed_institutional_reporting",
      title: "Institutional Reporting Demonstration Restoration Site",
      projectType: "ecosystem_restoration",
      regionId: "region_institutional_demo",
      location: {
        latitude: 14.9167,
        longitude: -17.2677,
        areaHectares: 210,
        boundaryHash: "a".repeat(64),
      },
      targetTreeCount: 80000,
      biodiversityIndicators: ["restoration survivorship", "habitat connectivity"],
      waterIndicators: ["soil infiltration", "seasonal water retention"],
      climateRiskIndicators: ["drought exposure", "wildfire exposure"],
      monitoringCadenceDays: 90,
      governancePolicyId: "canopyproof_policy_project_registry_v1",
      governanceApprovalId: "cp_governance_project_institutional_seed_approval_v1",
      status: "active",
      createdAt: "2026-07-08T00:00:00.000Z",
    },
    "system_canopyproof_project_registry",
  );
}

function createApiRequestId() {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `api-${Date.now().toString(36)}`;
}

function canopyProofObservabilityStatus() {
  const proofStatus = canopyProofService.getStatus();
  const evidenceNetworkStatus = canopyProofEvidenceNetworkService.getStatus();
  const verificationQueueStatus = canopyProofVerificationQueueService.getStatus();
  const memoryStatus = canopyProofMemoryService.getStatus();
  const terraStatus = terraProofService.getStatus();
  const partnerStatus = canopyProofPartnerService.getStatus();
  const institutionalReportingStatus = canopyProofInstitutionalReportingService.getStatus();
  const fundingStatus = canopyProofFundingService.getStatus();
  const riskStatus = canopyProofEarlyWarningService.getStatus();
  const agentStatus = canopyProofAgentService.getStatus();
  const securityStatus = canopyProofSecurityService.getStatus(process.env);
  const governanceStatus = canopyProofGovernanceService.getStatus();
  const resilienceStatus = canopyProofResilienceService.getStatus();
  const databaseAuditTransparencyStatus = canopyProofDatabaseAuditTransparencyStatus();
  const identityAuthenticationStatus = canopyProofAuthenticationStatus(process.env);
  const authorizationBindingStatus = canopyProofAuthorizationBindingStatus(process.env);
  const trustRegistryStatus = canopyProofTrustRegistryConfigurationStatus(process.env);

  return buildCanopyProofObservabilityStatus([
    serviceHealth(proofStatus.service, {
      evidenceCount: proofStatus.evidenceCount,
      aiAnalysisCount: proofStatus.aiAnalysisCount,
      proofRecordCount: proofStatus.proofRecordCount,
      proofRecordChallengeCount: proofStatus.proofRecordChallengeCount,
      openProofRecordChallengeCount: proofStatus.openProofRecordChallengeCount,
      revokedProofRecordCount: proofStatus.revokedProofRecordCount,
      esgReportCount: proofStatus.esgReportCount,
    }),
    serviceHealth(evidenceNetworkStatus.service, {
      mediaUploadIntentCount: evidenceNetworkStatus.mediaUploadIntentCount,
      mediaObjectCount: evidenceNetworkStatus.mediaObjectCount,
      quarantinedMediaObjectCount: evidenceNetworkStatus.quarantinedMediaObjectCount,
      pendingScanMediaObjectCount: evidenceNetworkStatus.pendingScanMediaObjectCount,
      duplicateMediaObjectCount: evidenceNetworkStatus.duplicateMediaObjectCount,
      consentReceiptCount: evidenceNetworkStatus.consentReceiptCount,
      revokedConsentReceiptCount: evidenceNetworkStatus.revokedConsentReceiptCount,
      deviceAttestationCount: evidenceNetworkStatus.deviceAttestationCount,
      riskyDeviceAttestationCount: evidenceNetworkStatus.riskyDeviceAttestationCount,
      mediaMetadataExtractionCount: evidenceNetworkStatus.mediaMetadataExtractionCount,
      metadataExtractionNeedsReviewCount: evidenceNetworkStatus.metadataExtractionNeedsReviewCount,
      evidenceReviewTaskCount: evidenceNetworkStatus.evidenceReviewTaskCount,
      openEvidenceReviewTaskCount: evidenceNetworkStatus.openEvidenceReviewTaskCount,
      escalatedEvidenceReviewTaskCount: evidenceNetworkStatus.escalatedEvidenceReviewTaskCount,
      retentionPolicyDecisionCount: evidenceNetworkStatus.retentionPolicyDecisionCount,
      retentionMinimizationDecisionCount: evidenceNetworkStatus.retentionMinimizationDecisionCount,
      offlineSyncBatchCount: evidenceNetworkStatus.offlineSyncBatchCount,
      offlineSyncConflictCount: evidenceNetworkStatus.offlineSyncConflictCount,
      communityAttestationCount: evidenceNetworkStatus.communityAttestationCount,
      custodyEventCount: evidenceNetworkStatus.custodyEventCount,
    }),
    serviceHealth(verificationQueueStatus.service, {
      capacity: verificationQueueStatus.capacity,
      totalWorkItemCount: verificationQueueStatus.totalWorkItemCount,
      queuedWorkItemCount: verificationQueueStatus.queuedWorkItemCount,
      runningWorkItemCount: verificationQueueStatus.runningWorkItemCount,
      blockedWorkItemCount: verificationQueueStatus.blockedWorkItemCount,
      escalatedWorkItemCount: verificationQueueStatus.escalatedWorkItemCount,
      completedWorkItemCount: verificationQueueStatus.completedWorkItemCount,
      criticalWorkItemCount: verificationQueueStatus.criticalWorkItemCount,
      backpressureActive: verificationQueueStatus.backpressureActive ? 1 : 0,
      queueUtilizationPercent: verificationQueueStatus.queueUtilizationPercent,
    }),
    serviceHealth(memoryStatus.service, {
      recordCount: memoryStatus.recordCount,
      publicRecordCount: memoryStatus.publicRecordCount,
      restrictedRecordCount: memoryStatus.restrictedRecordCount,
      legalHoldRecordCount: memoryStatus.legalHoldRecordCount,
    }),
    serviceHealth(terraStatus.service, {
      layerCount: terraStatus.layerCount,
      sceneCount: terraStatus.sceneCount,
      connectorRunCount: terraStatus.connectorRunCount,
    }),
    serviceHealth(partnerStatus.service, {
      countsAuthoritative: trustRegistryStatus.mode === "development_memory",
      organizationCount: partnerStatus.organizationCount,
      activePartnerCount: partnerStatus.activePartnerCount,
      membershipCount: partnerStatus.membershipCount,
      accreditationCount: partnerStatus.accreditationCount,
      dataSharingAgreementCount: partnerStatus.dataSharingAgreementCount,
      revokedDataSharingAgreementCount: partnerStatus.revokedDataSharingAgreementCount,
      dataSharingAgreementRevocationCount: partnerStatus.dataSharingAgreementRevocationCount,
      supersededDataSharingAgreementCount: partnerStatus.supersededDataSharingAgreementCount,
      dataSharingAgreementSupersessionCount: partnerStatus.dataSharingAgreementSupersessionCount,
      dataAccessRequestCount: partnerStatus.dataAccessRequestCount,
      pendingDataAccessRequestCount: partnerStatus.pendingDataAccessRequestCount,
      approvedDataAccessRequestCount: partnerStatus.approvedDataAccessRequestCount,
      dataAccessDeliveryReceiptCount: partnerStatus.dataAccessDeliveryReceiptCount,
      dataUseAttestationCount: partnerStatus.dataUseAttestationCount,
      challengedDataUseAttestationCount: partnerStatus.challengedDataUseAttestationCount,
      dataUseEnforcementCaseCount: partnerStatus.dataUseEnforcementCaseCount,
      openDataUseEnforcementCaseCount: partnerStatus.openDataUseEnforcementCaseCount,
      revokedDataUseEnforcementCaseCount: partnerStatus.revokedDataUseEnforcementCaseCount,
      dataAccessRestrictionCount: partnerStatus.dataAccessRestrictionCount,
      activeDataAccessRestrictionCount: partnerStatus.activeDataAccessRestrictionCount,
      revokedDataAccessRestrictionCount: partnerStatus.revokedDataAccessRestrictionCount,
      dataAccessAccountabilityPacketCount: partnerStatus.dataAccessAccountabilityPacketCount,
      dataAccessAccountabilityVerificationCount: partnerStatus.dataAccessAccountabilityVerificationCount,
      failedDataAccessAccountabilityVerificationCount: partnerStatus.failedDataAccessAccountabilityVerificationCount,
      dataAccessAccountabilityDisclosureCount: partnerStatus.dataAccessAccountabilityDisclosureCount,
      staleDataAccessAccountabilityDisclosureCount: partnerStatus.staleDataAccessAccountabilityDisclosureCount,
      dataAccessAccountabilityDisclosureChallengeCount: partnerStatus.dataAccessAccountabilityDisclosureChallengeCount,
      openDataAccessAccountabilityDisclosureChallengeCount: partnerStatus.openDataAccessAccountabilityDisclosureChallengeCount,
      dataAccessAccountabilityDisclosureResolutionCount: partnerStatus.dataAccessAccountabilityDisclosureResolutionCount,
      dataAccessAccountabilityDisclosureNoticeCount: partnerStatus.dataAccessAccountabilityDisclosureNoticeCount,
      withdrawnDataAccessAccountabilityDisclosureCount: partnerStatus.withdrawnDataAccessAccountabilityDisclosureCount,
      correctedDataAccessAccountabilityDisclosureCount: partnerStatus.correctedDataAccessAccountabilityDisclosureCount,
    }),
    serviceHealth(institutionalReportingStatus.service, {
      frameworkPackageCount: institutionalReportingStatus.frameworkPackageCount,
      investorReviewPackageCount: institutionalReportingStatus.investorReviewPackageCount,
      supportedFrameworkCount: institutionalReportingStatus.supportedFrameworks.length,
    }),
    serviceHealth(fundingStatus.service, {
      sourceCount: fundingStatus.sourceCount,
      allocationCount: fundingStatus.allocationCount,
      milestoneCount: fundingStatus.milestoneCount,
      evidenceLinkCount: fundingStatus.evidenceLinkCount,
    }),
    serviceHealth(riskStatus.service, {
      activeAlertCount: riskStatus.activeAlertCount,
      criticalAlertCount: riskStatus.criticalAlertCount,
      signalCount: riskStatus.signalCount,
      responseCount: riskStatus.responseCount,
      dispatchReceiptCount: riskStatus.dispatchReceiptCount,
      responsePlaybookCount: riskStatus.responsePlaybookCount,
      responseActivationCount: riskStatus.responseActivationCount,
      responseClosureCount: riskStatus.responseClosureCount,
      afterActionReviewCount: riskStatus.afterActionReviewCount,
    }),
    serviceHealth(agentStatus.service, {
      agentCount: agentStatus.agentCount,
      activeAgentCount: agentStatus.activeAgentCount,
      eventCount: agentStatus.eventCount,
    }),
    serviceHealth(securityStatus.service, {
      policyCount: securityStatus.policyCount,
      abuseSignalCount: securityStatus.abuseSignalCount,
      activeBucketCount: securityStatus.activeBucketCount,
    }),
    serviceHealth(identityAuthenticationStatus.service, {
      configured: identityAuthenticationStatus.configured,
      mode: identityAuthenticationStatus.mode,
      environmentModeSafe:
        !identityAuthenticationStatus.production || identityAuthenticationStatus.mode === "cloudflare_access_jwt",
      rawActorHeadersRejectedInProduction: identityAuthenticationStatus.safety.rawActorHeadersRejectedInProduction,
    }),
    serviceHealth(authorizationBindingStatus.service, {
      configured: authorizationBindingStatus.configured,
      mode: authorizationBindingStatus.mode,
      databaseConfigured: authorizationBindingStatus.databaseConfigured,
      durableParticipantRequiredInProduction:
        authorizationBindingStatus.safety.durableParticipantRequiredInProduction,
      membershipRevocationChecked: authorizationBindingStatus.safety.membershipRevocationChecked,
      latestAccreditationChecked: authorizationBindingStatus.safety.latestAccreditationChecked,
    }),
    serviceHealth(trustRegistryStatus.service, {
      configured: trustRegistryStatus.configured,
      mode: trustRegistryStatus.mode,
      authorityCommandsDurable: trustRegistryStatus.authorityCommandsDurable,
      dataSharingAgreementCommandsDurable: trustRegistryStatus.dataSharingAgreementCommandsDurable,
      dataAccessRequestCommandsDurable: trustRegistryStatus.dataAccessRequestCommandsDurable,
      dataAccessDeliveryReceiptCommandsDurable: trustRegistryStatus.dataAccessDeliveryReceiptCommandsDurable,
      dataUseAttestationCommandsDurable: trustRegistryStatus.dataUseAttestationCommandsDurable,
      dataUseEnforcementCaseCommandsDurable: trustRegistryStatus.dataUseEnforcementCaseCommandsDurable,
      dataAccessRestrictionCommandsDurable: trustRegistryStatus.dataAccessRestrictionCommandsDurable,
      dataAccessAccountabilityPacketCommandsDurable: trustRegistryStatus.dataAccessAccountabilityPacketCommandsDurable,
      dataAccessAccountabilityVerificationCommandsDurable:
        trustRegistryStatus.dataAccessAccountabilityVerificationCommandsDurable,
      dataAccessAccountabilityDisclosureCommandsDurable:
        trustRegistryStatus.dataAccessAccountabilityDisclosureCommandsDurable,
      dataAccessAccountabilityDisclosureChallengeCommandsDurable:
        trustRegistryStatus.dataAccessAccountabilityDisclosureChallengeCommandsDurable,
      auditExportManifestCommandsDurable: trustRegistryStatus.auditExportManifestCommandsDurable,
      pendingPartnerWorkflowAdapters: trustRegistryStatus.pendingPartnerWorkflowAdapters,
      noProductionMemoryFallback: trustRegistryStatus.safety.noProductionMemoryFallback,
      semanticEventsAppendOnly: trustRegistryStatus.safety.semanticEventsAppendOnly,
    }),
    serviceHealth(resilienceStatus.service, {
      drillCount: resilienceStatus.drillCount,
      failedDrillCount: resilienceStatus.failedDrillCount,
      recoveryDrillCount: resilienceStatus.recoveryDrillCount,
      databaseFailureDrillCount: resilienceStatus.databaseFailureDrillCount,
      apiOutageDrillCount: resilienceStatus.apiOutageDrillCount,
      failClosedSafe: resilienceStatus.failedDrillCount === 0,
    }),
    serviceHealth(governanceStatus.service, {
      policyCount: governanceStatus.policyCount,
      approvalCount: governanceStatus.approvalCount,
      conflictDisclosureCount: governanceStatus.conflictDisclosureCount,
      unresolvedConflictCount: governanceStatus.unresolvedConflictCount,
    }),
    serviceHealth(databaseAuditTransparencyStatus.service, {
      maxEventsPerVerification: databaseAuditTransparencyStatus.maxEventsPerVerification,
      hashOnlyInput: databaseAuditTransparencyStatus.safety.hashOnlyInput,
      rawRowsExcluded: databaseAuditTransparencyStatus.safety.rawRowsExcluded,
      sequenceContinuityChecked: databaseAuditTransparencyStatus.safety.sequenceContinuityChecked,
      independentReplayRequired: databaseAuditTransparencyStatus.safety.independentReplayRequired,
    }),
  ], canopyProofOtlpExporter.getStatus());
}

seedCanopyProofProjectRegistry();

export const app = new Hono<DropinApiEnvironment>();

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? origin),
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
  }),
);

app.onError((error, c) => {
  logger.error({ error: error.message, path: c.req.path }, "request failed");
  if (error instanceof CanopyProofAuthenticationError) {
    return c.json(
      {
        ok: false,
        error: error.code,
      },
      error.httpStatus,
    );
  }
  if (error instanceof CanopyProofAuthorizationError) {
    return c.json(
      {
        ok: false,
        error: error.code,
      },
      error.httpStatus,
    );
  }
  if (error instanceof CanopyProofTrustRegistryError) {
    return c.json(
      {
        ok: false,
        error: error.code,
      },
      error.httpStatus,
    );
  }
  if (error instanceof CanopyProofGlobalCommandCenterError) {
    c.header("cache-control", "private, no-store");
    return c.json(
      {
        ok: false,
        error: error.code,
      },
      error.httpStatus,
    );
  }
  if (error instanceof NasaGibsError) {
    return c.json(
      {
        ok: false,
        error: error.code,
      },
      error.httpStatus,
    );
  }
  if (error.message.startsWith("CANOPYPROOF_RBAC_DENIED")) {
    return c.json(
      {
        ok: false,
        error: error.message,
      },
      403,
    );
  }
  return c.json(
    {
      ok: false,
      error: error.message,
    },
    400,
  );
});

app.use("*", async (c, next) => {
  const startedAtMs = Date.now();
  const edgeRequestId = c.req.header("x-dropin-edge-request-id")?.trim();
  const requestId = edgeRequestId || createApiRequestId();
  c.header("x-dropin-request-id", requestId);
  if (edgeRequestId) {
    c.header("x-dropin-edge-request-id", edgeRequestId);
  }
  const candidateTraceparent = c.req.header("traceparent")?.trim();
  const traceparent = parseCanopyProofTraceparent(candidateTraceparent) ? candidateTraceparent?.toLowerCase() : undefined;
  if (traceparent) {
    c.header("traceparent", traceparent);
  }
  let authenticatedPrincipal: CanopyProofAuthenticatedPrincipal | undefined;
  const writeTelemetryHeaders = (status: number) => {
    const endedAtMs = Date.now();
    const telemetry = buildCanopyProofRequestTelemetry({
      requestId,
      ...(edgeRequestId ? { edgeRequestId } : {}),
      ...(traceparent ? { traceparent } : {}),
      route: canopyProofTelemetryRouteTemplate(c.req.path, c.req.routePath),
      method: c.req.method,
      status,
      durationMs: endedAtMs - startedAtMs,
      ...(authenticatedPrincipal ? { actorId: authenticatedPrincipal.actorId, actorRole: authenticatedPrincipal.role } : {}),
      startedAt: new Date(startedAtMs).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
    });
    c.header("x-dropin-trace-id", telemetry.traceId);
    c.header("x-dropin-span-id", telemetry.spanId);
    c.header("x-dropin-telemetry-event-hash", telemetry.eventHash);
    const span = buildCanopyProofOpenTelemetrySpan(telemetry);
    c.header("x-dropin-otel-span-hash", span.spanHash);
    c.header("server-timing", `canopyproof;dur=${telemetry.durationMs}`);
    canopyProofOtlpExporter.enqueue(telemetry, span);
  };
  if (c.req.path.startsWith("/canopyproof/") && c.req.method !== "OPTIONS") {
    try {
      authenticatedPrincipal = await authenticateCanopyProofRequest(c.req.raw.headers, process.env);
      c.set("canopyProofPrincipal", authenticatedPrincipal);
    } catch (error) {
      if (error instanceof CanopyProofAuthenticationError) {
        const remoteAddress = c.req.header("cf-connecting-ip")?.trim() ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
        canopyProofSecurityService.recordAuthenticationFailure({
          route: c.req.path,
          method: c.req.method,
          ...(remoteAddress ? { remoteAddress } : {}),
          configurationInvalid: error.code === "CANOPYPROOF_AUTH_CONFIG_INVALID",
        });
        writeTelemetryHeaders(error.httpStatus);
        return c.json({ ok: false, error: error.code }, error.httpStatus);
      }
      throw error;
    }
    const remoteAddress = c.req.header("cf-connecting-ip")?.trim() ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const evaluation = canopyProofSecurityService.evaluateRequest({
      path: c.req.path,
      method: c.req.method,
      ...(authenticatedPrincipal ? { actorId: authenticatedPrincipal.actorId } : {}),
      ...(remoteAddress ? { remoteAddress } : {}),
    });
    c.header("x-ratelimit-limit", String(evaluation.policy.maxRequests));
    c.header("x-ratelimit-remaining", String(evaluation.remaining));
    c.header("x-ratelimit-reset", evaluation.resetAt);
    if (!evaluation.allowed) {
      if (evaluation.policy.actorRequired && !authenticatedPrincipal) {
        writeTelemetryHeaders(401);
        return c.json(
          {
            ok: false,
            error: "CANOPYPROOF_AUTH_REQUIRED",
          },
          401,
        );
      }
      c.header("retry-after", String(evaluation.retryAfterSeconds));
      writeTelemetryHeaders(429);
      return c.json(
        {
          ok: false,
          error: "CANOPYPROOF_RATE_LIMITED",
          retryAfterSeconds: evaluation.retryAfterSeconds,
          tier: evaluation.tier,
        },
        429,
      );
    }
    if (
      canopyProofIsLegacyEvidenceNetworkRoute(c.req.path) &&
      !canopyProofLegacyEvidenceNetworkEnabled(process.env)
    ) {
      writeTelemetryHeaders(503);
      return c.json({ ok: false, error: "CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_DISABLED" }, 503);
    }
    if (authenticatedPrincipal) {
      try {
        const registry =
          authenticatedPrincipal.authenticationMethod === "cloudflare_access_jwt" &&
          process.env.DATABASE_URL?.trim() &&
          process.env.DROPIN_REPOSITORY === "prisma"
            ? (canopyProofAuthorizationRegistry ??= new PrismaCanopyProofAuthorizationRegistry(getPrisma()))
            : undefined;
        const binding = await bindCanopyProofAuthorizationPrincipal(authenticatedPrincipal, process.env, registry);
        c.set("canopyProofAuthorizationBinding", binding);
      } catch (error) {
        if (error instanceof CanopyProofAuthorizationError) {
          canopyProofSecurityService.recordAuthorizationFailure({
            actorId: authenticatedPrincipal.actorId,
            route: c.req.path,
            method: c.req.method,
            registryUnavailable: error.code === "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
          });
          writeTelemetryHeaders(error.httpStatus);
          return c.json({ ok: false, error: error.code }, error.httpStatus);
        }
        throw error;
      }
    }
    if (
      canopyProofAuthorizationBindingStatus(process.env).mode === "enforced" &&
      (canopyProofRequiresPendingPartnerPersistence(c.req.path) ||
        canopyProofRequiresPendingEvidencePersistence(c.req.path) ||
        canopyProofRequiresPendingVerificationPersistence(c.req.path))
    ) {
      writeTelemetryHeaders(503);
      return c.json({ ok: false, error: "CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE" }, 503);
    }
  }
  await next();
  writeTelemetryHeaders(c.res.status);
});

async function actorFromRequest(req: { json(): Promise<unknown> }) {
  const body = await req.json().catch(() => ({}));
  if (body && typeof body === "object" && "actor" in body && typeof (body as { actor?: unknown }).actor === "string") {
    return (body as { actor: string }).actor;
  }
  return "api-admin";
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "dropin-earth-api",
    version: "0.1.0",
    doctrine: "No proof, no certificate.",
  }),
);

app.get("/public/launch-pack", (c) =>
  c.json({
    ok: true,
    data: {
      campaignId: "campaign_v1_ggw_testnet",
      title: "Dropin Earth Great Green Wall Testnet Campaign",
      status: "testnet_only",
      limitations: [
        "No mainnet payment rail",
        "No private keys",
        "No automatic $CANOPY distribution",
        "Leaf Points are non-transferable testnet points",
        "Impact Certificate is not a certified carbon credit",
        "RWA Fragment is not guaranteed yield",
        "$CANOPY does not offset carbon tax",
      ],
      docs: [
        { id: "landing_page_copy", title: "Landing Page Copy", path: "docs/launch-pack/landing-page-copy.md" },
        { id: "twitter_thread", title: "Twitter Thread", path: "docs/launch-pack/twitter-thread.md" },
        { id: "telegram_announcement", title: "Telegram Announcement", path: "docs/launch-pack/telegram-announcement.md" },
        { id: "user_guide", title: "User Guide", path: "docs/launch-pack/user-guide.md" },
        { id: "faq", title: "FAQ", path: "docs/launch-pack/faq.md" },
        { id: "risk_disclosure", title: "Risk Disclosure", path: "docs/launch-pack/risk-disclosure.md" },
        { id: "red_team_challenge_guide", title: "Red-Team Challenge Guide", path: "docs/launch-pack/red-team-challenge-guide.md" },
        { id: "public_impact_report_template", title: "Public Impact Report Template", path: "docs/launch-pack/public-impact-report-template.md" },
      ],
      routes: {
        webCampaign: "/campaigns/campaign_v1_ggw_testnet",
        miniCampaign: "/campaign/campaign_v1_ggw_testnet",
        faq: "/faq",
        redTeam: "/red-team",
        feedback: "/feedback",
        challenges: "/challenges",
      },
    },
  }),
);

app.get("/ready", async (c) => {
  const report = await readinessService.getReadiness(c.req.query("campaignId") ?? "campaign_v1_ggw_testnet");
  return c.json({ ok: true, data: report });
});

app.get("/metrics", async (c) =>
  c.text([
    await metricsService.textMetrics(),
    renderCanopyProofMetrics(canopyProofObservabilityStatus()),
    renderNasaGibsMetrics(nasaGibsConnector().metrics()),
  ].join("\n")),
);

app.get("/status/system", async (c) => c.json({ ok: true, data: await statusService.getSystemStatus() }));

app.get("/admin/launch/readiness", async (c) => {
  const report = await readinessService.getReadiness(c.req.query("campaignId") ?? "campaign_v1_ggw_testnet");
  return c.json({ ok: true, data: report });
});

app.post("/admin/launch/check", async (c) => {
  const result = await readinessService.runLaunchCheck(await c.req.json());
  return c.json({ ok: true, data: result }, 201);
});

app.get("/regions", async (c) => c.json({ ok: true, data: await lotteryService.listRegions() }));

app.get("/regions/:id", async (c) => {
  const regions = await lotteryService.listRegions();
  const region = regions.find((item) => item.id === c.req.param("id"));
  if (!region) {
    return c.json({ ok: false, error: "Region not found" }, 404);
  }
  const species = await lotteryService.listSpecies(region.id);
  return c.json({ ok: true, data: { ...region, species } });
});

app.get("/species", async (c) => c.json({ ok: true, data: await lotteryService.listSpecies() }));

app.get("/lottery/rounds", async (c) =>
  c.json({
    ok: true,
    data: await lotteryService.listRounds(),
  }),
);

app.get("/lottery/rounds/:id", async (c) => {
  const detail = await lotteryService.getRoundDetail(c.req.param("id"));
  return c.json({
    ok: true,
    data: detail,
  });
});

app.post("/lottery/rounds/:id/enter", async (c) => {
  const result = await lotteryService.enterRound(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result }, result.idempotent ? 200 : 201);
});

app.post("/admin/lottery/rounds/:id/close", async (c) => {
  const round = await lotteryService.closeRound(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: round });
});

app.post("/admin/lottery/rounds/:id/finalize", async (c) => {
  const result = await lotteryService.finalizeRound(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: result });
});

app.post("/lottery/rounds/:id/close", async (c) => {
  const round = await lotteryService.closeRound(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: round });
});

app.post("/lottery/rounds/:id/finalize", async (c) => {
  const result = await lotteryService.finalizeRound(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: result });
});

app.get("/lottery/rounds/:id/results", async (c) => {
  const result = await lotteryService.getResults(c.req.param("id"));
  return c.json({ ok: true, data: result });
});

app.get("/me/tickets", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  return c.json({ ok: true, data: await lotteryService.listTicketsForUser(userId) });
});

app.get("/me/drops", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  return c.json({ ok: true, data: await lotteryService.listDropsForUser(userId) });
});

app.get("/me/rwa-fragments", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  return c.json({ ok: true, data: await lotteryService.listRwaFragmentsForUser(userId) });
});

app.post("/payments/intents", async (c) => {
  const result = await paymentService.createIntent(await c.req.json());
  return c.json({ ok: true, data: result }, result.idempotent ? 200 : 201);
});

app.get("/payments/intents", async (c) => c.json({ ok: true, data: await paymentService.listIntents() }));

app.get("/payments/intents/:id", async (c) => {
  const detail = await paymentService.getIntentDetail(c.req.param("id"));
  return c.json({ ok: true, data: detail });
});

app.get("/payments/intents/:id/instructions", async (c) => {
  const instructions = await paymentService.getInstructions(c.req.param("id"));
  return c.json({ ok: true, data: instructions });
});

app.post("/payments/intents/:id/submit", async (c) => {
  const intent = await paymentService.submitIntent(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: intent });
});

app.post("/payments/intents/:id/verify", async (c) => {
  const result = await paymentService.verifyIntent(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result }, result.idempotent ? 200 : 201);
});

app.post("/admin/payments/:id/confirm", async (c) => {
  const intent = await paymentService.confirmIntent(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: intent });
});

app.post("/admin/payments/:id/fail", async (c) => {
  const intent = await paymentService.failIntent(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: intent });
});

app.post("/admin/payments/reconcile", async (c) => {
  const report = await paymentService.reconcile(await c.req.json());
  return c.json({ ok: true, data: report }, 201);
});

app.get("/payments/reconciliation", async (c) =>
  c.json({ ok: true, data: await paymentService.listReconciliationReports() }),
);

app.post("/telegram/session", async (c) => {
  const session = await telegramService.createSession(await c.req.json());
  return c.json({ ok: true, data: session }, 201);
});

app.get("/telegram/me", async (c) => {
  const data = await telegramService.getMe({
    telegramUserId: c.req.query("telegramUserId"),
    userId: c.req.query("userId") ?? "telegram_10001",
  });
  return c.json({ ok: true, data });
});

app.get("/telegram/rounds", async (c) => c.json({ ok: true, data: await telegramService.getRounds() }));

app.get("/telegram/forest", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  return c.json({ ok: true, data: await telegramService.getForest(userId) });
});

app.post("/telegram/share-ticket", async (c) => {
  const share = await telegramService.shareTicket(await c.req.json());
  return c.json({ ok: true, data: share }, 201);
});

app.post("/telegram/referrals/claim", async (c) => {
  const claim = await telegramService.claimReferral(await c.req.json());
  return c.json({ ok: true, data: claim }, claim.idempotent ? 200 : 201);
});

app.get("/campaigns", async (c) => c.json({ ok: true, data: await campaignService.listCampaigns() }));

app.post("/admin/campaigns", async (c) => {
  const campaign = await campaignService.createCampaign(await c.req.json(), "api-admin");
  return c.json({ ok: true, data: campaign }, 201);
});

app.post("/admin/campaigns/:id/schedule", async (c) => {
  const campaign = await campaignService.scheduleCampaign(c.req.param("id"), await actorFromRequest(c.req));
  return c.json({ ok: true, data: campaign });
});

app.post("/admin/campaigns/:id/start", async (c) => {
  const campaign = await campaignService.startCampaign(c.req.param("id"), await actorFromRequest(c.req));
  return c.json({ ok: true, data: campaign });
});

app.post("/admin/campaigns/:id/end", async (c) => {
  const campaign = await campaignService.endCampaign(c.req.param("id"), await actorFromRequest(c.req));
  return c.json({ ok: true, data: campaign });
});

app.post("/admin/campaigns/:id/finalize", async (c) => {
  const result = await campaignService.finalizeCampaign(c.req.param("id"), await actorFromRequest(c.req));
  return c.json({ ok: true, data: result });
});

app.get("/campaigns/:id/leaderboard", async (c) =>
  c.json({ ok: true, data: await campaignService.getLeaderboard(c.req.param("id")) }),
);

app.get("/campaigns/:id/report", async (c) =>
  c.json({ ok: true, data: await campaignService.getReport(c.req.param("id")) }),
);

app.post("/campaigns/:id/join", async (c) => {
  const result = await campaignService.joinCampaign(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result }, result.idempotent ? 200 : 201);
});

app.get("/campaigns/:id/me", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  return c.json({ ok: true, data: await campaignService.getCampaignMe(c.req.param("id"), userId) });
});

app.get("/me/leaf-points", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  return c.json({ ok: true, data: await campaignService.getLeafPoints(userId) });
});

app.get("/campaigns/:id/leaf-points", async (c) =>
  c.json({ ok: true, data: await campaignService.getCampaignLeafPoints(c.req.param("id")) }),
);

app.get("/campaigns/:id", async (c) => {
  const detail = await campaignService.getCampaignDetail(c.req.param("id"));
  return c.json({ ok: true, data: detail });
});

app.post("/feedback", async (c) => {
  const feedback = await feedbackService.createFeedback(await c.req.json());
  return c.json({ ok: true, data: feedback }, 201);
});

app.get("/admin/feedback", async (c) => c.json({ ok: true, data: await feedbackService.listFeedback() }));

app.post("/admin/feedback/:id/resolve", async (c) => {
  const feedback = await feedbackService.resolveFeedback(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: feedback });
});

app.get("/projects", async (c) => c.json({ ok: true, data: await impactService.listProjects() }));

app.get("/projects/:id", async (c) => {
  const project = await impactService.getProjectDetail(c.req.param("id"));
  return c.json({ ok: true, data: project });
});

app.post("/admin/projects", async (c) => {
  const project = await impactService.createProject(await c.req.json(), "api-admin");
  return c.json({ ok: true, data: project }, 201);
});

app.post("/admin/projects/:id/milestones", async (c) => {
  const milestone = await impactService.createMilestone(c.req.param("id"), await c.req.json(), "api-admin");
  return c.json({ ok: true, data: milestone }, 201);
});

app.post("/admin/projects/:id/approve", async (c) => {
  const project = await impactService.approveProject(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: project });
});

app.post("/admin/projects/:id/fund", async (c) => {
  const project = await impactService.fundProject(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: project });
});

app.post("/admin/projects/:id/release-milestone", async (c) => {
  const result = await impactService.releaseMilestone(c.req.param("id"), await c.req.json(), "api-admin");
  return c.json({ ok: true, data: result });
});

app.get("/fund/allocations", async (c) => c.json({ ok: true, data: await fundService.listAllocations() }));

app.get("/fund/allocations/:id", async (c) => {
  const allocation = await fundService.getAllocation(c.req.param("id"));
  return c.json({ ok: true, data: allocation });
});

app.post("/admin/fund/allocations", async (c) => {
  const allocation = await fundService.createAllocation(await c.req.json(), "api-admin");
  return c.json({ ok: true, data: allocation }, 201);
});

app.post("/admin/fund/allocations/:id/approve", async (c) => {
  const allocation = await fundService.approveAllocation(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: allocation });
});

app.post("/admin/fund/allocations/:id/release", async (c) => {
  const allocation = await fundService.releaseAllocation(c.req.param("id"), "api-admin");
  return c.json({ ok: true, data: allocation });
});

app.post("/admin/fund/allocations/:id/challenge", async (c) => {
  const allocation = await fundService.challengeAllocation(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: allocation });
});

app.get("/treasury/accounts", async (c) => c.json({ ok: true, data: await fundService.listTreasuryAccounts() }));

app.get("/treasury/transactions", async (c) =>
  c.json({ ok: true, data: await fundService.listTreasuryTransactions() }),
);

app.get("/projects/:projectId/milestones/:milestoneId/settlement", async (c) => {
  const settlement = await fundService.getMilestoneSettlement(c.req.param("projectId"), c.req.param("milestoneId"));
  return c.json({ ok: true, data: settlement });
});

app.post("/admin/projects/:projectId/milestones/:milestoneId/release", async (c) => {
  const result = await fundService.releaseMilestone(
    c.req.param("projectId"),
    c.req.param("milestoneId"),
    await c.req.json(),
  );
  return c.json({ ok: true, data: result }, 201);
});

app.post("/admin/projects/:projectId/milestones/:milestoneId/settle", async (c) => {
  const result = await fundService.settleMilestone(
    c.req.param("projectId"),
    c.req.param("milestoneId"),
    await c.req.json(),
  );
  return c.json({ ok: true, data: { ...result, settlement: settlementDisclosure(result.settlement) } }, 201);
});

app.get("/settlements", async (c) =>
  c.json({ ok: true, data: (await fundService.listSettlementCertificates()).map(settlementDisclosure) }),
);

app.get("/milestone-releases", async (c) => c.json({ ok: true, data: await fundService.listMilestoneReleases() }));

app.post("/evidence", async (c) => {
  const evidence = await evidenceService.uploadEvidence(await c.req.json());
  return c.json({ ok: true, data: evidence }, 201);
});

app.get("/evidence", async (c) => c.json({ ok: true, data: await evidenceService.listEvidence() }));

app.get("/evidence/:id", async (c) => {
  const evidence = await evidenceService.getEvidence(c.req.param("id"));
  return c.json({ ok: true, data: evidence });
});

app.post("/admin/evidence/:id/review", async (c) => {
  const evidence = await evidenceService.reviewEvidence(c.req.param("id"), await c.req.json(), "api-admin");
  return c.json({ ok: true, data: evidence });
});

app.post("/impact-certificates", async (c) => {
  const certificate = await certificateService.issueCertificate(await c.req.json(), "api-admin");
  return c.json({ ok: true, data: certificateDisclosure(certificate) }, 201);
});

app.get("/impact-certificates", async (c) =>
  c.json({ ok: true, data: (await certificateService.listCertificates()).map(certificateDisclosure) }),
);

app.get("/impact-certificates/:id", async (c) => {
  const certificate = await certificateService.getCertificate(c.req.param("id"));
  return c.json({ ok: true, data: certificateDisclosure(certificate) });
});

app.post("/impact-certificates/:id/challenge", async (c) => {
  const result = await certificateService.challengeCertificate(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result }, 201);
});

app.get("/risk/events", async (c) => c.json({ ok: true, data: await riskService.listRiskEvents() }));

app.get("/risk/events/:id", async (c) => {
  const event = await riskService.getRiskEvent(c.req.param("id"));
  return c.json({ ok: true, data: event });
});

app.post("/risk/score", async (c) => {
  const score = await riskService.score(await c.req.json());
  return c.json({ ok: true, data: score }, 201);
});

app.post("/admin/risk/events/:id/resolve", async (c) => {
  const event = await riskService.resolveRiskEvent(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: event });
});

app.post("/drops/:id/claim", async (c) => {
  const decision = await riskService.claimDrop(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: decision });
});

app.post("/rwa-fragments/:id/claim", async (c) => {
  const decision = await riskService.claimRwaFragment(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: decision });
});

app.post("/challenges", async (c) => {
  const challenge = await riskService.createChallenge(await c.req.json());
  return c.json({ ok: true, data: challenge }, 201);
});

app.get("/challenges", async (c) => c.json({ ok: true, data: await riskService.listChallenges() }));

app.get("/challenges/:id", async (c) => {
  const challenge = await riskService.getChallengeDetail(c.req.param("id"));
  return c.json({ ok: true, data: challenge });
});

app.post("/challenges/:id/evidence", async (c) => {
  const evidence = await riskService.addChallengeEvidence(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: evidence }, 201);
});

app.post("/admin/challenges/:id/accept", async (c) => {
  const result = await riskService.acceptChallenge(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result });
});

app.post("/admin/challenges/:id/reject", async (c) => {
  const result = await riskService.rejectChallenge(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result });
});

app.post("/admin/challenges/:id/resolve", async (c) => {
  const result = await riskService.resolveChallenge(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result });
});

app.get("/audit-logs", async (c) => {
  const [lotteryLogs, impactLogs, riskLogs, fundLogs, paymentLogs, campaignLogs, feedbackLogs, statusLogs] = await Promise.all([
    lotteryRepository.listAuditLogs(),
    impactRepository.listAuditLogs(),
    riskRepository.listAuditLogs(),
    fundRepository.listAuditLogs(),
    paymentRepository.listAuditLogs(),
    campaignRepository.listAuditLogs(),
    feedbackRepository.listAuditLogs(),
    statusRepository.listAuditLogs(),
  ]);
  return c.json({
    ok: true,
    data: [
      ...lotteryLogs,
      ...impactLogs,
      ...riskLogs,
      ...fundLogs,
      ...paymentLogs,
      ...campaignLogs,
      ...feedbackLogs,
      ...statusLogs,
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  });
});

app.get("/canopyproof/status", (c) => c.json({ ok: true, data: canopyProofService.getStatus() }));

app.get("/canopyproof/identity/status", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({ ok: true, data: durable ? await durable.getIdentityStatus() : canopyProofIdentityService.getStatus() });
});

app.post("/canopyproof/identity/participants", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "community", "agent"]);
  const body = await c.req.json();
  const participantType =
    typeof body === "object" && body !== null && "participantType" in body ? (body as { participantType?: unknown }).participantType : undefined;
  if (actor.role === "agent" && participantType !== "agent") {
    throw new Error("CANOPYPROOF_RBAC_DENIED: agent actors can only register agent identity participants.");
  }
  if (actor.role === "community" && participantType !== "human" && participantType !== "device") {
    throw new Error("CANOPYPROOF_RBAC_DENIED: community actors can only register human or device identity participants.");
  }
  const durable = canopyProofDurableTrustRegistry(c);
  const participant = durable
    ? await durable.registerParticipant(body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofIdentityService.registerParticipant(body, actor.id);
  return c.json({ ok: true, data: participant }, 201);
});

app.get("/canopyproof/identity/participants", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const filter: { participantType?: string; verificationStatus?: string; organizationId?: string } = {};
  const participantType = c.req.query("participantType");
  const verificationStatus = c.req.query("verificationStatus");
  const organizationId = c.req.query("organizationId");
  if (participantType) filter.participantType = participantType;
  if (verificationStatus) filter.verificationStatus = verificationStatus;
  if (organizationId) filter.organizationId = organizationId;
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({ ok: true, data: durable ? await durable.listParticipants(filter) : canopyProofIdentityService.listParticipants(filter) });
});

app.get("/canopyproof/identity/participants/:participantId", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.getParticipant(c.req.param("participantId"))
      : canopyProofIdentityService.getParticipant(c.req.param("participantId")),
  });
});

app.post("/canopyproof/identity/participants/:participantId/reputation-snapshots", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const snapshot = durable
    ? await durable.recordReputationSnapshot(
        c.req.param("participantId"),
        body,
        actor.id,
        canopyProofIdempotencyKey(c),
      )
    : canopyProofIdentityService.recordReputationSnapshot(c.req.param("participantId"), body, actor.id);
  return c.json({ ok: true, data: snapshot }, 201);
});

app.get("/canopyproof/identity/participants/:participantId/reputation-snapshots", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listReputationSnapshots(c.req.param("participantId"))
      : canopyProofIdentityService.listReputationSnapshots(c.req.param("participantId")),
  });
});

app.get("/canopyproof/memory/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofMemoryService.getStatus() });
});

app.post("/canopyproof/memory/records", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const record = canopyProofMemoryService.recordMemory(await c.req.json(), actor.id);
  return c.json({ ok: true, data: record }, 201);
});

app.get("/canopyproof/memory/records", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const filter: { subjectType?: string; subjectId?: string; projectId?: string; organizationId?: string; scope?: string; tag?: string } = {};
  const subjectType = c.req.query("subjectType");
  const subjectId = c.req.query("subjectId");
  const projectId = c.req.query("projectId");
  const organizationId = c.req.query("organizationId");
  const scope = c.req.query("scope");
  const tag = c.req.query("tag");
  if (subjectType) filter.subjectType = subjectType;
  if (subjectId) filter.subjectId = subjectId;
  if (projectId) filter.projectId = projectId;
  if (organizationId) filter.organizationId = organizationId;
  if (scope) filter.scope = scope;
  if (tag) filter.tag = tag;
  return c.json({
    ok: true,
    data: canopyProofMemoryService.listRecords(filter),
  });
});

app.get("/canopyproof/memory/records/:recordId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofMemoryService.getRecord(c.req.param("recordId")) });
});

app.post("/canopyproof/memory/recall", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofMemoryService.recall(await c.req.json()) });
});

app.get("/canopyproof/evidence-network/status", (c) => c.json({ ok: true, data: canopyProofEvidenceNetworkService.getStatus() }));

app.get("/canopyproof/dashboard/global", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const authority = durable
    ? "postgresql_append_only_snapshot" as const
    : "process_local_compatibility" as const;
  const data = durable
    ? await (canopyProofGlobalCommandCenterRepository ??=
        new PrismaCanopyProofGlobalCommandCenterRepository(getPrisma())).getLatestSnapshot()
    : buildCanopyProofGlobalCommandCenter({
        projectRegistry: canopyProofProjectRegistryService,
        proof: canopyProofService,
        terra: terraProofService,
        risk: canopyProofEarlyWarningService,
        funding: canopyProofFundingService,
      });
  const response = canopyProofGlobalCommandCenterResponseSchema.parse({
    ok: true,
    apiVersion: canopyProofGlobalCommandCenterApiVersion,
    authority,
    data,
  });
  c.header("cache-control", "private, no-store");
  return c.json(response);
});

app.get("/canopyproof/verification/queue/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofVerificationQueueService.getStatus() });
});

app.get("/canopyproof/agents/status", (c) => c.json({ ok: true, data: canopyProofAgentService.getStatus() }));

app.get("/canopyproof/agents", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofAgentService.listAgents() });
});

app.get("/canopyproof/agents/events", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofAgentService.listEvents(c.req.query("agentId")) });
});

app.post("/canopyproof/agents/events", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "agent"]);
  const body = await c.req.json();
  if (actor.role === "agent") {
    const requestedAgentId = typeof body === "object" && body !== null && "agentId" in body ? (body as { agentId?: unknown }).agentId : undefined;
    if (requestedAgentId !== actor.id) {
      throw new Error("CANOPYPROOF_RBAC_DENIED: agent actors can only submit events for their own agent identity.");
    }
  }
  const event = canopyProofAgentService.recordEvent(body, actor.id);
  return c.json({ ok: true, data: event }, 201);
});

app.get("/canopyproof/agents/:agentId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofAgentService.getAgent(c.req.param("agentId")) });
});

app.get("/canopyproof/observability/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofObservabilityStatus() });
});

app.get("/canopyproof/security/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({
    ok: true,
    data: {
      ...canopyProofSecurityService.getStatus(process.env),
      authentication: canopyProofAuthenticationStatus(process.env),
      authorization: canopyProofAuthorizationBindingStatus(process.env),
      trustRegistry: canopyProofTrustRegistryConfigurationStatus(process.env),
    },
  });
});

app.post("/canopyproof/security/access-decisions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const rawBody = await c.req.json();
  const body = typeof rawBody === "object" && rawBody !== null ? (rawBody as Record<string, unknown>) : {};
  const actorOrganizationId = c.get("canopyProofPrincipal")?.organizationId;
  const bodyString = (field: string) => {
    const value = body[field];
    return typeof value === "string" ? value.trim() : "";
  };
  const resourceOrganizationId = bodyString("resourceOrganizationId");
  const conflictStatus = bodyString("conflictStatus");
  const createdAt = bodyString("createdAt");
  const accessInput: CanopyProofAttributeAccessInput = {
    actorId: actor.id,
    actorRole: actor.role as CanopyProofAccessRole,
    ...(actorOrganizationId ? { actorOrganizationId } : {}),
    resource: bodyString("resource") as CanopyProofAccessResource,
    resourceId: bodyString("resourceId"),
    ...(resourceOrganizationId ? { resourceOrganizationId } : {}),
    classification: bodyString("classification") as CanopyProofAccessClassification,
    purpose: bodyString("purpose") as CanopyProofAccessPurpose,
    action: bodyString("action") as CanopyProofAccessAction,
    ...(conflictStatus ? { conflictStatus: conflictStatus as CanopyProofConflictStatus } : {}),
    hasGovernanceApproval: body.hasGovernanceApproval === true,
    ...(createdAt ? { createdAt } : {}),
  };
  const decision = canopyProofSecurityService.evaluateAttributeAccess(accessInput);
  return c.json({ ok: true, data: decision }, decision.allowed ? 201 : 202);
});

app.post("/canopyproof/audit/verify", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const rawBody = await c.req.json();
  const body = typeof rawBody === "object" && rawBody !== null ? (rawBody as Record<string, unknown>) : {};
  const requestedVerifiedAt = typeof body.verifiedAt === "string" && body.verifiedAt.trim() ? body.verifiedAt.trim() : undefined;
  const verifiedAt = requestedVerifiedAt ?? new Date(0).toISOString();
  const verification = verifyCanopyProofAuditChain(canopyProofAuditVerificationEntriesFromRequest(rawBody), verifiedAt);
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: verification.valid ? "ASSERT" : "CHALLENGE",
    actor: actor.id,
    entityType: "audit_verification",
    entityId: `cp_audit_verification_${verification.chainRoot.slice(0, 24)}`,
    payload: {
      eventCount: verification.eventCount,
      terminalRoot: verification.terminalRoot,
      chainRoot: verification.chainRoot,
      valid: verification.valid,
      issueCodes: verification.issues.map((issue) => issue.code),
      verifiedAt,
    },
    createdAt: verifiedAt,
    rationale: verification.valid
      ? "CanopyProof audit chain verification passed with recomputed roots and linked previous roots."
      : "CanopyProof audit chain verification detected tampering or incomplete lineage.",
  }).at(-1);
  if (!auditEvent) {
    throw new Error("CanopyProof audit chain verification failed to append verification event.");
  }
  return c.json({ ok: true, data: { ...verification, auditEvent } }, verification.valid ? 200 : 422);
});

app.get("/canopyproof/audit/database-streams/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofDatabaseAuditTransparencyStatus() });
});

app.post("/canopyproof/audit/database-streams/verify", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const verification = verifyCanopyProofDatabaseAuditStream(await c.req.json());
  return c.json({ ok: true, data: verification }, verification.valid ? 200 : 422);
});

app.get("/canopyproof/audit/attestations/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofAuditAttestationService.getStatus() });
});

app.post("/canopyproof/audit/attestations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "accredited_organization");
  const attestation = canopyProofAuditAttestationService.createAttestation(await c.req.json(), actor.id);
  return c.json({ ok: true, data: attestation }, attestation.decision === "attest" ? 201 : 202);
});

app.get("/canopyproof/audit/attestations", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const scope = canopyProofAuditAttestationScopeFromQuery(c.req.query("scope"));
  const decision = canopyProofAuditAttestationDecisionFromQuery(c.req.query("decision"));
  const subjectId = c.req.query("subjectId")?.trim();
  const filter: {
    scope?: CanopyProofAuditAttestationScope;
    subjectId?: string;
    decision?: CanopyProofAuditAttestationDecision;
  } = {
    ...(scope ? { scope } : {}),
    ...(decision ? { decision } : {}),
    ...(subjectId ? { subjectId } : {}),
  };
  return c.json({ ok: true, data: canopyProofAuditAttestationService.listAttestations(filter) });
});

app.get("/canopyproof/audit/attestations/:attestationId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofAuditAttestationService.getAttestation(c.req.param("attestationId")) });
});

app.get("/canopyproof/audit/export-manifests/status", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const organizationId = requireCanopyProofActorOrganizationId(actor);
  return c.json({
    ok: true,
    data: durable && organizationId
      ? await durable.getAuditExportManifestStatus(organizationId)
      : canopyProofAuditExportManifestService.getStatus(),
  });
});

app.post("/canopyproof/audit/export-manifests", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "verified_organization");
  const body = await c.req.json();
  const requesterOrganizationId =
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as { requesterOrganizationId?: unknown }).requesterOrganizationId === "string"
      ? (body as { requesterOrganizationId: string }).requesterOrganizationId.trim()
      : "";
  if (requesterOrganizationId) assertCanopyProofActorOrganization(actor, requesterOrganizationId);
  const durable = canopyProofDurableTrustRegistry(c);
  const manifest = durable
    ? await durable.createAuditExportManifest(body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofAuditExportManifestService.createManifest(body, actor.id);
  return c.json({ ok: true, data: manifest }, 201);
});

app.get("/canopyproof/audit/export-manifests", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const scope = canopyProofAuditExportScopeFromQuery(c.req.query("scope"));
  const classification = canopyProofAuditExportClassificationFromQuery(c.req.query("classification"));
  const subjectId = c.req.query("subjectId")?.trim();
  const filter: {
    scope?: CanopyProofAuditExportScope;
    subjectId?: string;
    classification?: CanopyProofAuditExportClassification;
    includeSensitive?: boolean;
  } = {
    ...(scope ? { scope } : {}),
    ...(classification ? { classification } : {}),
    ...(subjectId ? { subjectId } : {}),
    includeSensitive: canopyProofCanReadSensitiveAuditExports(actor),
  };
  const durable = canopyProofDurableTrustRegistry(c);
  const organizationId = requireCanopyProofActorOrganizationId(actor);
  return c.json({
    ok: true,
    data: durable && organizationId
      ? await durable.listAuditExportManifests(organizationId, filter)
      : canopyProofAuditExportManifestService.listManifests(filter),
  });
});

app.get("/canopyproof/audit/export-manifests/:manifestId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const organizationId = requireCanopyProofActorOrganizationId(actor);
  return c.json({
    ok: true,
    data: durable && organizationId
      ? await durable.getAuditExportManifest(
          c.req.param("manifestId"),
          organizationId,
          canopyProofCanReadSensitiveAuditExports(actor),
        )
      : canopyProofAuditExportManifestService.getManifest(
          c.req.param("manifestId"),
          canopyProofCanReadSensitiveAuditExports(actor),
        ),
  });
});

app.get("/canopyproof/resilience/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofResilienceService.getStatus() });
});

app.post("/canopyproof/resilience/drills", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const drill = canopyProofResilienceService.recordDrill(await c.req.json(), actor.id);
  return c.json({ ok: true, data: drill }, drill.decision === "pass" ? 201 : 202);
});

app.get("/canopyproof/resilience/drills", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofResilienceService.listDrills() });
});

app.get("/canopyproof/resilience/drills/:drillId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofResilienceService.getDrill(c.req.param("drillId")) });
});

app.get("/canopyproof/governance/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofGovernanceService.getStatus() });
});

app.get("/canopyproof/governance/policies", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofGovernanceService.listPolicies(c.req.query("subjectType")) });
});

app.post("/canopyproof/governance/approvals", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "accredited_organization");
  const approval = canopyProofGovernanceService.createApproval(
    await c.req.json(),
    actor.id,
    actor.role as CanopyProofGovernanceReviewerRole,
  );
  return c.json({ ok: true, data: approval }, approval.decision === "approve" ? 201 : 202);
});

app.get("/canopyproof/governance/approvals", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const subjectType = c.req.query("subjectType");
  const subjectId = c.req.query("subjectId");
  const policyId = c.req.query("policyId");
  return c.json({
    ok: true,
    data: canopyProofGovernanceService.listApprovals({
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(policyId ? { policyId } : {}),
    }),
  });
});

app.post("/canopyproof/governance/conflict-disclosures", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const disclosure = canopyProofGovernanceService.recordConflictDisclosure(await c.req.json(), actor.id);
  return c.json({ ok: true, data: disclosure }, disclosure.status === "cleared" || disclosure.status === "waived" ? 201 : 202);
});

app.get("/canopyproof/governance/conflict-disclosures", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const subjectType = c.req.query("subjectType");
  const subjectId = c.req.query("subjectId");
  const actorId = c.req.query("actorId");
  return c.json({
    ok: true,
    data: canopyProofGovernanceService.listConflictDisclosures({
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(actorId ? { actorId } : {}),
    }),
  });
});

app.get("/canopyproof/methodologies/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofMethodologyService.getStatus() });
});

app.post("/canopyproof/methodologies", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const methodology = canopyProofMethodologyService.createMethodology(await c.req.json(), actor.id);
  return c.json({ ok: true, data: methodology }, methodology.status === "published" ? 201 : 202);
});

app.get("/canopyproof/methodologies", (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const scope = canopyProofMethodologyScopeFromQuery(c.req.query("scope"));
  const status = canopyProofMethodologyStatusFromQuery(c.req.query("status"));
  const filter: {
    scope?: CanopyProofMethodologyScope;
    status?: CanopyProofMethodologyStatus;
    includeAll?: boolean;
  } = {
    ...(scope ? { scope } : {}),
    ...(status ? { status } : {}),
    includeAll: canopyProofCanReadDraftMethodologies(actor),
  };
  return c.json({ ok: true, data: canopyProofMethodologyService.listMethodologies(filter) });
});

app.get("/canopyproof/methodologies/:methodologyId", (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({
    ok: true,
    data: canopyProofMethodologyService.getMethodology(c.req.param("methodologyId"), canopyProofCanReadDraftMethodologies(actor)),
  });
});

app.get("/canopyproof/quality/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofDataQualityService.getStatus() });
});

app.post("/canopyproof/quality/scorecards", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const scorecard = canopyProofDataQualityService.createScorecard(await c.req.json(), actor.id);
  return c.json({ ok: true, data: scorecard }, scorecard.decision === "pass" ? 201 : 202);
});

app.get("/canopyproof/quality/scorecards", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const subjectType = canopyProofDataQualitySubjectTypeFromQuery(c.req.query("subjectType"));
  const decision = canopyProofDataQualityDecisionFromQuery(c.req.query("decision"));
  const subjectId = c.req.query("subjectId");
  return c.json({
    ok: true,
    data: canopyProofDataQualityService.listScorecards({
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(decision ? { decision } : {}),
    }),
  });
});

app.get("/canopyproof/quality/scorecards/:scorecardId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofDataQualityService.getScorecard(c.req.param("scorecardId")) });
});

app.get("/canopyproof/partners/status", (c) => {
  const trustRegistry = canopyProofTrustRegistryConfigurationStatus(process.env);
  return c.json({
    ok: true,
    data: {
      ...canopyProofPartnerService.getStatus(),
      countsAuthoritative: trustRegistry.mode === "development_memory",
      trustRegistry,
    },
  });
});

app.get("/canopyproof/funding/status", (c) => c.json({ ok: true, data: canopyProofFundingService.getStatus() }));

app.get("/canopyproof/risk/status", (c) => c.json({ ok: true, data: canopyProofEarlyWarningService.getStatus() }));

app.get("/canopyproof/risk/overview", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getOverview() });
});

app.get("/canopyproof/risk/layers", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listLayers() });
});

app.get("/canopyproof/risk/layers/:riskClass", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getLayer(c.req.param("riskClass")) });
});

app.get("/canopyproof/risk/playbooks", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const riskClass = c.req.query("riskClass");
  const audience = c.req.query("audience");
  return c.json({
    ok: true,
    data: canopyProofEarlyWarningService.listResponsePlaybooks({
      ...(riskClass ? { riskClass } : {}),
      ...(audience ? { audience } : {}),
    }),
  });
});

app.get("/canopyproof/risk/playbooks/:playbookId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getResponsePlaybook(c.req.param("playbookId")) });
});

app.post("/canopyproof/risk/signals", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "agent"]);
  const result = canopyProofEarlyWarningService.ingestSignal(await c.req.json(), actor.id);
  return c.json({ ok: true, data: result }, result.alert.status === "review_required" ? 202 : 201);
});

app.get("/canopyproof/risk/signals", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listSignals(c.req.query("riskClass")) });
});

app.get("/canopyproof/risk/alerts", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listAlerts(c.req.query("riskClass")) });
});

app.get("/canopyproof/risk/alerts/:alertId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getAlert(c.req.param("alertId")) });
});

app.get("/canopyproof/risk/alerts/:alertId/responses", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listResponses(c.req.param("alertId")) });
});

app.post("/canopyproof/risk/alerts/:alertId/dispatches", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "agent"]);
  const result = canopyProofEarlyWarningService.dispatchAlert(c.req.param("alertId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: result }, 201);
});

app.get("/canopyproof/risk/alerts/:alertId/dispatches", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listDispatchReceipts(c.req.param("alertId")) });
});

app.get("/canopyproof/risk/dispatches/:dispatchReceiptId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getDispatchReceipt(c.req.param("dispatchReceiptId")) });
});

app.post("/canopyproof/risk/alerts/:alertId/playbook-activations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "community", "agent"]);
  const result = canopyProofEarlyWarningService.activateResponsePlaybook(c.req.param("alertId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: result }, 201);
});

app.get("/canopyproof/risk/alerts/:alertId/playbook-activations", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listResponseActivations(c.req.param("alertId")) });
});

app.get("/canopyproof/risk/playbook-activations/:activationId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getResponseActivation(c.req.param("activationId")) });
});

app.post("/canopyproof/risk/playbook-activations/:activationId/closures", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const closure = canopyProofEarlyWarningService.closeResponseActivation(
    c.req.param("activationId"),
    await c.req.json(),
    actor.id,
    actor.role as CanopyProofRiskResponseClosureReviewerRole,
  );
  return c.json({ ok: true, data: closure }, 201);
});

app.get("/canopyproof/risk/playbook-activations/:activationId/closures", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listResponseClosures(c.req.param("activationId")) });
});

app.get("/canopyproof/risk/response-closures/:closureId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getResponseClosure(c.req.param("closureId")) });
});

app.post("/canopyproof/risk/response-closures/:closureId/after-action-reviews", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const review = canopyProofEarlyWarningService.reviewClosedResponse(
    c.req.param("closureId"),
    await c.req.json(),
    actor.id,
    actor.role as CanopyProofRiskAfterActionReviewReviewerRole,
  );
  return c.json({ ok: true, data: review }, 201);
});

app.get("/canopyproof/risk/response-closures/:closureId/after-action-reviews", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.listAfterActionReviews(c.req.param("closureId")) });
});

app.get("/canopyproof/risk/after-action-reviews/:reviewId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofEarlyWarningService.getAfterActionReview(c.req.param("reviewId")) });
});

app.post("/canopyproof/risk/alerts/:alertId/acknowledge", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const response = canopyProofEarlyWarningService.acknowledgeAlert(c.req.param("alertId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: response }, 201);
});

app.post("/canopyproof/risk/alerts/:alertId/escalate", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"]);
  const response = canopyProofEarlyWarningService.escalateAlert(c.req.param("alertId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: response }, 201);
});

app.post("/canopyproof/funding/sources", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const source = canopyProofFundingService.registerFundingSource(await c.req.json(), actor.id);
  return c.json({ ok: true, data: source }, 201);
});

app.get("/canopyproof/funding/sources", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.listSources() });
});

app.get("/canopyproof/funding/sources/:sourceId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.getFundingSource(c.req.param("sourceId")) });
});

app.post("/canopyproof/funding/allocations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const allocation = canopyProofFundingService.createAllocation(await c.req.json(), actor.id);
  return c.json({ ok: true, data: allocation }, 201);
});

app.get("/canopyproof/funding/allocations", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.listAllocations(c.req.query("projectId")) });
});

app.get("/canopyproof/funding/allocations/:allocationId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.getAllocation(c.req.param("allocationId")) });
});

app.post("/canopyproof/funding/milestones", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const milestone = canopyProofFundingService.recordMilestone(await c.req.json(), actor.id);
  return c.json({ ok: true, data: milestone }, 201);
});

app.get("/canopyproof/funding/milestones", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.listMilestones(c.req.query("projectId")) });
});

app.get("/canopyproof/funding/milestones/:milestoneId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.getMilestone(c.req.param("milestoneId")) });
});

app.post("/canopyproof/funding/milestones/:milestoneId/evidence", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const evidenceLink = canopyProofFundingService.linkEvidenceToMilestone(c.req.param("milestoneId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: evidenceLink }, 201);
});

app.patch("/canopyproof/funding/milestones/:milestoneId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"]);
  const milestone = canopyProofFundingService.updateMilestoneStatus(c.req.param("milestoneId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: milestone });
});

app.get("/canopyproof/funding/ledger", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.buildLedger(c.req.query("projectId")) });
});

app.get("/canopyproof/funding/ledger/:projectId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofFundingService.buildLedger(c.req.param("projectId")) });
});

app.get("/canopyproof/projects/status", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable ? await durable.getProjectRegistryStatus() : canopyProofProjectRegistryService.getStatus(),
  });
});

app.post("/canopyproof/projects", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"]);
  const body = await c.req.json();
  if (typeof body !== "object" || body === null || typeof (body as { organizationId?: unknown }).organizationId !== "string") {
    throw new Error("CanopyProof project registration requires organizationId.");
  }
  const organizationId = (body as { organizationId: string }).organizationId;
  assertCanopyProofActorOrganization(actor, organizationId);
  const durable = canopyProofDurableTrustRegistry(c);
  if (!durable) canopyProofPartnerService.getOrganization(organizationId);
  const project = durable
    ? await durable.registerProject(
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier",
        canopyProofIdempotencyKey(c),
      )
    : canopyProofProjectRegistryService.registerProject(
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier",
      );
  return c.json({ ok: true, data: project }, 201);
});

app.get("/canopyproof/projects", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const projectFilter: {
    organizationId?: string;
    regionId?: string;
    projectType?: CanopyProofProjectType;
    status?: CanopyProofProjectStatus;
    limit?: number;
  } = {};
  const organizationId = c.req.query("organizationId");
  const regionId = c.req.query("regionId");
  const projectType = canopyProofProjectTypeFromQuery(c.req.query("projectType"));
  const status = canopyProofProjectStatusFromQuery(c.req.query("status"));
  if (organizationId) projectFilter.organizationId = organizationId;
  if (regionId) projectFilter.regionId = regionId;
  if (projectType) projectFilter.projectType = projectType;
  if (status) projectFilter.status = status;
  projectFilter.limit = canopyProofProjectLimitFromQuery(c.req.query("limit"));
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listProjects(projectFilter)
      : canopyProofProjectRegistryService.listProjects(projectFilter).slice(0, projectFilter.limit),
  });
});

app.get("/canopyproof/projects/monitoring-events", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const monitoringFilter: {
    projectId?: string;
    state?: CanopyProofProjectMonitoringState;
    eventType?: CanopyProofProjectMonitoringEventType;
    limit?: number;
  } = {};
  const projectId = c.req.query("projectId");
  const state = canopyProofProjectMonitoringStateFromQuery(c.req.query("state"));
  const eventType = canopyProofProjectMonitoringTypeFromQuery(c.req.query("eventType"));
  if (projectId) monitoringFilter.projectId = projectId;
  if (state) monitoringFilter.state = state;
  if (eventType) monitoringFilter.eventType = eventType;
  monitoringFilter.limit = canopyProofProjectLimitFromQuery(c.req.query("limit"));
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listProjectMonitoringEvents(monitoringFilter)
      : canopyProofProjectRegistryService.listMonitoringEvents(monitoringFilter).slice(0, monitoringFilter.limit),
  });
});

app.get("/canopyproof/projects/:projectId", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.getProject(c.req.param("projectId"))
      : canopyProofProjectRegistryService.getProject(c.req.param("projectId")),
  });
});

app.post("/canopyproof/projects/:projectId/monitoring-events", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const projectId = c.req.param("projectId");
  const durable = canopyProofDurableTrustRegistry(c);
  const project = durable
    ? await durable.getProject(projectId)
    : canopyProofProjectRegistryService.getProject(projectId);
  assertCanopyProofActorOrganization(actor, project.organizationId);
  const body = await c.req.json();
  const event = durable
    ? await durable.recordProjectMonitoringEvent(
        projectId,
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier" | "researcher",
        canopyProofIdempotencyKey(c),
      )
    : canopyProofProjectRegistryService.recordMonitoringEvent(
        projectId,
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier" | "researcher",
      );
  return c.json({ ok: true, data: event }, event.state === "challenged" || event.state === "needs_review" ? 202 : 201);
});

app.get("/canopyproof/projects/:projectId/monitoring-events", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const monitoringFilter: {
    projectId: string;
    state?: CanopyProofProjectMonitoringState;
    eventType?: CanopyProofProjectMonitoringEventType;
    limit?: number;
  } = { projectId: c.req.param("projectId") };
  const state = canopyProofProjectMonitoringStateFromQuery(c.req.query("state"));
  const eventType = canopyProofProjectMonitoringTypeFromQuery(c.req.query("eventType"));
  if (state) monitoringFilter.state = state;
  if (eventType) monitoringFilter.eventType = eventType;
  monitoringFilter.limit = canopyProofProjectLimitFromQuery(c.req.query("limit"));
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listProjectMonitoringEvents(monitoringFilter)
      : canopyProofProjectRegistryService.listMonitoringEvents(monitoringFilter).slice(0, monitoringFilter.limit),
  });
});

app.patch("/canopyproof/projects/:projectId/status", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"]);
  const projectId = c.req.param("projectId");
  const durable = canopyProofDurableTrustRegistry(c);
  const currentProject = durable
    ? await durable.getProject(projectId)
    : canopyProofProjectRegistryService.getProject(projectId);
  assertCanopyProofActorOrganization(actor, currentProject.organizationId);
  const body = await c.req.json();
  const project = durable
    ? await durable.updateProjectStatus(
        projectId,
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier",
        canopyProofIdempotencyKey(c),
      )
    : canopyProofProjectRegistryService.updateProjectStatus(
        projectId,
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier",
      );
  return c.json({ ok: true, data: project }, project.status === "challenged" ? 202 : 200);
});

app.post("/canopyproof/organizations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const organization = durable
    ? await durable.registerOrganization(body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.registerOrganization(body, actor.id);
  return c.json({ ok: true, data: organization }, 201);
});

app.get("/canopyproof/organizations", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({ ok: true, data: durable ? await durable.listOrganizations() : canopyProofPartnerService.listOrganizations() });
});

app.get("/canopyproof/organizations/:id", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable ? await durable.getOrganization(c.req.param("id")) : canopyProofPartnerService.getOrganization(c.req.param("id")),
  });
});

app.post("/canopyproof/organizations/:id/verification", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"], "accredited_organization");
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const organization = durable
    ? await durable.updateOrganizationVerification(c.req.param("id"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.updateOrganizationVerification(c.req.param("id"), body, actor.id);
  return c.json({ ok: true, data: organization }, organization.verificationStatus === "verified" ? 201 : 202);
});

app.get("/canopyproof/partners", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({ ok: true, data: durable ? await durable.listPartners() : canopyProofPartnerService.listPartners() });
});

app.get("/canopyproof/partners/:organizationId", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.getOrganization(c.req.param("organizationId"))
      : canopyProofPartnerService.getOrganization(c.req.param("organizationId")),
  });
});

app.post("/canopyproof/organizations/:id/memberships", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const membership = durable
    ? await durable.grantMembership(c.req.param("id"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.grantMembership(c.req.param("id"), body, actor.id);
  return c.json({ ok: true, data: membership }, 201);
});

app.get("/canopyproof/organizations/:id/memberships", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable ? await durable.listMemberships(c.req.param("id")) : canopyProofPartnerService.listMemberships(c.req.param("id")),
  });
});

app.patch("/canopyproof/organizations/:id/memberships/:membershipId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const membership = durable
    ? await durable.updateMembershipStatus(
        c.req.param("id"),
        c.req.param("membershipId"),
        body,
        actor.id,
        canopyProofIdempotencyKey(c),
      )
    : canopyProofPartnerService.updateMembershipStatus(c.req.param("id"), c.req.param("membershipId"), body, actor.id);
  return c.json({ ok: true, data: membership });
});

app.post("/canopyproof/organizations/:id/accreditations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"], "accredited_organization");
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const accreditation = durable
    ? await durable.recordAccreditation(c.req.param("id"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.recordAccreditation(c.req.param("id"), body, actor.id);
  return c.json({ ok: true, data: accreditation }, 201);
});

app.get("/canopyproof/organizations/:id/accreditations", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listAccreditations(c.req.param("id"))
      : canopyProofPartnerService.listAccreditations(c.req.param("id")),
  });
});

app.post("/canopyproof/organizations/:id/data-sharing-agreements", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const agreement = durable
    ? await durable.createDataSharingAgreement(c.req.param("id"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.createDataSharingAgreement(c.req.param("id"), body, actor.id);
  return c.json({ ok: true, data: agreement }, 201);
});

app.get("/canopyproof/organizations/:id/data-sharing-agreements", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataSharingAgreements(c.req.param("id"))
      : canopyProofPartnerService.listDataSharingAgreements(c.req.param("id")),
  });
});

app.post("/canopyproof/data-sharing-agreements/:agreementId/revocations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const revocation = durable
    ? await durable.revokeDataSharingAgreement(c.req.param("agreementId"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.revokeDataSharingAgreement(c.req.param("agreementId"), body, actor.id);
  return c.json({ ok: true, data: revocation }, 202);
});

app.get("/canopyproof/data-sharing-agreements/:agreementId/revocations", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataSharingAgreementRevocations(c.req.param("agreementId"))
      : canopyProofPartnerService.listDataSharingAgreementRevocations(c.req.param("agreementId")),
  });
});

app.get("/canopyproof/data-sharing-agreement-revocations/:revocationId", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataSharingAgreementRevocation(c.req.param("revocationId"))
      : canopyProofPartnerService.getDataSharingAgreementRevocation(c.req.param("revocationId")),
  });
});

app.post("/canopyproof/data-sharing-agreements/:agreementId/supersessions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const supersession = durable
    ? await durable.supersedeDataSharingAgreement(c.req.param("agreementId"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.supersedeDataSharingAgreement(c.req.param("agreementId"), body, actor.id);
  return c.json({ ok: true, data: supersession }, 201);
});

app.get("/canopyproof/data-sharing-agreements/:agreementId/supersessions", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataSharingAgreementSupersessions(c.req.param("agreementId"))
      : canopyProofPartnerService.listDataSharingAgreementSupersessions(c.req.param("agreementId")),
  });
});

app.get("/canopyproof/data-sharing-agreement-supersessions/:supersessionId", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataSharingAgreementSupersession(c.req.param("supersessionId"))
      : canopyProofPartnerService.getDataSharingAgreementSupersession(c.req.param("supersessionId")),
  });
});

app.post("/canopyproof/organizations/:id/data-access-requests", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  assertCanopyProofActorOrganization(actor, c.req.param("id"));
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.requestDataAccess(c.req.param("id"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.requestDataAccess(c.req.param("id"), body, actor.id);
  return c.json({ ok: true, data: request }, 202);
});

app.get("/canopyproof/organizations/:id/data-access-requests", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  assertCanopyProofActorOrganization(actor, c.req.param("id"));
  const durable = canopyProofDurableTrustRegistry(c);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessRequests(c.req.param("id"))
      : canopyProofPartnerService.listDataAccessRequests(c.req.param("id")),
  });
});

app.get("/canopyproof/data-access-requests/:requestId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.getDataAccessRequest(c.req.param("requestId"))
    : canopyProofPartnerService.getDataAccessRequest(c.req.param("requestId"));
  assertCanopyProofActorOrganization(actor, request.organizationId);
  return c.json({
    ok: true,
    data: request,
  });
});

app.patch("/canopyproof/data-access-requests/:requestId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"], "verified_organization");
  const durable = canopyProofDurableTrustRegistry(c);
  const current = durable
    ? await durable.getDataAccessRequest(c.req.param("requestId"))
    : canopyProofPartnerService.getDataAccessRequest(c.req.param("requestId"));
  assertCanopyProofActorOrganization(actor, current.organizationId);
  const body = await c.req.json();
  const request = durable
    ? await durable.decideDataAccessRequest(c.req.param("requestId"), body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.decideDataAccessRequest(c.req.param("requestId"), body, actor.id);
  return c.json({ ok: true, data: request });
});

app.post("/canopyproof/data-access-requests/:requestId/deliveries", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"], "accredited_organization");
  const requestId = c.req.param("requestId");
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.getDataAccessRequest(requestId)
    : canopyProofPartnerService.getDataAccessRequest(requestId);
  assertCanopyProofActorOrganization(actor, request.organizationId);
  const rawPayload = await c.req.json();
  const payload = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? (rawPayload as Record<string, unknown>) : {};
  const receipt = durable
    ? await durable.recordDataAccessDelivery(requestId, payload, actor.id, canopyProofIdempotencyKey(c))
    : (() => {
        const manifestId = typeof payload.manifestId === "string" ? payload.manifestId : "";
        const manifest = canopyProofAuditExportManifestService.getManifest(manifestId, true);
        return canopyProofPartnerService.recordDataAccessDelivery(
          requestId,
          {
            ...payload,
            manifestId: manifest.id,
            manifestRequesterOrganizationId: manifest.requesterOrganizationId,
            manifestHash: manifest.exportHash,
            manifestEntryRoot: manifest.entryRoot,
            manifestClassification: manifest.classification,
          },
          actor.id,
        );
      })();
  return c.json({ ok: true, data: receipt }, 201);
});

app.get("/canopyproof/data-access-requests/:requestId/deliveries", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const requestId = c.req.param("requestId");
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.getDataAccessRequest(requestId)
    : canopyProofPartnerService.getDataAccessRequest(requestId);
  assertCanopyProofActorOrganization(actor, request.organizationId);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessDeliveryReceipts(requestId)
      : canopyProofPartnerService.listDataAccessDeliveryReceipts(requestId),
  });
});

app.get("/canopyproof/data-access-deliveries/:deliveryId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const receipt = durable
    ? await durable.getDataAccessDeliveryReceipt(c.req.param("deliveryId"))
    : canopyProofPartnerService.getDataAccessDeliveryReceipt(c.req.param("deliveryId"));
  assertCanopyProofActorOrganization(actor, receipt.organizationId);
  return c.json({ ok: true, data: receipt });
});

app.post("/canopyproof/data-access-deliveries/:deliveryId/use-attestations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "verified_organization");
  const deliveryId = c.req.param("deliveryId");
  const durable = canopyProofDurableTrustRegistry(c);
  const delivery = durable
    ? await durable.getDataAccessDeliveryReceipt(deliveryId)
    : canopyProofPartnerService.getDataAccessDeliveryReceipt(deliveryId);
  assertCanopyProofActorOrganization(actor, delivery.organizationId);
  const body = await c.req.json();
  const attestation = durable
    ? await durable.recordDataUseAttestation(deliveryId, body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.recordDataUseAttestation(deliveryId, body, actor.id);
  return c.json({ ok: true, data: attestation }, attestation.usageState === "misuse_challenged" || attestation.usageState === "revocation_requested" ? 202 : 201);
});

app.get("/canopyproof/data-access-deliveries/:deliveryId/use-attestations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const deliveryId = c.req.param("deliveryId");
  const durable = canopyProofDurableTrustRegistry(c);
  const delivery = durable
    ? await durable.getDataAccessDeliveryReceipt(deliveryId)
    : canopyProofPartnerService.getDataAccessDeliveryReceipt(deliveryId);
  assertCanopyProofActorOrganization(actor, delivery.organizationId);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataUseAttestations(deliveryId)
      : canopyProofPartnerService.listDataUseAttestations(deliveryId),
  });
});

app.get("/canopyproof/data-use-attestations/:attestationId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const attestation = durable
    ? await durable.getDataUseAttestation(c.req.param("attestationId"))
    : canopyProofPartnerService.getDataUseAttestation(c.req.param("attestationId"));
  assertCanopyProofActorOrganization(actor, attestation.organizationId);
  return c.json({ ok: true, data: attestation });
});

app.post("/canopyproof/data-use-attestations/:attestationId/enforcement-cases", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"], "verified_organization");
  const attestationId = c.req.param("attestationId");
  const durable = canopyProofDurableTrustRegistry(c);
  const attestation = durable
    ? await durable.getDataUseAttestation(attestationId)
    : canopyProofPartnerService.getDataUseAttestation(attestationId);
  assertCanopyProofActorOrganization(actor, attestation.organizationId);
  const body = await c.req.json();
  const enforcementCase = durable
    ? await durable.recordDataUseEnforcementCase(attestationId, body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.recordDataUseEnforcementCase(attestationId, body, actor.id);
  return c.json({ ok: true, data: enforcementCase }, 202);
});

app.get("/canopyproof/data-use-attestations/:attestationId/enforcement-cases", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const attestationId = c.req.param("attestationId");
  const durable = canopyProofDurableTrustRegistry(c);
  const attestation = durable
    ? await durable.getDataUseAttestation(attestationId)
    : canopyProofPartnerService.getDataUseAttestation(attestationId);
  assertCanopyProofActorOrganization(actor, attestation.organizationId);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataUseEnforcementCases(attestationId)
      : canopyProofPartnerService.listDataUseEnforcementCases(attestationId),
  });
});

app.get("/canopyproof/data-use-enforcement-cases/:caseId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const enforcementCase = durable
    ? await durable.getDataUseEnforcementCase(c.req.param("caseId"))
    : canopyProofPartnerService.getDataUseEnforcementCase(c.req.param("caseId"));
  assertCanopyProofActorOrganization(actor, enforcementCase.organizationId);
  return c.json({ ok: true, data: enforcementCase });
});

app.post("/canopyproof/data-use-enforcement-cases/:caseId/access-restrictions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"], "verified_organization");
  const caseId = c.req.param("caseId");
  const durable = canopyProofDurableTrustRegistry(c);
  const enforcementCase = durable
    ? await durable.getDataUseEnforcementCase(caseId)
    : canopyProofPartnerService.getDataUseEnforcementCase(caseId);
  assertCanopyProofActorOrganization(actor, enforcementCase.organizationId);
  const body = await c.req.json();
  const restriction = durable
    ? await durable.recordDataAccessRestriction(caseId, body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.recordDataAccessRestriction(caseId, body, actor.id);
  return c.json({ ok: true, data: restriction }, 202);
});

app.get("/canopyproof/data-access-requests/:requestId/restrictions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const requestId = c.req.param("requestId");
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.getDataAccessRequest(requestId)
    : canopyProofPartnerService.getDataAccessRequest(requestId);
  assertCanopyProofActorOrganization(actor, request.organizationId);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessRestrictions(requestId)
      : canopyProofPartnerService.listDataAccessRestrictions(requestId),
  });
});

app.get("/canopyproof/data-access-restrictions/:restrictionId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const restriction = durable
    ? await durable.getDataAccessRestriction(c.req.param("restrictionId"))
    : canopyProofPartnerService.getDataAccessRestriction(c.req.param("restrictionId"));
  assertCanopyProofActorOrganization(actor, restriction.organizationId);
  return c.json({ ok: true, data: restriction });
});

app.post("/canopyproof/data-access-requests/:requestId/accountability-packets", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "verified_organization");
  const requestId = c.req.param("requestId");
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.getDataAccessRequest(requestId)
    : canopyProofPartnerService.getDataAccessRequest(requestId);
  assertCanopyProofActorOrganization(actor, request.organizationId);
  const body = await c.req.json();
  const packet = durable
    ? await durable.createDataAccessAccountabilityPacket(requestId, body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.createDataAccessAccountabilityPacket(requestId, body, actor.id);
  return c.json({ ok: true, data: packet }, 201);
});

app.get("/canopyproof/data-access-requests/:requestId/accountability-packets", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const requestId = c.req.param("requestId");
  const durable = canopyProofDurableTrustRegistry(c);
  const request = durable
    ? await durable.getDataAccessRequest(requestId)
    : canopyProofPartnerService.getDataAccessRequest(requestId);
  assertCanopyProofActorOrganization(actor, request.organizationId);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessAccountabilityPackets(requestId)
      : canopyProofPartnerService.listDataAccessAccountabilityPackets(requestId),
  });
});

app.get("/canopyproof/data-access-accountability-packets/:packetId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const packet = durable
    ? await durable.getDataAccessAccountabilityPacket(c.req.param("packetId"))
    : canopyProofPartnerService.getDataAccessAccountabilityPacket(c.req.param("packetId"));
  assertCanopyProofActorOrganization(actor, packet.organizationId);
  return c.json({ ok: true, data: packet });
});

app.post("/canopyproof/data-access-accountability-packets/:packetId/verify", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"], "verified_organization");
  const packetId = c.req.param("packetId");
  const durable = canopyProofDurableTrustRegistry(c);
  const packet = durable
    ? await durable.getDataAccessAccountabilityPacket(packetId)
    : canopyProofPartnerService.getDataAccessAccountabilityPacket(packetId);
  assertCanopyProofActorOrganization(actor, packet.organizationId);
  const body = await c.req.json();
  const verification = durable
    ? await durable.verifyDataAccessAccountabilityPacket(packetId, body, actor.id, canopyProofIdempotencyKey(c))
    : canopyProofPartnerService.verifyDataAccessAccountabilityPacket(packetId, body, actor.id);
  return c.json({ ok: true, data: verification }, verification.valid ? 200 : 202);
});

app.get("/canopyproof/data-access-accountability-packets/:packetId/verifications", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const packetId = c.req.param("packetId");
  const durable = canopyProofDurableTrustRegistry(c);
  const packet = durable
    ? await durable.getDataAccessAccountabilityPacket(packetId)
    : canopyProofPartnerService.getDataAccessAccountabilityPacket(packetId);
  assertCanopyProofActorOrganization(actor, packet.organizationId);
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessAccountabilityVerifications(packetId)
      : canopyProofPartnerService.listDataAccessAccountabilityVerifications(packetId),
  });
});

app.get("/canopyproof/data-access-accountability-verifications/:verificationId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  const verification = durable
    ? await durable.getDataAccessAccountabilityVerification(c.req.param("verificationId"))
    : canopyProofPartnerService.getDataAccessAccountabilityVerification(c.req.param("verificationId"));
  assertCanopyProofActorOrganization(actor, verification.organizationId);
  return c.json({ ok: true, data: verification });
});

app.post("/canopyproof/data-access-accountability-packets/:packetId/disclosures", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"], "verified_organization");
  const packetId = c.req.param("packetId");
  const durable = canopyProofDurableTrustRegistry(c);
  const packet = durable
    ? await durable.getDataAccessAccountabilityPacket(packetId)
    : canopyProofPartnerService.getDataAccessAccountabilityPacket(packetId);
  assertCanopyProofActorOrganization(actor, packet.organizationId);
  const body = await c.req.json();
  const disclosure = durable
    ? await durable.publishDataAccessAccountabilityDisclosure(
        packetId,
        body,
        actor.id,
        canopyProofIdempotencyKey(c),
      )
    : canopyProofPartnerService.publishDataAccessAccountabilityDisclosure(packetId, body, actor.id);
  return c.json({ ok: true, data: disclosure }, 201);
});

app.get("/canopyproof/public-accountability/data-access-disclosures/status", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataAccessAccountabilityDisclosureStatus()
      : canopyProofPartnerService.getDataAccessAccountabilityDisclosureStatus(),
  });
});

app.get("/canopyproof/public-accountability/data-access-disclosures", async (c) => {
  const organizationId = c.req.query("organizationId")?.trim();
  const currentState = canopyProofAccountabilityDisclosureStateFromQuery(c.req.query("state"));
  const governanceState = canopyProofAccountabilityDisclosureGovernanceStateFromQuery(c.req.query("governanceState"));
  const cursor = c.req.query("cursor")?.trim();
  const limit = canopyProofAccountabilityDisclosureLimitFromQuery(c.req.query("limit"));
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataAccessAccountabilityDisclosureIndex({
          ...(organizationId ? { organizationId } : {}),
          ...(currentState ? { currentState } : {}),
          ...(governanceState ? { governanceState } : {}),
          ...(cursor ? { cursor } : {}),
          limit,
        })
      : canopyProofPartnerService.getDataAccessAccountabilityDisclosureIndex({
          ...(organizationId ? { organizationId } : {}),
          ...(currentState ? { currentState } : {}),
          ...(governanceState ? { governanceState } : {}),
          ...(cursor ? { cursor } : {}),
          limit,
        }),
  });
});

app.post("/canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const disclosureId = c.req.param("disclosureId");
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const challenge = durable
    ? await durable.challengeDataAccessAccountabilityDisclosure(
        disclosureId,
        body,
        actor.id,
        actor.role as CanopyProofPartnerRole,
        canopyProofIdempotencyKey(c),
      )
    : canopyProofPartnerService.challengeDataAccessAccountabilityDisclosure(
        disclosureId,
        body,
        actor.id,
        actor.role as CanopyProofPartnerRole,
      );
  return c.json({ ok: true, data: challenge }, 202);
});

app.get("/canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessAccountabilityDisclosureChallenges(c.req.param("disclosureId"))
      : canopyProofPartnerService.listDataAccessAccountabilityDisclosureChallenges(c.req.param("disclosureId")),
  });
});

app.get("/canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataAccessAccountabilityDisclosureChallenge(c.req.param("challengeId"))
      : canopyProofPartnerService.getDataAccessAccountabilityDisclosureChallenge(c.req.param("challengeId")),
  });
});

app.post("/canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"]);
  const challengeId = c.req.param("challengeId");
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const resolution = durable
    ? await durable.resolveDataAccessAccountabilityDisclosureChallenge(
        challengeId,
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier",
        canopyProofIdempotencyKey(c),
      )
    : canopyProofPartnerService.resolveDataAccessAccountabilityDisclosureChallenge(
        challengeId,
        body,
        actor.id,
        actor.role as "owner" | "admin" | "verifier",
      );
  return c.json({ ok: true, data: resolution }, resolution.decision === "needs_more_evidence" ? 202 : 200);
});

app.get("/canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessAccountabilityDisclosureResolutions(c.req.param("challengeId"))
      : canopyProofPartnerService.listDataAccessAccountabilityDisclosureResolutions(c.req.param("challengeId")),
  });
});

app.get("/canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataAccessAccountabilityDisclosureResolution(c.req.param("resolutionId"))
      : canopyProofPartnerService.getDataAccessAccountabilityDisclosureResolution(c.req.param("resolutionId")),
  });
});

app.post("/canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId/notices", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin"]);
  const resolutionId = c.req.param("resolutionId");
  const body = await c.req.json();
  const durable = canopyProofDurableTrustRegistry(c);
  const notice = durable
    ? await durable.publishDataAccessAccountabilityDisclosureNotice(
        resolutionId,
        body,
        actor.id,
        actor.role as "owner" | "admin",
        canopyProofIdempotencyKey(c),
      )
    : canopyProofPartnerService.publishDataAccessAccountabilityDisclosureNotice(
        resolutionId,
        body,
        actor.id,
        actor.role as "owner" | "admin",
      );
  return c.json({ ok: true, data: notice }, 201);
});

app.get("/canopyproof/public-accountability/data-access-disclosures/:disclosureId/notices", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.listDataAccessAccountabilityDisclosureNotices(c.req.param("disclosureId"))
      : canopyProofPartnerService.listDataAccessAccountabilityDisclosureNotices(c.req.param("disclosureId")),
  });
});

app.get("/canopyproof/public-accountability/data-access-disclosure-notices/:noticeId", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataAccessAccountabilityDisclosureNotice(c.req.param("noticeId"))
      : canopyProofPartnerService.getDataAccessAccountabilityDisclosureNotice(c.req.param("noticeId")),
  });
});

app.get("/canopyproof/public-accountability/data-access-disclosures/:disclosureId", async (c) => {
  const durable = canopyProofPublicDurableTrustRegistry();
  return c.json({
    ok: true,
    data: durable
      ? await durable.getDataAccessAccountabilityDisclosure(c.req.param("disclosureId"))
      : canopyProofPartnerService.getDataAccessAccountabilityDisclosure(c.req.param("disclosureId")),
  });
});

app.get("/canopyproof/terra/connectors/nasa-gibs/status", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: await nasaGibsConnector().status(nasaGibsActor(actor)) });
});

app.post("/canopyproof/terra/connectors/nasa-gibs/sync", async (c) => {
  const actor = canopyProofActor(c, ["admin", "researcher", "agent"]);
  const idempotencyKey = canopyProofIdempotencyKey(c);
  if (idempotencyKey.length < 16 || idempotencyKey.length > 512) {
    throw new NasaGibsError("CATALOG_INVARIANT", "A bounded idempotency-key header is required.", 422);
  }
  const body = z.object({
    serviceType: z.enum(nasaGibsServiceTypes),
    projection: z.enum(nasaGibsProjections),
  }).strict().parse(await c.req.json());
  const result = await nasaGibsConnector().sync({
    serviceType: body.serviceType,
    projection: body.projection,
    actor: await nasaGibsSyncActor(actor),
    idempotencyKey,
    requestedAt: new Date().toISOString(),
  });
  return c.json({ ok: true, data: result }, result.outcome === "synchronized" ? 201 : 202);
});

app.get("/canopyproof/terra/connectors/nasa-gibs/products", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  nasaGibsActor(actor);
  const serviceType = optionalNasaGibsServiceType(c.req.query("serviceType"));
  const projection = optionalNasaGibsProjection(c.req.query("projection"));
  const freshness = optionalNasaGibsFreshness(c.req.query("freshness"));
  return c.json({
    ok: true,
    data: await nasaGibsConnector().listProducts({
      ...(serviceType ? { serviceType } : {}),
      ...(projection ? { projection } : {}),
      ...(freshness ? { freshness } : {}),
    }),
  });
});

app.post("/canopyproof/terra/connectors/nasa-gibs/tile-failures", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({
    ok: true,
    data: await nasaGibsConnector().recordTileFailure(await c.req.json(), nasaGibsActor(actor)),
  }, 202);
});

app.get("/canopyproof/terra/connectors/nasa-gibs/products/:id/availability", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  nasaGibsActor(actor);
  return c.json({ ok: true, data: await nasaGibsConnector().getAvailability(c.req.param("id")) });
});

app.post("/canopyproof/terra/connectors/nasa-gibs/products/:id/manifests", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const body = await c.req.json<Record<string, unknown>>();
  return c.json({
    ok: true,
    data: await nasaGibsConnector().issueMapManifest(
      { ...body, productId: c.req.param("id") },
      nasaGibsActor(actor),
    ),
  }, 201);
});

app.get("/canopyproof/terra/connectors/nasa-gibs/products/:id", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  nasaGibsActor(actor);
  return c.json({ ok: true, data: await nasaGibsConnector().getProduct(c.req.param("id")) });
});

app.post("/canopyproof/terra/connectors/nasa-gibs/comparisons", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  return c.json({
    ok: true,
    data: await nasaGibsConnector().createComparison(await c.req.json(), nasaGibsActor(actor)),
  }, 201);
});

app.get("/canopyproof/terra/connectors/nasa-gibs/comparisons/:id", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({
    ok: true,
    data: await nasaGibsConnector().getComparison(c.req.param("id"), nasaGibsActor(actor)),
  });
});

app.get("/canopyproof/terra/connectors/nasa-gibs/comparisons/:id/attribution/:artifactKind", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const artifactKind = c.req.param("artifactKind");
  if (!nasaGibsAttributionArtifactKinds.includes(artifactKind as NasaGibsAttributionArtifactKind)) {
    throw new NasaGibsError("CATALOG_INVARIANT", "NASA GIBS attribution artifact kind is invalid.", 422);
  }
  return c.json({
    ok: true,
    data: await nasaGibsConnector().comparisonAttribution(
      c.req.param("id"),
      artifactKind as NasaGibsAttributionArtifactKind,
      nasaGibsActor(actor),
    ),
  });
});

app.post("/canopyproof/terra/connectors/nasa-gibs/source-data-handoffs", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  return c.json({
    ok: true,
    data: await nasaGibsConnector().createSourceDataHandoff(await c.req.json(), nasaGibsActor(actor)),
  }, 201);
});

app.post("/canopyproof/terra/connectors/nasa-gibs/event-watches", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  return c.json({
    ok: true,
    data: await nasaGibsConnector().createEventWatch(await c.req.json(), nasaGibsActor(actor)),
  }, 201);
});

app.route(
  "/canopyproof/satellite",
  createCanopyProofSatelliteRoutes({ environment: process.env }),
);

app.route(
  "/canopyproof/evidence/mobile-sync",
  createCanopyProofMobileEvidenceSyncRoutes({
    environment: process.env,
    resolveService: (context) => canopyProofDurableMobileEvidenceSyncAuthority(context),
    resolveAdmissionAuthority: (context) =>
      canopyProofDurableMobileEvidenceSyncAdmissionAuthority(context),
  }),
);

app.get("/canopyproof/terra/status", (c) => c.json({ ok: true, data: terraProofService.getStatus() }));

app.get("/canopyproof/terra/layers", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: terraProofService.listLayers() });
});

app.get("/canopyproof/terra/layers/:id", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: terraProofService.getLayer(c.req.param("id")) });
});

app.get("/canopyproof/terra/scenes", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: terraProofService.listScenes() });
});

app.get("/canopyproof/terra/scenes/:id", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: terraProofService.getScene(c.req.param("id")) });
});

app.post("/canopyproof/terra/connectors/:connectorId/runs", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const connectorId = c.req.param("connectorId");
  if (!terraProofConnectorIds.includes(connectorId as TerraProofConnectorId)) {
    throw new Error(`Unsupported TerraProof connector: ${connectorId}`);
  }
  const result = terraProofService.runConnector(connectorId as TerraProofConnectorId, await c.req.json(), actor.id);
  return c.json({ ok: true, data: result }, result.run.status === "accepted" ? 201 : 202);
});

app.get("/canopyproof/terra/connectors/:connectorId/runs/:runId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const run = terraProofService.getConnectorRun(c.req.param("runId"));
  if (run.connectorId !== c.req.param("connectorId")) {
    throw new Error(`TerraProof connector run ${run.id} does not belong to connector ${c.req.param("connectorId")}.`);
  }
  return c.json({ ok: true, data: run });
});

app.post("/canopyproof/evidence", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const body = await c.req.json();
  const projectId = canopyProofProjectIdFromRequest(body);
  const durable = canopyProofDurableTrustRegistry(c);
  const project = durable
    ? await durable.getProject(projectId)
    : canopyProofProjectRegistryService.getProject(projectId);
  assertCanopyProofActorOrganization(actor, project.organizationId);
  const result = durable
    ? await durable.registerEvidence(
        body,
        actor.id,
        actor.role as CanopyProofEvidenceContributorRole,
        canopyProofIdempotencyKey(c),
      )
    : canopyProofService.submitEvidence({
        ...(typeof body === "object" && body !== null ? body : {}),
        contributor: actor.id,
      });
  return c.json({ ok: true, data: result }, result.valid ? 201 : 202);
});

app.post("/canopyproof/evidence/media/presign", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const intent = canopyProofEvidenceNetworkService.createMediaUploadIntent(await c.req.json(), actor.id);
  return c.json({ ok: true, data: intent }, 201);
});

app.post("/canopyproof/evidence/media/objects", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const mediaObject = canopyProofEvidenceNetworkService.confirmMediaObject(await c.req.json(), actor.id);
  return c.json({ ok: true, data: mediaObject }, mediaObject.mediaState === "available" ? 201 : 202);
});

app.post("/canopyproof/evidence/consent-receipts", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const receipt = canopyProofEvidenceNetworkService.recordConsentReceipt(await c.req.json(), actor.id);
  return c.json({ ok: true, data: receipt }, 201);
});

app.get("/canopyproof/evidence/consent-receipts", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.listConsentReceipts(c.req.query("subjectId")) });
});

app.post("/canopyproof/evidence/consent-receipts/:receiptId/revoke", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const receipt = canopyProofEvidenceNetworkService.revokeConsentReceipt(c.req.param("receiptId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: receipt }, 202);
});

app.post("/canopyproof/evidence/devices/attestations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const attestation = canopyProofEvidenceNetworkService.recordDeviceAttestation(await c.req.json(), actor.id);
  return c.json({ ok: true, data: attestation }, attestation.riskFlags.length > 0 ? 202 : 201);
});

app.get("/canopyproof/evidence/devices/attestations", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.listDeviceAttestations(c.req.query("subjectId")) });
});

app.post("/canopyproof/evidence/media/metadata-extractions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const extraction = canopyProofEvidenceNetworkService.extractMediaMetadata(await c.req.json(), actor.id);
  return c.json({ ok: true, data: extraction }, extraction.extractionState === "accepted" ? 201 : 202);
});

app.get("/canopyproof/evidence/media/metadata-extractions", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.listMediaMetadataExtractions(c.req.query("evidenceId")) });
});

app.post("/canopyproof/evidence/review-tasks", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const task = canopyProofEvidenceNetworkService.openEvidenceReviewTask(await c.req.json(), actor.id);
  return c.json({ ok: true, data: task }, task.status === "assigned" ? 202 : 201);
});

app.get("/canopyproof/evidence/review-tasks", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const status = c.req.query("status");
  const sourceType = c.req.query("sourceType");
  return c.json({
    ok: true,
    data: canopyProofEvidenceNetworkService.listEvidenceReviewTasks({
      ...(status ? { status } : {}),
      ...(sourceType ? { sourceType } : {}),
    }),
  });
});

app.post("/canopyproof/evidence/review-tasks/:taskId/resolve", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const task = canopyProofEvidenceNetworkService.resolveEvidenceReviewTask(c.req.param("taskId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: task }, task.status === "escalated" ? 202 : 200);
});

app.post("/canopyproof/evidence/retention/evaluations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"]);
  const evaluation = canopyProofEvidenceNetworkService.evaluateRetentionPolicies(await c.req.json(), actor.id);
  return c.json({ ok: true, data: evaluation }, 202);
});

app.get("/canopyproof/evidence/retention/decisions", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const sourceType = c.req.query("sourceType");
  const disposition = c.req.query("disposition");
  return c.json({
    ok: true,
    data: canopyProofEvidenceNetworkService.listRetentionPolicyDecisions({
      ...(sourceType ? { sourceType } : {}),
      ...(disposition ? { disposition } : {}),
    }),
  });
});

app.get("/canopyproof/evidence/media/objects", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.listMediaObjects(c.req.query("evidenceId")) });
});

app.get("/canopyproof/evidence/media/objects/:mediaObjectId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.getMediaObject(c.req.param("mediaObjectId")) });
});

app.post("/canopyproof/evidence/sync-batches", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const idempotencyKey = c.req.header("idempotency-key")?.trim() ?? "";
  const batch = canopyProofEvidenceNetworkService.syncOfflineBatch(await c.req.json(), actor.id, idempotencyKey);
  return c.json({ ok: true, data: batch }, batch.replayed ? 200 : batch.status === "accepted" ? 201 : 202);
});

app.get("/canopyproof/evidence", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  if (!durable) return c.json({ ok: true, data: canopyProofService.listEvidence() });
  const actorOrganizationId = requireCanopyProofActorOrganizationId(actor);
  const requestedOrganizationId = c.req.query("organizationId");
  if (requestedOrganizationId) assertCanopyProofActorOrganization(actor, requestedOrganizationId);
  const projectId = c.req.query("projectId");
  const evidenceType = canopyProofEvidenceTypeFromQuery(c.req.query("evidenceType"));
  const verificationStatus = canopyProofEvidenceStatusFromQuery(c.req.query("status"));
  return c.json({
    ok: true,
    data: await durable.listEvidence({
      ...(actorOrganizationId ? { organizationId: actorOrganizationId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(evidenceType ? { evidenceType } : {}),
      ...(verificationStatus ? { verificationStatus } : {}),
      limit: canopyProofEvidenceLimitFromQuery(c.req.query("limit")),
    }),
  });
});

app.get("/canopyproof/evidence/sync-batches/:batchId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.getSyncBatch(c.req.param("batchId")) });
});

app.get("/canopyproof/evidence/custody-events/:custodyEventId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.getCustodyEvent(c.req.param("custodyEventId")) });
});

app.get("/canopyproof/evidence/:id", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const durable = canopyProofDurableTrustRegistry(c);
  if (!durable) return c.json({ ok: true, data: canopyProofService.getEvidence(c.req.param("id")) });
  const evidence = await durable.getEvidence(c.req.param("id"));
  assertCanopyProofActorOrganization(actor, evidence.organizationId);
  return c.json({ ok: true, data: evidence });
});

app.post("/canopyproof/evidence/:id/validation-runs", async (c) => {
  const actor = canopyProofActor(c, ["agent", "owner", "admin", "verifier", "researcher"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const run = await durable.runEvidenceValidation(
    c.req.param("id"),
    await c.req.json(),
    actor.id,
    actor.role as "agent" | "owner" | "admin" | "verifier" | "researcher",
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: run }, run.outcome === "pass" ? 201 : 202);
});

app.get("/canopyproof/evidence/:id/validation-runs", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const organizationId = requireCanopyProofDurableOrganizationId(actor);
  return c.json({
    ok: true,
    data: await durable.listEvidenceValidationRuns(c.req.param("id"), organizationId),
  });
});

app.get("/canopyproof/verification/validation-runs/:runId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceValidationRun(
      c.req.param("runId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/evidence/:id/ai-analyses", async (c) => {
  const actor = canopyProofActor(c, ["agent"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const analysis = await durable.recordEvidenceAiAnalysis(
    c.req.param("id"),
    await c.req.json(),
    actor.id,
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: analysis }, analysis.findings.length > 0 ? 202 : 201);
});

app.get("/canopyproof/evidence/:id/ai-analyses", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.listEvidenceAiAnalyses(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/verification/ai-analyses/:analysisId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceAiAnalysis(
      c.req.param("analysisId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/evidence/:id/human-reviews", async (c) => {
  const actor = canopyProofActor(c, ["verifier", "researcher"], "verified_organization");
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const review = await durable.recordEvidenceHumanReview(
    c.req.param("id"),
    await c.req.json(),
    actor.id,
    actor.role as "verifier" | "researcher",
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: review }, review.decision === "approve" ? 201 : 202);
});

app.get("/canopyproof/evidence/:id/human-reviews", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.listEvidenceHumanReviews(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/verification/human-reviews/:reviewId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceHumanReview(
      c.req.param("reviewId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/evidence/:id/reliance", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceReliance(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/evidence/:id/challenges", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "verified_organization");
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const challenge = await durable.openEvidenceChallenge(
    c.req.param("id"),
    await c.req.json(),
    actor.id,
    actor.role as "owner" | "admin" | "verifier" | "researcher",
    requireCanopyProofDurableOrganizationId(actor),
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: challenge }, 201);
});

app.get("/canopyproof/evidence/:id/challenges", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.listEvidenceChallenges(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/verification/evidence-challenges/:challengeId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceChallenge(
      c.req.param("challengeId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/verification/evidence-challenges/:challengeId/resolutions", async (c) => {
  const actor = canopyProofActor(c, ["verifier", "researcher"], "verified_organization");
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const resolution = await durable.resolveEvidenceChallenge(
    c.req.param("challengeId"),
    await c.req.json(),
    actor.id,
    actor.role as "verifier" | "researcher",
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: resolution }, resolution.decision === "needs_more_evidence" ? 202 : 201);
});

app.get("/canopyproof/verification/evidence-challenges/:challengeId/resolutions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.listEvidenceChallengeResolutions(
      c.req.param("challengeId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/verification/evidence-challenge-resolutions/:resolutionId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceChallengeResolution(
      c.req.param("resolutionId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/verification/evidence-challenge-resolutions/:resolutionId/corrections", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"], "verified_organization");
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const correction = await durable.recordEvidenceCorrection(
    c.req.param("resolutionId"),
    await c.req.json(),
    actor.id,
    actor.role as "owner" | "admin" | "verifier",
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: correction }, 201);
});

app.get("/canopyproof/evidence/:id/corrections", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.listEvidenceCorrections(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/verification/evidence-corrections/:correctionId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceCorrection(
      c.req.param("correctionId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/evidence/:id/final-decisions", async (c) => {
  const actor = canopyProofActor(c, ["verifier"], "accredited_organization");
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  const decision = await durable.recordEvidenceFinalDecision(
    c.req.param("id"),
    await c.req.json(),
    actor.id,
    canopyProofIdempotencyKey(c),
  );
  return c.json({ ok: true, data: decision }, decision.decision === "verify" ? 201 : 202);
});

app.get("/canopyproof/evidence/:id/final-decisions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.listEvidenceFinalDecisions(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/verification/evidence-final-decisions/:decisionId", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceFinalDecision(
      c.req.param("decisionId"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.get("/canopyproof/evidence/:id/final-verification", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  const durable = requireCanopyProofDurableVerificationRegistry(c);
  return c.json({
    ok: true,
    data: await durable.getEvidenceFinalVerification(
      c.req.param("id"),
      requireCanopyProofDurableOrganizationId(actor),
    ),
  });
});

app.post("/canopyproof/evidence/:id/custody-events", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const body = await c.req.json();
  const input = typeof body === "object" && body !== null ? { ...body, evidenceId: c.req.param("id") } : { evidenceId: c.req.param("id") };
  const event = canopyProofEvidenceNetworkService.recordCustodyEvent(input, actor.id);
  return c.json({ ok: true, data: event }, 201);
});

app.get("/canopyproof/evidence/:id/custody-events", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.listCustodyEvents(c.req.param("id")) });
});

app.post("/canopyproof/evidence/:id/community-attestations", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const attestation = canopyProofEvidenceNetworkService.recordCommunityAttestation(c.req.param("id"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: attestation }, attestation.stance === "challenge" ? 202 : 201);
});

app.get("/canopyproof/evidence/:id/community-attestations", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  return c.json({ ok: true, data: canopyProofEvidenceNetworkService.listCommunityAttestations(c.req.param("id")) });
});

app.post("/canopyproof/evidence/:id/ai-analysis", async (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const result = canopyProofService.analyzeEvidence(c.req.param("id"), await c.req.json());
  return c.json({ ok: true, data: result }, result.analysis.findings.length > 0 ? 202 : 201);
});

app.post("/canopyproof/verification/queue/pipelines", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const pipeline = canopyProofVerificationQueueService.planEvidencePipeline(await c.req.json(), actor.id);
  return c.json({ ok: true, data: pipeline }, 201);
});

app.post("/canopyproof/verification/queue/work-items", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const workItem = canopyProofVerificationQueueService.enqueueWorkItem(await c.req.json(), actor.id);
  return c.json({ ok: true, data: workItem }, 201);
});

app.get("/canopyproof/verification/queue/work-items", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const status = c.req.query("status");
  const stage = c.req.query("stage");
  const evidenceId = c.req.query("evidenceId");
  return c.json({
    ok: true,
    data: canopyProofVerificationQueueService.listWorkItems({
      ...(status ? { status } : {}),
      ...(stage ? { stage } : {}),
      ...(evidenceId ? { evidenceId } : {}),
    }),
  });
});

app.post("/canopyproof/verification/queue/work-items/:workItemId/start", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const workItem = canopyProofVerificationQueueService.startWorkItem(c.req.param("workItemId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: workItem }, workItem.status === "blocked" ? 202 : 200);
});

app.post("/canopyproof/verification/queue/work-items/:workItemId/complete", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const workItem = canopyProofVerificationQueueService.completeWorkItem(c.req.param("workItemId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: workItem }, 200);
});

app.post("/canopyproof/verification/queue/work-items/:workItemId/block", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "agent"]);
  const workItem = canopyProofVerificationQueueService.blockWorkItem(c.req.param("workItemId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: workItem }, 202);
});

app.get("/canopyproof/verification/decisions/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofVerificationDecisionService.getStatus() });
});

app.post("/canopyproof/verification/decisions", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "accredited_organization");
  const decision = canopyProofVerificationDecisionService.createDecisionDossier(
    await c.req.json(),
    actor.id,
    actor.role as CanopyProofVerificationDecisionReviewerRole,
  );
  return c.json({ ok: true, data: decision }, decision.decision === "approve" ? 201 : 202);
});

app.get("/canopyproof/verification/decisions", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  const subjectType = canopyProofVerificationDecisionSubjectTypeFromQuery(c.req.query("subjectType"));
  const decision = canopyProofVerificationDecisionKindFromQuery(c.req.query("decision"));
  const subjectId = c.req.query("subjectId");
  return c.json({
    ok: true,
    data: canopyProofVerificationDecisionService.listDecisionDossiers({
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(decision ? { decision } : {}),
    }),
  });
});

app.get("/canopyproof/verification/decisions/:decisionId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofVerificationDecisionService.getDecisionDossier(c.req.param("decisionId")) });
});

app.get("/canopyproof/verification/challenge-cases/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofChallengeCaseService.getStatus() });
});

app.post("/canopyproof/verification/challenge-cases", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community"]);
  const challengeCase = canopyProofChallengeCaseService.openChallengeCase(await c.req.json(), actor.id);
  return c.json({ ok: true, data: challengeCase }, 201);
});

app.get("/canopyproof/verification/challenge-cases", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const subjectType = canopyProofChallengeCaseSubjectTypeFromQuery(c.req.query("subjectType"));
  const status = canopyProofChallengeCaseStatusFromQuery(c.req.query("status"));
  const reason = canopyProofChallengeCaseReasonFromQuery(c.req.query("reason"));
  const subjectId = c.req.query("subjectId");
  return c.json({
    ok: true,
    data: canopyProofChallengeCaseService.listChallengeCases({
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
    }),
  });
});

app.get("/canopyproof/verification/challenge-cases/:challengeCaseId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofChallengeCaseService.getChallengeCase(c.req.param("challengeCaseId")) });
});

app.post("/canopyproof/verification/challenge-cases/:challengeCaseId/resolve", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "accredited_organization");
  const challengeCase = canopyProofChallengeCaseService.resolveChallengeCase(c.req.param("challengeCaseId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: challengeCase }, challengeCase.status === "needs_more_evidence" ? 202 : 200);
});

app.get("/canopyproof/public-records/status", (c) => {
  const index = buildCanopyProofPublicRecordIndex({
    proof: canopyProofService,
    projectRegistry: canopyProofProjectRegistryService,
  });
  return c.json({
    ok: true,
    data: {
      service: index.service,
      generatedAt: index.generatedAt,
      recordCount: index.recordCount,
      issuedRecordCount: index.issuedRecordCount,
      challengedRecordCount: index.challengedRecordCount,
      revokedRecordCount: index.revokedRecordCount,
      lineage: index.lineage,
      safety: index.safety,
    },
  });
});

app.get("/canopyproof/public-records", (c) => {
  const projectId = c.req.query("projectId");
  const regionId = c.req.query("regionId");
  const status = canopyProofPublicRecordStatusFromQuery(c.req.query("status"));
  const index = buildCanopyProofPublicRecordIndex({
    proof: canopyProofService,
    projectRegistry: canopyProofProjectRegistryService,
    filter: {
      ...(projectId ? { projectId } : {}),
      ...(regionId ? { regionId } : {}),
      ...(status ? { status } : {}),
    },
  });
  return c.json({ ok: true, data: index });
});

app.get("/canopyproof/public-records/:recordId", (c) => {
  const record = canopyProofService.getProofRecord(c.req.param("recordId"));
  const project = canopyProofProjectRegistryService.getProject(record.projectId);
  return c.json({
    ok: true,
    data: buildCanopyProofPublicRecord({
      record,
      project,
      challenges: canopyProofService.listProofRecordChallenges(record.id),
    }),
  });
});

app.post("/canopyproof/proof-records", async (c) => {
  const actor = canopyProofActor(c, ["verifier"], "accredited_organization");
  const body = await c.req.json();
  const input =
    typeof body === "object" && body !== null
      ? {
          ...body,
          humanReview: {
            ...("humanReview" in body && typeof body.humanReview === "object" && body.humanReview !== null ? body.humanReview : {}),
            reviewer: actor.id,
            role: "verifier",
          },
        }
      : body;
  const governanceSubjectId = canopyProofProofRecordSubjectFromRequest(input);
  const projectId = canopyProofProjectIdFromRequest(input);
  canopyProofProjectRegistryService.getProject(projectId);
  canopyProofMonitoringEventSummariesFromRequest(input, projectId);
  const governanceApprovals = canopyProofGovernanceService.validateApprovalReferences({
    subjectType: "proof_record",
    subjectId: governanceSubjectId,
    approvalIds: canopyProofGovernanceApprovalIdsFromRequest(input),
  });
  const record = canopyProofService.issueProofRecord({
    ...(typeof input === "object" && input !== null ? input : {}),
    governanceApprovals: governanceApprovals.map((approval) => approval.id),
  });
  return c.json({ ok: true, data: record }, 201);
});

app.get("/canopyproof/proof-records", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofService.listProofRecords() });
});

app.get("/canopyproof/proof-records/:recordId/certificate", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofCertificateArtifactForRecord(c.req.param("recordId")) });
});

app.get("/canopyproof/certificates/transparency/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofCertificateTransparencyService.getStatus() });
});

app.post("/canopyproof/proof-records/:recordId/certificate/transparency", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "verified_organization");
  const artifact = canopyProofCertificateArtifactForRecord(c.req.param("recordId"));
  const entry = canopyProofCertificateTransparencyService.publishCertificateArtifact(await c.req.json(), artifact, actor.id);
  return c.json({ ok: true, data: entry }, entry.status === "active" ? 201 : 202);
});

app.get("/canopyproof/certificates/transparency/entries", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const status = canopyProofCertificateTransparencyStatusFromQuery(c.req.query("status"));
  const recordId = c.req.query("recordId");
  const projectId = c.req.query("projectId");
  return c.json({
    ok: true,
    data: canopyProofCertificateTransparencyService.listEntries({
      ...(recordId ? { recordId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    }),
  });
});

app.get("/canopyproof/certificates/transparency/entries/:entryId", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofCertificateTransparencyService.getEntry(c.req.param("entryId")) });
});

app.post("/canopyproof/certificates/transparency/verify", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  const result = canopyProofCertificateTransparencyService.verifyCertificateArtifact(await c.req.json(), actor.id);
  return c.json({ ok: true, data: result }, result.valid ? 200 : 422);
});

app.post("/canopyproof/proof-records/:recordId/challenges", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer"]);
  const result = canopyProofService.challengeProofRecord(c.req.param("recordId"), await c.req.json(), actor.id);
  return c.json({ ok: true, data: result }, 202);
});

app.get("/canopyproof/proof-records/:recordId/challenges", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"]);
  return c.json({ ok: true, data: canopyProofService.listProofRecordChallenges(c.req.param("recordId")) });
});

app.post("/canopyproof/proof-records/:recordId/challenges/:challengeId/resolve", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier"], "accredited_organization");
  const result = canopyProofService.resolveProofRecordChallenge(
    c.req.param("recordId"),
    c.req.param("challengeId"),
    await c.req.json(),
    actor.id,
  );
  return c.json({ ok: true, data: result });
});

app.post("/canopyproof/reports/esg/generate", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"], "verified_organization");
  const body = await c.req.json();
  const report = canopyProofService.generateEsgReport({
    ...(typeof body === "object" && body !== null ? body : {}),
    generatedBy: actor.id,
  });
  return c.json({ ok: true, data: report }, 201);
});

app.get("/canopyproof/reports/esg", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofService.listEsgReports() });
});

app.get("/canopyproof/reports/esg/:id/export.json", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.text(canopyProofService.exportEsgReportJson(c.req.param("id")), 200, {
    "content-type": "application/json; charset=utf-8",
  });
});

app.get("/canopyproof/reports/esg/:id/export.pdf", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.body(canopyProofService.exportEsgReportPdf(c.req.param("id")), 200, {
    "content-disposition": `inline; filename="${c.req.param("id")}.pdf"`,
    "content-type": "application/pdf",
  });
});

app.get("/canopyproof/reports/esg/:id", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofService.getEsgReport(c.req.param("id")) });
});

app.get("/canopyproof/reports/institutional/status", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofInstitutionalReportingService.getStatus() });
});

app.post("/canopyproof/reports/framework-packages", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const packageRecord = canopyProofInstitutionalReportingService.generateFrameworkPackage(await c.req.json(), actor.id);
  return c.json({ ok: true, data: packageRecord }, 201);
});

app.get("/canopyproof/reports/framework-packages", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofInstitutionalReportingService.listFrameworkPackages(c.req.query("framework")) });
});

app.get("/canopyproof/reports/framework-packages/:id/export.json", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.text(canopyProofInstitutionalReportingService.exportFrameworkPackageJson(c.req.param("id")), 200, {
    "content-type": "application/json; charset=utf-8",
  });
});

app.get("/canopyproof/reports/framework-packages/:id/export.pdf", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.body(canopyProofInstitutionalReportingService.exportFrameworkPackagePdf(c.req.param("id")), 200, {
    "content-disposition": `inline; filename="${c.req.param("id")}.pdf"`,
    "content-type": "application/pdf",
  });
});

app.get("/canopyproof/reports/framework-packages/:id", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofInstitutionalReportingService.getFrameworkPackage(c.req.param("id")) });
});

app.post("/canopyproof/reports/investor-review-packages", async (c) => {
  const actor = canopyProofActor(c, ["owner", "admin", "verifier", "researcher"]);
  const packageRecord = canopyProofInstitutionalReportingService.generateInvestorReviewPackage(await c.req.json(), actor.id);
  return c.json({ ok: true, data: packageRecord }, 201);
});

app.get("/canopyproof/reports/investor-review-packages", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({
    ok: true,
    data: canopyProofInstitutionalReportingService.listInvestorReviewPackages(c.req.query("organizationId")),
  });
});

app.get("/canopyproof/reports/investor-review-packages/:id/export.json", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.text(canopyProofInstitutionalReportingService.exportInvestorReviewPackageJson(c.req.param("id")), 200, {
    "content-type": "application/json; charset=utf-8",
  });
});

app.get("/canopyproof/reports/investor-review-packages/:id/export.pdf", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.body(canopyProofInstitutionalReportingService.exportInvestorReviewPackagePdf(c.req.param("id")), 200, {
    "content-disposition": `inline; filename="${c.req.param("id")}.pdf"`,
    "content-type": "application/pdf",
  });
});

app.get("/canopyproof/reports/investor-review-packages/:id", (c) => {
  canopyProofActor(c, ["owner", "admin", "verifier", "researcher", "observer"]);
  return c.json({ ok: true, data: canopyProofInstitutionalReportingService.getInvestorReviewPackage(c.req.param("id")) });
});

export {
  repository,
  lotteryRepository,
  lotteryService,
  impactRepository,
  impactService,
  evidenceService,
  certificateService,
  riskRepository,
  riskService,
  fundRepository,
  fundService,
  paymentRepository,
  paymentService,
  telegramRepository,
  telegramService,
  campaignRepository,
  campaignService,
  feedbackRepository,
  feedbackService,
  statusRepository,
  statusService,
  readinessService,
  metricsService,
  canopyProofIdentityService,
  canopyProofMemoryService,
};
