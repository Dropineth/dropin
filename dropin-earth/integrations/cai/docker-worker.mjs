/* global AbortController */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout, clearTimeout } from 'node:timers';
const exec = promisify(execFile);
export const WORKER_IMAGE = 'node:22.23.5-alpine3.24@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a';
async function removeContainer(name) {
  try {await exec('docker',['rm','--force',name],{timeout:10000,maxBuffer:4096});}
  catch {throw Object.assign(new Error('WORKER_CLEANUP_FAILED'),{code:'WORKER_CLEANUP_FAILED'});}
}
// No host mounts, docker socket, environment forwarding, ports or network.
export async function runIsolatedWorker(message, {signal, timeoutMs=3000, started=()=>{}} = {}) {
  const name = `cai-synthetic-${randomUUID()}`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once:true});
  if (signal?.aborted) abort();
  let createAttempted = false;
  let timer;
  try {
    if (controller.signal.aborted) throw new Error('WORKER_CANCELLED');
    const source = await readFile(new URL('./synthetic-worker.mjs', import.meta.url),'utf8');
    // Image must already exist. Never pull implicitly or use a mutable tag.
    await exec('docker',['image','inspect',WORKER_IMAGE],{timeout:5000,maxBuffer:65536});
    createAttempted = true;
    await exec('docker',['create','--pull=never','--name',name,'--label=io.canopyproof.cai=synthetic','--network=none','--read-only',
      '--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534',
      '--pids-limit=32','--memory=96m','--cpus=0.5','--stop-timeout=1','-i',
      WORKER_IMAGE,'node','--input-type=module','-e',source],{timeout:10000,maxBuffer:4096});
    if (controller.signal.aborted) throw new Error('WORKER_CANCELLED');
    const output = await new Promise((resolve,reject) => {
      let stdout = '', stderr = '';
      const child = spawn('docker',['start','--attach','--interactive',name],{stdio:['pipe','pipe','pipe'],signal:controller.signal});
      timer = setTimeout(abort,timeoutMs);
      child.once('spawn', () => started(name));
      child.once('error',reject);
      child.stdin.on('error',()=>{});
      child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>4096)abort();});
      child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>4096)abort();});
      child.once('close',code=>code===0 ? resolve(stdout) : reject(new Error('WORKER_FAILED')));
      child.stdin.end(JSON.stringify(message));
    });
    return JSON.parse(output);
  } finally {
    if(timer)clearTimeout(timer);
    signal?.removeEventListener('abort',abort);
    // Wait for container deletion, including cancellation while starting. A
    // cleanup failure is surfaced, never reported as successful shutdown.
    if(createAttempted)await removeContainer(name);
  }
}
