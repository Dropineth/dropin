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
  const idempotencyKey=useRef<string | null>(null);
  useEffect(()=>{const controller=new AbortController();fetch("/life/inquiries",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():null).then((result:unknown)=>setPolicy(receivePolicy(result))).catch(()=>undefined);return()=>controller.abort();},[]);
  const t=(zh:string,en:string)=>locale==="zh"?zh:en;
  const labels: Record<string,string>={name:t("联系人称呼（必填）","Your name (required)"),organization:t("机构（可选）","Organization (optional)"),contact:t("联系方式（必填，仅选择一种）","Contact detail (required, one channel only)"),message:t("简短需求（10–1200字）","Brief request (10–1200 characters)")};
  const update=<K extends keyof Inquiry>(key:K,newValue:Inquiry[K])=>{setValue({...value,[key]:newValue});setDraft("");setNotice("");setSendConsent(false);idempotencyKey.current=null;};
  function generate(event:FormEvent<HTMLFormElement>){event.preventDefault();const next=validateInquiry(value);setErrors(next);setNotice("");if(Object.keys(next).length){setDraft("");requestAnimationFrame(()=>document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());return;}setDraft(composeInquiry(value,locale));setNotice(t("询问内容已生成，尚未发送；本站尚未收件。","Inquiry drafted, not sent. This site has not received it."));}
  async function copy(){try{await navigator.clipboard.writeText(draft);setNotice(t("已复制，尚未发送；请通过您已核实的合作渠道自行发送。","Copied, not sent. Send it yourself through a partnership channel you have verified."));}catch{setNotice(t("未能自动复制，请手动选择下方文本。尚未发送。","Clipboard unavailable. Select the draft below to copy manually. Not sent."));}}
  async function checkReceiving(){
    if(sending || receipt)return;setSending(true);setSendConsent(false);
    try{const response=await fetch("/life/inquiries",{cache:"no-store"});const next=receivePolicy(response.ok?await response.json():null);setPolicy(next);setRecheck(!next);setNotice(next?t("接收状态已重新确认。请重新阅读发送说明并确认；原请求标识已保留，尚未再次发送。","Receiving status rechecked. Review and confirm the sending terms again; the original request identifier is retained and nothing was resubmitted."):t("接收仍不可用。草稿与原请求标识保留在当前页面，请勿通过刷新来重试。","Receiving remains unavailable. The draft and original request identifier remain in this page; do not refresh to retry."));}catch{setNotice(t("未能检查接收状态。当前草稿与请求标识仍保留，尚未再次发送。","Could not check receiving status. The draft and request identifier are retained; nothing was resubmitted."));}finally{setSending(false);}
  }
  async function send(){
    if(!policy || !sendConsent || sending || receipt)return;
    const next=validateInquiry(value);setErrors(next);if(Object.keys(next).length)return;
    setSending(true);setNotice("");
    try{
      idempotencyKey.current ??= crypto.randomUUID();
      const response=await fetch("/life/inquiries",{method:"POST",headers:{"content-type":"application/json","x-lifepp-inquiry":"1"},body:JSON.stringify({inquiry:value,idempotencyKey:idempotencyKey.current,policyVersion:policy.policyVersion,sendConsent,website})});
      if(response.status===503 || response.status===409){setPolicy(null);setRecheck(true);setSendConsent(false);}
      const result:unknown=await response.json();
      if(response.ok && result && typeof result==="object" && "status" in result && result.status==="stored" && "receiptId" in result && typeof result.receiptId==="string" && "withdrawalToken" in result && typeof result.withdrawalToken==="string" && "expiresAt" in result && typeof result.expiresAt==="string"){
        setReceipt({receiptId:result.receiptId,withdrawalToken:result.withdrawalToken,expiresAt:result.expiresAt});setDraft("");setNotice(t("咨询已写入接收存储并完成回读。此回执不表示工作人员已阅读或邮件已送达。","Your enquiry was persisted and read back from the receiving store. This receipt does not mean staff have read it or an email was delivered."));
      }else{setNotice(response.status===429?t("提交过于频繁，请稍后重试；尚未确认收件。","Too many requests. Try later; receipt has not been confirmed."):t("未能确认收件。请保留草稿，勿假定已送达；可用同一请求重试以防重复。","Receipt could not be confirmed. Keep the draft and do not assume delivery; retrying the same request prevents duplicates."));}
    }catch{setPolicy(null);setRecheck(true);setSendConsent(false);setNotice(t("连接中断，收件状态未知。请保留草稿并重新检查接收状态；重试将使用同一请求标识。","Connection interrupted; receipt is unknown. Keep the draft and recheck receiving status; retrying uses the same request identifier."));}
    finally{setSending(false);}
  }
  async function withdraw(){
    if(!receipt || sending)return;setSending(true);
    try{const response=await fetch("/life/inquiries",{method:"DELETE",headers:{"content-type":"application/json","x-lifepp-inquiry":"1"},body:JSON.stringify({receiptId:receipt.receiptId,withdrawalToken:receipt.withdrawalToken})});const result:unknown=await response.json();if(response.ok && result && typeof result==="object" && "status" in result && result.status==="removed_from_primary_store"){setReceipt(null);setValue({...empty});setSendConsent(false);idempotencyKey.current=null;setNotice(t("已确认从主存储移除。备份按下方已公布的保留说明处理。","Removal from the primary store is confirmed. Backups follow the published retention notice below."));}else setNotice(t("未能确认撤回，请保留回执与撤回凭据后重试。","Withdrawal could not be confirmed. Keep the receipt and withdrawal credential to retry."));}catch{setNotice(t("撤回连接中断，删除状态未知。","Withdrawal connection interrupted; deletion status is unknown."));}finally{setSending(false);}
  }
  const field=(key:"name"|"organization"|"contact"|"message",limit:number)=> <label className={styles.field} key={key} htmlFor={`inquiry-${key}`}>{labels[key]}{key==="message"?<textarea id={`inquiry-${key}`} value={value[key]} disabled={sending || !!receipt} maxLength={limit} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined} onChange={e=>update(key,e.target.value)} />:<input id={`inquiry-${key}`} value={value[key]} disabled={sending || !!receipt} maxLength={limit} autoComplete="off" type={key==="contact"&&value.channel==="email"?"email":"text"} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined} onChange={e=>update(key,e.target.value)} />}{errors[key]&&<span className={styles.error} id={`error-${key}`}>{key==="message"?t("请填写10–1200字的简短需求。","Enter a request of 10–1200 characters."):t("请检查此字段及长度；邮箱需为有效格式。","Check this field and its length; use a valid email format if selected.")}</span>}</label>;
  return <form className={styles.form} onSubmit={generate} noValidate aria-label={t("合作询问草稿","Partnership inquiry draft")}>
    <label className={styles.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></label>
    <p className={styles.status}>{policy ? t("接收通道已通过服务器配置与清理状态检查。您仍可只生成草稿；只有另行勾选并点击发送才会提交。","The receiving channel passed server configuration and cleanup checks. You can still draft only; submission requires separate consent and an explicit send action.") : t("先整理您的合作想法。此工具只在当前页面生成草稿，没有接通收件后台，不会自动发送。","Organize your partnership idea. This tool creates a draft in this page only. No receiving backend is connected and nothing is sent automatically.")}</p>
    <div className={styles.row}>{field("name",60)}{field("organization",100)}</div>
    <div className={styles.row}><label className={styles.field} htmlFor="inquiry-channel">{t("选择联系渠道","Choose a contact channel")}<select id="inquiry-channel" value={value.channel} disabled={sending || !!receipt} onChange={e=>update("channel",e.target.value as Inquiry["channel"])}><option value="email">{t("电子邮箱","Email")}</option><option value="phone">{t("电话","Phone")}</option><option value="wechat">{t("微信","WeChat")}</option></select></label>{field("contact",160)}</div>
    <label className={styles.field} htmlFor="inquiry-type">{t("合作类型","Partnership interest")}<select id="inquiry-type" value={value.type} disabled={sending || !!receipt} onChange={e=>update("type",e.target.value as Inquiry["type"])}>{([["space","空间与商户","Spaces & merchants"],["agent","数字分身与Edge","Agents & edge"],["club","共学与活动","Learning & events"],["robot","机器人试点","Robot pilot"],["membership","会员意向","Membership interest"],["rights","权限、撤回与申诉","Rights, withdrawal & disputes"]] as const).map(([v,zh,en])=><option key={v} value={v}>{t(zh,en)}</option>)}</select></label>
    {field("message",1200)}
    <p className={styles.note}>{t("请勿输入身份证、住址、医疗或支付资料，也无需上传图纸或视频。草稿仅存在于当前页面内存；刷新或清除即可移除。复制后由您管理剪贴板。若自行向外部渠道发送，保留期限与撤回方式须向收件方确认。","Do not enter identity documents, home addresses, health or payment data. No drawings or videos are needed. The draft lives only in this page’s memory; refresh or clear to remove it. You control the clipboard after copying. If you send it externally, confirm retention and withdrawal terms with that recipient.")}</p>
    <label className={styles.check}><input type="checkbox" checked={value.consent} disabled={sending || !!receipt} aria-invalid={!!errors.consent} aria-describedby={errors.consent?"error-consent":undefined} onChange={e=>update("consent",e.target.checked)} /><span>{t("我已阅读隐私说明，同意在当前页面整理这些信息；这不授予模型、视频或其他数据的训练、导航、再分发许可。","I have read the privacy notice and agree to compose this information in this page. This grants no training, navigation or redistribution permission for models, video or other data.")}</span></label>
    {errors.consent&&<p className={styles.error} id="error-consent">{t("请先阅读并确认隐私说明。","Read and confirm the privacy notice first.")}</p>}
    <div className={styles.actions}><button type="submit" disabled={sending || !!receipt}>{t("生成询问内容","Generate inquiry draft")}</button><button type="button" disabled={sending} className={styles.secondary} onClick={()=>{setValue({...empty});setDraft("");setErrors({});setSendConsent(false);setWebsite("");setReceipt(null);idempotencyKey.current=null;setNotice(receipt?t("本页信息与回执已清除；服务器记录未因此删除，仍按公布的保留说明处理。","Page information and receipt cleared. This does not delete the server record; published retention terms still apply."):t("本页信息已清除。","Information cleared from this page."));}}>{t("清除本页信息","Clear this page")}</button></div>
    {recheck&&!policy&&<button type="button" disabled={sending} className={styles.secondary} onClick={()=>void checkReceiving()}>{t("重新检查接收状态（不会发送）","Recheck receiving status (does not send)")}</button>}
    {policy&&<div className={styles.receiving}>
      <p>{t("接收与保留说明：","Receiving and retention notice: ")}{policy.controller} · {t("政策版本 ","Policy ")}{policy.policyVersion}</p>
      <p>{t(`主存储保留期限为 ${policy.retentionDays} 天，按小时清理到期记录。停机可能延迟删除；清理超过一小时未确认时停止新增收件。收件需以写入及回读完成为准。`, `Primary retention is ${policy.retentionDays} days, with hourly removal of expired records. Outages may delay deletion; new collection stops when cleanup is unconfirmed for over an hour. Receipt requires persistence and read-back.`)}</p>
      <p>{t("撤回会删除咨询正文和联系方式；仅保留带密钥哈希的防重复标记至原到期时间，防止旧请求重试后重新写入。","Withdrawal removes the enquiry text and contact details. A keyed retry marker remains until the original expiry to prevent stale requests from recreating the enquiry.")}</p>
      <p>{locale==="zh"?policy.backupNoticeZh:policy.backupNoticeEn}</p>
      {!receipt&&<><label className={styles.check}><input type="checkbox" checked={sendConsent} disabled={sending} onChange={event=>setSendConsent(event.target.checked)}/><span>{t("我同意将以上最少必要信息发送至所列接收方，并已阅读保留与撤回说明。这不是训练、导航或再分发许可。","I agree to send the minimum necessary information to the named recipient and have read the retention and withdrawal terms. This grants no training, navigation or redistribution permission.")}</span></label><button type="button" disabled={!sendConsent || sending} onClick={()=>void send()}>{sending?t("正在确认收件…","Confirming receipt…"):t("发送咨询并获取存储回执","Send enquiry and obtain storage receipt")}</button></>}
    </div>}
    {receipt&&<div className={styles.receiving}><strong>{t("存储回执（不是邮件送达证明）","Storage receipt (not proof of email delivery)")}</strong><p>{receipt.receiptId}</p><p>{t("到期时间：","Expires: ")}{receipt.expiresAt}</p><label className={styles.field}>{t("撤回凭据，请自行保留；刷新后不再显示","Withdrawal credential: retain it yourself; it disappears on refresh")}<input value={receipt.withdrawalToken} readOnly/></label><p>{t("凭回执ID和撤回凭据可向本页同源接口提交撤回。清除本页信息不等于删除服务器记录。请勿公开分享凭据。","The receipt ID and withdrawal credential authorize removal through this page’s same-origin endpoint. Clearing this page does not delete the stored record. Keep the credential private.")}</p><button type="button" disabled={sending} onClick={()=>void withdraw()}>{t("撤回并删除主存储记录","Withdraw and delete the primary record")}</button></div>}
    <p role="status" aria-live="polite">{notice}</p>
    {draft&&<div className={styles.result}><label className={styles.field} htmlFor="inquiry-draft">{t("尚未发送的草稿","Unsent draft")}<textarea id="inquiry-draft" className={styles.draft} value={draft} readOnly /></label><div><button type="button" onClick={copy}>{t("复制草稿（尚未发送）","Copy draft (not sent)")}</button></div></div>}
  </form>;
}
