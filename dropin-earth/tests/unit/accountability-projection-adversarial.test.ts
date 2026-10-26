import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { buildPoccAhinConsensusReceipt, canonicalProjectionJson, hashHex, hashJson, projectionDigest,
  referenceToVerifiedBytes, stableStringify, validatePoccAhinConsensusReceipt, verifyProjectionTransport,
  type CurrentProjectionKey } from "@dropin/crypto";

const now = Date.parse("2026-10-23T06:00:00Z");
const pair = generateKeyPairSync("ed25519");
const current: CurrentProjectionKey = { publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  protocolVersion: "synthetic-transport-test", schemaHash: `sha256:${"a".repeat(64)}`, keyEpoch: 3, revoked: false,
  validFrom: "2026-10-23T05:00:00Z", validUntil: "2026-10-23T07:00:00Z" };
const record = { protocol_version: current.protocolVersion, schema_hash: current.schemaHash, payload: { "2": "b", "10": "a" } };
const bytes = Buffer.from(canonicalProjectionJson(record));
const input = { recordBytes: bytes, keyId: "synthetic-key", keyEpoch: 3, signature: sign(null, bytes, pair.privateKey).toString("base64url") };
const authority = { current: async () => current };
const source = (id: string, signer: string, weight = 40) => ({ id, kind: "evidence" as const, hash: hashJson({ id }), signer, weight });

test("C01 fixed numeric-key bytes are distinct; changing digest prefixes cannot change source bytes", () => {
  const object = { "2": "b", "10": "a" };
  assert.equal(stableStringify(object), '{"10":"a","2":"b"}');
  assert.equal(canonicalProjectionJson(object), '{"2":"b","10":"a"}');
  assert.equal(hashJson(object), "a76f9931f09e47db676e50eebb06409ca3288449353bcd0eed02e168f7c6caf2");
  const canonical = Buffer.from(canonicalProjectionJson(object));
  assert.equal(projectionDigest(canonical), "sha256:b6e3a5de6007a9d717e70a63d7a5925fbad17a4c8b911a64354b0adf21956d06");
  assert.equal(referenceToVerifiedBytes(hashHex(canonical), canonical), projectionDigest(canonical));
  assert.throws(() => referenceToVerifiedBytes(hashJson(object), canonical), /SOURCE_BYTES_MISMATCH/);
});

test("C01 bounded deterministic JSON corpus preserves numeric keys, nesting and explicit byte hashes", () => {
  for (let seed = 0; seed < 32; seed++) {
    const value = { [String(seed + 10)]: "生态", [String(seed)]: [seed / 10, false, null, { z: "\\n", a: "é" }] };
    const a = canonicalProjectionJson(value);
    const b = canonicalProjectionJson(Object.fromEntries(Object.entries(value).reverse()));
    assert.equal(a, b, `seed=${seed}`);
    assert.deepEqual(JSON.parse(a), value);
  }
  for (const value of [undefined, NaN, Infinity, new Date(), [undefined], new Array(2)]) {
    assert.throws(() => canonicalProjectionJson(value), /NON_JSON_PROJECTION/);
  }
});

test("C08 duplicate source, signer and content cannot manufacture local quorum weight", () => {
  for (const duplicate of [source("a", "different"), source("different", "actor-a"), { ...source("different", "different"), hash: source("a", "actor-a").hash }]) {
    const receipt = buildPoccAhinConsensusReceipt({ subjectType: "tree", subjectId: "synthetic-tree", requiredWeight: 67,
      sources: [source("a", "actor-a"), duplicate] });
    assert.equal(receipt.accepted, false);
    assert.equal(receipt.quorumWeight, 40);
    assert.match(receipt.warnings.join(" "), /duplicate_/);
  }
});

test("C08 unsupported or overflow weights and short hashes cannot pass even local validation", () => {
  for (const weight of [101, -1, 0, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    const receipt = buildPoccAhinConsensusReceipt({ subjectType: "tree", subjectId: "synthetic-tree", requiredWeight: 67, sources: [source("a", "actor-a", weight)] });
    assert.equal(receipt.accepted, false); assert.equal(receipt.quorumWeight, 0);
  }
  const receipt = buildPoccAhinConsensusReceipt({ subjectType: "tree", subjectId: "synthetic-tree", requiredWeight: 1, sources: [{ ...source("a", "actor-a"), hash: "a".repeat(16) }] });
  assert.equal(receipt.accepted, false);
});

test("C08 accepted local receipt is not protocol authority, even with an authentic transport signature", async () => {
  const receipt = buildPoccAhinConsensusReceipt({ subjectType: "tree", subjectId: "synthetic-tree", requiredWeight: 67,
    sources: [source("a", "actor-a"), source("b", "actor-b")] });
  assert.equal(receipt.accepted, true); assert.equal(receipt.finalAuthority, false);
  assert.equal(receipt.verificationScope, "local-evidence-projection");
  assert.equal(validatePoccAhinConsensusReceipt({ ...receipt, finalAuthority: true } as unknown as typeof receipt), false);
  const recordBytes = Buffer.from(canonicalProjectionJson({ ...receipt, protocol_version: current.protocolVersion, schema_hash: current.schemaHash }));
  const request = { ...input, recordBytes, signature: sign(null, recordBytes, pair.privateKey).toString("base64url") };
  await assert.rejects(verifyProjectionTransport(request, authority, () => now), /LOCAL_PROJECTION_NOT_AUTHORITY/);
  await assert.rejects(verifyProjectionTransport(input, undefined, () => now), /AUTHORITY_UNAVAILABLE/);
});

test("C08 true transport signature verifies only authentic bytes, never grants finality or financial authority", async () => {
  assert.deepEqual(await verifyProjectionTransport(input, authority, () => now), {
    recordHash: projectionDigest(bytes), transportSignatureVerified: true, finalAuthority: false, economicAuthority: false, membershipAuthority: false,
  });
  const stranger = generateKeyPairSync("ed25519");
  for (const signature of ["fixture-signature:any", Buffer.alloc(64).toString("base64url"), sign(null, bytes, stranger.privateKey).toString("base64url")]) {
    await assert.rejects(verifyProjectionTransport({ ...input, signature }, authority, () => now), /SIGNATURE_INVALID/);
  }
  for (const mutation of [{ ...record, payload: { "2": "changed", "10": "a" } }, { ...record, schema_hash: `sha256:${"b".repeat(64)}` }]) {
    await assert.rejects(verifyProjectionTransport({ ...input, recordBytes: Buffer.from(canonicalProjectionJson(mutation)) }, authority, () => now), /SIGNATURE_INVALID|CONTRACT_MISMATCH/);
  }
});

test("C08 current revocation, epoch and expiry are checked after asynchronous authority lookup", async () => {
  for (const value of [{ ...current, revoked: true }, { ...current, keyEpoch: 4 }, { ...current, validUntil: "2026-10-23T06:00:00Z" }]) {
    await assert.rejects(verifyProjectionTransport(input, { current: async () => value }, () => now), /KEY_UNAVAILABLE/);
  }
  let decisionTime = now;
  await assert.rejects(verifyProjectionTransport(input, { current: async () => { decisionTime += 3_600_000; return current; } }, () => decisionTime), /KEY_UNAVAILABLE/);
  await assert.rejects(verifyProjectionTransport({ ...input, recordBytes: Buffer.from('{"protocol_version":"x","protocol_version":"synthetic-transport-test"}') }, authority, () => now), /NON_CANONICAL/);
});
