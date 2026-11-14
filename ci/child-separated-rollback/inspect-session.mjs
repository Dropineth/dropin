// Hosted disposable-loopback fixture only. Never a production provisioner.
import {createHash,generateKeyPairSync,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {open,readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';

const database='rehearsal_session_test';
const fail=()=>{throw new Error('REHEARSAL_FIXTURE_FAILED');};
const check=value=>{if(!value)fail();};
const hash=value=>createHash('sha256').update(value).digest('hex');
export function localAdminUrl(value,confirmation){
  check(confirmation==='disposable-local-synthetic');
  const url=new URL(value);
  check(['postgres:','postgresql:'].includes(url.protocol));
  check(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  check(/^\/[a-zA-Z0-9_]*test[a-zA-Z0-9_]*$/.test(url.pathname));
  check(url.username && url.password && !url.search && !url.hash);
  return url;
}
async function writePrivate(path,value){
  // Fail on existing output, including symlinks. Never chmod/reuse someone else's file.
  const handle=await open(path,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await handle.close();}
}
async function candidateRoot(input){
  const root=resolve(input);
  const nested=join(root,'dropin-earth');
  return await stat(join(root,'services/api/src/child-backend/migrations.ts')).then(()=>root).catch(async()=>{
    check((await stat(join(nested,'services/api/src/child-backend/migrations.ts'))).isFile());return nested;
  });
}
const imports=async(root,path)=>import(pathToFileURL(join(root,path)).href);
const poolOptions=connectionString=>({connectionString,max:2,connectionTimeoutMillis:5000,statement_timeout:30_000,ssl:false});
function fixturePool(pg,url){
  const pool=new pg.Pool(poolOptions(url));
  // Idle-socket error events must not bypass the CLI's sanitized error boundary.
  pool.on('error',()=>{process.stderr.write('REHEARSAL_FIXTURE_FAILED\n');process.exitCode=1;});
  return pool;
}

async function snapshot(root,adminUrl,output,db=database){
  const pg=createRequire(join(root,'services/api/package.json'))('pg');
  const target=new URL(adminUrl);target.pathname=`/${db}`;
  const pool=fixturePool(pg,target.toString());
  const client=await pool.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL timezone='UTC'; SET LOCAL search_path=pg_catalog");
    const schemas=['child_stewardship','child_stewardship_webauthn','child_stewardship_guardian','child_backend_migrations','rehearsal_fixture'];
    const tables=(await client.query("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind='r' ORDER BY 1,2",[schemas])).rows;
    check(tables.some(t=>t.schema==='child_stewardship'&&t.name==='sessions'));
    const quote=name=>'"'+name.replaceAll('"','""')+'"';
    const tableDigests=[];
    for(const table of tables){
      const name=`${quote(table.schema)}.${quote(table.name)}`;
      // JSONB has stable key order; sort rows inside SQL. Only counts/hashes escape.
      const result=(await client.query(`SELECT count(*)::text AS count,coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text AS data FROM ${name} t`)).rows[0];
      tableDigests.push({table:`${table.schema}.${table.name}`,count:Number(result.count),sha256:hash(result.data)});
    }
    const columns=(await client.query(`SELECT n.nspname,c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
      pg_get_expr(d.adbin,d.adrelid) AS default_expr,c.relrowsecurity,c.relforcerowsecurity
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname=ANY($1) AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,3`,[schemas])).rows;
    const constraints=(await client.query(`SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) ORDER BY 1,2,3`,[schemas])).rows;
    const functions=(await client.query(`SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=ANY($1) AND p.prokind IN('f','p') ORDER BY 1,2,3`,[schemas])).rows;
    const policies=(await client.query('SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname=ANY($1) ORDER BY 1,2,3',[schemas])).rows;
    const schemaSha256=hash(JSON.stringify({columns,constraints,functions,policies}));
    // Additional diagnostics only. Do not normalize or change the strict schema digest.
    const identities={
      columns:r=>[r.nspname,r.relname,r.attname],
      constraints:r=>[r.nspname,r.relname,r.conname],
      functions:r=>[r.nspname,r.proname,hash(r.arguments)],
      policies:r=>[r.schemaname,r.tablename,r.policyname]
    };
    const schemaObjects=Object.fromEntries(Object.entries({columns,constraints,functions,policies}).map(([kind,rows])=>
      [kind, rows.map(r=>({identity:identities[kind](r).join('.'),sha256:hash(JSON.stringify(r))}))]));

    await client.query('COMMIT');
    await writePrivate(output,{kind:'DisposableChildRehearsalSnapshot/1',syntheticOnly:true,
      schemaScope:'table-columns-constraints-functions-rls-policies',schemaSha256,schemaObjects,
      dataSha256:hash(JSON.stringify(tableDigests)),tables:tableDigests,
      perSessionAuth:'NOT_RUN',productionReady:false,releaseApproval:false});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();await pool.end();}
}

async function tls(root,adminUrl,credentialsPath,output){
  const credentials=JSON.parse(await readFile(credentialsPath,'utf8'));
  check(credentials.kind==='SyntheticOciSessionFixture/1');
  check(/^oci_runtime_[a-f0-9]{24}$/.test(credentials.runtimeRole));
  const pg=createRequire(join(root,'services/api/package.json'))('pg');
  const target=new URL(adminUrl);target.pathname=`/${database}`;
  const pool=fixturePool(pg,target.toString());
  try{
    const rows=(await pool.query(`SELECT s.ssl,s.version,s.cipher,s.bits
      FROM pg_stat_activity a JOIN pg_stat_ssl s ON s.pid=a.pid
      WHERE a.datname=$1 AND a.usename=$2 AND a.application_name='canopyproof-child-backend'
      ORDER BY s.ssl,s.version,s.cipher,s.bits`,[database,credentials.runtimeRole])).rows;
    check(rows.length>0 && rows.every(row=>row.ssl===true));
    await writePrivate(output,{kind:'DisposableChildRehearsalTls/1',source:'pg_stat_activity-join-pg_stat_ssl',
      connectionCount:rows.length,allSsl:true,connections:rows,syntheticOnly:true,
      perSessionAuth:'NOT_RUN',productionReady:false,releaseApproval:false});
  }finally{await pool.end();}
}

export async function main(argv=process.argv.slice(2),env=process.env){
  check((argv.length===3 && ['snapshot','snapshot-restored'].includes(argv[0])) || (argv.length===4 && argv[0]==='tls'));
  const adminUrl=localAdminUrl(env.REHEARSAL_DATABASE_URL,env.REHEARSAL_CONFIRM);
  const root=await candidateRoot(argv[1]);
  const output=resolve(argv.at(-1));
  // Output must not overwrite anything; prepare is intentionally one-shot.
  check(!(await stat(output).then(()=>true).catch(()=>false)));
  if(argv[0]==='tls')await tls(root,adminUrl,resolve(argv[2]),output);
  else await snapshot(root,adminUrl,output,argv[0]==='snapshot-restored'?'rehearsal_separate_test':database);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(()=>{process.stderr.write('REHEARSAL_FIXTURE_FAILED\n');process.exitCode=1;});
}
