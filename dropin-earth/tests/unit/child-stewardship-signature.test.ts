import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { verifyChildSignatureBytes } from "../../services/api/src/domain/child-stewardship/signature.ts";
import { ChildExternalRightsUnavailable, executeChildRealFundsTransfer, executeChildRealCarbonTransfer, verifyChildExternalLegalEntitlement } from "../../services/api/src/domain/child-stewardship/external-rights.ts";

// Ephemeral server-side test keys: never persisted, logged, exported or funded.
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const payload = Buffer.from(JSON.stringify({ environment: "synthetic", operation: "test-only",
  beneficiary: "synthetic-beneficiary", nonce: "one", amountMinor: "100", currency: "TEST",
  destination: "synthetic-destination", controlDomainVersion: 1, policyVersion: "test-v1" }));
const valid = () => ({ algorithm: "Ed25519", expectedPayload: payload, signedPayload: payload,
  signature: sign(null, payload, privateKey), registeredPublicKey: publicKey });

test("EX-33 primitive: real ephemeral Ed25519 signature verifies exact bytes", () => {
  assert.deepEqual(verifyChildSignatureBytes(valid()), { valid: true });
});
test("EX-33 primitive: public PEM works without accepting private keys", () => {
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.equal(verifyChildSignatureBytes({ ...valid(), registeredPublicKey: pem }).valid, true);
  assert.equal(verifyChildSignatureBytes({ ...valid(), registeredPublicKey: privateKey }).valid, false);
});
test("EX-33 primitive: wrong key, forged and truncated signatures fail closed", () => {
  const other = generateKeyPairSync("ed25519").publicKey;
  for (const input of [{ ...valid(), registeredPublicKey: other },
    { ...valid(), signature: Buffer.alloc(64) },
    { ...valid(), signature: valid().signature.subarray(0, 63) },
    { ...valid(), registeredPublicKey: "not a public key" }]) {
    assert.equal(verifyChildSignatureBytes(input).valid, false);
  }
});
test("EX-33 primitive: algorithm substitution is rejected", () => {
  for (const algorithm of ["none", "HS256", "RS256", "ed25519", ""]) {
    assert.equal(verifyChildSignatureBytes({ ...valid(), algorithm }).valid, false);
  }
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey;
  assert.equal(verifyChildSignatureBytes({ ...valid(), registeredPublicKey: rsa }).valid, false);
});
test("EX-33 primitive: authorization-field and cross-environment tampering fails", () => {
  for (const [field, value] of Object.entries({ environment: "production", operation: "transfer",
    beneficiary: "attacker", nonce: "two", amountMinor: "101", currency: "USD", destination: "attacker",
    controlDomainVersion: 2, policyVersion: "test-v2" })) {
    const altered = Buffer.from(JSON.stringify({ ...JSON.parse(payload.toString()), [field]: value }));
    assert.equal(verifyChildSignatureBytes({ ...valid(), signedPayload: altered }).valid, false, field);
    assert.equal(verifyChildSignatureBytes({ ...valid(), expectedPayload: altered, signedPayload: altered }).valid, false, field);
  }
});
test("EX-33 primitive: verified=true cannot authorize forged signature", () => {
  const input = { ...valid(), signature: Buffer.alloc(64), verified: true };
  assert.equal(verifyChildSignatureBytes(input).valid, false);
});
test("EX-33 primitive: digest-only substitution is rejected", () => {
  const bytes = Buffer.alloc(32, 7);
  assert.equal(verifyChildSignatureBytes({ ...valid(), signedPayload: bytes,
    signature: sign(null, bytes, privateKey) }).valid, false);
});
test("EX-33 primitive: empty and oversized inputs reject", () => {
  for (const size of [0, 65_537]) {
    const bytes = Buffer.alloc(size);
    assert.equal(verifyChildSignatureBytes({ ...valid(), expectedPayload: bytes, signedPayload: bytes }).valid, false);
  }
});
test("external rights: funds, carbon and legal verification cannot simulate success", () => {
  for (const operation of [executeChildRealFundsTransfer, executeChildRealCarbonTransfer, verifyChildExternalLegalEntitlement]) {
    assert.throws(operation, ChildExternalRightsUnavailable);
  }
});
