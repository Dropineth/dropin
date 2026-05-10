import { z } from "zod";

export const chainIds = ["solana", "ton", "monad", "evm", "manual"] as const;
export const currencies = ["USDC", "USDT", "TON", "SOL", "EHKD"] as const;

export const lotteryRoundStatuses = [
  "draft",
  "scheduled",
  "open",
  "closed",
  "randomness_requested",
  "randomness_committed",
  "winners_computed",
  "drop_computed",
  "prize_distributed",
  "fund_allocated",
  "certificate_generated",
  "finalized",
  "challenged",
  "cancelled",
] as const;

export const projectStatuses = [
  "draft",
  "submitted",
  "reviewing",
  "approved",
  "funded",
  "milestone_1_released",
  "planting_started",
  "evidence_submitted",
  "field_verified",
  "impact_certified",
  "carbon_monitoring",
  "rwa_eligible",
  "completed",
  "challenged",
  "rejected",
] as const;

export const evidenceStatuses = [
  "uploaded",
  "hashed",
  "geo_checked",
  "ai_screened",
  "field_reviewed",
  "accepted",
  "rejected",
  "challenged",
  "superseded",
] as const;

export const evidenceKinds = [
  "photo",
  "video",
  "gps",
  "satellite",
  "sensor",
  "ngo_report",
] as const;

export const rwaFragmentTypes = [
  "allocation",
  "fee_rebate",
  "impact_right",
  "qualified_yield",
] as const;

export const rwaFragmentStatuses = [
  "dropped",
  "claimable",
  "claimed",
  "linked_to_project",
  "impact_verified",
  "carbon_estimated",
  "mrv_pending",
  "mrv_certified",
  "tokenized",
  "redeemed",
  "retired",
  "expired",
  "challenged",
] as const;

export const challengeTargets = [
  "lottery_round",
  "randomness_certificate",
  "prize_distribution",
  "drop_result",
  "fund_allocation",
  "project_funding",
  "project",
  "evidence_object",
  "impact_certificate",
  "treasury_transaction",
  "settlement_certificate",
  "payment_intent",
  "carbon_estimate",
  "rwa_fragment",
  "validator_attestation",
  "robot_mission",
  "marketing_claim",
  "round_anchor",
  "impact_anchor",
] as const;

export const challengeStatuses = [
  "submitted",
  "bonded",
  "bond_locked",
  "target_challenged",
  "evidence_submitted",
  "under_review",
  "reviewing",
  "accepted",
  "rejected",
  "resolved",
  "slashed",
  "rewarded",
  "cancelled",
] as const;

export const riskLevels = ["low", "medium", "high", "blocked"] as const;
export const riskActions = ["allow", "delay", "manual_review", "block"] as const;
export const riskEventStatuses = ["open", "resolved", "dismissed"] as const;
export const dropClaimOutcomes = ["claimable", "delayed", "manual_review", "blocked"] as const;

export const treasuryAccountTypes = [
  "payment_clearing",
  "prize_pool",
  "tree_planting_fund",
  "operations",
  "insurance_challenge_pool",
  "referral_growth",
  "protocol_reserve",
  "round_escrow",
  "project_escrow",
] as const;

export const treasuryTransactionTypes = [
  "payment_confirmation",
  "lottery_allocation",
  "sponsor_allocation",
  "admin_adjustment",
  "milestone_release",
  "milestone_settlement",
  "challenge_freeze",
  "challenge_release",
  "revoke_reversal",
] as const;

export const treasuryTransactionStatuses = ["pending", "posted", "reversed", "challenged"] as const;

export const fundAllocationTypes = [
  "tree_fund",
  "prize_pool",
  "operations",
  "insurance_challenge_pool",
  "referral_growth",
  "protocol_reserve",
] as const;

export const fundAllocationSourceTypes = ["lottery_round", "sponsor_campaign", "admin"] as const;

export const fundAllocationStatuses = [
  "created",
  "allocated",
  "pending_approval",
  "approved",
  "timelocked",
  "released",
  "evidence_required",
  "evidence_accepted",
  "impact_certified",
  "settled",
  "challenged",
  "revoked",
] as const;

export const milestoneReleaseStatuses = ["created", "released", "settled", "challenged", "revoked"] as const;
export const settlementCertificateStatuses = ["issued", "challenged", "revoked"] as const;

