import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import test from 'node:test';
import {syntheticCurrentAuthorityProvider} from '../../integrations/cai/synthetic-current-authority.js';
import {currentAuthorityClient,type CurrentAuthority} from '../../services/api/src/child-backend/current-authority.js';

test('synthetic provider and actual client exchange signed current state over a socket',async()=>{
 const root=generateKeyPairSync('ed25519'),sessionId=randomUUID(),audience='fixture-provider';
 const state:CurrentAuthority={anchor:{checkpointId:'fixture',sequence:1,digest:'a'.repeat(64),sessionId,keyRegistryVersion:'v1'},registry:{version:'v1',keys:['protection','trustee'].map((role,i)=>({keyId:`key-${i}`,role:role as 'protection'|'trustee',controlDomain:`domain-${i}`,independentOfOperator:true,revoked:false,publicKey:generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'}).toString(),validAfter:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString()}))}};
 let reads=0;
 const provider=syntheticCurrentAuthorityProvider({environment:'SIMULATION_ONLY',audience,privateKey:root.privateKey,snapshot:id=>{reads++;return id===sessionId?state:null;}});
 const server=createServer(async(req,res)=>{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const response=await provider.handle(new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:{'content-type':'application/json'},body:Buffer.concat(chunks)}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 const client=currentAuthorityClient({url:`http://127.0.0.1:${address.port}/current`,audience,publicKey:root.publicKey.export({format:'pem',type:'spki'}).toString()});
 const body={protocol:'CanopyProof-CurrentRestoreAuthority/1',environment:'SIMULATION_ONLY',audience,sessionId,nonce:randomBytes(32).toString('base64url')};
 const request=(value:unknown=body,url='http://127.0.0.1/current')=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
 try{
  assert.equal((await client(sessionId)).anchor.sequence,1);
  state.registry.keys[1].revoked=true;
  await assert.rejects(client(sessionId),/CURRENT_RESTORE_AUTHORITY_UNAVAILABLE/);
  state.registry.keys[1].revoked=false;state.anchor.sequence=2;
  assert.equal((await client(sessionId)).anchor.sequence,2);
  assert.equal((await provider.handle(request({...body,sessionId:randomUUID()}))).status,404);
  const before=reads;
  for(const value of [{...body,environment:'PRODUCTION'},{...body,audience:'wrong'},{...body,extra:true},{...body,nonce:'bad'}])assert.equal((await provider.handle(request(value))).status,400);
  assert.equal((await provider.handle(request(body,'https://example.org/current'))).status,404);
  assert.equal((await provider.handle(new Request('http://127.0.0.1/current'))).status,405);
  assert.equal((await provider.handle(request('x'.repeat(4097)))).status,503);
  assert.equal(reads,before,'invalid input never queries registry');
  state.anchor.sessionId=randomUUID();assert.equal((await provider.handle(request())).status,503);state.anchor.sessionId=sessionId;
  provider.stop();await assert.rejects(client(sessionId),/CURRENT_RESTORE_AUTHORITY_UNAVAILABLE/);
 }finally{provider.stop();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('provider bounds stalled input and observes shutdown before consulting state',async()=>{
 const root=generateKeyPairSync('ed25519');let reads=0,cancelled=false;
 const provider=syntheticCurrentAuthorityProvider({environment:'SIMULATION_ONLY',audience:'fixture',privateKey:root.privateKey,snapshot:()=>{reads++;throw new Error('private fixture detail');}});
 const stalled=new Request('http://127.0.0.1/current',{method:'POST',headers:{'content-type':'application/json'},body:new ReadableStream({cancel(){cancelled=true;}}),duplex:'half'} as RequestInit);
 const response=await provider.handle(stalled);
 assert.equal(response.status,503);assert.equal(cancelled,true);assert.equal(reads,0);
 const body=JSON.stringify({protocol:'CanopyProof-CurrentRestoreAuthority/1',environment:'SIMULATION_ONLY',audience:'fixture',nonce:randomBytes(32).toString('base64url'),sessionId:randomUUID()});
 const pending=new Request('http://127.0.0.1/current',{method:'POST',headers:{'content-type':'application/json'},body});
 const inFlight=provider.handle(pending);provider.stop();
 assert.equal((await inFlight).status,503);assert.equal(reads,0);
});
