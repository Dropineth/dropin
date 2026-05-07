type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

type StepStatus = "PASS" | "SIMULATED" | "SKIPPED" | "FAIL";

type Step = {
  name: string;
  status: StepStatus;
  detail: string;
};

const apiBaseUrl = process.env.DROPIN_API_URL ?? "http://localhost:8787";
const campaignId = process.env.DROPIN_CAMPAIGN_ID ?? "campaign_v1_ggw_testnet";
const dryRunMode = process.env.DRY_RUN_MODE !== "false";
const explicitWriteMode = process.env.DROPIN_OPERATOR_WRITE_MODE === "true";
const actor = "operator-dry-run";
const userId = `operator-dry-run-user-${Date.now()}`;
const wallet = `operator_dry_run_wallet_${Date.now()}`;

const steps: Step[] = [];

function record(name: string, status: StepStatus, detail: string) {
  steps.push({ name, status, detail });
  const marker = status.padEnd(9, " ");
  console.log(`${marker} ${name} - ${detail}`);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? `HTTP ${response.status}` : payload.error);
  }
  return payload.data;
}

async function optionalPost<T>(name: string, path: string, body: unknown, allowMutation: boolean, simulationDetail: string) {
  if (!allowMutation) {
    record(name, "SIMULATED", simulationDetail);
    return undefined;
  }
  const data = await api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  record(name, "PASS", `mutated ${path}`);
  return data;
}

