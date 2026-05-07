type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

type ResultStatus = "PASS" | "EXPECTED" | "SIMULATED" | "FAIL";

type Result = {
  name: string;
  status: ResultStatus;
  detail: string;
};

const apiBaseUrl = process.env.DROPIN_API_URL ?? "http://localhost:8787";
const dryRunMode = process.env.DRY_RUN_MODE !== "false";
const explicitWriteMode = process.env.DROPIN_OPERATOR_WRITE_MODE === "true";
const results: Result[] = [];

function record(name: string, status: ResultStatus, detail: string) {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(9, " ")} ${name} - ${detail}`);
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

async function expectFailure(name: string, action: () => Promise<unknown>, expected: string) {
  try {
    await action();
    record(name, "FAIL", `expected detection did not happen: ${expected}`);
  } catch (error) {
    record(name, "EXPECTED", error instanceof Error ? error.message : expected);
  }
}

async function main() {
  console.log("Dropin Earth Failure Injection");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`DRY_RUN_MODE=${dryRunMode ? "true" : "false"}`);
  console.log(`DROPIN_OPERATOR_WRITE_MODE=${explicitWriteMode ? "true" : "false"}`);

  try {
    const status = await api<{ repositoryMode: string }>("/status/system");
    const allowMutation = explicitWriteMode && !dryRunMode && status.repositoryMode === "memory";
    record(
      "Determine write safety",
      allowMutation ? "PASS" : "SIMULATED",
      allowMutation ? "write mode enabled against memory repository" : "write mutations disabled; injecting safely",
    );

    if (allowMutation) {
      const duplicateTxHash = `failure-duplicate-tx-${Date.now()}`;
      const first = await api<{ intent: { id: string } }>("/payments/intents", {
        method: "POST",
        body: JSON.stringify({
          userId: "failure-user-a",
          wallet: "failure_wallet_a",
          purpose: "lottery_entry",
          purposeId: "round_v1_ggw_demo",
          chain: "manual",
          currency: "USDC",
          amount: "1",
          idempotencyKey: `failure-a-${Date.now()}`,
          metadata: { source: "failure_injection" },
        }),
      });
      await api(`/payments/intents/${first.intent.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ txHash: duplicateTxHash, submittedBy: "failure-injection" }),
      });
      const second = await api<{ intent: { id: string } }>("/payments/intents", {
        method: "POST",
        body: JSON.stringify({
          userId: "failure-user-b",
          wallet: "failure_wallet_b",
          purpose: "lottery_entry",
          purposeId: "round_v1_ggw_demo",
          chain: "manual",
          currency: "USDC",
          amount: "1",
          idempotencyKey: `failure-b-${Date.now()}`,
          metadata: { source: "failure_injection" },
        }),
      });
      await expectFailure(
        "Duplicate tx hash",
        () =>
          api(`/payments/intents/${second.intent.id}/submit`, {
            method: "POST",
            body: JSON.stringify({ txHash: duplicateTxHash, submittedBy: "failure-injection" }),
          }),
        "duplicate_tx_hash",
      );
    } else {
      record("Duplicate tx hash", "SIMULATED", "expected duplicate_tx_hash risk event or rejection");
    }

    record("Wrong recipient", "SIMULATED", "TON testnet verification should fail with wrong_recipient");
    record("Expired intent", "SIMULATED", "Payment reconciliation should flag expired_intent or stale_pending");
    record("Suspicious referral", "SIMULATED", "self-referral should create risk_event and award zero Leaf Points");
    record("Fake evidence challenge", "SIMULATED", "challenge target=evidence_object should enter red-team review");
    record("Open high-risk event", "SIMULATED", "readiness should warn/fail when critical/high challenge is open");

    const missingReadiness = await api<{ ready: boolean; decision: string }>("/ready?campaignId=failure_missing_campaign");
    if (!missingReadiness.ready && missingReadiness.decision === "fail") {
      record("Readiness fail condition", "PASS", "missing campaign safely produces fail decision");
    } else {
      record("Readiness fail condition", "FAIL", `unexpected decision=${missingReadiness.decision}`);
    }
  } catch (error) {
    record("Failure injection exception", "FAIL", error instanceof Error ? error.message : String(error));
  }

  const failed = results.filter((result) => result.status === "FAIL");
  console.log("\nSummary");
  for (const result of results) {
    console.log(`- ${result.status}: ${result.name} (${result.detail})`);
  }
  console.log(failed.length === 0 ? "\nPASS failure injection completed." : `\nFAIL ${failed.length} failure injection step(s) failed.`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

void main();
