import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  generateRegistrationOptions, generateAuthenticationOptions,
  verifyRegistrationResponse, verifyAuthenticationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import type { ChildSqlClient, ChildSqlConnection } from "./postgres-store.js";

export const SYNTHETIC_WEBAUTHN_RP = "webauthn.synthetic.invalid";
export const SYNTHETIC_WEBAUTHN_ORIGIN = "https://webauthn.synthetic.invalid";
const CHALLENGE_LIFETIME = 120_000;
const SESSION_LIFETIME = 600_000;
const base64url = /^[A-Za-z0-9_-]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export class ChildWebAuthnError extends Error {
  constructor(readonly code: string, readonly status: 400 | 401 | 403 | 409 | 503 = 403) { super(code); }
}
function reject(code: string, status: 400 | 401 | 403 | 409 | 503 = 403): never { throw new ChildWebAuthnError(code, status); }
function instant(value: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) reject("WEBAUTHN_INVALID_TIME", 400);
  return time;
}
/** The server supplies the request instant; elapsed monotonic time advances it
 * across database locks and crypto work. HTTP bodies cannot choose this clock. */
function advancingInstant(value:string):()=>string {
  const base=instant(value);const start=performance.now();
  return ()=>new Date(base+Math.max(0,performance.now()-start)).toISOString();
}
const hash = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const equalHash = (one: string, two: string) => /^[a-f0-9]{64}$/.test(one) && /^[a-f0-9]{64}$/.test(two)
  && timingSafeEqual(Buffer.from(one, "hex"), Buffer.from(two, "hex"));
export type SyntheticAuthenticatorFixture = { credentialId: string; publicKeySha256: string };
export type SyntheticWebAuthnScope = { sandboxId: string; capability: string };
type SandboxRow = Record<string, unknown> & {
  id: string; user_handle: string; fixture_key_digest: string; fixture_credential_id: string;
  capability_hash: string; epoch: string | number; revoked: boolean; expires_at: Date | string;
};
type CeremonyRow = Record<string, unknown> & {
  id: string; kind: "registration" | "authentication"; challenge: string;
  epoch: string | number; consumed_at: Date | string | null; expires_at: Date | string;
};
type CredentialRow = Record<string, unknown> & {
  credential_id: string; public_key: Uint8Array; counter: string | number; epoch: string | number;
  revoked: boolean; device_type: "singleDevice" | "multiDevice"; backed_up: boolean;
};
function timeOf(value: Date | string): number { return value instanceof Date ? value.getTime() : instant(value); }
async function scoped(db: ChildSqlConnection, sandboxId: string): Promise<void> {
  if (!uuid.test(sandboxId)) reject("WEBAUTHN_UNAUTHORIZED", 401);
  await db.query("SELECT set_config('app.webauthn_sandbox',$1,true)", [sandboxId]);
}
function keys(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) reject("WEBAUTHN_INVALID_INPUT", 400);
  const object = value as Record<string, unknown>;
  if (required.some(key => !Object.hasOwn(object, key)) || Object.keys(object).some(key => !required.includes(key) && !optional.includes(key))) reject("WEBAUTHN_INVALID_INPUT", 400);
  return object;
}
function binary(value: unknown, minimum = 1, maximum = 16_384): asserts value is string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || !base64url.test(value)
    || Buffer.from(value, "base64url").toString("base64url") !== value) reject("WEBAUTHN_INVALID_INPUT", 400);
}
function responseShape(value: unknown, kind: "registration" | "authentication") {
  const outer = keys(value, ["id", "rawId", "type", "response", "clientExtensionResults"], ["authenticatorAttachment"]);
  binary(outer.id, 16, 512); binary(outer.rawId, 16, 512);
  if (outer.id !== outer.rawId || outer.type !== "public-key"
    || outer.authenticatorAttachment !== undefined && !["platform", "cross-platform"].includes(String(outer.authenticatorAttachment))) reject("WEBAUTHN_INVALID_INPUT", 400);
  keys(outer.clientExtensionResults, []);
  const response = kind === "registration"
    ? keys(outer.response, ["clientDataJSON", "attestationObject"], ["transports"])
    : keys(outer.response, ["clientDataJSON", "authenticatorData", "signature"], ["userHandle"]);
  binary(response.clientDataJSON, 16, 4096);
  if (kind === "registration") {
    binary(response.attestationObject, 16, 16_384);
    if (response.transports !== undefined && (!Array.isArray(response.transports) || response.transports.some(item => item !== "internal"))) reject("WEBAUTHN_INVALID_INPUT", 400);
  } else {
    binary(response.authenticatorData, 16, 2048); binary(response.signature, 16, 2048);
    if (response.userHandle !== undefined) binary(response.userHandle, 16, 128);
  }
  let client: unknown;
  try { client = JSON.parse(Buffer.from(response.clientDataJSON as string, "base64url").toString("utf8")); } catch { reject("WEBAUTHN_INVALID_CLIENT_DATA", 400); }
  const data = keys(client, ["type", "challenge", "origin"], ["crossOrigin"]);
  if (data.crossOrigin !== undefined && data.crossOrigin !== false) reject("WEBAUTHN_CROSS_ORIGIN_DENIED");
  if (data.origin !== SYNTHETIC_WEBAUTHN_ORIGIN) reject("WEBAUTHN_ORIGIN_MISMATCH");
  return outer;
}

