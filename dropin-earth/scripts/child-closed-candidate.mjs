import {Buffer} from 'node:buffer';
import console from 'node:console';
import {constants} from 'node:fs';
import {open,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import process from 'node:process';
import {pathToFileURL,URL} from 'node:url';
import {sha256} from './lifepp-release-policy.mjs';

const commit = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const image = /^sha256:[a-f0-9]{64}$/;
const artifactNames = ['server.mjs','migrate.mjs'];
const invalid = () => { throw new Error('CLOSED_CANDIDATE_EVIDENCE_INVALID'); };
const requireValue = condition => { if (!condition) invalid(); };
function fields(value, names) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value));
  requireValue(Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value,name)));
}
function matches(value, pattern) { requireValue(typeof value === 'string' && pattern.test(value)); }
function parseJson(bytes) { try { return JSON.parse(bytes.toString('utf8')); } catch { return invalid(); } }
function reference(value) {
  fields(value,['sourceSha','imageId','buildManifestSha256']);
  matches(value.sourceSha,commit); matches(value.imageId,image); matches(value.buildManifestSha256,digest);
}

/** Checks only caller-supplied local evidence consistency. Never a cloud receipt,
 * clean-source attestation, approval, deployed-image verification or enrollment.
 * Artifact bytes are hashed, NEVER imported or executed. No credentials needed. */
export function validateClosedCandidate({selection,candidate,rollback,plan}) {
  fields(selection,['kind','candidate','rollback','boundary']);
  requireValue(selection.kind === 'CanopyProofClosedCandidate/1');
  reference(selection.candidate); reference(selection.rollback);
  for (const key of ['sourceSha','imageId','buildManifestSha256']) {
    requireValue(selection.candidate[key] !== selection.rollback[key]);
  }
  const boundary = selection.boundary;
  fields(boundary,['backendMode','proxyMode','gatewayMode','workersDev','previewUrls','publicRoutes','realEnrollment']);
  requireValue(boundary.backendMode === 'disabled' && boundary.proxyMode === 'disabled' && boundary.gatewayMode === 'disabled');
  requireValue(boundary.workersDev === false && boundary.previewUrls === false && boundary.realEnrollment === false);
  requireValue(Array.isArray(boundary.publicRoutes) && boundary.publicRoutes.length === 0);
  // Reuse the existing preparation/runtime pin. This file is not release approval.
  requireValue(plan?.kind === 'CanopyProofBackendPreparation' && plan.status === 'not-approved-for-resource-creation');
  requireValue(plan.api?.defaultAccountMode === 'disabled' && plan.api.automaticDeploy === false
    && plan.api.automaticPreviewResources === false && plan.api.migrationOnStartup === false);
  requireValue(plan.realChildren === false && plan.realPayments === false && plan.mainnet === false);
  const runtime = /^Docker \/ Node (\d+\.\d+\.\d+)$/.exec(plan.api.runtime ?? '');
  requireValue(runtime !== null);
  matches(plan.api.nodeImageDigest,new RegExp(`^docker\\.io/library/node:${runtime[1].replaceAll('.','\\.')}-bookworm-slim@sha256:[a-f0-9]{64}$`));

  function verify(ref, evidence) {
    fields(evidence,['manifestBytes','imageCheck','artifacts']);
    requireValue(Buffer.isBuffer(evidence.manifestBytes) && evidence.manifestBytes.length <= 65_536);
    requireValue(sha256(evidence.manifestBytes) === ref.buildManifestSha256);
    const manifest = parseJson(evidence.manifestBytes);
    fields(manifest,['sourceSha','workingTreeDirty','node','sourceFingerprint','artifacts','syntheticOnly','releaseApproval']);
    requireValue(manifest.sourceSha === ref.sourceSha && manifest.node === `v${runtime[1]}`);
    // Docker builds without Git report null. Preserve unknown, never upgrade it
    // to a clean-source receipt; known-dirty source is not a candidate.
    requireValue(manifest.workingTreeDirty === false || manifest.workingTreeDirty === null);
    matches(manifest.sourceFingerprint,digest);
    requireValue(manifest.syntheticOnly === true && manifest.releaseApproval === false);
    fields(manifest.artifacts,artifactNames); fields(evidence.artifacts,artifactNames);
    for (const name of artifactNames) {
      matches(manifest.artifacts[name],digest);
      requireValue(Buffer.isBuffer(evidence.artifacts[name]) && evidence.artifacts[name].length <= 32 * 1024 * 1024);
      requireValue(sha256(evidence.artifacts[name]) === manifest.artifacts[name]);
    }
    const receipt = evidence.imageCheck;
    fields(receipt,['sourceSha','baseImage','imageId','manifest','probe','exitCode','productionDeployed']);
    requireValue(receipt.sourceSha === ref.sourceSha && receipt.imageId === ref.imageId && receipt.baseImage === plan.api.nodeImageDigest);
    // Both are parsed JSON; compare canonical key order without accepting fields
    // that were not present in the separately hashed build manifest.
    requireValue(JSON.stringify(canonical(receipt.manifest)) === JSON.stringify(canonical(manifest)));
    fields(receipt.probe,['node','sourceSha','uid','accountEntry']);
    requireValue(receipt.probe.node === manifest.node && receipt.probe.sourceSha === ref.sourceSha);
    requireValue(Number.isSafeInteger(receipt.probe.uid) && receipt.probe.uid > 0 && receipt.probe.accountEntry === 'closed');
    requireValue(receipt.exitCode === 0 && receipt.productionDeployed === false);
    return {...ref,workingTreeDirty:manifest.workingTreeDirty};
  }
  return {
    kind:'CanopyProofClosedCandidateCheck/1',scope:'offline-evidence-consistency',
    candidate:verify(selection.candidate,candidate),rollback:verify(selection.rollback,rollback),
    localEvidenceConsistent:true,accountEntry:'closed',syntheticOnly:true,
    cleanSourceAttested:false,boundaryObserved:false,rollbackAvailabilityVerified:false,liveReceiptVerified:false,productionReady:false,
    releaseApproval:false,authorizationGranted:false,productionDeployed:false,
  };
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])]));
}

