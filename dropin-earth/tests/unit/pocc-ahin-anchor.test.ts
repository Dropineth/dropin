import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnchorVerificationReceipt,
  buildPoccAhinConsensusReceipt,
  hashJson,
  validatePoccAhinConsensusReceipt,
} from "@dropin/crypto";

test("PoCC/AHIN consensus receipt is deterministic and rejects weak evidence", () => {
  const sources = [
    { id: "oracle_satellite", kind: "oracle" as const, hash: hashJson({ satellite: "ok" }), signer: "satellite-validator-1", weight: 35 },
    { id: "ngo_report", kind: "evidence" as const, hash: hashJson({ ngo: "accepted" }), signer: "ngo-validator-1", weight: 35 },
    { id: "anchor_trace", kind: "anchor" as const, hash: hashJson({ anchor: "root" }), signer: "solana-anchor-agent", weight: 30 },
  ];
  const first = buildPoccAhinConsensusReceipt({
    subjectType: "round",
    subjectId: "round_v1_ggw_demo",
    requiredWeight: 67,
    sources,
    createdAt: "2026-05-10T00:00:00.000Z",
  });
  const second = buildPoccAhinConsensusReceipt({
    subjectType: "round",
    subjectId: "round_v1_ggw_demo",
    requiredWeight: 67,
    sources: [...sources].reverse(),
    createdAt: "2026-05-10T00:00:00.000Z",
  });

  assert.deepEqual(second, first);
  assert.equal(first.accepted, true);
  assert.equal(validatePoccAhinConsensusReceipt(first), true);

  const weak = buildPoccAhinConsensusReceipt({
    subjectType: "round",
    subjectId: "round_v1_ggw_demo",
    requiredWeight: 67,
    sources: [{ id: "anonymous-photo", kind: "evidence", hash: "short", signer: "anonymous", weight: 100 }],
    createdAt: "2026-05-10T00:00:00.000Z",
  });

  assert.equal(weak.accepted, false);
  assert.match(weak.warnings.join(","), /weak_hash/);
  assert.match(weak.warnings.join(","), /unattributed_source/);
});

test("anchor verification receipt distinguishes verified, pending, and mismatch states", () => {
  const localRoot = hashJson({ proof: "impact-root" });
  const verified = buildAnchorVerificationReceipt({
    chain: "solana",
    subjectId: "cert_v1_ggw_demo",
    localRoot,
    anchoredRoot: localRoot,
    txHash: "solana_tx_demo",
    verifier: "anchor-verifier",
    checkedAt: "2026-05-10T00:00:00.000Z",
  });
  const mismatch = buildAnchorVerificationReceipt({
    chain: "solana",
    subjectId: "cert_v1_ggw_demo",
    localRoot,
    anchoredRoot: hashJson({ proof: "tampered" }),
    txHash: "solana_tx_demo",
    verifier: "anchor-verifier",
    checkedAt: "2026-05-10T00:00:00.000Z",
  });
  const unavailable = buildAnchorVerificationReceipt({
    chain: "manual",
    subjectId: "cert_v1_ggw_demo",
    localRoot,
    verifier: "local-verifier",
    checkedAt: "2026-05-10T00:00:00.000Z",
  });

  assert.equal(verified.status, "verified");
  assert.equal(mismatch.status, "mismatch");
  assert.equal(unavailable.status, "unavailable");
});
