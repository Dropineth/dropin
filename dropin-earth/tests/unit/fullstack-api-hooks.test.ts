import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function file(path: string) {
  return readFileSync(path, "utf8");
}

test("Web and Mini App expose typed API clients for the core Dropin workflow", () => {
  const webApi = file("apps/web/src/lib/api.ts");
  const miniApi = file("apps/miniapp-ton/src/lib/api.ts");

  for (const source of [webApi, miniApi]) {
    assert.match(source, /createPaymentIntent/);
    assert.match(source, /paymentInstructions/);
    assert.match(source, /submitPaymentIntent/);
    assert.match(source, /verifyPaymentIntent/);
    assert.match(source, /enterRound/);
    assert.match(source, /roundResults/);
    assert.match(source, /campaignMe/);
    assert.match(source, /NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS/);
  }
});

test("Shared schemas include PoCC/AHIN, anchor, and notification contracts", () => {
  const schemas = file("packages/schemas/src/index.ts");

  assert.match(schemas, /poccAhinConsensusReceiptSchema/);
  assert.match(schemas, /anchorVerificationReceiptSchema/);
  assert.match(schemas, /notificationEventSchema/);
  assert.match(schemas, /payment_confirmed/);
  assert.match(schemas, /challenge_submitted/);
});

test("Mini App payment flow uses typed API helpers and avoids random ticket generation", () => {
  const entry = file("apps/miniapp-ton/src/app/round/[roundId]/mini-round-entry.tsx");

  assert.match(entry, /miniappApi\.createPaymentIntent/);
  assert.match(entry, /miniappApi\.verifyPaymentIntent/);
  assert.match(entry, /miniappApi\.enterRound/);
  assert.doesNotMatch(entry, /Math\.random/);
});
