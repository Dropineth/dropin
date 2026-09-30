"use client";
import { useState, type FormEvent } from "react";
import { composeInquiry, validateInquiry, type Inquiry } from "@/data/life/inquiry";
import styles from "./LeadForm.module.css";
const empty: Inquiry = { name: "", organization: "", channel: "email", contact: "", type: "space", message: "", consent: false };
export function LeadForm({ locale }: { locale: "zh" | "en" }) {
  const [value,setValue]=useState<Inquiry>({...empty});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [draft,setDraft]=useState("");
  const [notice,setNotice]=useState("");
  const t=(zh:string,en:string)=>locale==="zh"?zh:en;
  const labels: Record<string,string>={name:t("联系人称呼（必填）","Your name (required)"),organization:t("机构（可选）","Organization (optional)"),contact:t("联系方式（必填，仅选择一种）","Contact detail (required, one channel only)"),message:t("简短需求（10–1200字）","Brief request (10–1200 characters)")};
  const update=<K extends keyof Inquiry>(key:K,newValue:Inquiry[K])=>{setValue({...value,[key]:newValue});setDraft("");setNotice("");};
  function generate(event:FormEvent<HTMLFormElement>){event.preventDefault();const next=validateInquiry(value);setErrors(next);setNotice("");if(Object.keys(next).length){setDraft("");requestAnimationFrame(()=>document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());return;}setDraft(composeInquiry(value,locale));setNotice(t("询问内容已生成，尚未发送；本站尚未收件。","Inquiry drafted, not sent. This site has not received it."));}
  async function copy(){try{await navigator.clipboard.writeText(draft);setNotice(t("已复制，尚未发送；请通过您已核实的合作渠道自行发送。","Copied, not sent. Send it yourself through a partnership channel you have verified."));}catch{setNotice(t("未能自动复制，请手动选择下方文本。尚未发送。","Clipboard unavailable. Select the draft below to copy manually. Not sent."));}}
  const field=(key:"name"|"organization"|"contact"|"message",limit:number)=> <label className={styles.field} key={key} htmlFor={`inquiry-${key}`}>{labels[key]}{key==="message"?<textarea id={`inquiry-${key}`} value={value[key]} maxLength={limit} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined} onChange={e=>update(key,e.target.value)} />:<input id={`inquiry-${key}`} value={value[key]} maxLength={limit} autoComplete="off" type={key==="contact"&&value.channel==="email"?"email":"text"} aria-invalid={!!errors[key]} aria-describedby={errors[key]?`error-${key}`:undefined} onChange={e=>update(key,e.target.value)} />}{errors[key]&&<span className={styles.error} id={`error-${key}`}>{key==="message"?t("请填写10–1200字的简短需求。","Enter a request of 10–1200 characters."):t("请检查此字段及长度；邮箱需为有效格式。","Check this field and its length; use a valid email format if selected.")}</span>}</label>;
  return <form className={styles.form} onSubmit={generate} noValidate aria-label={t("合作询问草稿","Partnership inquiry draft")}>
    <p className={styles.status}>{t("先整理您的合作想法。此工具只在当前页面生成草稿，没有接通收件后台，不会自动发送。","Organize your partnership idea. This tool creates a draft in this page only. No receiving backend is connected and nothing is sent automatically.")}</p>
    <div className={styles.row}>{field("name",60)}{field("organization",100)}</div>
    <div className={styles.row}><label className={styles.field} htmlFor="inquiry-channel">{t("选择联系渠道","Choose a contact channel")}<select id="inquiry-channel" value={value.channel} onChange={e=>update("channel",e.target.value as Inquiry["channel"])}><option value="email">{t("电子邮箱","Email")}</option><option value="phone">{t("电话","Phone")}</option><option value="wechat">{t("微信","WeChat")}</option></select></label>{field("contact",160)}</div>
    <label className={styles.field} htmlFor="inquiry-type">{t("合作类型","Partnership interest")}<select id="inquiry-type" value={value.type} onChange={e=>update("type",e.target.value as Inquiry["type"])}>{([["space","空间与商户","Spaces & merchants"],["agent","数字分身与Edge","Agents & edge"],["club","共学与活动","Learning & events"],["robot","机器人试点","Robot pilot"],["membership","会员意向","Membership interest"],["rights","权限、撤回与申诉","Rights, withdrawal & disputes"]] as const).map(([v,zh,en])=><option key={v} value={v}>{t(zh,en)}</option>)}</select></label>
    {field("message",1200)}
    <p className={styles.note}>{t("请勿输入身份证、住址、医疗或支付资料，也无需上传图纸或视频。草稿仅存在于当前页面内存；刷新或清除即可移除。复制后由您管理剪贴板。若自行向外部渠道发送，保留期限与撤回方式须向收件方确认。","Do not enter identity documents, home addresses, health or payment data. No drawings or videos are needed. The draft lives only in this page’s memory; refresh or clear to remove it. You control the clipboard after copying. If you send it externally, confirm retention and withdrawal terms with that recipient.")}</p>
    <label className={styles.check}><input type="checkbox" checked={value.consent} aria-invalid={!!errors.consent} aria-describedby={errors.consent?"error-consent":undefined} onChange={e=>update("consent",e.target.checked)} /><span>{t("我已阅读隐私说明，同意在当前页面整理这些信息；这不授予模型、视频或其他数据的训练、导航、再分发许可。","I have read the privacy notice and agree to compose this information in this page. This grants no training, navigation or redistribution permission for models, video or other data.")}</span></label>
    {errors.consent&&<p className={styles.error} id="error-consent">{t("请先阅读并确认隐私说明。","Read and confirm the privacy notice first.")}</p>}
    <div className={styles.actions}><button type="submit">{t("生成询问内容","Generate inquiry draft")}</button><button type="button" className={styles.secondary} onClick={()=>{setValue({...empty});setDraft("");setErrors({});setNotice(t("本页信息已清除。","Information cleared from this page."));}}>{t("清除本页信息","Clear this page")}</button></div>
    <p role="status" aria-live="polite">{notice}</p>
    {draft&&<div className={styles.result}><label className={styles.field} htmlFor="inquiry-draft">{t("尚未发送的草稿","Unsent draft")}<textarea id="inquiry-draft" className={styles.draft} value={draft} readOnly /></label><div><button type="button" onClick={copy}>{t("复制草稿（尚未发送）","Copy draft (not sent)")}</button></div></div>}
  </form>;
}