async function main() {
  console.log("Dropin Earth Operator Dry Run");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`DRY_RUN_MODE=${dryRunMode ? "true" : "false"}`);
  console.log(`DROPIN_OPERATOR_WRITE_MODE=${explicitWriteMode ? "true" : "false"}`);

  try {
    const readiness = await api<{
      ready: boolean;
      decision: string;
    }>(`/ready?campaignId=${campaignId}`);
    record("Call /ready", readiness.ready ? "PASS" : "FAIL", `decision=${readiness.decision}, ready=${readiness.ready}`);

    const status = await api<{
      repositoryMode: string;
      paymentMode: string;
      anchor: { configured: boolean };
    }>("/status/system");
    const allowMutation = explicitWriteMode && !dryRunMode && status.repositoryMode === "memory";
    record(
      "Determine write safety",
      allowMutation ? "PASS" : "SIMULATED",
      allowMutation ? "write mode enabled against memory repository" : "write mutations disabled; running safe dry run",
    );

    const campaignDetail = await api<{
      campaign: {
        id: string;
        title: string;
        roundId?: string;
        projectId?: string;
      };
      participantCount: number;
    }>(`/campaigns/${campaignId}`);
    const roundId = campaignDetail.campaign.roundId ?? "round_v1_ggw_demo";
    const projectId = campaignDetail.campaign.projectId ?? "project_v1_ggw_demo";
    record("Fetch campaign", "PASS", `${campaignDetail.campaign.title}, participants=${campaignDetail.participantCount}`);

    await optionalPost(
      "Join campaign",
      `/campaigns/${campaignId}/join`,
      { userId, wallet },
      allowMutation,
      `would join ${campaignId} as ${userId}`,
    );

    const round = await api<{ round: { id: string; status: string; ticketPriceAmount: string; ticketPriceSymbol: string } }>(
      `/lottery/rounds/${roundId}`,
    );
    record("Fetch linked round", "PASS", `${round.round.id}, status=${round.round.status}`);

    const paymentIntent = await optionalPost<{ intent?: { id: string }; id?: string }>(
      "Create Payment Intent",
      "/payments/intents",
      {
        userId,
        wallet,
        purpose: "lottery_entry",
        purposeId: roundId,
        chain: "manual",
        currency: round.round.ticketPriceSymbol,
        amount: round.round.ticketPriceAmount,
        idempotencyKey: `operator-${Date.now()}`,
        metadata: { source: "operator_dry_run" },
      },
      allowMutation,
      "would create manual/mock Payment Intent",
    );
    const paymentIntentId = paymentIntent?.intent?.id ?? paymentIntent?.id;

    if (paymentIntentId) {
      await optionalPost(
        "Submit tx hash",
        `/payments/intents/${paymentIntentId}/submit`,
        { txHash: `operator-dry-run-tx-${Date.now()}`, submittedBy: actor },
        allowMutation,
        "would submit mock tx hash",
      );
      await optionalPost(
        "Confirm payment",
        `/admin/payments/${paymentIntentId}/confirm`,
        { actor, notes: "Operator dry-run confirmation" },
        allowMutation,
        "would confirm Payment Intent in mock/manual mode",
      );
      await optionalPost(
        "Create lottery entry",
        `/lottery/rounds/${roundId}/enter`,
        {
          userId,
          wallet,
          amount: round.round.ticketPriceAmount,
          currency: round.round.ticketPriceSymbol,
          regionId: "region_ggw_sahel",
          paymentIntentId,
          idempotencyKey: `operator-entry-${Date.now()}`,
        },
        allowMutation,
        "would create Tree Lotto entry from confirmed Payment Intent",
      );
    } else {
      record("Submit tx hash", "SIMULATED", "no mutation mode; no Payment Intent created");
      record("Confirm payment", "SIMULATED", "no mutation mode; no Payment Intent created");
      record("Create lottery entry", "SIMULATED", "no mutation mode; no Payment Intent created");
    }

    await api(`/lottery/rounds/${roundId}/results`);
    record("Verify round finalization/results", "PASS", `fetched results for ${roundId}`);

    const allocations = await api<unknown[]>("/fund/allocations");
    record("Fetch fund allocations", "PASS", `${allocations.length} allocation records`);

    await api(`/projects/${projectId}`);
    record("Fetch linked project", "PASS", projectId);
    await api("/evidence");
    record("Verify seeded evidence", "PASS", "evidence list reachable");
    await api("/impact-certificates/cert_v1_ggw_demo");
    record("Fetch Impact Certificate", "PASS", "cert_v1_ggw_demo; not a certified carbon credit");
    record("Verify anchor config", status.anchor.configured ? "PASS" : "SKIPPED", status.anchor.configured ? "Anchor.toml detected" : "anchor config not detected");

    const challenge = await optionalPost<{ id: string }>(
      "Create challenge",
      "/challenges",
      {
        targetType: "impact_certificate",
        targetId: "cert_v1_ggw_demo",
        challenger: actor,
        severity: "low",
        title: "Operator dry-run challenge",
        attackScenario: "Dry-run verifies challenge routing without making a claim trusted.",
        evidenceHash: `operator-dry-run-evidence-${Date.now()}`,
        bondAmount: "1",
        bondCurrency: "USDC",
      },
      allowMutation,
      "would create low-severity challenge",
    );
    if (challenge?.id) {
      await optionalPost(
        "Resolve challenge",
        `/admin/challenges/${challenge.id}/reject`,
        { resolver: actor, notes: "Operator dry-run rejected by design." },
        allowMutation,
        "would resolve dry-run challenge",
      );
    } else {
      record("Resolve challenge", "SIMULATED", "no mutation mode; no challenge created");
    }

    await optionalPost(
      "Submit feedback",
      "/feedback",
      {
        source: "api",
        userId,
        category: "operator_dry_run",
        message: "Operator dry-run feedback signal.",
        severity: "low",
      },
      allowMutation,
      "would submit feedback item",
    );

    const report = await api<{ participantCount: number; ticketCount: number; challengeCount: number }>(`/campaigns/${campaignId}/report`);
    record("Fetch campaign report", "PASS", `participants=${report.participantCount}, tickets=${report.ticketCount}, challenges=${report.challengeCount}`);
  } catch (error) {
    record("Dry run exception", "FAIL", error instanceof Error ? error.message : String(error));
  }

  const failed = steps.filter((step) => step.status === "FAIL");
  console.log("\nSummary");
  for (const step of steps) {
    console.log(`- ${step.status}: ${step.name} (${step.detail})`);
  }
  console.log(failed.length === 0 ? "\nPASS operator dry run completed." : `\nFAIL ${failed.length} dry-run step(s) failed.`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

void main();
