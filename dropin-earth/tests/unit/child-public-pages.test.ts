import test from 'node:test';
import assert from 'node:assert/strict';
import {GET, HEAD} from '../../apps/web/src/app/child-accounts/route.js';
import {GET as chinese} from '../../apps/web/src/app/zh/child-accounts/route.js';
import {GET as children} from '../../apps/web/src/app/children/route.js';
import {GET as chineseChildren} from '../../apps/web/src/app/zh/children/route.js';

test('public guide routes return fixed bilingual content with no collection or execution surface', async()=>{
  for(const get of [GET,chinese,children,chineseChildren]){
    const response=get(),html=await response.text();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    assert.match(response.headers.get('content-security-policy')!,/default-src 'none'/);
    assert.doesNotMatch(html,/<script|<form|<input|<iframe|<button/);
    assert.equal((html.match(/<h1>/g)??[]).length,1);
    assert.equal((html.match(/<details /g)??[]).length,4);
    assert.match(html,/https:\/\/ahin.io\/(zh\/)?child-accounts/);
    assert.match(html,/EXP/);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length);
    for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(anchor),`missing ${anchor}`);
    assert.equal((html.match(/class="entry-card"/g)??[]).length,3);
    assert.equal((html.match(/class="family-note"/g)??[]).length,2);
    assert.match(html,/<nav class="contents" aria-label=/);
  }
  assert.equal(await HEAD().text(),'');
});

