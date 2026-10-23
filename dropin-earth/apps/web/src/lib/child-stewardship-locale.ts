import { cloneElement, isValidElement, type ReactNode } from "react";
import catalog from "./child-stewardship-en.json";
import { stewardshipScreens } from "./child-stewardship-screens";
export type ChildLocale = "zh-CN" | "en";
const englishScreens = [
  ["Meet a tree together", "Start with one leaf. You can observe, ask questions or stop whenever you want.", "Start"],
  ["With a trusted adult", "Real accounts and Passkeys are unavailable. This uses demo roles and creates no identity credential.", "Adult support"],
  ["Choose a comfortable reading style", "Only fictional observers are used. Do not enter names, birthdays or contact details.", "Reading settings"],
  ["What would you like to do?", "Learning and sending are separate choices. You can change either at any time.", "Your choices"],
  ["Meet the sample tree", "This synthetic learning tree has no real location, ownership or care task.", "My tree"],
  ["We do not know the tree's current condition", "One old record cannot tell us everything about a tree now. We can look at records together.", "My tree"],
  ["Meet the AI guide", "A live AI service is not connected. These are bounded static learning materials, not a tree speaking.", "Learn together"],
  ["What shall we explore?", "Answers come from these synthetic learning materials. They do not query real trees.", "Learn together"],
  ["What does this record tell us?", "This is an illustration, not a field photo. It cannot prove survival or carbon uptake.", "Record source"],
  ["Choose a gentle observation", "Stay indoors without a camera. Comparing two illustrated leaves is a way to practice observation.", "Indoor observation"],
  ["Take care of yourself first", "Real field tasks are unavailable. Do not climb, pick plants or enter roads, watersides or unfamiliar places.", "Safety agreement"],
  ["What did you notice?", "Choose one description. “I am not sure” is a thoughtful observation too.", "Make a record"],
  ["Preview what will be saved", "Only a preset description and synthetic task ID. No photos, audio, location or personal writing.", "Before sending"],
  ["Save on this device first", "Encrypted drafts stay in this browser. Saving is not sending or review.", "Confirm saving"],
  ["Drafts on this device", "Successfully saved drafts can reopen in this browser. Clear them before leaving a shared device.", "Notebook"],
  ["Sending and receiving are separate", "Only a server receipt means Received. Keep your draft when offline.", "Sync status"],
  ["Records still need human interpretation", "Synthetic practice can demonstrate review steps. It never becomes real ecological verification.", "Review status"],
  ["What happened in this activity", "You compared illustrations and recorded a description. No real field care was triggered.", "Activity receipt"],
  ["Thoughtful observations deserve a place", "No rankings or daily streaks. Photo counts do not measure your worth. You can stop for today.", "Notebook"],
  ["The scope of a learning record", "Learning records cannot be transferred, withdrawn or exchanged for carbon credits. They do not replace established legal rights.", "Contribution scope"],
  ["Not enough recent records yet", "Unknown does not mean dead. This is not your fault, and does not depend on opening the app.", "Current condition unknown"],
  ["When a tree is gone", "This is a synthetic learning scenario. Real death findings require qualified human review. You can choose not to look.", "Keeping memories"],
  ["Something may be wrong", "Practice uses preset dispute categories only. Real safety reporting is unavailable; find a trusted adult nearby.", "Dispute practice"],
  ["A dispute needs independent review", "Without a real protection team accepting a case, we do not say it is resolved or promise a response time.", "Dispute status"],
  ["For the adult supporting you", "A demo role is not legal guardianship. No real child data or complete chat surveillance is collected here.", "Adult view"],
  ["You can pause or leave", "Local withdrawal immediately blocks new sending. Previously sent content needs separate server confirmation.", "Permissions and exit"],
  ["Shared devices and recovery", "Formal account recovery is unavailable. The demo does not collect iris, face or voice biometrics, or ask for wallet secrets.", "Device management"],
  ["Make reading comfortable", "Enlarge text if you like. Every step has text; no sound, dragging or 3D scene is required.", "Accessibility"],
  ["A learning record is not a carbon credit", "Real carbon records require the relevant project, method, independent verification and registry evidence. These are not connected.", "For adults"],
  ["Pause and find a trusted adult", "You can leave if you feel uncomfortable. This platform does not offer live rescue or real safety reporting.", "Help"],
  ["Where do real rights come from?", "Verifiable legal grounds and beneficiary records are not connected. No verified rights currently shown does not permanently deny anyone's rights.", "Rights sources"],
  ["Owed is different from received", "Legal obligations, fund reservations, payment submission and final settlement must be reconciled separately. No spendable balance is available here.", "Rights and funds"],
  ["Protected spending is unavailable", "Purpose, amount, destination and independent approvals require exact verification. Children and demo roles cannot make real payments.", "Controlled spending"],
  ["Pausing is not confiscation", "Stopping local submissions does not mean an institution froze funds. Only its corresponding receipt confirms an external freeze.", "Rights protection"],
  ["Growing up and guardian changes", "A transition requires fresh checks of local legal capacity and representation. It is not an automatic switch at eighteen, and rights do not pass to the platform.", "Rights continuity"],
] as const;
const messages: Record<string, string> = { ...catalog, "语言": "Language", "中文": "中文" };
for (let index = 0; index < stewardshipScreens.length; index++) {
  const source = stewardshipScreens[index]!; const translated = englishScreens[index]!;
  messages[source[1]] = translated[0]; messages[source[2]] = translated[1]; messages[source[3]] = translated[2];
}
export function translateChildText(text: string, locale: ChildLocale): string {
  if (locale === "zh-CN") return text;
  const trimmed = text.trim();
  if (messages[trimmed]) return text.replace(trimmed, messages[trimmed]!);
  const drafts = trimmed.match(/^(\d+) 份本机草稿$/);
  if (drafts) return `${drafts[1]} local draft${drafts[1] === "1" ? "" : "s"}`;
  const received = trimmed.match(/^合成服务已收到。接收编号：([a-zA-Z0-9_-]+)。尚未审核，不表示树存活。$/);
  if (received) return `Received by the synthetic service. Receipt: ${received[1]}. Not reviewed; this does not establish tree survival.`;
  const challenge = trimmed.match(/^合成服务接收编号：([a-zA-Z0-9_-]+)。等待演示复核，不代表真实保护服务接单。$/);
  if (challenge) return `Synthetic service receipt: ${challenge[1]}. Waiting for demo review, not a real protection response.`;
  if (trimmed.startsWith("已收到 · ")) return trimmed.replace("已收到 · ", "Received · ");
  return text;
}
/** Rendering-only translation: values, event handlers, authorization and stored data are unchanged. */
export function translateChildNode(node: ReactNode, locale: ChildLocale): ReactNode {
  if (locale === "zh-CN") return node;
  if (typeof node === "string") return translateChildText(node, locale);
  if (Array.isArray(node)) return node.map(item => translateChildNode(item, locale));
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  const translated: Record<string, unknown> = {};
  for (const key of ["aria-label", "title", "placeholder", "alt"]) if (typeof node.props[key] === "string") translated[key] = translateChildText(node.props[key] as string, locale);
  if (node.props.lang === "zh-CN") translated.lang = "en";
  if (Object.hasOwn(node.props, "children")) translated.children = translateChildNode(node.props.children as ReactNode, locale);
  return cloneElement(node, translated);
}
export const childLocaleCatalogStatus = { locales: ["zh-CN", "en"], screenCount: 35, humanLanguageAndChildTesting: "pending" } as const;
