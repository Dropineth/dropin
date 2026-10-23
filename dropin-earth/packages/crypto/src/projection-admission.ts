import { createHash, createPublicKey, verify } from "node:crypto";

/** Transport canonicalization only. It never changes Dropin hashJson or its audit roots. */
export function canonicalProjectionJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) throw new Error("NON_JSON_PROJECTION");
      return item.map(normalize);
    }
    if (!item || typeof item !== "object" || Object.getPrototypeOf(item) !== Object.prototype) throw new Error("NON_JSON_PROJECTION");
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) {
      const property = Object.getOwnPropertyDescriptor(item, key);
      if (!property || !("value" in property)) throw new Error("NON_JSON_PROJECTION");
      Object.defineProperty(result, key, { value: normalize(property.value), enumerable: true });
    }
    return result;
  };
  return JSON.stringify(normalize(value));
}

export function projectionDigest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** A prefix change is permitted only after recomputing the same bytes. Never converts a Merkle algorithm. */
export function referenceToVerifiedBytes(bareDigest: string, bytes: Uint8Array): string {
  if (!/^[a-f0-9]{64}$/.test(bareDigest) || projectionDigest(bytes) !== `sha256:${bareDigest}`) {
    throw new Error("SOURCE_BYTES_MISMATCH");
  }
  return `sha256:${bareDigest}`;
}

export type CurrentProjectionKey = {
  readonly publicKeyPem: string;
  readonly protocolVersion: string;
  readonly schemaHash: string;
  readonly keyEpoch: number;
  readonly revoked: boolean;
  readonly validFrom: string;
  readonly validUntil: string;
};

/** Supplied by the host's current registry, never by a request body. */
export interface ProjectionKeyAuthority {
  current(keyId: string): Promise<CurrentProjectionKey | undefined>;
}

/** Read-only signature verification, not a PoCC verdict, membership decision or economic authorization. */
export async function verifyProjectionTransport(
  input: { readonly recordBytes: Uint8Array; readonly signature: string; readonly keyId: string; readonly keyEpoch: number },
  authority: ProjectionKeyAuthority | undefined,
  clock: () => number = Date.now,
) {
  if (!authority) throw new Error("ACCOUNTABILITY_AUTHORITY_UNAVAILABLE");
  const bytes = Buffer.from(input.recordBytes);
  if (bytes.length === 0 || bytes.length > 262_144) throw new Error("PROJECTION_SIZE_INVALID");
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PROJECTION_RECORD_REQUIRED");
  if (!Buffer.from(canonicalProjectionJson(value)).equals(bytes)) throw new Error("NON_CANONICAL_PROJECTION_BYTES");
  const record = value as Record<string, unknown>;
  if ("accepted" in record || "quorumWeight" in record || "previousRoot" in record) throw new Error("LOCAL_PROJECTION_NOT_AUTHORITY");
  const current = await authority.current(input.keyId);
  // The asynchronous registry read may cross expiry. Decide using fresh time after it returns.
  const now = clock();
  if (!current || current.revoked || !Number.isSafeInteger(current.keyEpoch) || current.keyEpoch !== input.keyEpoch
    || !Number.isFinite(now) || !Number.isFinite(Date.parse(current.validFrom)) || !Number.isFinite(Date.parse(current.validUntil))
    || Date.parse(current.validFrom) > now || now >= Date.parse(current.validUntil)) throw new Error("PROJECTION_KEY_UNAVAILABLE");
  if (record.protocol_version !== current.protocolVersion || record.schema_hash !== current.schemaHash
    || !/^sha256:[a-f0-9]{64}$/.test(current.schemaHash)) throw new Error("PROJECTION_CONTRACT_MISMATCH");
  if (!/^[A-Za-z0-9_-]{86}$/.test(input.signature)) throw new Error("PROJECTION_SIGNATURE_INVALID");
  const signature = Buffer.from(input.signature, "base64url");
  const key = createPublicKey(current.publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519" || signature.length !== 64 || signature.toString("base64url") !== input.signature
    || !verify(null, bytes, key, signature)) throw new Error("PROJECTION_SIGNATURE_INVALID");
  return Object.freeze({ recordHash: projectionDigest(bytes), transportSignatureVerified: true as const,
    finalAuthority: false as const, economicAuthority: false as const, membershipAuthority: false as const });
}
