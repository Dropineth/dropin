import {createConnection} from 'node:net';
import process from 'node:process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseCommand} from './authority-control.mjs';
const PATH='/tmp/authority-control.sock';
const counters=['currentRequests','signedResponses','refusedResponses','handlerErrors','uniqueNonces'];
export async function control(command){
  const bytes=Buffer.from(JSON.stringify({command}));parseCommand(bytes);
  return new Promise((resolve,reject)=>{
    const socket=createConnection({path:PATH});let done=false,size=0;const chunks=[];
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();if(error)reject(new Error('AUTHORITY_CONTROL_REJECTED'));else resolve(value);};
    const timer=setTimeout(()=>finish(true),1500);
    socket.on('connect',()=>socket.end(bytes));socket.on('error',()=>finish(true));
    socket.on('data',chunk=>{size+=chunk.length;if(size>1024)return finish(true);chunks.push(chunk);});
    socket.on('end',()=>{try{
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
      if(!value||value.ok!==true)throw new Error();
      const keys=Object.keys(value);
      if(command==='metrics'){
        if(keys.length!==2||!Object.hasOwn(value,'metrics')||!value.metrics||Object.keys(value.metrics).length!==5)throw new Error();
        for(const key of counters)if(!Number.isSafeInteger(value.metrics[key])||value.metrics[key]<0)throw new Error();
      }else if(command==='advance-floor'){if(keys.length!==2||!Number.isSafeInteger(value.sequence)||value.sequence<2)throw new Error();}
      else if(keys.length!==1)throw new Error();
      finish(false,value);
    }catch{finish(true);}});
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  (async()=>{if(process.argv.length!==3)throw new Error();process.stdout.write(JSON.stringify(await control(process.argv[2]))+'\n');})()
    .catch(()=>{process.stdout.write('{"ok":false}\n');process.exitCode=1;});
}
