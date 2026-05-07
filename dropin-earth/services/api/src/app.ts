import { Hono } from "hono";
import { cors } from "hono/cors";
import pino from "pino";
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

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? origin),
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.onError((error, c) => {
  logger.error({ error: error.message, path: c.req.path }, "request failed");
  return c.json(
    {
      ok: false,
      error: error.message,
    },
    400,
  );
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

app.get("/metrics", async (c) => c.text(await metricsService.textMetrics()));

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
};
