import process from 'node:process';
import console from 'node:console';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let workingTreeDirty=null;
try{workingTreeDirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());}catch{/* image build has no Git metadata; not an independent clean-source attestation */}
const output=resolve(root,'dist/child-backend');
const sha=process.env.CHILD_BUILD_SHA??execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(sha)||process.version!=='v22.23.4')throw new Error('PINNED_BUILD_CONTEXT_REQUIRED');
await mkdir(resolve(output,'migrations'),{recursive:true});
const result=await build({absWorkingDir:root,entryPoints:{server:'services/api/src/child-backend/server.ts',migrate:'services/api/src/child-backend/migrate-cli.ts'},outdir:output,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',target:'node22',format:'esm',metafile:true,external:['pg-native'],banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"}});
const {childMigrationFiles}=await import('../services/api/src/child-backend/migrations.ts');
const sourceFiles=[...Object.keys(result.metafile.inputs),'package-lock.json',...childMigrationFiles.map(name=>`services/api/prisma/${name}`)].sort();
const hashes=[];
for(const path of sourceFiles){hashes.push([path,createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')]);}
for(const name of childMigrationFiles)await copyFile(resolve(root,'services/api/prisma',name),resolve(output,'migrations',name));
const artifacts={};
for(const name of ['server.mjs','migrate.mjs'])artifacts[name]=createHash('sha256').update(await readFile(resolve(output,name))).digest('hex');
await writeFile(resolve(output,'build.json'),JSON.stringify({sourceSha:sha,workingTreeDirty,node:process.version,sourceFingerprint:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),artifacts,syntheticOnly:true,releaseApproval:false},null,2)+'\n');
console.log(JSON.stringify({sourceSha:sha,node:process.version,artifacts,releaseApproval:false}));
