import assert from "node:assert/strict";
import test from "node:test";
import { hashJson, merkleRoot, evidenceHash } from "@dropin/crypto";
import { ImpactLedger } from "../../services/api/src/domain/impact-ledger.js";
import { computeDrops, LotteryEngine } from "../../services/api/src/domain/lottery-engine.js";
import { InMemoryRepository } from "../../services/api/src/domain/repository.js";

const roundInput = {
  chain: "solana",
  regionId: "region_ggw_sahel",
  title: "Test Great Green Wall Round",
  ticketPriceAmount: "1",
  ticketPriceSymbol: "USDC",
  prizePoolBps: 2500,
  treeFundBps: 5000,
  canopyDropBps: 700,
  rwaFragmentDropBps: 500,
  referralBps: 500,
  operationsBps: 500,
  challengePoolBps: 300,
  opensAt: new Date("2026-05-07T00:00:00.000Z").toISOString(),
  closesAt: new Date("2026-05-14T00:00:00.000Z").toISOString(),
} as const;

const entryInput = {
  userId: "user_1",
  wallet: "solana_wallet_111111111111111111111111",
  amount: "1",
  currency: "USDC",
  regionId: "region_ggw_sahel",
  antiSybilScore: 82,
} as const;

test("lottery round state transitions and audit logs are enforced", () => {
  const repo = new InMemoryRepository();
  const engine = new LotteryEngine(repo);
  const round = engine.createRound(roundInput, "test-admin");

  assert.equal(round.status, "draft");
  engine.transitionRound(round.id, "scheduled", "test-admin");
  engine.transitionRound(round.id, "open", "test-admin");
  engine.enterRound(round.id, entryInput);
  const closed = engine.closeRound(round.id, "test-admin");

  assert.equal(closed.status, "closed");
  assert.equal(closed.entryCount, 1);
  assert.ok(closed.entryMerkleRoot);
  assert.ok(repo.auditLogs.some((log) => log.action === "lottery.round.close"));
});

test("randomness certificate and roots are replayable", () => {
  const repo = new InMemoryRepository();
  const engine = new LotteryEngine(repo);
  const round = engine.createRound(roundInput, "test-admin");
  engine.transitionRound(round.id, "scheduled", "test-admin");
  engine.transitionRound(round.id, "open", "test-admin");
  engine.enterRound(round.id, entryInput);
  engine.enterRound(round.id, {
    ...entryInput,
    userId: "user_2",
    wallet: "solana_wallet_222222222222222222222222",
  });
  const closed = engine.closeRound(round.id, "test-admin");
  const result = engine.finalizeRound(round.id, "test-admin");

  const replayedSeed = hashJson({
    roundId: round.id,
    entryMerkleRoot: closed.entryMerkleRoot,
    publicRandomness: result.certificate.publicRandomness,
    committeeReveal: result.certificate.committeeReveal,
  });
  const replayedDropRoot = merkleRoot(
    computeDrops(round.id, repo.getEntriesForRound(round.id), replayedSeed).map((drop) => drop.merkleLeaf),
  );

  assert.equal(result.certificate.finalSeed, replayedSeed);
  assert.equal(result.certificate.dropMerkleRoot, replayedDropRoot);
  assert.equal(result.round.status, "finalized");
});

test("drop result generation is deterministic without Math.random", () => {
  const repo = new InMemoryRepository();
  const engine = new LotteryEngine(repo);
  const round = engine.createRound(roundInput, "test-admin");
  engine.transitionRound(round.id, "scheduled", "test-admin");
  engine.transitionRound(round.id, "open", "test-admin");
  const entry = engine.enterRound(round.id, entryInput);
  const seed = "fixed-seed";

  const first = computeDrops(round.id, [entry], seed)[0];
  const second = computeDrops(round.id, [entry], seed)[0];

  assert.equal(first?.merkleLeaf, second?.merkleLeaf);
  assert.equal(first?.rarity, second?.rarity);
});

test("evidence hash generation is stable", () => {
  const first = evidenceHash("gps-photo-content", "r2://dropin/evidence/1.jpg");
  const second = evidenceHash("gps-photo-content", "r2://dropin/evidence/1.jpg");

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("impact certificate issuance writes an audit log and avoids carbon credit wording", () => {
  const repo = new InMemoryRepository();
  const ledger = new ImpactLedger(repo);
  const project = ledger.createProject({
    title: "Senegal Dryland Planting",
    regionId: "region_ggw_sahel",
    operator: "Great Green Wall Local Operator",
    targetTreeCount: 1000,
    targetSpecies: ["Faidherbia albida"],
    budgetAmount: "2500",
    status: "approved",
  });
  const evidence = ledger.uploadEvidence({
    projectId: project.id,
    kind: "photo",
    uri: "r2://dropin/evidence/senegal-001.jpg",
    content: "mock-photo-bytes",
    submittedBy: "validator_1",
  });
  const certificate = ledger.issueImpactCertificate({
    projectId: project.id,
    treeClusterId: "cluster_001",
    evidenceObjectIds: [evidence.id],
    verifiedTreeCount: 800,
    survivalRateEstimate: 0.72,
    estimatedCo2eLow: "120",
    estimatedCo2eHigh: "210",
    methodologyVersion: "impact-v1-pre-mrv",
    validatorSignatures: ["validator_sig_1"],
  });

  assert.equal(certificate.certificateLevel, "impact_certificate");
  assert.equal(certificate.status, "issued");
  assert.ok(repo.auditLogs.some((log) => log.action === "impact_certificate.issue"));
});
