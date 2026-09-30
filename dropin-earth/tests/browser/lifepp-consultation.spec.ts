/** LOCAL_SYNTHETIC UI fixture. Responses are mocked; this proves no real receipt. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright';

async function main() {
  const directory=await mkdtemp(join(tmpdir(),'lifepp-consultation-ui-'));
  let browser:Browser|undefined;
  let server:ReturnType<typeof createServer>|undefined;
  try {
    await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {LeadForm} from './apps/web/src/components/life/LeadForm'; createRoot(document.getElementById('root')).render(<LeadForm locale="en" />);`,resolveDir:process.cwd(),loader:'tsx'},outfile:join(directory,'fixture.js'),bundle:true,jsx:'automatic',platform:'browser',tsconfig:join(process.cwd(),'apps/web/tsconfig.json'),define:{'process.env.NODE_ENV':'"test"'}});
    const javascript=await readFile(join(directory,'fixture.js'));
    const css=await readFile(join(directory,'fixture.css'));
    server=createServer((request,response)=>{
      if(request.url==='/fixture.js'){response.setHeader('content-type','text/javascript');response.end(javascript);return;}
      if(request.url==='/fixture.css'){response.setHeader('content-type','text/css');response.end(css);return;}
      response.setHeader('content-type','text/html');
      response.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'");
      response.end('<!doctype html><html lang="en"><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    });
    await new Promise<void>(resolve=>server!.listen(0,'127.0.0.1',resolve));
    const address=server.address();assert.ok(address && typeof address==='object');
    const base=`http://127.0.0.1:${address.port}`;
    const installedChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath=process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE ?? (existsSync(installedChrome)?installedChrome:undefined);
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const context=await browser.newContext();
    const requests:{method:string;body:Record<string,unknown>|null}[]=[];
    let receiving=false;
    let failPost=true;
    const policy={mode:'receive',policyVersion:'LOCAL_SYNTHETIC-v1',retentionDays:2,controller:'LOCAL_SYNTHETIC recipient',backupNoticeZh:'本地合成测试，无生产声明。',backupNoticeEn:'LOCAL_SYNTHETIC only; no production retention claim.'};
    await context.route('**/*',async route=>{
      const request=route.request();
      if(request.url()===`${base}/life/inquiries`){
        requests.push({method:request.method(),body:request.postDataJSON() as Record<string,unknown>|null});
        if(request.method()==='GET'){await route.fulfill({json:receiving?policy:{mode:'draft'}});return;}
        assert.equal(request.method(),'POST','Fixture permits only the explicitly exercised synthetic method');
        if(failPost){await route.fulfill({status:503,json:{error:'unavailable'}});return;}
        await route.fulfill({status:200,json:{status:'stored',receiptId:'00000000-0000-4000-8000-000000000001',withdrawalToken:'a'.repeat(64),expiresAt:'2026-10-02T00:00:00.000Z',duplicate:true}});return;
      }
      if(new URL(request.url()).origin===base)await route.continue();
      else await route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(10_000);
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.getByRole('button',{name:'Send enquiry and obtain storage receipt'}).count(),0);
    assert.deepEqual(requests.map(request=>request.method),['GET'],'Default closure never posts');
    receiving=true;await page.reload({waitUntil:'networkidle'});
    await page.getByLabel('Your name (required)',{exact:true}).fill('LOCAL_SYNTHETIC visitor');
    await page.getByLabel('Contact detail (required, one channel only)',{exact:true}).fill('test@example.invalid');
    await page.getByLabel('Brief request (10–1200 characters)',{exact:true}).fill('LOCAL_SYNTHETIC consultation. No real recipient.');
    await page.getByRole('checkbox',{name:/I have read the privacy notice/}).check();
    await page.getByRole('checkbox',{name:/I agree to send the minimum necessary/}).check();
    await page.getByRole('button',{name:'Send enquiry and obtain storage receipt'}).click();
    const recheck=page.getByRole('button',{name:'Recheck receiving status (does not send)'});await recheck.waitFor();
    assert.equal(await page.getByRole('button',{name:'Send enquiry and obtain storage receipt'}).count(),0,'503 disables sending');
    const first=requests.find(request=>request.method==='POST')!.body!;
    assert.equal(first.sendConsent,true);assert.equal(first.policyVersion,policy.policyVersion);
    receiving=false;await recheck.click();
    await page.getByText(/Receiving remains unavailable/).waitFor();
    assert.equal(requests.filter(request=>request.method==='POST').length,1,'Rechecking unavailable status does not send');
    receiving=true;await recheck.click();
    const send=page.getByRole('button',{name:'Send enquiry and obtain storage receipt'});await send.waitFor();
    assert.equal(await send.isDisabled(),true,'Fresh explicit send consent is required');
    assert.equal(await page.getByLabel('Your name (required)',{exact:true}).inputValue(),'LOCAL_SYNTHETIC visitor','Draft survives status failure');
    failPost=false;await page.getByRole('checkbox',{name:/I agree to send the minimum necessary/}).check();await send.click();
    await page.getByText('Storage receipt (not proof of email delivery)',{exact:true}).waitFor();
    const posts=requests.filter(request=>request.method==='POST');assert.equal(posts.length,2);
    assert.equal(posts[1]!.body!.idempotencyKey,first.idempotencyKey,'503 recovery preserves the original dedupe key');
    assert.deepEqual(posts[1]!.body!.inquiry,first.inquiry);
    const report={evidenceClass:'LOCAL_SYNTHETIC_MOCK_UI',realInstitutionalReceipt:false,status:'PASS',browserVersion:browser.version(),checks:['default draft performs GET only','503 removes send action','status recheck never POSTs','draft and dedupe UUID survive status recheck','fresh consent required','receipt wording limits itself to storage'],syntheticPostCount:posts.length};
    if(process.env.LIFEPP_CONSULTATION_BROWSER_REPORT)await writeFile(process.env.LIFEPP_CONSULTATION_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally {await browser?.close();if(server)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));await rm(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
