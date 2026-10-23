import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

/** trusted is obtained from the runner/CI API by the caller, never from the submitted receipt. */
export function verifyAdversarialReceipt(bytes, trusted, now = Date.now()) {
  const fail = code => { throw new Error(code); };
  if (!trusted || !/^[a-f0-9]{40}$/.test(trusted.targetSha) || !Array.isArray(trusted.tests)
    || trusted.tests.length === 0 || !trusted.runnerId || !["pull_request", "merge_candidate"].includes(trusted.phase)) fail("TRUSTED_RUN_CONTEXT_REQUIRED");
  if (trusted.status !== "completed" || trusted.conclusion !== "success") fail("TRUSTED_RUN_NOT_SUCCESSFUL");
  if (!Buffer.isBuffer(bytes) || bytes.length > 1_000_000 || createHash("sha256").update(bytes).digest("hex") !== trusted.receiptSha256) fail("RECEIPT_DIGEST_MISMATCH");
  const result = JSON.parse(bytes.toString("utf8"));
  if (result.targetSha !== trusted.targetSha || result.runnerId !== trusted.runnerId || result.phase !== trusted.phase) fail("RUN_CONTEXT_MISMATCH");
  if (!Number.isFinite(now) || !Number.isFinite(Date.parse(result.completedAt)) || Date.parse(result.completedAt) > now
    || now - Date.parse(result.completedAt) > trusted.maxAgeMs || !Number.isSafeInteger(trusted.maxAgeMs) || trusted.maxAgeMs <= 0) fail("RECEIPT_EXPIRED");
  if (result.conclusion !== "success" || result.sourceDirty !== false || !Array.isArray(result.tests)) fail("RUN_NOT_ACCEPTED");
  const ids = result.tests.map(item => item.id);
  const expected = [...trusted.tests].sort(), actual = [...ids].sort();
  if ([...ids, ...trusted.tests].some(id => typeof id !== "string" || id.length === 0 || /[\r\n]/.test(id))
    || new Set(ids).size !== ids.length || new Set(trusted.tests).size !== trusted.tests.length
    || actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) fail("TEST_MANIFEST_MISMATCH");
  for (const item of result.tests) if (item.status !== "passed" || item.executed !== true
    || !Number.isSafeInteger(item.assertions) || item.assertions <= 0) fail("TEST_NOT_EXECUTED_SUCCESSFULLY");
  return Object.freeze({ accepted: true, targetSha: result.targetSha, phase: result.phase, tests: ids.length,
    releaseApproval: false });
}
