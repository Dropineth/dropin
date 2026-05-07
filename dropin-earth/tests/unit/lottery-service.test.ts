import assert from "node:assert/strict";
import test from "node:test";
import { LotteryService } from "../../services/api/src/domain/lottery/lottery-service.js";
import { InMemoryLotteryRepository } from "../../services/api/src/domain/lottery/lottery-repository.js";

const entry = {
  userId: "demo-user",
  wallet: "solana_wallet_demo_user_111111111111111111",
  amount: "1",
  currency: "USDC",
  regionId: "region_ggw_sahel",
  antiSybilScore: 78,
  idempotencyKey: "idem-demo-0001",
} as const;

test("repository-backed service lists seeded round and region", async () => {
  const service = new LotteryService(new InMemoryLotteryRepository());
  const regions = await service.listRegions();
  const rounds = await service.listRounds();

  assert.equal(regions[0]?.id, "region_ggw_sahel");
  assert.equal(rounds[0]?.id, "round_v1_ggw_demo");
});

test("enter open round persists entry and ticket with idempotency", async () => {
  const service = new LotteryService(new InMemoryLotteryRepository());
  const first = await service.enterRound("round_v1_ggw_demo", entry);
  const second = await service.enterRound("round_v1_ggw_demo", entry);
  const detail = await service.getRoundDetail("round_v1_ggw_demo");

  assert.equal(first.entry.id, second.entry.id);
  assert.equal(second.idempotent, true);
  assert.equal(detail.entries.length, 1);
  assert.equal(detail.tickets.length, 1);
});

test("closed round rejects new entries and freezes entry root", async () => {
  const repo = new InMemoryLotteryRepository();
  const service = new LotteryService(repo);
  await service.enterRound("round_v1_ggw_demo", entry);
  const closed = await service.closeRound("round_v1_ggw_demo", "test-admin");

  await assert.rejects(
    () =>
      service.enterRound("round_v1_ggw_demo", {
        ...entry,
        userId: "late-user",
        wallet: "solana_wallet_late_user_222222222222222222",
        idempotencyKey: "idem-late-0002",
      }),
    /open status/,
  );
  assert.equal(closed.status, "closed");
  assert.ok(closed.entryMerkleRoot);
});

test("finalize is deterministic and idempotent", async () => {
  const service = new LotteryService(new InMemoryLotteryRepository());
  await service.enterRound("round_v1_ggw_demo", entry);
  await service.enterRound("round_v1_ggw_demo", {
    ...entry,
    userId: "demo-user-2",
    wallet: "solana_wallet_demo_user_222222222222222222",
    idempotencyKey: "idem-demo-0002",
  });
  await service.closeRound("round_v1_ggw_demo", "test-admin");

  const first = await service.finalizeRound("round_v1_ggw_demo", "test-admin");
  const second = await service.finalizeRound("round_v1_ggw_demo", "test-admin");

  assert.equal(first.proof.finalSeed, second.proof.finalSeed);
  assert.equal(first.proof.winnerMerkleRoot, second.proof.winnerMerkleRoot);
  assert.equal(first.proof.dropMerkleRoot, second.proof.dropMerkleRoot);
  assert.equal(second.idempotent, true);
});

test("admin close/finalize writes audit logs", async () => {
  const repo = new InMemoryLotteryRepository();
  const service = new LotteryService(repo);
  await service.enterRound("round_v1_ggw_demo", entry);
  await service.closeRound("round_v1_ggw_demo", "test-admin");
  await service.finalizeRound("round_v1_ggw_demo", "test-admin");

  assert.ok(repo.auditLogs.some((log) => log.action === "lottery.round.close"));
  assert.ok(repo.auditLogs.some((log) => log.action === "lottery.round.finalize"));
});

test("results API shape includes winner/drop/rwa roots", async () => {
  const service = new LotteryService(new InMemoryLotteryRepository());
  await service.enterRound("round_v1_ggw_demo", {
    ...entry,
    wallet: "solana_wallet_demo_user_legendary_probe",
  });
  await service.closeRound("round_v1_ggw_demo", "test-admin");
  await service.finalizeRound("round_v1_ggw_demo", "test-admin");
  const results = await service.getResults("round_v1_ggw_demo");

  assert.ok(results.proof.entryMerkleRoot);
  assert.ok(results.proof.winnerMerkleRoot);
  assert.ok(results.proof.dropMerkleRoot);
  assert.equal(results.drops.length, 1);
});