// Fixed filenames: no path/URL supplied in evidence is dereferenced. A bounded
// read also rejects a file that grows after stat; nothing is written or executed.
async function boundedRead(path, limit) {
  // Supplied directories are trusted operator paths; reject the final component
  // if it is a symlink, and do not wait on FIFOs before checking file type.
  requireValue(Number.isInteger(constants.O_NOFOLLOW) && Number.isInteger(constants.O_NONBLOCK));
  const file = await open(path,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat(); requireValue(stat.isFile() && stat.size <= limit);
    const bytes = Buffer.alloc(limit + 1); let size = 0;
    while (size <= limit) {
      const {bytesRead} = await file.read(bytes,size,limit + 1 - size,null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    requireValue(size <= limit); return bytes.subarray(0,size);
  } finally { await file.close(); }
}
async function loadEvidence(directory) {
  const artifacts = {};
  for (const name of artifactNames) artifacts[name] = await boundedRead(resolve(directory,name),32 * 1024 * 1024);
  return {manifestBytes:await boundedRead(resolve(directory,'build.json'),65_536),
    imageCheck:parseJson(await boundedRead(resolve(directory,'image-check.json'),65_536)),artifacts};
}
async function main() {
  try {
    requireValue(process.argv.length === 5);
    const selectionBytes = await boundedRead(resolve(process.argv[2]),65_536);
    const result = validateClosedCandidate({selection:parseJson(selectionBytes),
      candidate:await loadEvidence(resolve(process.argv[3])),rollback:await loadEvidence(resolve(process.argv[4])),
      plan:JSON.parse(await readFile(new URL('../infra/child-backend/deployment-plan.json',import.meta.url),'utf8'))});
    console.log(JSON.stringify({...result,selectionSha256:sha256(selectionBytes)}));
  } catch {
    // Never echo input, paths, parser errors or unexpected fields (possibly secrets).
    console.error(JSON.stringify({error:'CLOSED_CANDIDATE_EVIDENCE_INVALID',productionReady:false,releaseApproval:false,authorizationGranted:false,liveReceiptVerified:false}));
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
