import { createPublicKey, timingSafeEqual, verify, type KeyObject } from "node:crypto";

/** Cryptographic primitive only: neither a quorum decision nor a rights grant.
 * The caller must obtain the key from its authoritative, current registry.
 * There is deliberately no caller-supplied `verified` flag or signing facility.
 */
export type ChildSignatureFailure =
  | "INVALID_INPUT"
  | "UNSUPPORTED_ALGORITHM"
  | "PAYLOAD_MISMATCH"
  | "INVALID_PUBLIC_KEY"
  | "INVALID_SIGNATURE";

export type ChildSignatureResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: ChildSignatureFailure };

export function verifyChildSignatureBytes(input: {
  readonly algorithm: string;
  readonly expectedPayload: Uint8Array;
  readonly signedPayload: Uint8Array;
  readonly signature: Uint8Array;
  readonly registeredPublicKey: KeyObject | string;
}): ChildSignatureResult {
  if (!input || typeof input !== "object") return { valid: false, reason: "INVALID_INPUT" };
  if (input.algorithm !== "Ed25519") return { valid: false, reason: "UNSUPPORTED_ALGORITHM" };
  if (
    !(input.expectedPayload instanceof Uint8Array) ||
    !(input.signedPayload instanceof Uint8Array) ||
    !(input.signature instanceof Uint8Array) ||
    input.expectedPayload.byteLength === 0 ||
    input.expectedPayload.byteLength > 65_536 ||
    input.signedPayload.byteLength !== input.expectedPayload.byteLength
  ) return { valid: false, reason: "INVALID_INPUT" };
  // Compare the exact authoritative envelope, not a caller-provided digest.
  if (!timingSafeEqual(input.expectedPayload, input.signedPayload)) {
    return { valid: false, reason: "PAYLOAD_MISMATCH" };
  }
  if (input.signature.byteLength !== 64) return { valid: false, reason: "INVALID_SIGNATURE" };
  let key: KeyObject;
  try {
    if (typeof input.registeredPublicKey === "string") {
      // Never accept private material even though createPublicKey can derive from it.
      if (!input.registeredPublicKey.startsWith("-----BEGIN PUBLIC KEY-----")) {
        return { valid: false, reason: "INVALID_PUBLIC_KEY" };
      }
      key = createPublicKey(input.registeredPublicKey);
    } else {
      key = input.registeredPublicKey;
    }
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") {
      return { valid: false, reason: "INVALID_PUBLIC_KEY" };
    }
    return verify(null, input.signedPayload, key, input.signature)
      ? { valid: true }
      : { valid: false, reason: "INVALID_SIGNATURE" };
  } catch {
    return { valid: false, reason: "INVALID_PUBLIC_KEY" };
  }
}
