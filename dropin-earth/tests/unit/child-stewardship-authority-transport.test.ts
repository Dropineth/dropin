import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createServer} from 'node:http';
import test from 'node:test';
import {currentAuthorityClient} from '../../services/api/src/child-backend/current-authority.js';
import {backendConfig} from '../../services/api/src/child-backend/config.js';
import {stableJson} from '../../services/api/src/domain/child-stewardship/store.js';

test('actual loopback authority transport rechecks revocation and fails closed across service changes', {timeout:10_000}, async()=>{
 // Real sockets and Ed25519, but only synthetic authority. HTTP is a test seam;
 // production configuration must reject this URL and no fixture root is installed.
 const root=generateKeyPairSync('ed25519'),otherRoot=generateKeyPairSync('ed25519');
 const publicKey=root.publicKey.export({format:'pem',type:'spki'}).toString();
 const keys=['protection','trustee'].map((role,i)=>({keyId:`fixture-${i}`,role,controlDomain:`fixture-domain-${i}`,independentOfOperator:true,
  publicKey:generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'}).toString(),revoked:false,
  validAfter:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString()}));
 const sessionId=randomUUID(),audience='canopyproof:synthetic:socket-test';
 let mode:'valid'|'revoked'|'replay'|'wrong-root'|'redirect'|'oversize'='valid';
 let requests=0,saved='',redirectHits=0;
 const nonces=new Set<string>();
 const server=createServer(async(req,res)=>{
  if(req.url==='/redirect-target'){redirectHits++;res.writeHead(500).end();return;}
  requests++;
  let body='';for await(const chunk of req)body+=String(chunk);
  const request=JSON.parse(body);nonces.add(request.nonce);
  assert.equal(request.environment,'SIMULATION_ONLY');assert.equal(req.method,'POST');
  if(mode==='redirect'){res.writeHead(302,{location:'/redirect-target'}).end();return;}
  res.setHeader('content-type','application/json');
  if(mode==='oversize'){res.end('x'.repeat(65_537));return;}
  if(mode==='replay'){res.end(saved);return;}
  const issued=Date.now();const payload={...request,issuedAt:new Date(issued).toISOString(),expiresAt:new Date(issued+20_000).toISOString(),
   anchor:{sessionId,checkpointId:'fixture-checkpoint',sequence:1,digest:'a'.repeat(64),keyRegistryVersion:'fixture-v1'},
   registry:{version:'fixture-v1',keys:keys.map((key,i)=>({...key,revoked:mode==='revoked'&&i===1}))}};
  const response=JSON.stringify({payload,signature:sign(null,Buffer.from(stableJson(payload)),mode==='wrong-root'?otherRoot.privateKey:root.privateKey).toString('base64url')});
  if(mode==='valid')saved=response;
  // Multiple chunks exercise the real streaming reader, not injected fetch.
  res.write(response.slice(0,120));res.end(response.slice(120));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 const url=`http://127.0.0.1:${address.port}/current`;
 const client=currentAuthorityClient({url,publicKey,audience});
 const read=()=>client(sessionId);
 try{
  assert.throws(()=>backendConfig({CHILD_CURRENT_AUTHORITY_URL:url}),/CONFIGURATION_INVALID/);
  assert.equal((await read()).anchor.sessionId,sessionId);
  for(const next of ['revoked','replay','wrong-root','redirect','oversize'] as const){
   mode=next;const before=requests;
   await assert.rejects(read(),error=>error instanceof Error&&error.message==='CURRENT_RESTORE_AUTHORITY_UNAVAILABLE');
   assert.equal(requests,before+1,'one request and no retry');
  }
  assert.equal(redirectHits,0);assert.equal(nonces.size,requests);
  mode='valid';assert.equal((await currentAuthorityClient({url,publicKey,audience})(sessionId)).registry.keys.length,2,'new client still uses pinned root and fresh nonce');
 }finally{
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
 await assert.rejects(read(),/CURRENT_RESTORE_AUTHORITY_UNAVAILABLE/);
});