export const paymentPurposes = ["lottery_entry", "sponsor_allocation", "manual_admin"] as const;
export const paymentIntentStatuses = [
  "created",
  "awaiting_payment",
  "submitted",
  "confirming",
  "confirmed",
  "reconciled",
  "expired",
  "failed",
  "refunded",
  "challenged",
] as const;
export const paymentEventTypes = [
  "intent_created",
  "payment_submitted",
  "payment_verified",
  "payment_confirmed",
  "payment_failed",
  "payment_reconciled",
  "payment_challenged",
  "anomaly_detected",
] as const;
export const paymentReconciliationStatuses = ["clean", "warnings", "failed"] as const;
export const telegramAuthModes = ["mock", "strict"] as const;
export const referralSourceTypes = ["ticket", "round", "forest", "campaign"] as const;
export const referralCodeStatuses = ["active", "paused", "revoked"] as const;
export const referralEventStatuses = ["claimed", "duplicate", "suspicious", "rejected"] as const;
export const shareCardStatuses = ["created", "shared", "revoked"] as const;
export const campaignStatuses = ["draft", "scheduled", "active", "ended", "finalized", "cancelled"] as const;
export const campaignParticipantStatuses = ["joined", "blocked"] as const;
export const leafPointTransactionStatuses = ["posted", "reversed", "challenged"] as const;
export const campaignReportStatuses = ["draft", "published"] as const;
export const feedbackSources = ["web", "miniapp", "admin", "api"] as const;
export const feedbackStatuses = ["open", "resolved", "dismissed"] as const;
export const feedbackSeverities = ["low", "medium", "high"] as const;
export const launchGateStatuses = ["pass", "warn", "fail"] as const;

export const certificateLevels = [
  "tree_nft",
  "impact_certificate",
  "estimated_carbon",
  "mrv_carbon_rwa",
  "retired_claim",
] as const;

export const regionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  country: z.string().min(1),
  restorationType: z.string().min(1),
  restorationPriority: z.enum(["low", "medium", "high", "critical"]),
  requiredTreesLow: z.number().int().nonnegative(),
  requiredTreesHigh: z.number().int().nonnegative(),
  verifiedTrees: z.number().int().nonnegative(),
  estimatedCo2eTonnes: z.number().nonnegative(),
  survivalRateEstimate: z.number().min(0).max(1),
});

export const speciesSchema = z.object({
  id: z.string().min(1),
  regionId: z.string().min(1),
  scientificName: z.string().min(1),
  commonName: z.string().min(1),
  waterRequirement: z.enum(["low", "medium", "high"]),
  climateSuitability: z.number().min(0).max(100),
  carbonPotential: z.number().min(0).max(100),
  biodiversityScore: z.number().min(0).max(100),
  localEconomicValue: z.number().min(0).max(100),
  invasiveRisk: z.enum(["low", "medium", "high"]),
});

export const createLotteryRoundSchema = z.object({
  chain: z.enum(chainIds),
  regionId: z.string().min(1),
  title: z.string().min(3),
  ticketPriceAmount: z.string().regex(/^\d+(\.\d+)?$/),
  ticketPriceSymbol: z.enum(currencies),
  prizePoolBps: z.number().int().min(0).max(10000),
  treeFundBps: z.number().int().min(0).max(10000),
  canopyDropBps: z.number().int().min(0).max(10000),
  rwaFragmentDropBps: z.number().int().min(0).max(10000),
  referralBps: z.number().int().min(0).max(10000),
  operationsBps: z.number().int().min(0).max(10000),
  challengePoolBps: z.number().int().min(0).max(10000),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
});

