// Disposable HTTPS reachability fixture, NOT a guardian issuer or checkpoint service.
import {readFileSync} from 'node:fs';
import {createPublicKey,createPrivateKey} from 'node:crypto';
import {createServer} from 'node:https';
import process from 'node:process';
const credentials=JSON.parse(readFileSync('/fixture/credentials.json','utf8'));
// Actual configured Ed25519 material is checked, but no per-session assertion is minted.
const publicKey=createPublicKey(credentials.authorityPublicKey);
if(publicKey.asymmetricKeyType!=='ed25519')throw new Error('FIXTURE_KEY_INVALID');
if(credentials.authorityPrivateKey){
  const derived=createPublicKey(createPrivateKey(credentials.authorityPrivateKey)).export({type:'spki',format:'pem'});
  if(derived!==publicKey.export({type:'spki',format:'pem'}))throw new Error('FIXTURE_KEY_MISMATCH');
}
let currentRequests=0;
const server=createServer({key:readFileSync('/fixture/authority.key'),cert:readFileSync('/fixture/authority.crt')},(req,res)=>{
  res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
  if(req.method==='GET'&&req.url==='/health'){
    res.end(JSON.stringify({fixture:true,syntheticOnly:true,authorizationGranted:false,currentRequests}));return;
  }
  if(req.method==='POST'&&req.url==='/current')currentRequests++;
  req.resume();res.statusCode=503;res.end(JSON.stringify({error:'SYNTHETIC_SESSION_NOT_PROVISIONED',authorizationGranted:false}));
});
server.listen(8443,'0.0.0.0');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{process.exitCode=0;}));
