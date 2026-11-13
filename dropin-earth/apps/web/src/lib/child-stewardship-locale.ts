import { cloneElement, isValidElement, type ReactNode } from "react";
import catalog from "./child-stewardship-en.json";
import { stewardshipScreens } from "./child-stewardship-screens";
export type ChildLocale = "zh-CN" | "en";
const englishScreens = [
  ["Meet a tree together", "Start with two illustrated leaves. Notice a difference, ask a question or take a break whenever you like.", "Start"],
  ["Read with a trusted adult", "A parent, teacher or another adult you feel safe with can read along. This activity uses fictional profiles and opens no real account.", "Adult support"],
  ["Choose a practice profile", "The profiles and age groups are for the demo. Do not enter your name, birthday or contact details.", "Practice settings"],
  ["What would you like to do?", "Reading, saving a draft on this device and sending it online are separate choices. You can simply read.", "Your choices"],
  ["Meet our example tree", "This is a drawing with no real location. We use it to practise observation; you do not need to adopt or care for it.", "Example tree"],
  ["How is the tree now? We do not know", "An illustration cannot tell us how a real tree is doing. Look at the source before deciding what it shows.", "Example tree"],
  ["Meet CAI, the AI learning assistant", "An AI learning assistant can help explain materials, but people make the decisions. This demo uses prepared explanations, with no live AI conversation.", "Learn together"],
  ["What would you like to ask?", "Choose a question to read a prepared explanation. The answers discuss these illustrations, without looking up real trees.", "Learn together"],
  ["Where did the material come from?", "This learning illustration can help us compare colours. It cannot prove that a real tree is alive or how much carbon it absorbs.", "Material source"],
  ["Look at two leaves indoors", "There is no need to go outside or use a camera. Look at the two illustrations and choose a colour you notice.", "Indoor observation"],
  ["Feel safe and comfortable first", "Today we are looking at illustrations on a screen. Outdoor activities are not open; this exercise never asks you to climb, pick plants or find a tree.", "Safety reminder"],
  ["What did you notice?", "Choose one description. “I am not sure yet” is a thoughtful answer too.", "Describe what you see"],
  ["Preview your practice note", "The draft contains your preset choice, the example activity, a device timestamp and record details. It has no photo, audio, location or personal message.", "Before saving"],
  ["Save a draft if you want", "Your draft is saved only when success is confirmed. It stays encrypted in this browser; saving it does not send it to us.", "Save on this device"],
  ["Drafts in this browser", "These are the saved drafts for the selected fictional profile. On a shared device, you can remove them before leaving.", "Draft notebook"],
  ["A saved draft has not been sent", "Online submission is not open in the public experience. This section explains the practice flow; Received appears only after a service confirmation.", "Sending explained"],
  ["What can a record tell us?", "Practise looking at the evidence behind a record. No real reviewer accepts work here, and this activity cannot verify a real tree.", "Understand feedback"],
  ["Look back at the activity", "Review the example comparison and any receipt status. They do not show that a real tree received care.", "Activity overview"],
  ["Learn at your own pace", "There are no rankings or daily streaks. Look at the practice feedback, or finish for today.", "Learning summary"],
  ["What is a practice note for?", "It helps you reflect on what you have learned. There are no tradable points, cash rewards or carbon credits here.", "Using the notes"],
  ["Without a recent record, it is okay not to know", "Unknown does not mean a tree has died. A tree is not harmed because you did not open this page.", "Condition unknown"],
  ["When a tree’s life ends", "You can skip this discussion. A real tree’s condition needs suitable human review, and you do not have to carry that responsibility alone.", "Optional topic"],
  ["You can say when something seems wrong", "Choose an example concern to practise raising a question. Do not report real incidents here; find a trusted adult if you need help with safety.", "Raise a question"],
  ["A question still needs a response", "There is no real protection team taking cases in this demo. A practice status does not mean a real concern was accepted or resolved.", "Question status"],
  ["For parents and teachers", "Review the practice choices and help explain saving versus sending. A fictional profile is not a verified child or guardian.", "Adult guide"],
  ["You can pause at any time", "Pausing immediately stops new sending from this page. If anything was sent earlier, its deletion or retention needs separate confirmation.", "Pause and choices"],
  ["Check your drafts on a shared device", "You can clear this fictional profile’s drafts from this browser. Real account recovery and management across devices are not available.", "Device and drafts"],
  ["Make the page easier to read", "You can enlarge the text and use a keyboard. The activity does not require sound, dragging or a 3D scene.", "Reading help"],
  ["For adults: understand the different records", "Learning notes, environmental evidence, legal rights and completed payments need separate explanations. This experience provides learning examples only.", "For adults"],
  ["When you need help, find someone you trust", "You can stop without finishing the activity. This site does not provide live emergency help or accept real safety reports.", "Help"],
  ["About possible benefits and rights", "No real grant programme or beneficiary record is connected, and no reward is promised. Real legal rights must be checked against their own supporting grounds.", "Benefits and rights"],
  ["A promise, an amount owed and a payment differ", "There is no spendable balance here. Real amounts owed, funds set aside and payments received each need their own confirmation.", "Payments explained"],
  ["Payments are not available here", "The real payment service is not open. Demo choices, a parent’s login or an AI suggestion cannot start a transfer.", "Payments unavailable"],
  ["Pausing a page cannot freeze funds elsewhere", "This page can stop new sending here. A bank or another institution must separately confirm any freeze or return of funds.", "What pausing does"],
  ["Growing up, changing schools or guardians", "Real account handover is not available. Any future transition needs checks of local requirements and lawful representation; a child’s rights do not automatically pass to the platform.", "Growing and changing"],
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
  const received = trimmed.match(/^演示服务已收到，接收编号：([a-zA-Z0-9_-]+)。这不代表审核通过，也不能证明真实树木存活。$/);
  if (received) return `Received by the demo service. Receipt: ${received[1]}. This does not mean review approval or establish that a real tree is alive.`;
  const challenge = trimmed.match(/^演示服务接收编号：([a-zA-Z0-9_-]+)。这是练习记录，没有真实保护团队接单。$/);
  if (challenge) return `Demo service receipt: ${challenge[1]}. This is a practice record; no real protection team has accepted a case.`;
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
