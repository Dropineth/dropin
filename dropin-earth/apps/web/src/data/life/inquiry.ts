export type Inquiry = { name: string; organization: string; channel: "email" | "phone" | "wechat"; contact: string; type: "space" | "agent" | "club" | "robot" | "membership" | "rights"; message: string; consent: boolean };
export function validateInquiry(input: Inquiry): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.trim().length > 60) errors.name = "name";
  if (input.organization.length > 100) errors.organization = "organization";
  if (!["email", "phone", "wechat"].includes(input.channel)) errors.channel = "channel";
  if (!input.contact.trim() || input.contact.length > 160 || Array.from(input.contact).some(character => character.charCodeAt(0) < 32)) errors.contact = "contact";
  if (input.channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact)) errors.contact = "email";
  if (!["space", "agent", "club", "robot", "membership", "rights"].includes(input.type)) errors.type = "type";
  if (input.message.trim().length < 10 || input.message.length > 1200) errors.message = "message";
  if (!input.consent) errors.consent = "consent";
  return errors;
}
export function composeInquiry(input: Inquiry, locale: "zh" | "en", hasPriorSubmissionAttempt = false): string {
  if (Object.keys(validateInquiry(input)).length) throw new Error("Invalid inquiry");
  const zh = locale === "zh";
  const title = hasPriorSubmissionAttempt
    ? (zh ? "Life++ 本地草稿副本 — 不代表此前提交状态" : "Life++ local draft copy — not a statement of earlier submission status")
    : (zh ? "Life++HERE 合作咨询草稿 — 尚未发送" : "Life++HERE enquiry draft — not sent");
  const topics: Record<Inquiry["type"], [string, string]> = {
    space: ["空间与商户", "Spaces and merchants"], agent: ["智能助手与边缘设备", "AI assistance and edge devices"],
    club: ["共学与活动", "Learning and events"], robot: ["机器人试点", "Robot pilot"],
    membership: ["参与计划", "Participation plans"], rights: ["权限、撤回与反馈", "Permissions, withdrawal and feedback"],
  };
  const channels: Record<Inquiry["channel"], [string, string]> = { email: ["电子邮箱", "Email"], phone: ["电话", "Phone"], wechat: ["微信", "WeChat"] };
  const language = zh ? 0 : 1;
  return [title, `${zh ? "称呼" : "Name"}: ${input.name.trim()}`, `${zh ? "学校、机构或公司（可选）" : "School, organization or company (optional)"}: ${input.organization.trim()}`, `${channels[input.channel][language]}: ${input.contact.trim()}`, `${zh ? "咨询主题" : "Enquiry topic"}: ${topics[input.type][language]}`, input.message.trim(), zh ? "本咨询不授予展示、模型下载、训练、导航或再分发许可。" : "This enquiry grants no display, model download, training, navigation or redistribution rights."].join("\n");
}
