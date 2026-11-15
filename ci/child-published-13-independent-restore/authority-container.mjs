// Fixture-only process in the inspected internal Docker network, not product API.
import {readFile} from 'node:fs/promises';
import {startSignedAuthority} from './signed-current-authority.mjs';
import {startControl} from './authority-control.mjs';
let authority,control,stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await control?.stop();await authority?.stop();};
try{
  authority=await startSignedAuthority({app:'/candidate',fixture:JSON.parse(await readFile('/fixture/authority.json','utf8')),
    tls:{key:await readFile('/fixture/authority.key'),cert:await readFile('/fixture/authority.crt')},
    host:'0.0.0.0',port:8443,isolatedContainer:true});
  control=await startControl({path:'/tmp/authority-control.sock',authority});
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>stop().catch(()=>{process.exitCode=1;}));
}catch{await stop().catch(()=>{});process.stderr.write('SYNTHETIC_AUTHORITY_START_FAILED\n');process.exitCode=1;}
