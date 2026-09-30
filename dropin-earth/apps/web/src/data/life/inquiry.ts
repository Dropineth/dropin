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
export function composeInquiry(input: Inquiry, locale: "zh" | "en"): string {
  if (Object.keys(validateInquiry(input)).length) throw new Error("Invalid inquiry");
  const zh = locale === "zh";
  return [zh ? "Life++ 合作询问草稿 — 尚未发送" : "Life++ inquiry draft — not sent", `${zh ? "称呼" : "Name"}: ${input.name.trim()}`, `${zh ? "机构（可选）" : "Organization (optional)"}: ${input.organization.trim()}`, `${input.channel}: ${input.contact.trim()}`, `${zh ? "合作类型" : "Interest"}: ${input.type}`, input.message.trim(), zh ? "本意向不授予展示、模型下载、训练、导航或再分发许可。" : "This inquiry grants no display, model download, training, navigation or redistribution rights."].join("\n");
}
