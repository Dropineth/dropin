// Local disposable fixture control only. No HTTP routes and no TCP listener.
import {createServer} from 'node:net';
import {chmod,link,lstat,mkdtemp,rmdir,unlink} from 'node:fs/promises';
import {dirname,isAbsolute,join} from 'node:path';
const commands=new Set(['metrics','healthy','revoked','expired','unavailable','advance-floor']);
const counters=['currentRequests','signedResponses','refusedResponses','handlerErrors','uniqueNonces'];
const invalid=()=>{throw new Error('AUTHORITY_CONTROL_REJECTED');};
export function parseCommand(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length>1024)invalid();
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,'command')||!commands.has(value.command))invalid();
  return value.command;
}
function safeMetrics(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==counters.length)invalid();
  const output={};for(const key of counters){if(!Object.hasOwn(value,key)||!Number.isSafeInteger(value[key])||value[key]<0)invalid();output[key]=value[key];}return output;
}
export async function startControl({path,authority}){
  if(typeof path!=='string'||!isAbsolute(path)||!authority||!['setMode','advanceFloor','metrics'].every(key=>typeof authority[key]==='function'))invalid();
  try{await lstat(path);invalid();}catch(error){if(error.code!=='ENOENT')throw new Error('AUTHORITY_CONTROL_REJECTED');}
  let stopped=false,advanced=false,ownIdentity;
  // Node/libuv may unlink its listen path on close. Keep that private path
  // separate so closing cannot delete a replacement at the public control path.
  const privateDirectory=await mkdtemp(join(dirname(path),'.control-'));
  const listenPath=join(privateDirectory,'s');
  const connections=new Set();
  const server=createServer({allowHalfOpen:true},socket=>{
    connections.add(socket);let done=false,size=0;const chunks=[];
    const timer=setTimeout(()=>finish({ok:false}),1000);
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);socket.end(JSON.stringify(value)+'\n');socket.destroySoon();};
    socket.on('error',()=>{done=true;clearTimeout(timer);socket.destroy();});
    socket.on('close',()=>{clearTimeout(timer);connections.delete(socket);});
    socket.on('data',chunk=>{if(done)return;size+=chunk.length;if(size>1024){finish({ok:false});return;}chunks.push(chunk);});
    socket.on('end',async()=>{
      if(done)return;
      try{
        if(stopped)invalid();const command=parseCommand(Buffer.concat(chunks));
        if(command==='metrics')finish({ok:true,metrics:safeMetrics(await authority.metrics())});
        else if(command==='advance-floor'){
          if(advanced)invalid();advanced=true; // Never replay an uncertain side effect.
          const sequence=await authority.advanceFloor();if(!Number.isSafeInteger(sequence)||sequence<2)invalid();finish({ok:true,sequence});
        }else{await authority.setMode(command);finish({ok:true});}
      }catch{finish({ok:false});}
    });
  });
  // Do not surface raw event errors; startup failures reject with a fixed message.
  server.on('error',()=>{});
  async function removeOwn(){
    if(!ownIdentity)return;
    try{const current=await lstat(path);if(current.isSocket()&&current.ino===ownIdentity.ino&&current.dev===ownIdentity.dev)await unlink(path);}
    catch(error){if(error.code!=='ENOENT')throw new Error('AUTHORITY_CONTROL_REJECTED');}
  }
  try{
    await new Promise((resolve,reject)=>{const failed=()=>reject(new Error('AUTHORITY_CONTROL_REJECTED'));server.once('error',failed);server.listen(listenPath,()=>{server.off('error',failed);resolve();});});
    ownIdentity=await lstat(listenPath);if(!ownIdentity.isSocket())invalid();await chmod(listenPath,0o600);
    // Linux Unix sockets can be reached through an inode hard link. Atomic link
    // also refuses a path created concurrently after the initial lstat.
    await link(listenPath,path);
  }catch{for(const socket of connections)socket.destroy();if(server.listening)await new Promise(resolve=>server.close(resolve));await removeOwn();await rmdir(privateDirectory).catch(()=>{});throw new Error('AUTHORITY_CONTROL_REJECTED');}
  let closing;
  return {stop(){
    if(closing)return closing;stopped=true;for(const socket of connections)socket.destroy();
    closing=(async()=>{await new Promise(resolve=>server.close(resolve));await removeOwn();await rmdir(privateDirectory);})();return closing;
  }};
}
