import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPoccAhinConsensusReceipt, validatePoccAhinConsensusReceipt } from "@dropin/crypto";
import type { PoccAhinConsensusInput, PoccAhinConsensusReceipt } from "@dropin/crypto";
import { poccAhinConsensusReceiptSchema } from "@dropin/schemas";

type HistoricalReceipt = Omit<PoccAhinConsensusReceipt, "verificationScope" | "finalAuthority">;
const fixture = JSON.parse(readFileSync(new URL("../fixtures/pocc-ahin-legacy-receipts.json", import.meta.url), "utf8")) as {
  provenance: { commit: string; builderGitBlob: string };
  cases: { name: string; input: PoccAhinConsensusInput; receipt: HistoricalReceipt }[];
};
const cases = fixture.cases;
const validateUntrustedShape = (value: unknown) => validatePoccAhinConsensusReceipt(value as PoccAhinConsensusReceipt);

test("legacy public receipts are rejected unchanged without rewriting historical audit acceptance", () => {
  assert.equal(fixture.provenance.commit, "77712ef54ea8331d188c2fad33e486124bb9b785");
  assert.equal(fixture.provenance.builderGitBlob, "aed4419e42692e151e6e922cb08605b489c07674");
  assert.equal(cases.length, 2);
  for (const entry of cases) {
    const before = JSON.stringify(entry.receipt);
    assert.equal(entry.receipt.accepted, true, "Actual historical builder accepted both stored records");
    assert.equal(Object.hasOwn(entry.receipt, "verificationScope"), false);
    assert.equal(Object.hasOwn(entry.receipt, "finalAuthority"), false);
    assert.equal(poccAhinConsensusReceiptSchema.safeParse(entry.receipt).success, false);
    assert.equal(validateUntrustedShape(entry.receipt), false);
    assert.equal(JSON.stringify(entry.receipt), before, "Validation cannot migrate or rewrite the audit record");
  }
});

test("legacy missing partial and inherited markers cannot enter the current receipt schema", () => {
  const receipt = cases[0]!.receipt;
  const attempts = [
    receipt,
    { ...receipt, verificationScope: "local-evidence-projection" },
    { ...receipt, finalAuthority: false },
    Object.assign(Object.create({ verificationScope: "local-evidence-projection", finalAuthority: false }), receipt),
    { ...receipt, verificationScope: "local-evidence-projection", finalAuthority: true },
  ];
  for (const attempt of attempts) {
    assert.equal(poccAhinConsensusReceiptSchema.safeParse(attempt).success, false);
    assert.equal(validateUntrustedShape(attempt), false);
  }
  assert.equal(validateUntrustedShape({}), false, "Reject missing markers before rebuilding malformed historical data");
});

test("appending markers cannot preserve a legacy duplicate quorum under current validation", () => {
  const receipt = cases[1]!.receipt;
  assert.equal(receipt.quorumWeight, 70);
  assert.equal(receipt.accepted, true);
  const marked = { ...receipt, verificationScope: "local-evidence-projection" as const, finalAuthority: false as const };
  assert.equal(poccAhinConsensusReceiptSchema.safeParse(marked).success, true, "Shape parsing is not evidence validation");
  assert.equal(validatePoccAhinConsensusReceipt(marked), false);
  const rebuilt = buildPoccAhinConsensusReceipt(cases[1]!.input);
  assert.equal(rebuilt.quorumWeight, 35);
  assert.equal(rebuilt.accepted, false);
  assert.equal(rebuilt.finalAuthority, false);
  assert.equal(receipt.accepted, true, "Recomputation cannot erase the historical audit result");
});

test("explicit fresh receipt recomputation remains a non-authoritative local projection", () => {
  const receipt = buildPoccAhinConsensusReceipt(cases[0]!.input);
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.verificationScope, "local-evidence-projection");
  assert.equal(receipt.finalAuthority, false);
  assert.equal(poccAhinConsensusReceiptSchema.safeParse(receipt).success, true);
  assert.equal(validatePoccAhinConsensusReceipt(receipt), true);
  assert.equal(poccAhinConsensusReceiptSchema.safeParse({ ...receipt, finalAuthority: true }).success, false);
  assert.equal(validateUntrustedShape({ ...receipt, finalAuthority: true }), false);
});