export const lotteryRoundSchema = createLotteryRoundSchema.extend({
  id: z.string().min(1),
  status: z.enum(lotteryRoundStatuses),
  randomnessCertificateId: z.string().optional(),
  roundCertificateHash: z.string().optional(),
  entryMerkleRoot: z.string().optional(),
  entryCount: z.number().int().nonnegative().default(0),
  totalAmount: z.string().default("0"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createLotteryEntrySchema = z.object({
  userId: z.string().min(1),
  wallet: z.string().min(8),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(currencies),
  regionId: z.string().min(1),
  txHash: z.string().optional(),
  paymentIntentId: z.string().min(1).optional(),
  antiSybilScore: z.number().min(0).max(100).default(50),
  idempotencyKey: z.string().min(8).optional(),
});

export const lotteryEntrySchema = createLotteryEntrySchema.extend({
  id: z.string().min(1),
  roundId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const lotteryTicketSchema = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  entryId: z.string().min(1),
  userId: z.string().min(1),
  wallet: z.string().min(8),
  ticketNumber: z.number().int().positive(),
  receiptHash: z.string().min(1),
  status: z.enum(["issued", "voided", "challenged"]),
  createdAt: z.string().datetime(),
});

export const randomnessCertificateSchema = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  entryMerkleRoot: z.string().min(1),
  publicRandomness: z.string().min(1),
  committeeCommitment: z.string().min(1),
  committeeReveal: z.string().min(1),
  finalSeed: z.string().min(1),
  algorithm: z.enum(["sha3_256", "sha256"]),
  winnerMerkleRoot: z.string().min(1),
  dropMerkleRoot: z.string().min(1),
  scriptHash: z.string().min(1),
  signatures: z.array(z.string()),
  pqSignature: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const dropResultSchema = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  entryId: z.string().min(1),
  userId: z.string().min(1),
  wallet: z.string().min(8),
  canopyAmount: z.string(),
  rwaFragmentAmount: z.string(),
  rarity: z.enum(["none", "common", "rare", "epic", "legendary"]),
  merkleLeaf: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const winnerResultSchema = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  entryId: z.string().min(1),
  userId: z.string().min(1),
  wallet: z.string().min(8),
  rank: z.number().int().positive(),
  prizeAmount: z.string(),
  prizeCurrency: z.enum(currencies),
  merkleLeaf: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  regionId: z.string().min(1),
  operator: z.string().min(1),
  targetTreeCount: z.number().int().positive(),
  targetSpecies: z.array(z.string()).min(1),
  budgetAmount: z.string(),
  status: z.enum(projectStatuses),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createProjectSchema = z.object({
  title: z.string().min(3),
  regionId: z.string().min(1),
  operator: z.string().min(1),
  targetTreeCount: z.number().int().positive(),
  targetSpecies: z.array(z.string()).min(1),
  budgetAmount: z.string().regex(/^\d+(\.\d+)?$/),
  status: z.enum(projectStatuses).default("draft"),
});

export const projectMilestoneStatuses = [
  "draft",
  "approved",
  "funded",
  "released",
  "evidence_required",
  "verified",
  "challenged",
  "cancelled",
] as const;

export const createProjectMilestoneSchema = z.object({
  title: z.string().min(3),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  status: z.enum(projectMilestoneStatuses).default("draft"),
  dueAt: z.string().datetime().optional(),
});

export const projectMilestoneSchema = createProjectMilestoneSchema.extend({
  id: z.string().min(1),
  projectId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const evidenceUploadBaseSchema = z.object({
  projectId: z.string().min(1),
  treeClusterId: z.string().optional(),
  kind: z.enum(evidenceKinds),
  uri: z.string().min(1),
  rawContent: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  submittedBy: z.string().min(1),
});

export const evidenceUploadSchema = evidenceUploadBaseSchema.refine((input) => input.rawContent || input.content || input.contentHash, {
  message: "Evidence upload requires rawContent, content, or contentHash.",
});

export const evidenceObjectSchema = evidenceUploadBaseSchema.omit({ rawContent: true, content: true, contentHash: true }).extend({
  id: z.string().min(1),
  sha256Hash: z.string().min(1),
  status: z.enum(evidenceStatuses),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const evidenceReviewSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  reviewer: z.string().min(1).default("api-admin"),
  notes: z.string().optional(),
});

export const createImpactCertificateSchema = z.object({
  projectId: z.string().min(1),
  treeClusterId: z.string().min(1),
  evidenceObjectIds: z.array(z.string()).min(1).optional(),
  evidenceIds: z.array(z.string()).min(1).optional(),
  verifiedTreeCount: z.number().int().positive(),
  survivalRateEstimate: z.number().min(0).max(1),
  estimatedCo2eLow: z.string(),
  estimatedCo2eHigh: z.string(),
  methodologyVersion: z.string().min(1),
  validatorSignatures: z.array(z.string()).default([]),
}).refine((input) => (input.evidenceIds?.length ?? input.evidenceObjectIds?.length ?? 0) > 0, {
  message: "Impact certificate requires at least one evidence ID.",
});

export const impactCertificateSchema = createImpactCertificateSchema.extend({
  id: z.string().min(1),
  regionId: z.string().min(1),
  certificateLevel: z.enum(certificateLevels),
  evidenceRoot: z.string().min(1),
  confidenceScore: z.number().min(0).max(100),
  pqSignature: z.string().optional(),
  chainAnchorHash: z.string().optional(),
  status: z.enum(["draft", "issued", "challenged", "revoked", "retired"]),
  issuedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export const rwaFragmentSchema = z.object({
  id: z.string().min(1),
  holderUserId: z.string().min(1),
  holderWallet: z.string().min(8),
  roundId: z.string().optional(),
  projectId: z.string().optional(),
  regionId: z.string().optional(),
  type: z.enum(rwaFragmentTypes),
  status: z.enum(rwaFragmentStatuses),
  notionalCo2e: z.string().optional(),
  feeCreditAmount: z.string().optional(),
  jurisdictionMode: z.enum(["global_utility", "qualified_investor", "licensed_security"]),
  transferability: z.enum(["non_transferable", "restricted", "transferable"]),
  evidenceRoot: z.string().optional(),
  certificateId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createChallengeSchema = z.object({
  targetType: z.enum(challengeTargets),
  targetId: z.string().min(1),
  challenger: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(3),
  attackScenario: z.string().min(10),
  evidenceHash: z.string().min(1),
  bondAmount: z.string(),
  bondCurrency: z.enum(currencies).optional(),
});

export const challengeCaseSchema = createChallengeSchema.extend({
  id: z.string().min(1),
  status: z.enum(challengeStatuses),
  result: z.enum(["pending", "accepted", "rejected", "mitigated", "slashed", "resolved", "rewarded"]).default("pending"),
  rewardAmount: z.string().default("0"),
  protocolFix: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const riskScoreInputSchema = z.object({
  wallet: z.string().min(8),
  userId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  entryCount: z.number().int().nonnegative(),
  totalContributionAmount: z.string().regex(/^\d+(\.\d+)?$/),
  walletAgeDays: z.number().int().nonnegative().optional(),
  priorClaimCount: z.number().int().nonnegative().optional(),
  rejectedChallengeCount: z.number().int().nonnegative().optional(),
  acceptedEvidenceCount: z.number().int().nonnegative().optional(),
});

export const riskScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  riskLevel: z.enum(riskLevels),
  reasons: z.array(z.string()),
  recommendedAction: z.enum(riskActions),
});

export const riskScoreSnapshotSchema = riskScoreResultSchema.extend({
  id: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  wallet: z.string().optional(),
  userId: z.string().optional(),
  input: z.unknown(),
  createdAt: z.string().datetime(),
});

export const riskEventSchema = z.object({
  id: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  riskLevel: z.enum(riskLevels),
  score: z.number().min(0).max(1),
  recommendedAction: z.enum(riskActions),
  reasonCodes: z.array(z.string()),
  status: z.enum(riskEventStatuses),
  resolution: z.string().optional(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});

export const resolveRiskEventSchema = z.object({
  resolver: z.string().min(1).default("api-admin"),
  resolution: z.string().min(3),
  status: z.enum(["resolved", "dismissed"]).default("resolved"),
});

export const challengeEvidenceSubmitSchema = z.object({
  uri: z.string().min(1),
  evidenceHash: z.string().min(1),
  submittedBy: z.string().min(1),
});

export const challengeEvidenceSchema = challengeEvidenceSubmitSchema.extend({
  id: z.string().min(1),
  challengeId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const challengeBondSchema = z.object({
  id: z.string().min(1),
  challengeId: z.string().min(1),
  challengerUserId: z.string().min(1),
  amount: z.string(),
  currency: z.enum(currencies),
  status: z.enum(["locked", "slashed", "rewarded", "released"]),
  slashReason: z.string().optional(),
  rewardReason: z.string().optional(),
  lockedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});

export const challengeResolutionSchema = z.object({
  id: z.string().min(1),
  challengeId: z.string().min(1),
  resolver: z.string().min(1),
  action: z.enum(["accept", "reject", "resolve"]),
  outcome: z.enum(["accepted", "rejected", "resolved"]),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const challengeResolutionInputSchema = z.object({
  resolver: z.string().min(1).default("api-admin"),
  notes: z.string().optional(),
  protocolFix: z.string().optional(),
});

export const dropClaimSchema = z.object({
  wallet: z.string().min(8),
  userId: z.string().min(1).optional(),
  walletAgeDays: z.number().int().nonnegative().optional(),
  priorClaimCount: z.number().int().nonnegative().optional(),
  rejectedChallengeCount: z.number().int().nonnegative().optional(),
  acceptedEvidenceCount: z.number().int().nonnegative().optional(),
});

export const dropClaimResultSchema = z.object({
  outcome: z.enum(dropClaimOutcomes),
  risk: riskScoreResultSchema,
  targetType: z.enum(["drop_result", "rwa_fragment"]),
  targetId: z.string().min(1),
});

export const treasuryAccountSchema = z.object({
  id: z.string().min(1),
  type: z.enum(treasuryAccountTypes),
  name: z.string().min(1),
  currency: z.enum(currencies),
  status: z.enum(["active", "paused", "closed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const treasuryTransactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(treasuryTransactionTypes),
  debitAccountId: z.string().min(1),
  creditAccountId: z.string().min(1),
  amount: z.string(),
  currency: z.enum(currencies),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  status: z.enum(treasuryTransactionStatuses),
  reversalOfId: z.string().optional(),
  memo: z.string().optional(),
  createdAt: z.string().datetime(),
  postedAt: z.string().datetime().optional(),
});

export const createFundAllocationSchema = z.object({
  sourceType: z.enum(fundAllocationSourceTypes),
  sourceId: z.string().min(1),
  allocationType: z.enum(fundAllocationTypes),
  projectId: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(currencies),
  status: z.enum(fundAllocationStatuses).default("created"),
  ledgerTransactionId: z.string().optional(),
});

export const fundAllocationSchema = createFundAllocationSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const allocationChallengeSchema = z.object({
  challenger: z.string().min(1).default("api-admin"),
  reason: z.string().min(3),
});

export const projectMilestoneReleaseSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  milestoneId: z.string().min(1),
  allocationId: z.string().optional(),
  amount: z.string(),
  currency: z.enum(currencies),
  status: z.enum(milestoneReleaseStatuses),
  ledgerTransactionId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const releaseMilestoneFundsSchema = z.object({
  allocationId: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(currencies).default("USDC"),
  actor: z.string().min(1).default("api-admin"),
});

export const settlementCertificateSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  milestoneId: z.string().min(1),
  releaseId: z.string().min(1),
  evidenceRoot: z.string().min(1),
  amount: z.string(),
  currency: z.enum(currencies),
  certificateId: z.string().optional(),
  settlementHash: z.string().min(1),
  finalSettlement: z.boolean(),
  status: z.enum(settlementCertificateStatuses),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const settleMilestoneSchema = z.object({
  releaseId: z.string().min(1).optional(),
  certificateId: z.string().min(1).optional(),
  finalSettlement: z.boolean().default(false),
  actor: z.string().min(1).default("api-admin"),
});

export const createPaymentIntentSchema = z.object({
  userId: z.string().min(1),
  wallet: z.string().min(8),
  purpose: z.enum(paymentPurposes),
  purposeId: z.string().min(1),
  chain: z.enum(chainIds).default("manual"),
  currency: z.enum(currencies),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  expectedRecipient: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const paymentIntentSchema = createPaymentIntentSchema.extend({
  id: z.string().min(1),
  status: z.enum(paymentIntentStatuses),
  expectedRecipient: z.string().min(1),
  paymentNonce: z.string().optional(),
  expectedMemo: z.string().optional(),
  submittedTxHash: z.string().optional(),
  confirmedTxHash: z.string().optional(),
  confirmedAt: z.string().datetime().optional(),
  confirmedBlockTime: z.string().datetime().optional(),
  confirmedRawPayloadHash: z.string().optional(),
  verificationSource: z.string().optional(),
  expiresAt: z.string().datetime(),
  treasuryTransactionId: z.string().optional(),
  reconciliationStatus: z.enum(paymentReconciliationStatuses).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const submitPaymentIntentSchema = z.object({
  txHash: z.string().min(6),
  observedAmount: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  observedCurrency: z.enum(currencies).optional(),
  submittedBy: z.string().min(1).default("demo-user"),
});

export const adminConfirmPaymentSchema = z.object({
  actor: z.string().min(1).default("api-admin"),
  confirmedTxHash: z.string().min(6).optional(),
  observedAmount: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  observedCurrency: z.enum(currencies).optional(),
  notes: z.string().optional(),
});

export const verifyPaymentIntentSchema = z.object({
  txHash: z.string().min(6),
  actor: z.string().min(1).default("payment-verifier"),
});

export const adminFailPaymentSchema = z.object({
  actor: z.string().min(1).default("api-admin"),
  reason: z.string().min(3),
});

export const paymentEventSchema = z.object({
  id: z.string().min(1),
  paymentIntentId: z.string().min(1),
  type: z.enum(paymentEventTypes),
  txHash: z.string().optional(),
  metadata: z.unknown().optional(),
  createdAt: z.string().datetime(),
});

export const paymentReconciliationReportSchema = z.object({
  id: z.string().min(1),
  status: z.enum(paymentReconciliationStatuses),
  checkedIntentCount: z.number().int().nonnegative(),
  duplicateTxCount: z.number().int().nonnegative(),
  amountMismatchCount: z.number().int().nonnegative(),
  currencyMismatchCount: z.number().int().nonnegative(),
  stalePendingCount: z.number().int().nonnegative(),
  anomalies: z.array(z.record(z.string(), z.unknown())),
  createdAt: z.string().datetime(),
});

export const reconcilePaymentsSchema = z.object({
  actor: z.string().min(1).default("api-admin"),
  staleAfterMinutes: z.number().int().positive().default(60),
});

export const telegramUserPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  languageCode: z.string().optional(),
});

export const telegramSessionSchema = z.object({
  initData: z.string().optional(),
  user: telegramUserPayloadSchema.optional(),
  wallet: z.string().min(8).optional(),
  referralCode: z.string().min(3).optional(),
}).refine((input) => input.initData || input.user, {
  message: "Telegram session requires initData or mock user payload.",
});

export const telegramAccountSchema = z.object({
  id: z.string().min(1),
  telegramUserId: z.string().min(1),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  languageCode: z.string().optional(),
  linkedUserId: z.string().min(1),
  wallet: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createReferralCodeSchema = z.object({
  ownerUserId: z.string().min(1),
  sourceType: z.enum(referralSourceTypes),
  sourceId: z.string().min(1),
});

export const referralCodeSchema = createReferralCodeSchema.extend({
  id: z.string().min(1),
  code: z.string().min(3),
  status: z.enum(referralCodeStatuses),
  createdAt: z.string().datetime(),
});

export const claimReferralSchema = z.object({
  code: z.string().min(3),
  telegramUserId: z.union([z.string(), z.number()]).transform(String).optional(),
  referredUserId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  wallet: z.string().min(8).optional(),
}).refine((input) => input.telegramUserId || input.referredUserId, {
  message: "Referral claim requires telegramUserId or referredUserId.",
});

export const referralEventSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(3),
  referrerUserId: z.string().min(1),
  referredTelegramUserId: z.string().optional(),
  referredUserId: z.string().optional(),
  roundId: z.string().optional(),
  status: z.enum(referralEventStatuses),
  riskScoreSnapshot: z.unknown().optional(),
  leafPoints: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
});

export const shareTicketSchema = z.object({
  ticketId: z.string().min(1),
  roundId: z.string().min(1),
  ownerUserId: z.string().min(1),
  wallet: z.string().min(8).optional(),
});

export const shareCardSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1).optional(),
  roundId: z.string().min(1),
  ownerUserId: z.string().min(1),
  referralCode: z.string().min(3),
  title: z.string().min(1),
  copy: z.string().min(1),
  url: z.string().min(1),
  status: z.enum(shareCardStatuses),
  createdAt: z.string().datetime(),
});

export const createCampaignSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  regionId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  fundingGoalAmount: z.string().regex(/^\d+(\.\d+)?$/),
  fundingGoalCurrency: z.enum(currencies),
  treeGoal: z.number().int().positive(),
  roundId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

export const campaignSchema = createCampaignSchema.extend({
  id: z.string().min(1),
  status: z.enum(campaignStatuses),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const joinCampaignSchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  wallet: z.string().min(8).optional(),
  referralCode: z.string().min(3).optional(),
});

export const campaignParticipantSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  userId: z.string().min(1),
  wallet: z.string().optional(),
  referralCode: z.string().optional(),
  status: z.enum(campaignParticipantStatuses),
  joinedAt: z.string().datetime(),
});

export const leafPointsAccountSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  campaignId: z.string().min(1),
  balance: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const leafPointsTransactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  userId: z.string().min(1),
  campaignId: z.string().min(1),
  amount: z.number().int(),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  reason: z.string().min(1),
  status: z.enum(leafPointTransactionStatuses),
  createdAt: z.string().datetime(),
});

export const campaignReportSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  status: z.enum(campaignReportStatuses),
  participantCount: z.number().int().nonnegative(),
  ticketCount: z.number().int().nonnegative(),
  confirmedPaymentIntentCount: z.number().int().nonnegative(),
  totalConfirmedPaymentAmount: z.string(),
  fundingGoalAmount: z.string(),
  fundingGoalCurrency: z.enum(currencies),
  treeGoal: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  challengeCount: z.number().int().nonnegative(),
  riskEventCount: z.number().int().nonnegative(),
  fundAllocations: z.array(z.unknown()),
  projectMilestones: z.array(z.unknown()),
  impactCertificateStatuses: z.record(z.string(), z.number().int().nonnegative()),
  leaderboard: z.array(z.unknown()),
  createdAt: z.string().datetime(),
});

export const createFeedbackSchema = z.object({
  source: z.enum(feedbackSources),
  userId: z.string().min(1).optional(),
  wallet: z.string().min(6).optional(),
  campaignId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  page: z.string().min(1).optional(),
  category: z.string().min(2).default("general"),
  message: z.string().min(3).max(2000),
  severity: z.enum(feedbackSeverities).default("low"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const feedbackItemSchema = createFeedbackSchema.extend({
  id: z.string().min(1),
  status: z.enum(feedbackStatuses),
  resolution: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const resolveFeedbackSchema = z.object({
  actor: z.string().min(1).default("api-admin"),
  status: z.enum(["resolved", "dismissed"]).default("resolved"),
  resolution: z.string().min(3),
});

export const launchReadinessCheckSchema = z.object({
  actor: z.string().min(1).default("api-admin"),
  campaignId: z.string().min(1).default("campaign_v1_ggw_testnet"),
});

export const launchCheckSchema = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  campaignId: z.string().min(1),
  decision: z.enum(launchGateStatuses),
  summary: z.unknown(),
  createdAt: z.string().datetime(),
});

export const systemStatusSnapshotSchema = z.object({
  id: z.string().min(1),
  status: z.enum(launchGateStatuses),
  repositoryMode: z.string().min(1),
  paymentMode: z.string().min(1),
  campaignCount: z.number().int().nonnegative(),
  liveCampaignCount: z.number().int().nonnegative(),
  openRiskEventCount: z.number().int().nonnegative(),
  openChallengeCount: z.number().int().nonnegative(),
  pendingPaymentIntentCount: z.number().int().nonnegative(),
  stalePaymentIntentCount: z.number().int().nonnegative(),
  metrics: z.unknown(),
  createdAt: z.string().datetime(),
});

export const auditLogSchema = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  beforeState: z.unknown().optional(),
  afterState: z.unknown().optional(),
  requestId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.union([
    z.object({
      ok: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      ok: z.literal(false),
      error: z.string().min(1),
    }),
  ]);

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string().min(1),
  leafPoints: z.number().int().nonnegative(),
});

export const campaignDetailSchema = z.object({
  campaign: campaignSchema,
  participantCount: z.number().int().nonnegative(),
  leaderboard: z.array(leaderboardEntrySchema),
});

export const campaignMeSchema = z.object({
  participant: campaignParticipantSchema.optional(),
  leafPointsAccount: leafPointsAccountSchema.optional(),
  tickets: z.array(lotteryTicketSchema).default([]),
  drops: z.array(dropResultSchema).default([]),
  rwaFragments: z.array(rwaFragmentSchema).default([]),
});

export const lotteryRoundDetailSchema = z.object({
  round: lotteryRoundSchema,
  entries: z.array(lotteryEntrySchema),
  tickets: z.array(lotteryTicketSchema),
});

export const lotteryRoundResultsSchema = z.object({
  proof: z.object({
    entryMerkleRoot: z.string().optional(),
    randomnessCertificateId: z.string().optional(),
    finalSeed: z.string().optional(),
    winnerMerkleRoot: z.string().optional(),
    dropMerkleRoot: z.string().optional(),
    scriptHash: z.string().optional(),
  }),
  winners: z.array(winnerResultSchema),
  drops: z.array(dropResultSchema),
  rwaFragments: z.array(
    rwaFragmentSchema.extend({
      disclosure: z.string().min(1).optional(),
    }),
  ),
});

export const paymentInstructionSchema = z.object({
  paymentIntentId: z.string().min(1),
  chain: z.enum(chainIds),
  network: z.string().min(1).optional(),
  currency: z.enum(currencies),
  amount: z.string().min(1),
  recipient: z.string().min(1),
  memo: z.string().optional(),
  paymentNonce: z.string().optional(),
  expiresAt: z.string().datetime(),
});

export const poccAhinEvidenceSourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["payment", "ticket", "fund", "evidence", "certificate", "anchor", "challenge", "oracle"]),
  hash: z.string().min(1),
  weight: z.number().int().min(1).max(100),
  signer: z.string().min(1),
});

export const poccAhinConsensusReceiptSchema = z.object({
  id: z.string().min(1),
  subjectType: z.enum(["round", "campaign", "tree", "certificate", "anchor", "payment"]),
  subjectId: z.string().min(1),
  evidenceRoot: z.string().min(1),
  quorumWeight: z.number().int().nonnegative(),
  requiredWeight: z.number().int().positive(),
  accepted: z.boolean(),
  sources: z.array(poccAhinEvidenceSourceSchema),
  warnings: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export const anchorVerificationReceiptSchema = z.object({
  id: z.string().min(1),
  chain: z.enum(chainIds),
  subjectId: z.string().min(1),
  localRoot: z.string().min(1),
  anchoredRoot: z.string().min(1).optional(),
  status: z.enum(["verified", "pending", "mismatch", "unavailable"]),
  txHash: z.string().optional(),
  verifier: z.string().min(1),
  checkedAt: z.string().datetime(),
});

export const notificationEventSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(["slack", "telegram", "operator_log"]),
  eventType: z.enum(["payment_confirmed", "ticket_issued", "challenge_submitted", "anchor_verified", "deployment_smoke"]),
  severity: z.enum(["info", "warn", "critical"]),
  message: z.string().min(1),
  targetUrl: z.string().url().optional(),
  redactedPayload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export const seedRegions = [
  {
    id: "region_ggw_sahel",
    name: "Great Green Wall / Sahel",
    slug: "great-green-wall-sahel",
    country: "Senegal",
    restorationType: "Dryland restoration / agroforestry",
    restorationPriority: "critical",
    requiredTreesLow: 18_200_000_000,
    requiredTreesHigh: 42_700_000_000,
    verifiedTrees: 438_200,
    estimatedCo2eTonnes: 51_609,
    survivalRateEstimate: 0.712,
  },
  {
    id: "region_kenya_rift",
    name: "Kenya Rift Watershed",
    slug: "kenya-rift-watershed",
    country: "Kenya",
    restorationType: "Watershed restoration",
    restorationPriority: "high",
    requiredTreesLow: 1_800_000_000,
    requiredTreesHigh: 4_200_000_000,
    verifiedTrees: 34_120,
    estimatedCo2eTonnes: 9_420,
    survivalRateEstimate: 0.74,
  },
] satisfies Array<z.input<typeof regionSchema>>;

export const seedSpecies = [
  {
    id: "species_faidherbia_albida",
    regionId: "region_ggw_sahel",
    scientificName: "Faidherbia albida",
    commonName: "Apple-ring acacia",
    waterRequirement: "low",
    climateSuitability: 92,
    carbonPotential: 62,
    biodiversityScore: 84,
    localEconomicValue: 91,
    invasiveRisk: "low",
  },
  {
    id: "species_acacia_senegal",
    regionId: "region_ggw_sahel",
    scientificName: "Acacia senegal",
    commonName: "Gum arabic tree",
    waterRequirement: "low",
    climateSuitability: 88,
    carbonPotential: 58,
    biodiversityScore: 77,
    localEconomicValue: 94,
    invasiveRisk: "low",
  },
  {
    id: "species_moringa_oleifera",
    regionId: "region_kenya_rift",
    scientificName: "Moringa oleifera",
    commonName: "Moringa",
    waterRequirement: "medium",
    climateSuitability: 84,
    carbonPotential: 44,
    biodiversityScore: 68,
    localEconomicValue: 96,
    invasiveRisk: "low",
  },
] satisfies Array<z.input<typeof speciesSchema>>;

export type ChainId = (typeof chainIds)[number];
export type Currency = (typeof currencies)[number];
export type LotteryRoundStatus = (typeof lotteryRoundStatuses)[number];
export type LotteryRound = z.infer<typeof lotteryRoundSchema>;
export type LotteryEntry = z.infer<typeof lotteryEntrySchema>;
export type LotteryTicket = z.infer<typeof lotteryTicketSchema>;
export type RandomnessCertificate = z.infer<typeof randomnessCertificateSchema>;
export type DropResult = z.infer<typeof dropResultSchema>;
export type WinnerResult = z.infer<typeof winnerResultSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;
export type EvidenceObject = z.infer<typeof evidenceObjectSchema>;
export type ImpactCertificate = z.infer<typeof impactCertificateSchema>;
export type RwaFragment = z.infer<typeof rwaFragmentSchema>;
export type ChallengeCase = z.infer<typeof challengeCaseSchema>;
export type RiskLevel = (typeof riskLevels)[number];
export type RiskAction = (typeof riskActions)[number];
export type RiskScoreInput = z.infer<typeof riskScoreInputSchema>;
export type RiskScoreResult = z.infer<typeof riskScoreResultSchema>;
export type RiskScoreSnapshot = z.infer<typeof riskScoreSnapshotSchema>;
export type RiskEvent = z.infer<typeof riskEventSchema>;
export type ChallengeEvidence = z.infer<typeof challengeEvidenceSchema>;
export type ChallengeBond = z.infer<typeof challengeBondSchema>;
export type ChallengeResolution = z.infer<typeof challengeResolutionSchema>;
export type DropClaimResult = z.infer<typeof dropClaimResultSchema>;
export type TreasuryAccount = z.infer<typeof treasuryAccountSchema>;
export type TreasuryTransaction = z.infer<typeof treasuryTransactionSchema>;
export type FundAllocation = z.infer<typeof fundAllocationSchema>;
export type ProjectMilestoneRelease = z.infer<typeof projectMilestoneReleaseSchema>;
export type SettlementCertificate = z.infer<typeof settlementCertificateSchema>;
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export type PaymentReconciliationReport = z.infer<typeof paymentReconciliationReportSchema>;
export type TelegramAccount = z.infer<typeof telegramAccountSchema>;
export type ReferralCode = z.infer<typeof referralCodeSchema>;
export type ReferralEvent = z.infer<typeof referralEventSchema>;
export type ShareCard = z.infer<typeof shareCardSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignParticipant = z.infer<typeof campaignParticipantSchema>;
export type LeafPointsAccount = z.infer<typeof leafPointsAccountSchema>;
export type LeafPointsTransaction = z.infer<typeof leafPointsTransactionSchema>;
export type CampaignReport = z.infer<typeof campaignReportSchema>;
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;
export type LaunchCheck = z.infer<typeof launchCheckSchema>;
export type SystemStatusSnapshot = z.infer<typeof systemStatusSnapshotSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type CampaignDetail = z.infer<typeof campaignDetailSchema>;
export type CampaignMe = z.infer<typeof campaignMeSchema>;
export type LotteryRoundDetail = z.infer<typeof lotteryRoundDetailSchema>;
export type LotteryRoundResults = z.infer<typeof lotteryRoundResultsSchema>;
export type PaymentInstruction = z.infer<typeof paymentInstructionSchema>;
export type PoccAhinEvidenceSource = z.infer<typeof poccAhinEvidenceSourceSchema>;
export type PoccAhinConsensusReceipt = z.infer<typeof poccAhinConsensusReceiptSchema>;
export type AnchorVerificationReceipt = z.infer<typeof anchorVerificationReceiptSchema>;
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