/** Real WebAuthn verification, deliberately limited to a server-pinned synthetic
 * authenticator fixture. This is not mounted by the production application.
 * It cannot enroll a browser's real credential or establish age/guardianship.
 */
export class ChildSyntheticWebAuthn {
  constructor(private readonly client: ChildSqlClient, private readonly fixture: SyntheticAuthenticatorFixture,
    private readonly verifierClient: ChildSqlClient) {
    binary(fixture.credentialId, 16, 512);
    if (!/^[a-f0-9]{64}$/.test(fixture.publicKeySha256)) reject("WEBAUTHN_FIXTURE_REQUIRED", 503);
  }
  async ready(): Promise<boolean> {
    try {
      const readiness = `SELECT current_user AS role,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='child_stewardship_webauthn' AND table_name='ceremonies')
        AND current_user=session_user
        AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
        AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='child_stewardship_webauthn' AND r.rolname=current_user) AS ready,
        EXISTS(SELECT 1 FROM child_stewardship_webauthn.verifier_roles
          WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp()) AS verifier`;
      const result = await this.client.query<{ role: string; ready: boolean; verifier: boolean }>(readiness);
      const verification = await this.verifierClient.query<{ role: string; ready: boolean; verifier: boolean }>(readiness);
      if (result[0]?.ready !== true || result[0].verifier || verification[0]?.ready !== true
        || !verification[0].verifier || result[0].role===verification[0].role) return false;
      const membership = await this.client.query<{ member: boolean }>("SELECT pg_has_role(current_user,$1,'MEMBER') AS member",[verification[0].role]);
      return membership[0]?.member === false;
    } catch { return false; }
  }
  /** Trusted local fixture harness only; never accepts account names or public-key pins from HTTP. */
  async createFixtureSandbox(now: string): Promise<SyntheticWebAuthnScope> {
    if (!await this.ready()) reject("WEBAUTHN_UNAVAILABLE", 503);
    const sandboxId = randomUUID(); const capability = randomBytes(32).toString("base64url");
    const userHandle = randomBytes(32).toString("base64url");
    const expiresAt = new Date(instant(now) + 60 * 60_000).toISOString();
    await this.client.transaction(async db => {
      await scoped(db, sandboxId);
      await db.query(`INSERT INTO child_stewardship_webauthn.sandboxes
        (id,user_handle,fixture_key_digest,fixture_credential_id,capability_hash,expires_at)
        VALUES($1::uuid,$2,$3,$4,$5,$6::timestamptz)`,
      [sandboxId,userHandle,this.fixture.publicKeySha256,this.fixture.credentialId,hash(capability),expiresAt]);
    });
    return { sandboxId, capability };
  }
  private async lock(db: ChildSqlConnection, scope: SyntheticWebAuthnScope, now: ()=>string): Promise<SandboxRow> {
    await scoped(db, scope.sandboxId);
    binary(scope.capability, 43, 43);
    const rows = await db.query<SandboxRow>("SELECT * FROM child_stewardship_webauthn.sandboxes WHERE id=$1::uuid FOR UPDATE", [scope.sandboxId]);
    const row = rows[0];
    if (!row || !equalHash(row.capability_hash, hash(scope.capability)) || row.revoked || timeOf(row.expires_at) <= instant(now())) reject("WEBAUTHN_UNAUTHORIZED", 401);
    if (row.fixture_credential_id !== this.fixture.credentialId || !equalHash(row.fixture_key_digest, this.fixture.publicKeySha256)) reject("WEBAUTHN_FIXTURE_REQUIRED", 503);
    return row;
  }
  private async credential(db: ChildSqlConnection, sandboxId: string): Promise<CredentialRow | undefined> {
    return (await db.query<CredentialRow>("SELECT * FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1::uuid FOR UPDATE", [sandboxId]))[0];
  }
  async begin(scope: SyntheticWebAuthnScope, kind: "registration" | "authentication", now: string) {
    const clock=advancingInstant(now);
    if (kind !== "registration" && kind !== "authentication") reject("WEBAUTHN_INVALID_INPUT", 400);
    return this.client.transaction(async db => {
      const account = await this.lock(db, scope, clock);
      const credential = await this.credential(db, scope.sandboxId);
      if (kind === "registration" && credential) reject("WEBAUTHN_ALREADY_REGISTERED", 409);
      if (kind === "authentication" && (!credential || credential.revoked || Number(credential.epoch) !== Number(account.epoch))) reject("WEBAUTHN_UNAUTHORIZED", 401);
      const challenge = randomBytes(32); const ceremonyId = randomUUID();
      const options = kind === "registration"
        ? await generateRegistrationOptions({ rpName: "CanopyProof synthetic authenticator test", rpID: SYNTHETIC_WEBAUTHN_RP,
          userID: Buffer.from(account.user_handle, "base64url"), userName: "demo-guardian", userDisplayName: "Synthetic guardian",
          challenge, timeout: CHALLENGE_LIFETIME, attestationType: "none", supportedAlgorithmIDs: [-7],
          authenticatorSelection: { userVerification: "required", residentKey: "required" } })
        : await generateAuthenticationOptions({ rpID: SYNTHETIC_WEBAUTHN_RP, challenge, timeout: CHALLENGE_LIFETIME,
          userVerification: "required", allowCredentials: [{ id: credential!.credential_id, transports: ["internal"] }] });
      if(timeOf(account.expires_at)<=instant(clock()))reject("WEBAUTHN_UNAUTHORIZED",401);
      await db.query(`INSERT INTO child_stewardship_webauthn.ceremonies(id,sandbox_id,kind,challenge,epoch,issued_at,expires_at)
        VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::timestamptz,$7::timestamptz)`,
      [ceremonyId,scope.sandboxId,kind,options.challenge,Number(account.epoch),now,new Date(instant(now)+CHALLENGE_LIFETIME).toISOString()]);
      return { ceremonyId, options, syntheticOnly: true, identityVerified: false };
    });
  }
  async finish(scope: SyntheticWebAuthnScope, ceremonyId: string, value: unknown, now: string) {
    const clock=advancingInstant(now);
    if (!uuid.test(ceremonyId)) reject("WEBAUTHN_INVALID_INPUT", 400);
    const result = await this.verifierClient.transaction(async db => {
      const account = await this.lock(db, scope, clock);
      const ceremony = (await db.query<CeremonyRow>("SELECT * FROM child_stewardship_webauthn.ceremonies WHERE sandbox_id=$1::uuid AND id=$2::uuid FOR UPDATE", [scope.sandboxId,ceremonyId]))[0];
      if (!ceremony) reject("WEBAUTHN_CHALLENGE_INVALID");
      if (ceremony.consumed_at) reject("WEBAUTHN_CHALLENGE_USED", 409);
      now=clock();
      const checkDeadline=()=>{
        now=clock();
        if(timeOf(account.expires_at)<=instant(now)||timeOf(ceremony.expires_at)<=instant(now))reject("WEBAUTHN_CHALLENGE_EXPIRED");
      };
      // Commit consumption even for an invalid signature: no challenge can be retried.
      await db.query("UPDATE child_stewardship_webauthn.ceremonies SET consumed_at=$3::timestamptz WHERE sandbox_id=$1::uuid AND id=$2::uuid", [scope.sandboxId,ceremonyId,now]);
      let accepted: { syntheticOnly: true; identityVerified: false; registered?: true; sessionToken?: string; expiresAt?: string };
      let verificationCompleted = false;
      try {
        checkDeadline();
        if (Number(ceremony.epoch)!==Number(account.epoch)) reject("WEBAUTHN_CHALLENGE_EXPIRED");
        const response = responseShape(value, ceremony.kind);
        if (response.id !== account.fixture_credential_id) reject("WEBAUTHN_FIXTURE_REQUIRED");
        const current = await this.credential(db, scope.sandboxId);
        if (ceremony.kind === "registration") {
          if (current) reject("WEBAUTHN_ALREADY_REGISTERED", 409);
          const verified = await verifyRegistrationResponse({ response: response as unknown as RegistrationResponseJSON,
            expectedChallenge: ceremony.challenge, expectedOrigin: SYNTHETIC_WEBAUTHN_ORIGIN,
            expectedRPID: SYNTHETIC_WEBAUTHN_RP, requireUserVerification: true, supportedAlgorithmIDs: [-7] });
          if (!verified.verified || !verified.registrationInfo) reject("WEBAUTHN_VERIFICATION_FAILED");
          const info = verified.registrationInfo;
          if (info.fmt !== "none" || !equalHash(hash(info.credential.publicKey), account.fixture_key_digest)
            || info.credential.id !== account.fixture_credential_id) reject("WEBAUTHN_FIXTURE_REQUIRED");
          checkDeadline();
          verificationCompleted = true;
          await db.query(`INSERT INTO child_stewardship_webauthn.credentials
            (sandbox_id,credential_id,public_key,counter,epoch,device_type,backed_up,created_at)
            VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::timestamptz)`,
          [scope.sandboxId,info.credential.id,Buffer.from(info.credential.publicKey),info.credential.counter,Number(account.epoch),info.credentialDeviceType,info.credentialBackedUp,now]);
          accepted = { syntheticOnly: true, identityVerified: false, registered: true };
        } else {
          if (!current || current.revoked || Number(current.epoch)!==Number(account.epoch)) reject("WEBAUTHN_CREDENTIAL_REVOKED", 401);
          const responseData = response.response as Record<string, unknown>;
          if (responseData.userHandle !== undefined && responseData.userHandle !== account.user_handle) reject("WEBAUTHN_USER_HANDLE_MISMATCH");
          const verified = await verifyAuthenticationResponse({ response: response as unknown as AuthenticationResponseJSON,
            expectedChallenge: ceremony.challenge, expectedOrigin: SYNTHETIC_WEBAUTHN_ORIGIN,
            expectedRPID: SYNTHETIC_WEBAUTHN_RP, requireUserVerification: true,
            credential: { id: current.credential_id, publicKey: new Uint8Array(current.public_key), counter: Number(current.counter), transports: ["internal"] } });
          if (!verified.verified) reject("WEBAUTHN_VERIFICATION_FAILED");
          checkDeadline();
          verificationCompleted = true;
          await db.query("UPDATE child_stewardship_webauthn.credentials SET counter=$2 WHERE sandbox_id=$1::uuid", [scope.sandboxId,verified.authenticationInfo.newCounter]);
          const sessionToken = randomBytes(32).toString("base64url");
          const expiresAt = new Date(Math.min(instant(now)+SESSION_LIFETIME,timeOf(account.expires_at))).toISOString();
          await db.query(`INSERT INTO child_stewardship_webauthn.sessions
            (id,sandbox_id,credential_id,token_hash,epoch,created_at,expires_at) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::timestamptz,$7::timestamptz)`,
          [randomUUID(),scope.sandboxId,current.credential_id,hash(sessionToken),Number(account.epoch),now,expiresAt]);
          accepted = { syntheticOnly: true, identityVerified: false, sessionToken, expiresAt };
        }
        await this.audit(db,scope.sandboxId,ceremonyId,ceremony.kind,"accepted","WEBAUTHN_VERIFIED",now);
        checkDeadline();
        return { ok: true as const, value: accepted };
      } catch (error) {
        // A DB failure must roll the transaction back; never disguise it as verification rejection.
        if (verificationCompleted || error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)) throw error;
        const code = error instanceof ChildWebAuthnError ? error.code : "WEBAUTHN_VERIFICATION_FAILED";
        await this.audit(db,scope.sandboxId,ceremonyId,ceremony.kind,"rejected",code,now);
        return { ok: false as const, code, status: error instanceof ChildWebAuthnError ? error.status : 403 as const };
      }
    });
    if (!result.ok) reject(result.code,result.status);
    return result.value;
  }
  private async audit(db: ChildSqlConnection, sandboxId: string, ceremonyId: string | null,
    action: "registration" | "authentication" | "revocation", outcome: "accepted" | "rejected", code: string, now: string) {
    await db.query(`INSERT INTO child_stewardship_webauthn.audit(sandbox_id,ceremony_id,action,outcome,code,recorded_at)
      VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::timestamptz)`, [sandboxId,ceremonyId,action,outcome,code,now]);
  }
  async authenticateSession(scope: SyntheticWebAuthnScope, sessionToken: string, now: string) {
    const clock=advancingInstant(now);
    binary(sessionToken,43,43);
    return this.client.transaction(async db => {
      const account = await this.lock(db,scope,clock);
      const rows = await db.query<{ token_hash: string; expires_at: Date | string; epoch: string | number; revoked: boolean; credential_revoked: boolean; credential_epoch: string | number }>(`SELECT s.*,c.revoked AS credential_revoked,c.epoch AS credential_epoch
        FROM child_stewardship_webauthn.sessions s JOIN child_stewardship_webauthn.credentials c
          ON c.sandbox_id=s.sandbox_id AND c.credential_id=s.credential_id
        WHERE s.sandbox_id=$1::uuid AND s.token_hash=$2`,[scope.sandboxId,hash(sessionToken)]);
      const session=rows[0];
      now=clock();
      if (!session || session.revoked || session.credential_revoked || timeOf(session.expires_at)<=instant(now)
        || Number(session.epoch)!==Number(account.epoch) || Number(session.credential_epoch)!==Number(account.epoch)) reject("WEBAUTHN_SESSION_REVOKED",401);
      return { subject: "demo-guardian" as const, syntheticOnly: true as const, identityVerified: false as const, epoch: Number(account.epoch) };
    });
  }
  /** The isolated fixture capability may revoke, but cannot recover or re-enroll a revoked sandbox. */
  async revoke(scope: SyntheticWebAuthnScope, now: string) {
    const clock=advancingInstant(now);
    await this.client.transaction(async db => {
      await this.lock(db,scope,clock);now=clock();
      await db.query("UPDATE child_stewardship_webauthn.credentials SET revoked=true WHERE sandbox_id=$1::uuid AND NOT revoked",[scope.sandboxId]);
      await db.query("UPDATE child_stewardship_webauthn.sessions SET revoked=true WHERE sandbox_id=$1::uuid AND NOT revoked",[scope.sandboxId]);
      await db.query("UPDATE child_stewardship_webauthn.sandboxes SET epoch=epoch+1,revoked=true WHERE id=$1::uuid",[scope.sandboxId]);
      await this.audit(db,scope.sandboxId,null,"revocation","accepted","WEBAUTHN_REVOKED",now);
    });
    return { revoked: true, syntheticOnly: true };
  }
}
