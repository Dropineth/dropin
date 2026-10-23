import { readFile } from "node:fs/promises";
import { projectAccountabilityEvidence, authorizeLedgerMutationFromProjection } from "../services/api/src/domain/canopyproof/accountability-projection.js";
import type { CurrentProjectionKey } from "@dropin/crypto";

// Local synthetic process bridge only. Host registry is a separate file, never a request field.
async function main() {
if (process.env.LIFEPP_SYNTHETIC_CONFIRM !== "confirm-disposable-test-database"
  || !process.env.CANOPY_SYNTHETIC_PROJECTION_KEYS) throw new Error("SYNTHETIC_HOST_AUTHORITY_REQUIRED");
const keys: Record<string, CurrentProjectionKey> = JSON.parse(await readFile(process.env.CANOPY_SYNTHETIC_PROJECTION_KEYS, "utf8"));
const chunks: Buffer[] = [];
let length = 0;
for await (const chunk of process.stdin) {
  length += chunk.length;
  if (length > 400_000) throw new Error("INPUT_LIMIT");
  chunks.push(Buffer.from(chunk));
}
const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
if (Object.keys(request).sort().join(",") !== "keyEpoch,keyId,recordBase64,signature") throw new Error("PROJECTION_REQUEST_INVALID");
const projection = await projectAccountabilityEvidence({ recordBytes: Buffer.from(request.recordBase64, "base64"),
  signature: request.signature, keyId: request.keyId, keyEpoch: request.keyEpoch }, { current: async id => keys[id] });
const refused: string[] = [];
for (const operation of ["record-verified-observation", "award-contribution", "confer-entitlement", "transfer-funding"]) {
  try { authorizeLedgerMutationFromProjection(projection, operation); }
  catch (error) { if (!(error instanceof Error) || error.message !== "PROJECTION_CANNOT_AUTHORIZE_LEDGER_MUTATION") throw error; refused.push(operation); }
}
if (refused.length !== 4) throw new Error("UNEXPECTED_LEDGER_AUTHORITY");
process.stdout.write(JSON.stringify({ ok: true, scope: "local-synthetic-projection", projection, ledgerMutationsRefused: refused }));
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
