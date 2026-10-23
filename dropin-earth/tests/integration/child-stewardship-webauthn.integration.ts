import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { ChildSyntheticWebAuthn, SYNTHETIC_WEBAUTHN_ORIGIN } from "../../services/api/src/domain/child-stewardship/webauthn.js";
import { createChildWebAuthnFixtureRoutes } from "../../services/api/src/routes/child-stewardship/webauthn-fixture.js";
import { nativeChildPool,nativeChildSql } from "../fixtures/child-stewardship-postgres.js";
import { syntheticAuthenticator } from "../fixtures/child-stewardship-webauthn.js";

const NOW="2026-10-23T12:00:00.000Z";
async function scopedPool(owner:pg.Pool,verifier=false) {
  const role=`webauthn_test_${randomUUID().replaceAll("-","")}`;
  const password=randomBytes(32).toString("hex");
  await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`);
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship_webauthn TO ${role}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA child_stewardship_webauthn TO ${role}`);
  await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship_webauthn TO ${role}`);
  await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship_webauthn TO ${role}`);
  if(verifier) await owner.query("INSERT INTO child_stewardship_webauthn.verifier_roles(database_role,enabled,expires_at) VALUES($1,true,clock_timestamp()+interval '1 hour')",[role]);
  const connection=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);
  connection.username=role;connection.password=password;
  const pool=new pg.Pool({connectionString:connection.toString(),max:6});
  return {pool,role,async close(){await pool.end();await owner.query("DELETE FROM child_stewardship_webauthn.verifier_roles WHERE database_role=$1",[role]);await owner.query(`DROP OWNED BY ${role}`);await owner.query(`DROP ROLE ${role}`);}};
}
test("WebAuthn native: genuine crypto verification, durable ceremonies, API integration and no production enrollment",async t=>{
  const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof scopedPool>>|undefined;let verifier:Awaited<ReturnType<typeof scopedPool>>|undefined;
  try{
    await owner.query(await readFile("services/api/prisma/child-stewardship-webauthn.sql","utf8"));
    runtime=await scopedPool(owner);
    verifier=await scopedPool(owner,true);
    const client=nativeChildSql(runtime.pool);
    const verifierClient=nativeChildSql(verifier.pool);
    assert.equal(await new ChildSyntheticWebAuthn(nativeChildSql(owner),syntheticAuthenticator().fixture,verifierClient).ready(),false,"migration owner is never the runtime verifier");
    assert.equal(await new ChildSyntheticWebAuthn(client,syntheticAuthenticator().fixture,client).ready(),false,"ordinary runtime cannot also be verifier");
    const external=t.mock.method(globalThis,"fetch",async()=>{throw new Error("unexpected external request");});
    const create=async()=>{
      const authenticator=syntheticAuthenticator();const service=new ChildSyntheticWebAuthn(client,authenticator.fixture,verifierClient);
      const scope=await service.createFixtureSandbox(NOW);return {authenticator,service,scope};
    };
    const register=async(f:Awaited<ReturnType<typeof create>>)=>{
      const begin=await f.service.begin(f.scope,"registration",NOW);
      await f.service.finish(f.scope,begin.ceremonyId,f.authenticator.registration({challenge:begin.options.challenge}),NOW);
    };
    const counts=async(sandboxId:string)=>{
      const data=await owner.query(`SELECT
        (SELECT count(*)::int FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1::uuid) AS credentials,
        (SELECT count(*)::int FROM child_stewardship_webauthn.sessions WHERE sandbox_id=$1::uuid) AS sessions`,[sandboxId]);return data.rows[0];
    };

    await t.test("real ES256 registration/authentication through Hono and native non-owner SQL; reconnect session remains valid",async()=>{
      const f=await create();let time=NOW;
      const app=createChildWebAuthnFixtureRoutes(f.service,f.scope,()=>time);
      const request=async(path:string,body:unknown)=>app.request(path,{method:"POST",headers:{origin:SYNTHETIC_WEBAUTHN_ORIGIN,authorization:`Bearer ${f.scope.capability}`,"content-type":"application/json"},body:JSON.stringify(body)});
      const options=await (await request("/options",{kind:"registration"})).json();
      assert.equal(options.options.authenticatorSelection.userVerification,"required");
      assert.deepEqual(options.options.pubKeyCredParams,[{alg:-7,type:"public-key"}]);
      const registration=f.authenticator.registration({challenge:options.options.challenge});
      const registered=await request("/verify",{ceremonyId:options.ceremonyId,response:registration});assert.equal(registered.status,200);
      assert.equal((await registered.json()).identityVerified,false);
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:0},"registration alone cannot create a session");
      assert.equal((await request("/verify",{ceremonyId:options.ceremonyId,response:registration})).status,409);
      const auth=await (await request("/options",{kind:"authentication"})).json();
      const response=f.authenticator.authentication({challenge:auth.options.challenge,counter:1});
      const verified=await request("/verify",{ceremonyId:auth.ceremonyId,response});assert.equal(verified.status,200);
      const result=await verified.json();assert.ok(result.sessionToken);
      const reconnect=new ChildSyntheticWebAuthn(client,f.authenticator.fixture,verifierClient);
      assert.equal((await reconnect.authenticateSession(f.scope,result.sessionToken,NOW)).subject,"demo-guardian");
      const persisted=await owner.query("SELECT counter FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1",[f.scope.sandboxId]);assert.equal(Number(persisted.rows[0].counter),1);
      assert.equal((await request("/verify",{ceremonyId:auth.ceremonyId,response})).status,409);
      assert.equal((await request("/options",{kind:"registration",childName:"synthetic-sensitive-field"})).status,400);
      time="2026-10-23T12:10:01.000Z";assert.equal((await request("/session",{sessionToken:result.sessionToken})).status,401);
      assert.equal((await request("/guardian/sessions",{})).status,503);
    });

    await t.test("registration enforces exact challenge, origin, RP hash, UV and UP; denied attempts cannot register and are spent",async()=>{
      for(const alteration of ["challenge","origin","rp","uv","up","crossOrigin"]){
        const f=await create();const begin=await f.service.begin(f.scope,"registration",NOW);
        const response=f.authenticator.registration({challenge:begin.options.challenge,...(alteration==="challenge"?{challenge:"different-challenge"}:{}),
          ...(alteration==="origin"?{origin:"https://attacker.invalid"}:{}),...(alteration==="rp"?{rp:"attacker.invalid"}:{}),
          ...(alteration==="uv"?{uv:false}:{}),...(alteration==="up"?{up:false}:{}),...(alteration==="crossOrigin"?{crossOrigin:true}:{})});
        await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,response,NOW),/WEBAUTHN_/);
        assert.deepEqual(await counts(f.scope.sandboxId),{credentials:0,sessions:0});
        await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,f.authenticator.registration({challenge:begin.options.challenge}),NOW),/WEBAUTHN_CHALLENGE_USED/);
      }
    });

    await t.test("expired ceremonies and a non-allowlisted credential/public key cannot enroll",async()=>{
      const f=await create();const begin=await f.service.begin(f.scope,"registration",NOW);
      await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,f.authenticator.registration({challenge:begin.options.challenge}),"2026-10-23T12:02:00.000Z"),/WEBAUTHN_CHALLENGE_EXPIRED/);
      const fresh=await f.service.begin(f.scope,"registration","2026-10-23T12:03:00.000Z");
      await assert.rejects(f.service.finish(f.scope,fresh.ceremonyId,syntheticAuthenticator().registration({challenge:fresh.options.challenge}),"2026-10-23T12:03:00.000Z"),/WEBAUTHN_FIXTURE_REQUIRED/);
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:0,sessions:0});
    });

    await t.test("same credential ID with a different public key and COSE algorithm substitution both fail",async()=>{
      const f=await create();const begin=await f.service.begin(f.scope,"registration",NOW);
      const sameIdWrongKey=syntheticAuthenticator({credentialId:f.authenticator.fixture.credentialId});
      await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,sameIdWrongKey.registration({challenge:begin.options.challenge}),NOW),/WEBAUTHN_FIXTURE_REQUIRED/);
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:0,sessions:0});
      const unsupported=syntheticAuthenticator({algorithm:-8});
      const service=new ChildSyntheticWebAuthn(client,unsupported.fixture,verifierClient);const scope=await service.createFixtureSandbox(NOW);
      const options=await service.begin(scope,"registration",NOW);
      await assert.rejects(service.finish(scope,options.ceremonyId,unsupported.registration({challenge:options.options.challenge}),NOW),/WEBAUTHN_VERIFICATION_FAILED/);
      assert.deepEqual(await counts(scope.sandboxId),{credentials:0,sessions:0});
      const accepted=await create();await register(accepted);
      const authenticate=await accepted.service.begin(accepted.scope,"authentication",NOW);
      const wrongSigner=syntheticAuthenticator({credentialId:accepted.authenticator.fixture.credentialId});
      await assert.rejects(accepted.service.finish(accepted.scope,authenticate.ceremonyId,wrongSigner.authentication({challenge:authenticate.options.challenge,counter:1}),NOW),/WEBAUTHN_VERIFICATION_FAILED/);
      assert.deepEqual(await counts(accepted.scope.sandboxId),{credentials:1,sessions:0});
    });

    await t.test("authentication rejects actual invalid signatures, signed foreign semantics, lower counter and wrong handle with no session",async()=>{
      const f=await create();await register(f);
      const initial=await f.service.begin(f.scope,"authentication",NOW);
      await f.service.finish(f.scope,initial.ceremonyId,f.authenticator.authentication({challenge:initial.options.challenge,counter:3}),NOW);
      for(const alteration of ["signature","challenge","origin","rp","uv","up","counter","userHandle","crossOrigin"]){
        const begin=await f.service.begin(f.scope,"authentication",NOW);
        const response=f.authenticator.authentication({challenge:begin.options.challenge,counter:4,
          ...(alteration==="challenge"?{challenge:"wrong-challenge"}:{}),...(alteration==="origin"?{origin:"https://attacker.invalid"}:{}),
          ...(alteration==="rp"?{rp:"attacker.invalid"}:{}),...(alteration==="uv"?{uv:false}:{}),...(alteration==="up"?{up:false}:{}),
          ...(alteration==="counter"?{counter:2}:{}),...(alteration==="userHandle"?{userHandle:Buffer.alloc(32,7).toString("base64url")}:{}),
          ...(alteration==="crossOrigin"?{crossOrigin:true}:{})});
        if(alteration==="signature")response.response.signature=Buffer.alloc(70,7).toString("base64url");
        await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,response,NOW),/WEBAUTHN_/);
        assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:1});
        assert.equal(Number((await owner.query("SELECT counter FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1",[f.scope.sandboxId])).rows[0].counter),3);
      }
    });

    await t.test("counter-zero authenticators retain replay safety through one-use challenges",async()=>{
      const f=await create();await register(f);
      for(let i=0;i<2;i++){
        const begin=await f.service.begin(f.scope,"authentication",NOW);const response=f.authenticator.authentication({challenge:begin.options.challenge,counter:0});
        assert.ok((await f.service.finish(f.scope,begin.ceremonyId,response,NOW)).sessionToken);
        await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,response,NOW),/WEBAUTHN_CHALLENGE_USED/);
      }
      assert.equal((await counts(f.scope.sandboxId)).sessions,2);
    });

    await t.test("concurrent exact challenge redemption produces one durable session",async()=>{
      const f=await create();await register(f);const begin=await f.service.begin(f.scope,"authentication",NOW);
      const response=f.authenticator.authentication({challenge:begin.options.challenge,counter:1});
      const results=await Promise.allSettled([f.service.finish(f.scope,begin.ceremonyId,response,NOW),f.service.finish(f.scope,begin.ceremonyId,response,NOW)]);
      assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
      assert.equal(results.filter(result=>result.status==="rejected").length,1);
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:1});
    });

    await t.test("revocation closes existing sessions and queued challenges; durable SQL rejects counter/binding/revocation rollback",async()=>{
      const f=await create();await register(f);const begin=await f.service.begin(f.scope,"authentication",NOW);
      const logged=await f.service.finish(f.scope,begin.ceremonyId,f.authenticator.authentication({challenge:begin.options.challenge,counter:2}),NOW);
      const queued=await f.service.begin(f.scope,"authentication",NOW);
      await f.service.revoke(f.scope,NOW);
      await assert.rejects(f.service.authenticateSession(f.scope,logged.sessionToken!,NOW),/WEBAUTHN_UNAUTHORIZED/);
      await assert.rejects(f.service.finish(f.scope,queued.ceremonyId,f.authenticator.authentication({challenge:queued.options.challenge,counter:3}),NOW),/WEBAUTHN_UNAUTHORIZED/);
      for(const statement of ["UPDATE child_stewardship_webauthn.credentials SET counter=1 WHERE sandbox_id=$1::uuid",
        "UPDATE child_stewardship_webauthn.credentials SET revoked=false WHERE sandbox_id=$1::uuid",
        "UPDATE child_stewardship_webauthn.sandboxes SET epoch=1,revoked=false WHERE id=$1::uuid"]){
        await assert.rejects(owner.query(statement,[f.scope.sandboxId]),/WEBAUTHN_((CREDENTIAL|BINDING)_IMMUTABLE|VERIFIER_ADMISSION_REQUIRED)/);
      }
      const audit=await owner.query("SELECT action,outcome,code FROM child_stewardship_webauthn.audit WHERE sandbox_id=$1",[f.scope.sandboxId]);
      assert.ok(audit.rows.some(row=>row.action==="revocation"&&row.outcome==="accepted"));
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:1});
    });

    await t.test("failed session persistence rolls back consumption and counter; safe retry succeeds",async()=>{
      const f=await create();await register(f);const begin=await f.service.begin(f.scope,"authentication",NOW);
      const response=f.authenticator.authentication({challenge:begin.options.challenge,counter:1});
      let fail=true;
      const failing=new ChildSyntheticWebAuthn(client,f.authenticator.fixture,nativeChildSql(verifier!.pool,text=>{if(fail&&text.includes("INSERT INTO child_stewardship_webauthn.sessions")){fail=false;throw new Error("injected_session_failure");}}));
      await assert.rejects(failing.finish(f.scope,begin.ceremonyId,response,NOW),/injected_session_failure/);
      assert.equal((await counts(f.scope.sandboxId)).sessions,0);
      assert.equal(Number((await owner.query("SELECT counter FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1",[f.scope.sandboxId])).rows[0].counter),0);
      assert.ok((await f.service.finish(f.scope,begin.ceremonyId,response,NOW)).sessionToken);
    });

    await t.test("cross-sandbox ceremony and caller verified flag never authorize; audit excludes raw WebAuthn bytes",async()=>{
      const f=await create();const other=await create();const begin=await f.service.begin(f.scope,"registration",NOW);
      const response=f.authenticator.registration({challenge:begin.options.challenge});
      await assert.rejects(other.service.finish(other.scope,begin.ceremonyId,response,NOW),/WEBAUTHN_CHALLENGE_INVALID/);
      await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,{...response,verified:true},NOW),/WEBAUTHN_INVALID_INPUT/);
      const audit=JSON.stringify((await owner.query("SELECT row_to_json(a) AS row FROM child_stewardship_webauthn.audit a WHERE sandbox_id=$1",[f.scope.sandboxId])).rows);
      assert.ok(!audit.includes(response.response.clientDataJSON));assert.ok(!audit.includes(response.response.attestationObject));
      assert.ok(!audit.includes(f.scope.capability));assert.ok(!audit.includes(f.authenticator.fixture.credentialId));
    });
    await t.test("ordinary runtime cannot forge a session, credential, verifier admission, counter or successful audit through SQL",async()=>{
      const f=await create();await register(f);
      const forgedToken=randomBytes(32).toString("base64url");
      const inScope=async(statement:string,parameters:unknown[])=>client.transaction(async db=>{
        await db.query("SELECT set_config('app.webauthn_sandbox',$1,true)",[f.scope.sandboxId]);
        await db.query("SELECT set_config('app.webauthn_verified','true',true)");
        return db.query(statement,parameters);
      });
      await assert.rejects(inScope(`INSERT INTO child_stewardship_webauthn.sessions
        (id,sandbox_id,credential_id,token_hash,epoch,created_at,expires_at)
        VALUES($1,$2,$3,$4,1,$5,$6)`,[randomUUID(),f.scope.sandboxId,f.authenticator.fixture.credentialId,
        createHash("sha256").update(forgedToken).digest("hex"),NOW,"2026-10-23T12:10:00.000Z"]),/WEBAUTHN_VERIFIER_ADMISSION_REQUIRED/);
      await assert.rejects(f.service.authenticateSession(f.scope,forgedToken,NOW),/WEBAUTHN_SESSION_REVOKED/);
      await assert.rejects(inScope("INSERT INTO child_stewardship_webauthn.credentials SELECT * FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1",[f.scope.sandboxId]),/WEBAUTHN_VERIFIER_ADMISSION_REQUIRED/);
      await assert.rejects(inScope("UPDATE child_stewardship_webauthn.credentials SET counter=counter+1 WHERE sandbox_id=$1",[f.scope.sandboxId]),/WEBAUTHN_VERIFIER_ADMISSION_REQUIRED/);
      await assert.rejects(inScope(`INSERT INTO child_stewardship_webauthn.audit(sandbox_id,action,outcome,code,recorded_at)
        VALUES($1,'authentication','accepted','WEBAUTHN_VERIFIED',$2)`,[f.scope.sandboxId,NOW]),/WEBAUTHN_VERIFIER_ADMISSION_REQUIRED/);
      await assert.rejects(client.query("INSERT INTO child_stewardship_webauthn.verifier_roles(database_role,enabled,expires_at) VALUES(current_user,true,clock_timestamp()+interval '1 hour')"),/WEBAUTHN_VERIFIER_PROVISIONING_DENIED/);
      await assert.rejects(client.query("UPDATE child_stewardship_webauthn.verifier_roles SET expires_at=clock_timestamp()+interval '1 day' WHERE database_role=$1",[verifier!.role]),/WEBAUTHN_VERIFIER_PROVISIONING_DENIED/);
      await assert.rejects(client.query(`SET ROLE ${verifier!.role}`),/permission denied to set role/);
      await client.query("RESET ROLE");
      const identity=await client.query<{role:string;login:string}>("SELECT current_user AS role,session_user AS login");
      assert.equal(identity[0]?.role,runtime!.role);assert.equal(identity[0]?.login,runtime!.role);
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:0});
      const begin=await f.service.begin(f.scope,"authentication",NOW);
      await owner.query("UPDATE child_stewardship_webauthn.verifier_roles SET enabled=false WHERE database_role=$1",[verifier!.role]);
      try{
        assert.equal(await f.service.ready(),false);
        await assert.rejects(f.service.finish(f.scope,begin.ceremonyId,f.authenticator.authentication({challenge:begin.options.challenge,counter:1}),NOW),/WEBAUTHN_VERIFIER_ADMISSION_REQUIRED/);
        assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:0});
      }finally{await owner.query("UPDATE child_stewardship_webauthn.verifier_roles SET enabled=true WHERE database_role=$1",[verifier!.role]);}
      assert.ok((await f.service.finish(f.scope,begin.ceremonyId,f.authenticator.authentication({challenge:begin.options.challenge,counter:1}),NOW)).sessionToken);
    });
    await t.test("waiting for a native row lock cannot preserve an expired ceremony or sandbox request instant",async()=>{
      for(const boundary of ["ceremony","sandbox"]){
        const f=await create();const begin=await f.service.begin(f.scope,"registration",NOW);
        const lock=await owner.connect();await lock.query("BEGIN");
        await lock.query("SELECT id FROM child_stewardship_webauthn.sandboxes WHERE id=$1 FOR UPDATE",[f.scope.sandboxId]);
        const requestInstant=boundary==="ceremony"?"2026-10-23T12:01:59.950Z":"2026-10-23T12:59:59.950Z";
        const pending=f.service.finish(f.scope,begin.ceremonyId,f.authenticator.registration({challenge:begin.options.challenge}),requestInstant).then(()=>"accepted",()=>"denied");
        await new Promise(resolve=>setTimeout(resolve,120));await lock.query("COMMIT");lock.release();
        assert.equal(await pending,"denied");assert.deepEqual(await counts(f.scope.sandboxId),{credentials:0,sessions:0});
      }
    });
    await t.test("RLS isolates sandbox rows; non-destructive rollback preserves replay barriers and revokes sessions",async()=>{
      const f=await create();await register(f);const auth=await f.service.begin(f.scope,"authentication",NOW);
      const session=await f.service.finish(f.scope,auth.ceremonyId,f.authenticator.authentication({challenge:auth.options.challenge,counter:1}),NOW);
      assert.equal((await client.query("SELECT count(*)::int AS count FROM child_stewardship_webauthn.sandboxes"))[0]?.count,0);
      await client.transaction(async db=>{
        await db.query("SELECT set_config('app.webauthn_sandbox',$1,true)",[randomUUID()]);
        assert.equal((await db.query("SELECT count(*)::int AS count FROM child_stewardship_webauthn.credentials WHERE sandbox_id=$1::uuid",[f.scope.sandboxId]))[0]?.count,0);
      });
      await owner.query(await readFile("services/api/prisma/child-stewardship-webauthn.rollback.sql","utf8"));
      await assert.rejects(f.service.authenticateSession(f.scope,session.sessionToken!,NOW),/WEBAUTHN_UNAUTHORIZED/);
      assert.deepEqual(await counts(f.scope.sandboxId),{credentials:1,sessions:1});
      const challenge=await owner.query("SELECT consumed_at FROM child_stewardship_webauthn.ceremonies WHERE id=$1::uuid",[auth.ceremonyId]);
      assert.ok(challenge.rows[0].consumed_at);
      await assert.rejects(owner.query("UPDATE child_stewardship_webauthn.ceremonies SET consumed_at=NULL WHERE id=$1::uuid",[auth.ceremonyId]),/WEBAUTHN_CHALLENGE_IMMUTABLE/);
    });
    assert.equal(external.mock.callCount(),0);
  }finally{await runtime?.close();await verifier?.close();await owner.end();}
});
