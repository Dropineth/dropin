// TEST ONLY. The repository's synthetic provider is adapted to actual HTTPS.
// No enrollment, public ingress, real issuer, database credential, or admin route.
import assert from 'node:assert/strict';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {createServer} from 'node:https';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';

export function authorityOnly(fixture){
  assert.equal(fixture.kind,'SyntheticOciSessionFixture/1');
  assert.equal(fixture.environment,'SIMULATION_ONLY');
  assert.equal(fixture.audience,'canopyproof:synthetic:child-backend');
  assert.equal(fixture.current.anchor.sessionId,fixture.sessionId);
  assert.ok(Number.isSafeInteger(fixture.current.anchor.sequence)&&fixture.current.anchor.sequence>0);
  const key=createPrivateKey(fixture.transportPrivateKey);
  assert.equal(key.asymmetricKeyType,'ed25519');
  assert.equal(createPublicKey(key).export({type:'spki',format:'pem'}),fixture.transportPublicKey);
  return structuredClone({kind:fixture.kind,environment:fixture.environment,audience:fixture.audience,
    sessionId:fixture.sessionId,transportPrivateKey:fixture.transportPrivateKey,
    transportPublicKey:fixture.transportPublicKey,current:fixture.current});
}

export async function startSignedAuthority({app,fixture,tls,host='127.0.0.1',port=0,isolatedContainer=false}){
  assert.ok(host==='127.0.0.1'||(host==='0.0.0.0'&&isolatedContainer===true),'TEST_LISTENER_BOUNDARY_REQUIRED');
  assert.ok(Number.isInteger(port)&&port>=0&&port<=65535);
  const state=authorityOnly(fixture);
  const {syntheticCurrentAuthorityProvider}=await import(pathToFileURL(join(app,'integrations/cai/synthetic-current-authority.ts')).href);
  let mode='healthy',advanced=false,stopped=false;
  const metrics={currentRequests:0,signedResponses:0,refusedResponses:0,handlerErrors:0,uniqueNonces:0};
  const seen=new Set();
  const provider=syntheticCurrentAuthorityProvider({environment:'SIMULATION_ONLY',audience:state.audience,
    privateKey:createPrivateKey(state.transportPrivateKey),now:()=>Date.now()-(mode==='expired'?60_000:0),
    snapshot:id=>{
      if(id!==state.sessionId)return null;
      const snapshot=structuredClone(state.current);
      if(mode==='revoked')snapshot.registry.keys.forEach(key=>{if(key.role==='trustee')key.revoked=true;});
      return snapshot;
    }});
  const server=createServer({key:tls.key,cert:tls.cert},async(req,res)=>{
    res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
    const deny=(status)=>{metrics.refusedResponses++;res.statusCode=status;res.end('{"error":"SYNTHETIC_UNAVAILABLE"}');};
    if(req.method!=='POST'||req.url!=='/current'){req.resume();deny(404);return;}
    metrics.currentRequests++;
    if(stopped||mode==='unavailable'){req.resume();deny(503);return;}
    let timer;
    try{
      const read=async()=>{let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>4096)throw new Error('BODY_LIMIT');chunks.push(chunk);}return Buffer.concat(chunks);};
      const bytes=await Promise.race([read(),new Promise((_,reject)=>{timer=setTimeout(()=>{req.destroy();reject(new Error('BODY_DEADLINE'));},1000);})]);
      const json=JSON.parse(bytes.toString('utf8'));
      if(typeof json.nonce==='string'){seen.add(json.nonce);metrics.uniqueNonces=seen.size;}
      // Fixed in-memory URL is required by the existing fixture's local-only guard.
      // The actual caller-to-this-server transport is HTTPS with native verification.
      const reply=await provider.handle(new Request('http://127.0.0.1/current',{
        method:'POST',headers:{'content-type':req.headers['content-type']??''},body:bytes}));
      res.statusCode=reply.status;
      if(reply.status===200)metrics.signedResponses++;else metrics.refusedResponses++;
      res.end(await reply.text());
    }catch{metrics.handlerErrors++;if(!res.destroyed)deny(503);}
    finally{if(timer)clearTimeout(timer);}
  });
  server.requestTimeout=2000;server.headersTimeout=2000;server.keepAliveTimeout=100;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  const address=server.address();
  return {
    endpoint:`https://${host==='0.0.0.0'?'rehearsal-authority':'127.0.0.1'}:${address.port}/current`,
    publicKey:state.transportPublicKey,
    metrics:()=>({...metrics}),
    setMode(value){assert.ok(['healthy','revoked','expired','unavailable'].includes(value));assert.ok(!stopped);mode=value;},
    advanceFloor(){assert.ok(!advanced&&!stopped,'FLOOR_CAN_ONLY_ADVANCE_ONCE');advanced=true;state.current.anchor.sequence++;return state.current.anchor.sequence;},
    async stop(){stopped=true;provider.stop();server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));},
  };
}
