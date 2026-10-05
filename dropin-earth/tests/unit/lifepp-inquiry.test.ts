import assert from "node:assert/strict";
import test from "node:test";
import { composeInquiry, validateInquiry, type Inquiry } from "../../apps/web/src/data/life/inquiry";
const valid: Inquiry = { name:"Test visitor", organization:"",channel:"email",contact:"visitor@example.invalid",type:"space",message:"A synthetic space enquiry for tests.",consent:true };
test("inquiry draft explicitly cannot represent delivery",()=>{
 assert.deepEqual(validateInquiry(valid),{});
 assert.match(composeInquiry(valid,"en"),/not sent/);
 assert.match(composeInquiry(valid,"zh"),/尚未发送/);
 assert.match(composeInquiry(valid,"en"),/grants no display/);
 assert.match(composeInquiry(valid,"en",true),/not a statement of earlier submission status/);
 assert.doesNotMatch(composeInquiry(valid,"en",true),/draft — not sent/);
 assert.match(composeInquiry(valid,"zh",true),/不代表此前提交状态/);
 assert.doesNotMatch(composeInquiry(valid,"zh",true),/尚未发送/);
});
test("invalid contact, channel, lengths and absent consent cannot produce draft",()=>{
 for(const input of [{...valid,consent:false},{...valid,contact:"bad"},{...valid,contact:"a@b.com\nBcc:x@y.com"},{...valid,message:"short"},{...valid,message:"x".repeat(1201)},{...valid,name:"x".repeat(61)},{...valid,organization:"x".repeat(101)},{...valid,channel:"unknown" as Inquiry["channel"]},{...valid,type:"billing" as Inquiry["type"]}])assert.throws(()=>composeInquiry(input,"en"));
});
test("one chosen contact channel and optional organization are sufficient",()=>{
 for(const channel of ["phone","wechat"] as const)assert.deepEqual(validateInquiry({...valid,channel,contact:"synthetic-contact"}),{});
});
