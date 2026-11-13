"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { composeInquiry, validateInquiry, type Inquiry } from "@/data/life/inquiry";
import styles from "./LeadForm.module.css";
type ReceivePolicy = { mode: "receive"; policyVersion: string; retentionDays: number; controller: string; backupNoticeZh: string; backupNoticeEn: string };
type Receipt = { receiptId: string; withdrawalToken: string; expiresAt: string };
const empty: Inquiry = { name: "", organization: "", channel: "email", contact: "", type: "space", message: "", consent: false };
function receivePolicy(result:unknown):ReceivePolicy|null {
  if(result && typeof result==="object" && "mode" in result && result.mode==="receive" && "policyVersion" in result && typeof result.policyVersion==="string" && "retentionDays" in result && typeof result.retentionDays==="number" && Number.isInteger(result.retentionDays) && result.retentionDays>=1 && result.retentionDays<=30 && "controller" in result && typeof result.controller==="string" && "backupNoticeZh" in result && typeof result.backupNoticeZh==="string" && "backupNoticeEn" in result && typeof result.backupNoticeEn==="string")return result as ReceivePolicy;
  return null;
}
export function LeadForm({ locale }: { locale: "zh" | "en" }) {
  const [value,setValue]=useState<Inquiry>({...empty});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [draft,setDraft]=useState("");
  const [notice,setNotice]=useState("");
  const [policy,setPolicy]=useState<ReceivePolicy | null>(null);
  const [recheck,setRecheck]=useState(false);
  const [sending,setSending]=useState(false);
  const [website,setWebsite]=useState("");
  const [sendConsent,setSendConsent]=useState(false);
  const [receipt,setReceipt]=useState<Receipt | null>(null);
  const [sendAttempted,setSendAttempted]=useState(false);
  // Keep only unresolved request identifiers in this page's memory. A receipt for
  // a later edited enquiry cannot establish what happened to an earlier attempt.
  const [unknownRequestKeys,setUnknownRequestKeys]=useState<Set<string>>(()=>new Set());
  const receiptUnknown=unknownRequestKeys.size>0;
  const idempotencyKey=useRef<string | null>(null);
  useEffect(()=>{const controller=new AbortController();fetch("/life/inquiries",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():null).then((result:unknown)=>setPolicy(receivePolicy(result))).catch(()=>undefined);return()=>controller.abort();},[]);
  const t=(zh:string,en:string)=>locale==="zh"?zh:en;
  const labels: Record<string,string>={name:t("你的称呼（必填）","Your name (required)"),organization:t("学校、机构或公司（可选）","School, organization or company (optional)"),contact:t("联系方式（必填）","Contact detail (required)"),message:t("你想解决的问题（10–1200字）","What would you like to solve? (10–1200 characters)")};
  const update=<K extends keyof Inquiry>(key:K,newValue:Inquiry[K])=>{setValue({...value,[key]:newValue});setDraft("");setNotice("");setSendConsent(false);idempotencyKey.current=null;};
  const draftActionNotice=(action:string)=>`${action} ${receiptUnknown?t("此前发送尝试的收件状态仍未知；草稿操作不会重新发送或撤销该请求。","Receipt for the earlier sending attempt remains unknown; draft actions do not resend or cancel that request."):t("此草稿操作不会发送，也不会改变此前的提交状态。","This draft action sends nothing and does not change earlier submissions.")}`;
  function generate(event:FormEvent<HTMLFormElement>){event.preventDefault();const next=validateInquiry(value);setErrors(next);setNotice("");if(Object.keys(next).length){setDraft("");requestAnimationFrame(()=>document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());return;}setDraft(composeInquiry(value,locale,sendAttempted));setNotice(sendAttempted?draftActionNotice(t("咨询草稿已生成。","Enquiry draft ready.")):t("咨询草稿已生成，尚未发送。","Enquiry draft ready — not sent."));}
  async function copy(){try{await navigator.clipboard.writeText(draft);setNotice(sendAttempted?draftActionNotice(t("草稿已复制。","Draft copied.")):t("已复制，尚未发送；请通过您已核实的合作渠道自行发送。","Copied, not sent. Send it yourself through a partnership channel you have verified."));}catch{setNotice(sendAttempted?draftActionNotice(t("未能自动复制，请手动选择下方文本。","Clipboard unavailable. Select the draft below to copy manually.")):t("未能自动复制，请手动选择下方文本。尚未发送。","Clipboard unavailable. Select the draft below to copy manually. Not sent."));}}
  async function checkReceiving(){
    if(sending || receipt)return;setSending(true);setSendConsent(false);
    try{const response=await fetch("/life/inquiries",{cache:"no-store"});const next=receivePolicy(response.ok?await response.json():null);setPolicy(next);setRecheck(!next);setNotice(next?t("发送功能已恢复。请重新阅读说明并确认；原咨询信息已保留，尚未再次发送。","Sending is available again. Review the terms and confirm before sending. Your original enquiry is retained and has not been resubmitted."):t("发送暂时不可用。草稿和重试信息已保留，请留在本页稍后重试。","Sending is still unavailable. Your draft and retry details are retained. Stay on this page and try again later."));}catch{setNotice(t("暂时无法确认发送功能是否可用。草稿已保留，尚未再次发送。","We could not check whether sending is available. Your draft is retained and nothing has been resubmitted."));}finally{setSending(false);}
  }
  async function send(){
    if(!policy || !sendConsent || sending || receipt)return;
    const next=validateInquiry(value);setErrors(next);if(Object.keys(next).length)return;
    setSending(true);setNotice("");setSendAttempted(true);if(draft)setDraft(composeInquiry(value,locale,true));
    try{
      idempotencyKey.current ??= crypto.randomUUID();
      const requestKey=idempotencyKey.current;
      setUnknownRequestKeys(previous=>new Set(previous).add(requestKey));
      const response=await fetch("/life/inquiries",{method:"POST",headers:{"content-type":"application/json","x-lifepp-inquiry":"1"},body:JSON.stringify({inquiry:value,idempotencyKey:requestKey,policyVersion:policy.policyVersion,sendConsent,website})});
      if(response.status===503 || response.status===409){setPolicy(null);setRecheck(true);setSendConsent(false);}
      const result:unknown=await response.json();
      if(response.ok && result && typeof result==="object" && "status" in result && result.status==="stored" && "receiptId" in result && typeof result.receiptId==="string" && "withdrawalToken" in result && typeof result.withdrawalToken==="string" && "expiresAt" in result && typeof result.expiresAt==="string"){
        setUnknownRequestKeys(previous=>{const remaining=new Set(previous);remaining.delete(requestKey);return remaining;});setReceipt({receiptId:result.receiptId,withdrawalToken:result.withdrawalToken,expiresAt:result.expiresAt});setDraft("");setNotice(t("本次咨询已保存，回执如下。这仅确认本次提交，不表示其他咨询的状态、工作人员已阅读或邮件已送达。","Your enquiry has been saved. The receipt below confirms this submission only. It does not confirm other submissions, staff review or email delivery."));
      }else{setNotice(response.status===429?t("提交过于频繁，请稍后重试；尚未确认收件。","Too many requests. Try later; receipt has not been confirmed."):t("暂时无法确认是否收到。请保留草稿，在本页重试同一份咨询可避免重复提交。","Receipt could not be confirmed. Keep your draft. Retrying the same enquiry on this page avoids duplicate submissions."));}
    }catch{setPolicy(null);setRecheck(true);setSendConsent(false);setNotice(t("连接中断，尚不确定是否收到。请保留草稿并重新检查发送状态；在本页重试会继续使用原咨询记录。","The connection was interrupted and receipt is unknown. Keep your draft and recheck availability. A retry on this page uses the same enquiry record."));}
    finally{setSending(false);}
  }
  async function withdraw(){
    if(!receipt || sending)return;setSending(true);
    try{const response=await fetch("/life/inquiries",{method:"DELETE",headers:{"content-type":"application/json","x-lifepp-inquiry":"1"},body:JSON.stringify({receiptId:receipt.receiptId,withdrawalToken:receipt.withdrawalToken})});const result:unknown=await response.json();if(response.ok && result && typeof result==="object" && "status" in result && result.status==="removed_from_primary_store"){setReceipt(null);setValue({...empty});setSendConsent(false);idempotencyKey.current=null;setNotice(t("此回执对应的咨询正文和联系方式已从当前系统删除。其他咨询不受影响；备份按下方保留说明处理。","The enquiry and contact details for this receipt have been removed from the active system. Other submissions are unchanged. Backups follow the retention notice below."));}else setNotice(t("暂时无法确认撤回结果。请保留回执和撤回码，稍后重试。","Withdrawal could not be confirmed. Keep your receipt and withdrawal code, then try again."));}catch{setNotice(t("撤回连接中断，删除状态未知。","Withdrawal connection interrupted; deletion status is unknown."));}finally{setSending(false);}
  }
  const field=(key:"name"|"organization"|"contact"|"message",limit:number)=> <label className={styles.field} key={key} htmlFor={`inquiry-${key}`}>{labels[key]}{key==="message"?<textarea id={`inquiry-${key}`} value={value[key]} disabled={sending || !!receipt} maxLength={limit} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined} onChange={e=>update(key,e.target.value)} />:<input id={`inquiry-${key}`} value={value[key]} disabled={sending || !!receipt} maxLength={limit} autoComplete="off" type={key==="contact"&&value.channel==="email"?"email":"text"} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined} onChange={e=>update(key,e.target.value)} />}{errors[key]&&<span className={styles.error} id={`error-${key}`}>{key==="message"?t("请填写10–1200字的简短需求。","Enter a request of 10–1200 characters."):t("请检查此字段及长度；邮箱需为有效格式。","Check this field and its length; use a valid email format if selected.")}</span>}</label>;
  return <form className={styles.form} onSubmit={generate} noValidate aria-label={t("合作咨询草稿","Partnership enquiry draft")}>
    <label className={styles.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></label>
    <p className={styles.status}>{policy ? t("可在本页发送咨询。请先阅读接收与保留说明；你也可以只生成和保存草稿。","You can send an enquiry here. Review the recipient and retention terms first, or simply create a draft for your own records.") : t("先整理你的合作需求。当前仅提供草稿；复制后可通过你已确认的联系渠道发送。","Prepare your enquiry here. This page currently creates a draft only. Copy it and send it through a contact channel you have verified.")}</p>
    {receiptUnknown&&<p className={styles.note} data-receipt-state="unknown">{t("此前发送尝试的收件状态尚未确认。生成、复制、编辑或清除本页草稿都不会撤销服务器上可能已有的记录；重新检查接收状态也不代表该次请求已送达或未送达。","Receipt for an earlier sending attempt has not been confirmed. Generating, copying, editing or clearing this page's draft does not remove any record that may already exist on the server. Rechecking availability does not establish whether that request arrived.")}</p>}
    <div className={styles.row}>{field("name",60)}{field("organization",100)}</div>
    <div className={styles.row}><label className={styles.field} htmlFor="inquiry-channel">{t("希望如何联系你","Preferred contact method")}<select id="inquiry-channel" value={value.channel} disabled={sending || !!receipt} onChange={e=>update("channel",e.target.value as Inquiry["channel"])}><option value="email">{t("电子邮箱","Email")}</option><option value="phone">{t("电话","Phone")}</option><option value="wechat">{t("微信","WeChat")}</option></select></label>{field("contact",160)}</div>
    <label className={styles.field} htmlFor="inquiry-type">{t("咨询主题","Enquiry topic")}<select id="inquiry-type" value={value.type} disabled={sending || !!receipt} onChange={e=>update("type",e.target.value as Inquiry["type"])}>{([["space","空间与商户","Spaces & merchants"],["agent","智能助手与边缘设备","AI assistance & edge devices"],["club","共学与活动","Learning & events"],["robot","机器人试点","Robot pilot"],["membership","会员意向","Membership interest"],["rights","权限、撤回与反馈","Permissions, withdrawal & feedback"]] as const).map(([v,zh,en])=><option key={v} value={v}>{t(zh,en)}</option>)}</select></label>
    {field("message",1200)}
    <p className={styles.note}>{t("只需提供项目概况。请勿填写儿童个人资料、证件号码、家庭住址、健康或支付信息。未发送的草稿仅保留在当前页面；刷新或清空会移除本页副本。复制或另行发送后，请自行妥善保管，并向收件方确认保留与撤回方式。","Share a project outline only. Do not include children’s personal details, identity numbers, home addresses, health or payment information. An unsent draft stays on this page; refreshing or clearing removes the local copy. Keep copied or separately sent information secure and check retention and withdrawal terms with the recipient.")}</p>
    <label className={styles.check}><input type="checkbox" checked={value.consent} disabled={sending || !!receipt} aria-invalid={!!errors.consent} aria-describedby={errors.consent?"error-consent":undefined} onChange={e=>update("consent",e.target.checked)} /><span>{t("我已阅读隐私说明，同意在本页生成咨询草稿。这不授权使用我的资料进行模型训练、导航或再分发。","I have read the privacy notice and agree to create an enquiry draft on this page. This does not authorize use of my information for model training, navigation or redistribution.")}</span></label>
    {errors.consent&&<p className={styles.error} id="error-consent">{t("请先阅读并确认隐私说明。","Read and confirm the privacy notice first.")}</p>}
    <div className={styles.actions}><button type="submit" disabled={sending || !!receipt}>{t("生成咨询草稿","Create enquiry draft")}</button><button type="button" disabled={sending} className={styles.secondary} onClick={()=>{setValue({...empty});setDraft("");setErrors({});setSendConsent(false);setWebsite("");setReceipt(null);idempotencyKey.current=null;setNotice(receipt?t("本页信息与回执已清除；服务器记录未因此删除，仍按公布的保留说明处理。","Page information and receipt cleared. This does not delete the server record; published retention terms still apply."):receiptUnknown?t("本页信息已清除。此前收件状态仍未知；这不会删除服务器上可能已有的记录。","Page information cleared. The earlier receipt remains unknown; this does not delete any record that may already exist on the server."):t("本页信息已清除。","Information cleared from this page."));}}>{t("清空本页","Clear this page")}</button></div>
    {recheck&&!policy&&<button type="button" disabled={sending} className={styles.secondary} onClick={()=>void checkReceiving()}>{t("检查发送状态","Check sending availability")}</button>}
    {policy&&<div className={styles.receiving}>
      <p>{t("接收与保留说明：","Receiving and retention notice: ")}{policy.controller} · {t("政策版本 ","Policy ")}{policy.policyVersion}</p>
      <p>{t(`咨询资料保留 ${policy.retentionDays} 天，系统每小时清理到期记录。停机可能延迟删除；若超过一小时无法确认清理状态，将暂停接收新咨询。提交后请以回执为准。`, `Enquiry details are retained for ${policy.retentionDays} days. Expired records are removed hourly. Outages may delay deletion; new submissions pause if cleanup cannot be confirmed for over an hour. Check for a receipt after sending.`)}</p>
      <p>{t("撤回会删除咨询正文和联系方式。系统仅保留不含正文和联系方式的防重复标记，直至原到期时间，防止旧提交被重复保存。","Withdrawal removes your enquiry and contact details. A duplicate-prevention marker, containing neither, remains until the original expiry so an old submission cannot recreate the record.")}</p>
      <p>{locale==="zh"?policy.backupNoticeZh:policy.backupNoticeEn}</p>
      {!receipt&&<><label className={styles.check}><input type="checkbox" checked={sendConsent} disabled={sending} onChange={event=>setSendConsent(event.target.checked)}/><span>{t("我同意将以上最少必要信息发送至所列接收方，并已阅读保留与撤回说明。这不是训练、导航或再分发许可。","I agree to send the minimum necessary information to the named recipient and have read the retention and withdrawal terms. This grants no training, navigation or redistribution permission.")}</span></label><button type="button" disabled={!sendConsent || sending} onClick={()=>void send()}>{sending?t("正在确认收件…","Confirming receipt…"):t("发送咨询","Send enquiry")}</button></>}
    </div>}
    {receipt&&<div className={styles.receiving}><strong>{t("咨询保存回执","Enquiry saved")}</strong><p>{receipt.receiptId}</p><p>{t("到期时间：","Expires: ")}{receipt.expiresAt}</p><label className={styles.field}>{t("撤回码（请保存，刷新后不再显示）","Withdrawal code (save it before refreshing)")}<input value={receipt.withdrawalToken} readOnly/></label><p>{t("你可以使用下方按钮撤回这份咨询。请保存回执编号和撤回码，不要公开分享。清空本页只会移除本页显示的信息，不会撤回已保存的咨询。","Use the button below to withdraw this enquiry. Save the receipt number and withdrawal code and keep them private. Clearing this page removes only the information displayed here; it does not withdraw the saved enquiry.")}</p><button type="button" disabled={sending} onClick={()=>void withdraw()}>{t("撤回这份咨询","Withdraw this enquiry")}</button></div>}
    <p role="status" aria-live="polite">{notice}</p>
    {draft&&<div className={styles.result}><label className={styles.field} htmlFor="inquiry-draft">{sendAttempted?t("本地草稿副本","Local draft copy"):t("尚未发送的草稿","Unsent draft")}<textarea id="inquiry-draft" className={styles.draft} value={draft} readOnly /></label><div><button type="button" onClick={copy}>{sendAttempted?t("复制草稿（不会发送）","Copy draft (does not send)"):t("复制草稿（尚未发送）","Copy draft (not sent)")}</button></div></div>}
  </form>;
}
