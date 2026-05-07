import assert from "node:assert/strict";
import test from "node:test";
import { app, feedbackRepository, statusRepository } from "../../services/api/src/app.js";
import { InMemoryCampaignRepository } from "../../services/api/src/domain/campaign/campaign-repository.js";
import { InMemoryFeedbackRepository } from "../../services/api/src/domain/feedback/feedback-repository.js";
import { FeedbackService } from "../../services/api/src/domain/feedback/feedback-service.js";
import { InMemoryFundRepository } from "../../services/api/src/domain/fund/fund-repository.js";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";
import { InMemoryLotteryRepository } from "../../services/api/src/domain/lottery/lottery-repository.js";
import { InMemoryPaymentRepository } from "../../services/api/src/domain/payment/payment-repository.js";
import { InMemoryRiskRepository } from "../../services/api/src/domain/risk/risk-repository.js";
import { MetricsService } from "../../services/api/src/domain/status/metrics-service.js";
import { ReadinessService } from "../../services/api/src/domain/status/readiness-service.js";
import { InMemoryStatusRepository, StatusService, type StatusDependencies } from "../../services/api/src/domain/status/status-service.js";

function createLaunchContext(options: { seedCampaign?: boolean; tonEnabled?: boolean } = {}) {
  const previousTon = process.env.DROPIN_TON_TESTNET_ENABLED;
  process.env.DROPIN_TON_TESTNET_ENABLED = options.tonEnabled ? "true" : "false";
  const deps: StatusDependencies = {
    campaignRepo: new InMemoryCampaignRepository(options.seedCampaign ?? true),
    lotteryRepo: new InMemoryLotteryRepository(),
    impactRepo: new InMemoryImpactRepository(),
    fundRepo: new InMemoryFundRepository(),
    paymentRepo: new InMemoryPaymentRepository(),
    riskRepo: new InMemoryRiskRepository(),
    feedbackRepo: new InMemoryFeedbackRepository(),
    repositoryMode: "memory",
    paymentMode: "mock",
  };
  const statusRepo = new InMemoryStatusRepository();
  const statusService = new StatusService(statusRepo, deps);
  const readinessService = new ReadinessService(statusService, deps);
  const metricsService = new MetricsService(statusService);
  return {
    deps,
    metricsService,
    readinessService,
    restoreEnv: () => {
      if (previousTon === undefined) {
        delete process.env.DROPIN_TON_TESTNET_ENABLED;
      } else {
        process.env.DROPIN_TON_TESTNET_ENABLED = previousTon;
      }
    },
    statusRepo,
    statusService,
  };
}

test("/ready returns ok in memory mode", async () => {
  const response = await app.request("/ready");
  const payload = (await response.json()) as { ok: boolean; data: { ready: boolean; decision: string } };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.data.ready, "boolean");
  assert.ok(["pass", "warn", "fail"].includes(payload.data.decision));
});

test("/status/system returns repository, payment, campaign, risk, and challenge counts", async () => {
  const response = await app.request("/status/system");
  const payload = (await response.json()) as {
    ok: boolean;
    data: { repositoryMode: string; paymentMode: string; counts: Record<string, number> };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.repositoryMode, "memory");
  assert.equal(typeof payload.data.paymentMode, "string");
  assert.equal(typeof payload.data.counts.campaigns, "number");
  assert.equal(typeof payload.data.counts.openRiskEvents, "number");
  assert.equal(typeof payload.data.counts.openChallenges, "number");
});

test("readiness check passes for seeded demo when TON testnet is enabled", async () => {
  const context = createLaunchContext({ seedCampaign: true, tonEnabled: true });
  try {
    const report = await context.readinessService.getReadiness("campaign_v1_ggw_testnet");

    assert.equal(report.ready, true);
    assert.equal(report.decision, "pass");
    assert.equal(report.checks.every((check) => check.status === "pass"), true);
  } finally {
    context.restoreEnv();
  }
});

test("readiness check fails when campaign is missing", async () => {
  const context = createLaunchContext({ seedCampaign: false, tonEnabled: true });
  try {
    const report = await context.readinessService.getReadiness("campaign_v1_missing");

    assert.equal(report.ready, false);
    assert.equal(report.decision, "fail");
    assert.equal(report.checks.find((check) => check.id === "campaign_exists")?.status, "fail");
  } finally {
    context.restoreEnv();
  }
});

test("readiness check warns when TON testnet adapter is disabled", async () => {
  const context = createLaunchContext({ seedCampaign: true, tonEnabled: false });
  try {
    const report = await context.readinessService.getReadiness("campaign_v1_ggw_testnet");

    assert.equal(report.ready, true);
    assert.equal(report.decision, "warn");
    assert.equal(report.checks.find((check) => check.id === "ton_testnet")?.status, "warn");
  } finally {
    context.restoreEnv();
  }
});

test("feedback creation and resolution create audit logs", async () => {
  const repo = new InMemoryFeedbackRepository();
  const service = new FeedbackService(repo);
  const feedback = await service.createFeedback({
    source: "web",
    userId: "feedback-user",
    category: "launch_feedback",
    message: "The payment instructions need one more confirmation hint.",
  });
  const resolved = await service.resolveFeedback(feedback.id, {
    actor: "launch-admin",
    resolution: "Added to launch review notes.",
  });

  assert.equal(feedback.status, "open");
  assert.equal(resolved.status, "resolved");
  assert.ok(repo.auditLogs.some((log) => log.action === "feedback.create"));
  assert.ok(repo.auditLogs.some((log) => log.action === "feedback.resolve"));
});

test("metrics endpoint includes expected metric names", async () => {
  const response = await app.request("/metrics");
  const text = await response.text();

  assert.equal(response.status, 200);
  for (const metric of [
    "dropin_payment_intents_pending",
    "dropin_challenges_open",
    "dropin_risk_events_open",
    "dropin_campaigns_live",
    "dropin_feedback_open",
    "dropin_lottery_rounds_open",
  ]) {
    assert.match(text, new RegExp(`\\b${metric}\\b`));
  }
});

test("launch check creates launch_checks record and audit log", async () => {
  const beforeChecks = await statusRepository.listLaunchChecks();
  const beforeAudit = await statusRepository.listAuditLogs();
  const response = await app.request("/admin/launch/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor: "launch-admin", campaignId: "campaign_v1_ggw_testnet" }),
  });
  const payload = (await response.json()) as { ok: boolean; data: { launchCheck: { id: string } } };
  const afterChecks = await statusRepository.listLaunchChecks();
  const afterAudit = await statusRepository.listAuditLogs();

  assert.equal(response.status, 201);
  assert.equal(payload.ok, true);
  assert.equal(afterChecks.length, beforeChecks.length + 1);
  assert.equal(afterAudit.length, beforeAudit.length + 1);
  assert.ok(afterAudit.some((log) => log.action === "launch.check"));
});

test("feedback APIs create and resolve launch feedback", async () => {
  const create = await app.request("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "web",
      userId: "api-feedback-user",
      category: "launch_feedback",
      message: "The testnet campaign status page loaded correctly.",
    }),
  });
  const createPayload = (await create.json()) as { ok: boolean; data: { id: string; status: string } };
  const resolve = await app.request(`/admin/feedback/${createPayload.data.id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor: "launch-admin", resolution: "Validated through API test." }),
  });
  const resolvePayload = (await resolve.json()) as { ok: boolean; data: { status: string } };
  const auditLogs = await feedbackRepository.listAuditLogs();

  assert.equal(create.status, 201);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.data.status, "open");
  assert.equal(resolve.status, 200);
  assert.equal(resolvePayload.data.status, "resolved");
  assert.ok(auditLogs.some((log) => log.action === "feedback.resolve" && log.entityId === createPayload.data.id));
});
