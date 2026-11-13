"use client";

import { useEffect, useRef, useState } from "react";
import { CHILD_DRAFT_SCHEMA, ChildDraftSync, ChildDraftVault, IndexedChildDraftStorage, type ChildDraft, type ChildDemoSession, type ObservationChoice } from "@/lib/child-stewardship-offline";
import { ChildDemoApi, type DraftAuthorizationProposal } from "@/lib/child-stewardship-api";
import { stewardshipScreens, type StewardshipScreenId } from "@/lib/child-stewardship-screens";
import { translateChildNode, type ChildLocale } from "@/lib/child-stewardship-locale";
import styles from "./Stewardship.module.css";

const answers: Record<ObservationChoice, string> = { green_leaves: "我看到了绿色叶片", yellow_leaves: "我看到了黄色叶片", not_sure: "我还不确定" };
function TreeDrawing({ locale }: { locale: ChildLocale }) {
  return translateChildNode(<svg viewBox="0 0 270 300" role="img" aria-label="用于学习的树木插画，不代表真实树木的近况"><ellipse cx="137" cy="271" rx="91" ry="12" fill="#ccd5b9"/><path d="M132 263l7-128m-4 68l-37-38m39 17l38-43" stroke="#817056" strokeWidth="11" fill="none" strokeLinecap="round"/><path d="M67 170C22 154 47 89 77 87C73 24 148 11 173 54C226 49 249 113 214 144C228 200 158 221 135 189C103 207 75 199 67 170Z" fill="#789867"/><path d="M81 141C56 111 88 74 114 86C119 49 160 48 174 81C206 76 217 119 192 137C197 169 158 181 143 155C115 174 92 165 81 141Z" fill="#96ad7d"/><path d="M90 252l-6-14m99 20l6-19m-21 23l-3-11" stroke="#718753" strokeWidth="4" strokeLinecap="round"/></svg>, locale);
}
function Leaves({ locale }: { locale: ChildLocale }) {
  return translateChildNode(<div className={styles.leaves}>{["#6e9256", "#b69d4f"].map((color, index) => <figure key={color}><svg viewBox="0 0 100 120" role="img" aria-label={index ? "黄色叶片插画" : "绿色叶片插画"}><path d="M48 104C4 91 14 25 78 12C91 70 80 95 48 104Z" fill={color}/><path d="M37 115L71 29M48 88L29 70M55 69L76 60M62 50L47 38" stroke="#4d623c" strokeWidth="3" fill="none" strokeLinecap="round"/></svg><figcaption>叶片插画 {index ? "B" : "A"}</figcaption></figure>)}</div>, locale);
}
export function StewardshipExperience({ apiBase = process.env.NEXT_PUBLIC_DROPIN_API_URL ?? "", initialLocale = "zh-CN" }: { apiBase?: string; initialLocale?: ChildLocale }) {
  const [locale, setLocale] = useState<ChildLocale>(initialLocale);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("lang") !== locale) {
      url.searchParams.set("lang", locale);
      window.history.replaceState(window.history.state, "", url.href);
    }
    document.documentElement.lang = locale;
    document.title = locale === "en"
      ? "Look, ask and learn together · CanopyProof learning demo"
      : "一起观察，一起提问 · CanopyProof 学习演示";
  }, [locale]);
  const [screen, setScreen] = useState<StewardshipScreenId>("S01");
  const visited = useRef<StewardshipScreenId[]>(["S01"]);
  const cursor = useRef(0);
  const navigationInstance = useRef<string | null>(null);
  useEffect(() => {
    navigationInstance.current ??= crypto.randomUUID();
    window.history.replaceState({...window.history.state, childGuideIndex:0, childGuideInstance:navigationInstance.current}, "");
    function pop(event: PopStateEvent) {
      const index: unknown = event.state?.childGuideIndex;
      if (event.state?.childGuideInstance === navigationInstance.current && typeof index === "number" && Number.isInteger(index) && index >= 0 && index < visited.current.length) {
        cursor.current = index; setScreen(visited.current[index]!); setMessage("");
      } else {
        visited.current = ["S01"]; cursor.current = 0; setScreen("S01"); setMessage("");
        window.history.replaceState({...window.history.state, childGuideIndex:0, childGuideInstance:navigationInstance.current}, "");
      }
    }
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const [profile, setProfile] = useState<ChildDraft["profile"]>("synthetic-a");
  const [ageBand, setAgeBand] = useState<"6-8" | "9-12" | "13-17">("9-12");
  const [large, setLarge] = useState(false);
  const [learning, setLearning] = useState(false);
  const [upload, setUpload] = useState(false);
  const [answer, setAnswer] = useState<ObservationChoice>("not_sure");
  const [drafts, setDrafts] = useState<ChildDraft[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [privacyRequest, setPrivacyRequest] = useState<string | null>(null);
  const [privacyExport, setPrivacyExport] = useState<unknown>(null);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [withdrawalRequested, setWithdrawalRequested] = useState(false);
  const [withdrawalServer, setWithdrawalServer] = useState<"none" | "pending" | "consent" | "ticket" | "unknown">("none");
  const [withdrawalLocal, setWithdrawalLocal] = useState<"none" | "pending" | "cleared" | "unknown">("none");
  const [currentApprovals, setCurrentApprovals] = useState<Record<string, boolean>>({});
  const [authorizationProposal, setAuthorizationProposal] = useState<{ draft: ChildDraft; scope: DraftAuthorizationProposal } | null>(null);
  const [authorizationChoice, setAuthorizationChoice] = useState(false);
  const pendingAuthority = useRef<AbortController | null>(null);
  const pendingCancellation = useRef<ChildDemoSession | null>(null);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [localReviewed, setLocalReviewed] = useState(false);
  const [serverReviewed, setServerReviewed] = useState(false);
  const [challengeReason, setChallengeReason] = useState("wrong_time");
  const [challenge, setChallenge] = useState("");
  const [question, setQuestion] = useState("");
  const [permissionCheck, setPermissionCheck] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const initialScreen = useRef(true);
  const vault = useRef<ChildDraftVault | null>(null);
  const sync = useRef(new ChildDraftSync(profile));
  const api = useRef<ChildDemoApi | null>(null);
  const savingDraft = useRef<ChildDraft | null>(null);
  const currentPageDrafts = useRef(new Set<string>());
  const selection = stewardshipScreens.find(item => item[0] === screen)!;
  const observationId = Object.values(received).at(-1);
  useEffect(() => {
    try { vault.current = new ChildDraftVault(new IndexedChildDraftStorage()); setStorageReady(true); }
    catch { setMessage("这个浏览器暂时不能安全保存草稿。你仍然可以阅读，但请不要依赖草稿恢复。"); }
    return () => { sync.current.withdraw(); api.current?.close(); };
  }, []);
  useEffect(() => {
    if (!storageReady || !vault.current) return;
    let active = true;
    void vault.current.loadSession(profile).then(session => { if (active) setResumeAvailable(Boolean(session)); }).catch(() => { if (active) setResumeAvailable(false); });
    void vault.current.list(profile).then(result => { if (active) setDrafts(result); }).catch(() => { if (active) setMessage("暂时读不到本机草稿。还不能确认它们被清除或发送，请保留设备后再试。"); });
    return () => { active = false; };
  }, [profile, storageReady]);
  function storedEpoch(value: ChildDraft["profile"]): number | null {
    try { const epoch = Number(localStorage.getItem(`cp-synthetic-epoch:${value}`) ?? 0); return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null; } catch { return null; }
  }
  useEffect(() => {
    sync.current = new ChildDraftSync(profile, storedEpoch(profile) ?? 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === `cp-synthetic-epoch:${profile}` && Number(event.newValue) > sync.current.currentEpoch) {
        sync.current.withdraw(Number(event.newValue)); pendingAuthority.current?.abort(); api.current?.clearUploadAuthorizations(); setCurrentApprovals({}); setAuthorizationProposal(null); setAuthorizationChoice(false); setPrivacyExport(null); setLearning(false); setUpload(false); setPermissionCheck(false);
        setMessage("这个练习角色已在另一个标签页暂停。本页也已停止新的发送。");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [profile]);
  useEffect(() => { if (initialScreen.current) { initialScreen.current = false; return; } heading.current?.focus({ preventScroll: true }); }, [screen]);
  function go(next: StewardshipScreenId) {
    if (visited.current[cursor.current] !== next) {
      visited.current = [...visited.current.slice(0, cursor.current + 1), next];
      cursor.current++;
      window.history.pushState({...window.history.state, childGuideIndex:cursor.current, childGuideInstance:navigationInstance.current}, "");
    }
    setScreen(next); setMessage("");
  }
  function revokeLocal(preserveTicket = false) {
    setPrivacyExport(null); setCurrentApprovals({}); setAuthorizationProposal(null); setAuthorizationChoice(false);
    pendingAuthority.current?.abort(); api.current?.clearUploadAuthorizations();
    sync.current.withdraw();
    setResumeAvailable(false);
    if (!preserveTicket) void vault.current?.forgetSession(profile).catch(() => setMessage("本页已停止发送，但下次恢复用的凭据还没有确认清除。如果它仍可使用、服务也没有确认撤回，重新打开时可能记不住这次停止选择。请保持页面打开并重试，暂时不要交出共享设备。"));
    try { localStorage.setItem(`cp-synthetic-epoch:${profile}`, String(sync.current.currentEpoch)); } catch { /* Local stop still applies; no persisted permission is ever granted. */ }
  }
  function stop() {
    revokeLocal(true); setLearning(false); setUpload(false); setPermissionCheck(false);
    setWithdrawalRequested(true); setWithdrawalServer("pending"); setWithdrawalLocal("pending");
    go("S26"); setMessage("已经请求暂停，本页立即停止新的发送。在线确认和本机清理的结果会分别显示。");
    void (async () => {
      try {
        if (connected && api.current) { await api.current.withdraw(); setWithdrawalServer("consent"); }
        else {
          const ticket = pendingCancellation.current ?? await vault.current?.loadSession(profile);
          if (!ticket) throw new Error("NO_CANCELLATION_PROOF");
          pendingCancellation.current = ticket;
          const service = new ChildDemoApi(new URL(apiBase || window.location.origin, window.location.origin).href.replace(/\/$/, ""), fetch, profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b");
          await service.cancelResume(ticket); pendingCancellation.current = null; setWithdrawalServer("ticket");
        }
      } catch { setWithdrawalServer("unknown"); }
      finally {
        if (!vault.current) setWithdrawalLocal("unknown");
        else { try { await vault.current.forgetSession(profile); setWithdrawalLocal("cleared"); } catch { setWithdrawalLocal("unknown"); } }
      }
    })();
  }
  function setPermission(purpose: "learning" | "upload", value: boolean) {
    if (!value) {
      revokeLocal();
      if (connected && api.current) void api.current.command("child", { type: "set-assent", profileId: api.current.profileId, purpose, willing: false }).catch(() => setMessage("本页已停止新的发送。服务是否已收到撤回请求，还没有确认。"));
    }
    if (purpose === "learning") setLearning(value); else setUpload(value);
    setPermissionCheck(false);
  }
  function confirmPermissions() {
    setPermissionCheck(true); go("S05");
  }
  async function saveDraft() {
    if (!learning || !permissionCheck || !vault.current) { setMessage("保存前，请先选择愿意进行这次练习。不选择也可以继续阅读。"); return; }
    setBusy(true);
    try {
      const draft: ChildDraft = savingDraft.current ?? { schema: CHILD_DRAFT_SCHEMA, id: crypto.randomUUID(), profile, task: "synthetic-indoor-comparison", answer, source: "synthetic_reference", createdAt: new Date().toISOString(), consentEpoch: sync.current.currentEpoch, submissionVersion: null, serverBinding: null };
      const boundDraft = connected && api.current ? api.current.bindDraft(draft, true) : draft;
      savingDraft.current = boundDraft;
      await vault.current.save(boundDraft);
      currentPageDrafts.current.add(draft.id);
      setDrafts(await vault.current.list(profile)); savingDraft.current = null;
      go("S15"); setMessage("草稿已加密保存在这个浏览器中，还没有发送。");
    } catch { setMessage("保存还没有确认成功。可以留在这页稍后重试，也可以放弃这次记录。"); }
    finally { setBusy(false); }
  }
  async function connect() {
    if (!learning || !upload || !permissionCheck) { setMessage("发送练习需要分别选择学习和发送。你仍可阅读或查看本机草稿。"); return; }
    setBusy(true);
    const service = new ChildDemoApi(new URL(apiBase || window.location.origin, window.location.origin).href.replace(/\/$/, ""), fetch, profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b");
    const startingEpoch = sync.current.currentEpoch;
    try {
      await service.start(); await service.setup(ageBand, true);
      if (sync.current.currentEpoch !== startingEpoch) throw new Error("CONSENT_WITHDRAWN");
      api.current = service; setConnected(true);
      setMessage("演示服务已连接，可以继续练习发送。这里只核对虚构角色，不验证真实身份或监护关系；草稿还没有发送。");
    } catch { service.close(); setConnected(false); setMessage("演示服务暂不可用，没有确认收到草稿。已保存的加密草稿仍留在本机；服务准备是否完成也未确认，这不代表创建了真实账户。"); }
    finally { setBusy(false); }
  }
  async function suspendSession() {
    if (!api.current || !connected || !vault.current || busy) return;
    setBusy(true); setCurrentApprovals({}); setAuthorizationProposal(null); setAuthorizationChoice(false); const startingEpoch = sync.current.currentEpoch;
    try {
      const ticket = await api.current.suspend(startingEpoch);
      if (sync.current.currentEpoch !== startingEpoch) throw new Error("CONSENT_WITHDRAWN");
      await vault.current.saveSession(profile, ticket);
      if (sync.current.currentEpoch !== startingEpoch) { await vault.current.forgetSession(profile); throw new Error("CONSENT_WITHDRAWN"); }
      setResumeAvailable(true); setMessage("演示连接已暂停，原来的活动访问已失效。浏览器只保存了供下次核对的一次性恢复凭据；恢复时仍需联网检查，也不会自动发送。");
    } catch { setResumeAvailable(false); setMessage("没有确认已准备好下次恢复。当前连接已关闭，旧草稿只能在本机阅读，不会自动取得发送许可。"); }
    finally { setConnected(false); api.current?.close(); setBusy(false); }
  }
  async function resumeSession() {
    if (!vault.current || busy) return;
    setBusy(true);
    const startingEpoch = sync.current.currentEpoch;
    const service = new ChildDemoApi(new URL(apiBase || window.location.origin, window.location.origin).href.replace(/\/$/, ""), fetch, profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b");
    try {
      const session = await vault.current.loadSession(profile);
      const durableEpoch = storedEpoch(profile);
      if (!session || durableEpoch === null || sync.current.currentEpoch > session.localEpoch || durableEpoch > session.localEpoch) throw new Error("CONSENT_WITHDRAWN");
      await service.resume(session);
      setResumeAvailable(false);
      // The server has consumed this ticket. Deletion failure cannot restore its authority.
      await vault.current.forgetSession(profile).catch(() => undefined);
      if (sync.current.currentEpoch !== startingEpoch) throw new Error("CONSENT_WITHDRAWN");
      sync.current = new ChildDraftSync(profile, sync.current.currentEpoch);
      setCurrentApprovals({}); setAuthorizationProposal(null); setAuthorizationChoice(false);
      api.current = service; setConnected(true); setLearning(false); setUpload(false); setPermissionCheck(false);
      setMessage("原来的演示连接已恢复，只能读取原有资料，不能直接发送。每份草稿都要重新核对内容、用途和当前规则，再由你明确选择。");
    } catch {
      service.close(); setConnected(false);
      setMessage("暂时无法恢复原来的演示连接，可能因为已过期、已撤回、发生变化或没有联网。旧草稿仍可在本机查看，不会自动变成允许发送的新记录。");
    } finally { setBusy(false); }
  }
  async function inspectAuthorization(draft: ChildDraft) {
    if (!api.current || !connected || busy) return;
    setBusy(true); setAuthorizationChoice(false); setAuthorizationProposal(null);
    const startingEpoch = sync.current.currentEpoch;
    try {
      const bound = await api.current.prepareDraft(draft, currentPageDrafts.current.has(draft.id));
      if (bound !== draft) {
        if (!vault.current) throw new Error("LOCAL_STORAGE_UNAVAILABLE");
        await vault.current.save(bound); setDrafts(previous => previous.map(item => item.id === bound.id ? bound : item));
      }
      const scope = await api.current.inspectDraftAuthorization(bound);
      if (sync.current.currentEpoch !== startingEpoch) throw new Error("CONSENT_WITHDRAWN");
      setAuthorizationProposal({ draft: bound, scope }); setMessage("已完成在线核对。请阅读这份草稿的内容、用途和规则版本；核对本身不会允许发送。");
    } catch (error) { setMessage(error instanceof Error && error.message === "DRAFT_REAUTHORIZATION_REQUIRED" ? "这份草稿来自较早打开的页面，目前只能在本机阅读。旧的发送选择不能沿用；愿意的话，可重新选择并创建一份新的练习草稿。" : "在线核对没有完成，仍不能发送。可以联网后重试，或继续在本机阅读旧草稿。"); }
    finally { setBusy(false); }
  }
  async function confirmDraftAuthorization() {
    if (!api.current || !authorizationProposal || !authorizationChoice || busy) return;
    const pending = authorizationProposal; const startingEpoch = sync.current.currentEpoch;
    const controller = new AbortController(); pendingAuthority.current = controller; setBusy(true);
    try {
      await api.current.authorizeDraft(pending.draft, pending.scope, controller.signal);
      if (controller.signal.aborted || sync.current.currentEpoch !== startingEpoch) throw new Error("CONSENT_WITHDRAWN");
      sync.current.authorize(pending.draft); setCurrentApprovals(previous => ({ ...previous, [pending.draft.id]: true }));
      setAuthorizationProposal(null); setAuthorizationChoice(false); setMessage("已确认这份草稿本次可以发送，但观察内容还没有发出。这次许可只在当前页面有效；重新打开、暂停或暂存连接后，都要重新核对和选择。");
    } catch { setCurrentApprovals(previous => ({ ...previous, [pending.draft.id]: false })); setAuthorizationProposal(null); setAuthorizationChoice(false); setMessage("这次发送许可没有确认，草稿没有发送。请重新在线核对后再作选择。"); }
    finally { pendingAuthority.current = null; setBusy(false); }
  }
  async function sendDraft(draft: ChildDraft) {
    if (!api.current || !connected || !currentApprovals[draft.id]) { setMessage("这份草稿还没有本次页面的发送许可。它仍在本机，请先核对内容和用途，再明确选择。"); return; }
    setBusy(true);
    try {
      const bound = await api.current.prepareDraft(draft, currentPageDrafts.current.has(draft.id));
      if (bound !== draft) {
        if (!vault.current) throw new Error("LOCAL_STORAGE_UNAVAILABLE");
        await vault.current.save(bound);
        setDrafts(previous => previous.map(item => item.id === bound.id ? bound : item));
      }
      const receipt = await sync.current.sync(bound, api.current.transport(bound));
      setReceived(previous => ({ ...previous, [draft.id]: receipt.receiptId }));
      setMessage(`演示服务已收到，接收编号：${receipt.receiptId}。这不代表审核通过，也不能证明真实树木存活。`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "DRAFT_REAUTHORIZATION_REQUIRED" ? "这份草稿来自较早打开的页面，目前只能在本机阅读。旧的发送选择不能沿用；愿意的话，可重新选择并创建一份新的练习草稿。" : code === "CONSENT_WITHDRAWN" ? "发送选择已撤回或改变，还没开始的发送已经停止。部分内容可能已发出，需要另外核对。" : "没有收到有效的接收确认，结果还不确定。草稿仍在本机；再次核对会沿用同一次请求，不另建记录。");
    } finally { setBusy(false); }
  }
  async function review() {
    if (!observationId || !api.current || !connected) { setLocalReviewed(true); setMessage("这是本页的练习反馈：插画可以用来学习，却不足以确认真实树木存活。没有真人审核，也没有出具真实证明。"); return; }
    setBusy(true);
    try {
      await api.current.command("reviewer", { type: "review-observation", observationId, decision: "insufficient_for_survival", reason: "synthetic_source" });
      await api.current.command("reviewer", { type: "grant-contribution", observationId, policyVersion: "child-learning-demo-v1" });
      setServerReviewed(true); setMessage("演示服务记录了练习反馈，仍不足以确认真实树木存活。切换演示角色不等于独立真人审核。");
    } catch { setMessage("还没有确认全部反馈步骤完成。需要再核对服务记录；这不是现实中的核查通过。"); }
    finally { setBusy(false); }
  }
  async function openChallenge() {
    if (!observationId || !api.current || !connected) { setChallenge("仅在本页练习，尚未发送"); go("S24"); return; }
    setBusy(true);
    try {
      const result = await api.current.command("child", { type: "open-dispute", profileId: api.current.profileId, targetId: observationId, reason: challengeReason });
      setChallenge(`演示服务接收编号：${result.id}。这是练习记录，没有真实保护团队接单。`); go("S24");
    } catch { setMessage("没有收到这次问题练习的接收确认，发送结果未知。真实安全问题请找可信的大人。"); }
    finally { setBusy(false); }
  }
  async function requestPrivacy(kind: "export_learning" | "delete_learning") {
    if (!api.current || !connected || busy) return;
    if (kind === "delete_learning") { revokeLocal(); setLearning(false); setUpload(false); setPermissionCheck(false); }
    setBusy(true); setPrivacyExport(null);
    try { const result = await api.current.command("guardian", { type: "request-privacy", profileId: api.current.profileId, kind }); setPrivacyRequest(result.id); setMessage("演示服务已收到这次资料请求，正在排队处理。还没有确认删除任何副本，可以继续查询状态。"); }
    catch { setMessage("没有收到资料请求的确认，处理结果未知。本页仍然保持停止发送。"); }
    finally { setBusy(false); }
  }
  async function checkPrivacy() {
    if (!api.current || !privacyRequest || busy) return;
    setBusy(true); setPrivacyExport(null);
    try { const result = await api.current.privacyStatus(privacyRequest); setPrivacyExport(result.export ?? null); setMessage(result.export ? "练习资料已准备好下载，只包含当前虚构角色的一般学习记录。" : "已查询请求状态，但还没有确认所有副本已删除。处理可能仍在排队；访问限制和必要的保留要求继续适用。"); }
    catch { setMessage("暂时无法查询资料请求，不能确认处理完成或内容已删除。"); }
    finally { setBusy(false); }
  }
  async function downloadPrivacy() {
    if (!privacyExport || !api.current || !privacyRequest || busy) return;
    const startingEpoch = sync.current.currentEpoch; setBusy(true);
    try {
      const fresh = await api.current.privacyStatus(privacyRequest);
      if (!fresh.export || sync.current.currentEpoch !== startingEpoch) throw new Error("CONSENT_WITHDRAWN");
      const url = URL.createObjectURL(new Blob([JSON.stringify(fresh.export, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "synthetic-learning-export.json"; link.click(); URL.revokeObjectURL(url);
    } catch { setPrivacyExport(null); setMessage("暂时无法查询资料请求，不能确认处理完成或内容已删除。"); }
    finally { setBusy(false); }
  }
  async function clearDrafts() {
    revokeLocal(); setLearning(false); setUpload(false); setPermissionCheck(false);
    if (!vault.current) { setMessage("暂时无法使用本机存储，清除还没有确认成功。"); return; }
    setBusy(true);
    try { await vault.current?.clear(profile); setResumeAvailable(false); api.current?.close(); setConnected(false); setDrafts([]); setMessage("当前虚构角色在这个浏览器里的草稿和加密密钥已清除。此操作没有删除服务记录、其他角色或其他设备上的内容。"); }
    catch { setMessage("清除还没有确认完成。请重试，并先不要把共享设备交给下一位使用者。"); }
    finally { setBusy(false); }
  }
  function changeProfile(value: ChildDraft["profile"]) {
    if (busy) return;
    revokeLocal(); pendingCancellation.current = null; setWithdrawalRequested(false); setWithdrawalServer("none"); setWithdrawalLocal("none"); api.current?.close(); api.current = null;
    sync.current = new ChildDraftSync(value, storedEpoch(value) ?? 0); setProfile(value); setDrafts([]); setReceived({});
    setConnected(false); setPrivacyRequest(null); setPrivacyExport(null); setResumeAvailable(false); setLearning(false); setUpload(false); setPermissionCheck(false); setLocalReviewed(false); setServerReviewed(false); setChallenge(""); savingDraft.current = null;
  }
  const button = (label: string, next: StewardshipScreenId) => <button className={styles.primary} onClick={() => go(next)}>{label}</button>;
  const learningRecord = localReviewed || serverReviewed;
  function screenContent() {
    switch (screen) {
      case "S01": return <><div className={styles.card}><h2>看一看，发现一点不同</h2><p>我们一起比较两片画出来的叶子。可以说出发现，也可以说「不知道」。不用证明什么，想休息时就停下。</p><p className={styles.note}>家庭与课堂都可阅读 · 使用虚构示例 · 无需相机或定位</p></div><div className={styles.actions}>{button("和大人一起开始", "S02")}<button className={styles.secondary} onClick={() => go("S08")}>先看看问题与讲解</button></div></>;
      case "S02": return <><div className={styles.card}><h2>用示例学习，不用注册</h2><p>家长或老师可以陪你读，也可以先自己看看。这里不创建真实儿童账户，也不验证谁是你的监护人。</p><p className={styles.note}>只选择页面提供的虚构角色，不需要身份证件、真实姓名或人脸信息。</p></div><div className={styles.actions}>{button("选择一个练习角色", "S03")}{button("先阅读学习材料", "S08")}</div></>;
      case "S03": return <><div className={styles.card}><label htmlFor="demo-profile">虚构的练习角色</label><select id="demo-profile" disabled={busy} className={styles.select} value={profile} onChange={event => changeProfile(event.target.value as ChildDraft["profile"])}><option value="synthetic-a">小叶子 A（虚构）</option><option value="synthetic-b">小叶子 B（虚构）</option></select><label htmlFor="reading-age">练习角色的年龄段（不是你的身份资料）</label><select id="reading-age" className={styles.select} value={ageBand} onChange={event => setAgeBand(event.target.value as typeof ageBand)}><option value="6-8">6–8 岁角色 · 可和大人一起读</option><option value="9-12">9–12 岁角色 · 试着提问</option><option value="13-17">13–17 岁角色 · 想想材料的依据</option></select><label className={styles.choice}><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)}/><span>放大文字</span></label></div>{button("看看有哪些选择", "S04")}</>;
      case "S04": return <><div className={styles.card}><fieldset><legend>每一项，都可以自己选</legend><label className={styles.choice}><input type="checkbox" checked={learning} onChange={event => setPermission("learning", event.target.checked)}/><span>我愿意做这次练习，并可选择把一个预设描述存到本机。</span></label><label className={styles.choice}><input type="checkbox" checked={upload} onChange={event => setPermission("upload", event.target.checked)}/><span>如果演示服务可用，我愿意在另外确认并点击发送后，发送这份虚构练习记录。</span></label></fieldset><p className={styles.note}>这两个选择不会自动保存或发送草稿。公开体验目前不开放在线提交，也没有公开分享或模型训练功能。请只使用虚构示例。</p></div><div className={styles.actions}><button className={styles.primary} onClick={confirmPermissions}>确认这次选择</button>{button("先不选择，继续阅读", "S08")}</div></>;
      case "S05": return <><div className={styles.card}><h2>示例学习园 · 小树 01</h2><dl><dt>插画从哪里来</dt><dd>页面提供的插画与预设描述</dd><dt>需要去现场吗</dt><dd>不需要；真实户外任务尚未开放</dd><dt>我在做什么</dt><dd>观察练习，不会获得树木所有权</dd></dl></div>{button("看看这棵示例树", "S06")}</>;
      case "S06": return <><div className={styles.card}><span className={styles.badge}>示例树 · 现实状态未知</span><h2>这幅图能告诉我们什么？</h2><p>这里没有真实现场记录或实时传感器信息，也不提供碳成果核查。</p><p className={styles.note}>我们没有这棵树的真实观察时间。插画只是学习材料。</p></div><div className={styles.actions}>{button("认识 AI 学习助手", "S07")}{button("试一次室内观察", "S10")}</div></>;
      case "S07": return <><div className={styles.card}><h2>AI 学习助手能知道树现在的一切吗？</h2><div className={styles.actions}><button className={styles.secondary} onClick={() => setQuestion("还不能。助手只能根据已有材料解释，不能看见没有记录的现场。再想一想，也可以选择不知道。")}>我觉得能</button><button className={styles.primary} onClick={() => { setQuestion("对。先看看材料从哪里来，材料没告诉我们的部分就说不知道。"); go("S08"); }}>不能，要看材料有没有依据</button></div>{question && <p role="status">{question}</p>}</div></>;
      case "S08": return <><div className={styles.card}><h2>你想先问哪一个？</h2><div className={styles.actions}><button className={styles.secondary} onClick={() => setQuestion("一张插画里的叶片是绿色，另一张是黄色。真实叶子颜色不同可能有很多原因；只看这两幅图，不能判断树是否缺水或生病。")}>两片叶子有什么不同？</button><button className={styles.secondary} onClick={() => setQuestion("我们不知道真实树木的位置、观察时间或现在的情况。插画和讲解都不能证明树木存活，也不会产生碳信用。")}>还有哪些事不知道？</button></div>{question && <p role="status" className={styles.status}>{question}</p>}<p className={styles.note}>AI 学习助手（CAI）示例 · 使用预先写好的讲解 · 没有实时 AI 对话</p></div>{button("看看材料来源", "S09")}</>;
      case "S09": return <><div className={styles.card}><Leaves locale={locale}/><p><strong>来源：</strong>这页提供的学习插画。</p><p><strong>真实观察时间：</strong>没有现场拍摄或观察时间。</p><p><strong>能看出来：</strong>两张叶片插画的颜色不同。</p><p><strong>还不能知道：</strong>真实树木是谁、现在是否存活、吸收了多少碳，或谁拥有相关权益。</p><p className={styles.note}>图片清楚、完整，也不代表现实情况已经得到证实。</p></div>{button("用这两幅图做练习", "S10")}</>;
      case "S10": return <><div className={styles.card}><h2>看看两片画出来的叶子</h2><p>选一个你看到的颜色。如果拿不准，就选「我还不确定」。</p><p>只用插画 · 不用出门 · 随时可以休息</p><p className={styles.note}>这个活动不需要打开相机或定位。真实户外任务尚未开放。</p></div>{button("先看安全提醒", "S11")}</>;
      case "S11": return <><div className={styles.card}><h2>今天只看屏幕里的叶片</h2><p>不需要出去找树、采摘、使用工具或药剂，也不要靠近虫巢和野生动物。现实中的树木照护应由合适的大人按现场情况安排。</p><p>不舒服或想休息时，随时可以点「停一停」。</p></div>{button("开始比较叶片", "S12")}</>;
      case "S12": return <><div className={styles.card}><Leaves locale={locale}/><fieldset><legend>选一个描述</legend>{Object.entries(answers).map(([value, label]) => <label className={styles.choice} key={value}><input type="radio" name="observation" value={value} checked={answer === value} onChange={() => { setAnswer(value as ObservationChoice); savingDraft.current = null; }}/><span>{label}</span></label>)}</fieldset></div>{button("先看看记录内容", "S13")}</>;
      case "S13": return <><div className={styles.card}><h2>{answers[answer]}</h2><p>观察对象是页面里的插画，没有采集现实中的资料。</p><p>草稿包含所选描述、虚构角色、示例任务、随机编号、本机保存时间，以及核对发送所需的版本信息。</p><p className={styles.note}>不包含照片、录音、位置、姓名、设备指纹或自由填写的个人文字。本机时间不能证明现实中的观察时间。</p></div><div className={styles.actions}>{button("继续到保存说明", "S14")}{button("重新选一个描述", "S12")}</div></>;
      case "S14": return <><div className={styles.card}><h2>草稿还没有发送</h2><p>本机保存准备：{storageReady ? "已准备；实际保存仍需确认成功" : "还没有确认"}</p><p>只有确认保存成功后，才能依赖这份草稿。共享浏览器即使使用加密，也需要在交给别人前清除。</p></div><button className={styles.primary} disabled={busy || !storageReady} onClick={() => void saveDraft()}>{busy ? "正在保存…" : "加密保存到这个浏览器"}</button>{!permissionCheck && <div className={styles.actions}>{button("先确认是否愿意练习", "S04")}</div>}</>;
      case "S15": return <><div className={styles.card}><h2>{drafts.length ? (locale === "en" ? `${drafts.length} local draft${drafts.length === 1 ? "" : "s"}` : `${drafts.length} 份本机草稿`) : "这里还没有草稿"}</h2>{drafts.map(draft => <article key={draft.id}><h3>{answers[draft.answer]}</h3><p className={styles.note}>{received[draft.id] ? "演示服务已确认收到；本机也有副本" : "已存到本机；没有接收确认"} · 插画练习</p><button className={styles.quiet} disabled={busy} onClick={() => void vault.current?.storage.remove(draft.id, profile).then(() => setDrafts(previous => previous.filter(item => item.id !== draft.id))).catch(() => setMessage("还没有确认移除成功，请重试。"))}>移除这份本机草稿</button></article>)}</div><div className={styles.actions}>{button("了解发送与接收", "S16")}{button("再观察一次", "S10")}</div></>;
      case "S16": return <><div className={styles.card}><h2>{connected ? "演示服务已连接" : "在线提交目前未开放"}</h2>
        <p>恢复连接只让你重新查看原有资料，不会恢复发送许可。每份草稿都要在线核对内容、用途和当前规则，再明确确认。确认之后，还要另外点发送。</p><p>核对和确认时，只发送识别草稿与检查规则所需的编号、来源、用途、版本和内容校验值。你选的观察答案、示例和记录时间，会等到另外点击发送后才传出。</p>
        {!connected && <><button className={styles.secondary} disabled={busy} onClick={() => void connect()}>检查演示服务是否可用</button>{resumeAvailable && <button className={styles.secondary} disabled={busy} onClick={() => void resumeSession()}>尝试恢复原来的演示连接</button>}</>}
        {connected && <button className={styles.secondary} disabled={busy} onClick={() => void suspendSession()}>暂停连接，并准备下次恢复</button>}
        {drafts.map(draft => <div className={styles.card} key={draft.id}><strong>{answers[draft.answer]}</strong><p className={styles.note}>{received[draft.id] ? `已收到 · ${received[draft.id]}` : "还没有接收确认"}</p>
          <p>{currentApprovals[draft.id] ? "本次已确认可以发送，仍需点击发送按钮" : "目前只能阅读，还没有本次发送许可"}</p>
          <button className={styles.secondary} disabled={busy || !connected} onClick={() => void inspectAuthorization(draft)}>核对这份草稿的发送内容与用途</button>
          <button className={styles.primary} disabled={busy || !connected || !currentApprovals[draft.id]} onClick={() => void sendDraft(draft)}>{received[draft.id] ? "再次核对这次发送" : "发送这份练习草稿"}</button></div>)}
        {authorizationProposal && <section className={styles.card} aria-label="确认单份草稿的发送选择"><h2>这次准备发送哪一份、用来做什么？</h2><dl>
          <dt>草稿编号</dt><dd>{authorizationProposal.draft.id}</dd><dt>草稿内容</dt><dd>{answers[authorizationProposal.draft.answer]}</dd>
          <dt>使用目的</dt><dd>仅用于演示中的学习观察</dd><dt>记录格式版本</dt><dd>{authorizationProposal.scope.schemaVersion}</dd>
          <dt>适用规则版本</dt><dd>{authorizationProposal.scope.policyVersion}</dd><dt>本次在线核对版本</dt><dd>{authorizationProposal.scope.currentVersion}</dd>
          <dt>旧记录的来源</dt><dd>只用于核对来源，不能代替这次同意</dd></dl>
          <label className={styles.choice}><input type="checkbox" checked={authorizationChoice} onChange={event => setAuthorizationChoice(event.target.checked)}/><span>我已经看过上面的内容，同意仅按所示用途和版本发送这一份草稿。这个选择只用于本次，不恢复过去的许可。</span></label>
          <button className={styles.primary} disabled={busy || !authorizationChoice} onClick={() => void confirmDraftAuthorization()}>确认这一份草稿的发送许可</button></section>}
        <p className={styles.note}>旧草稿保留原来的记录来源，但不能沿用以前的发送许可。即使上次撤回没有记住，重新打开后也要再次在线核对，并为每份草稿明确选择。收到草稿也不等于审核通过。</p>
        <p className={styles.note}>如果本机清理和在线取消都没有成功，之前的停止选择可能没有被保存。现在仍然不能直接发送。请联网后重试取消，确认清理前不要交出共享设备。</p>
      </div>{button("了解怎样看待反馈", "S17")}</>;
      case "S17": return <><div className={styles.card}><h2>{learningRecord ? "不能据此确认真实树木存活" : "还没有练习反馈"}</h2><p>{serverReviewed ? "演示服务已记录练习反馈，没有独立真人审核。" : localReviewed ? "这是本页的练习反馈，没有在线审核确认。" : "这里没有真人接单，也没有处理时间承诺。"}</p><button className={styles.secondary} disabled={busy} onClick={() => void review()}>{observationId ? "查看这份记录的演示反馈" : "练习判断：插画能证明什么？"}</button></div>{button("回顾活动说明", "S18")}</>;
      case "S18": return <><div className={styles.card}><h2>活动内容：比较与描述</h2><p>这是一项插画练习，没有执行真实树木照护。</p><p>在线接收状态：{observationId ? "演示服务已确认收到" : "还没有接收回执"}。</p><p>真实树木状态：未知。这些插画不能证明存活。</p></div>{button("查看学习小结", "S19")}</>;
      case "S19": return <><div className={styles.card}><h2>{learningRecord ? "认真描述，也愿意说不知道" : "练习可以按自己的节奏来"}</h2><p>{serverReviewed ? "演示服务记录了本次学习反馈。" : localReviewed ? "这条反馈只在本页显示，不是正式证书。" : "草稿是否保存、服务是否收到、是否有反馈，是三个不同的状态。"}</p><p>这里不排名、不要求打卡。今天做多少都可以，暂停也不会让你欠下任何东西。</p></div><div className={styles.actions}>{button("看看练习记录有什么用", "S20")}<button className={styles.secondary} onClick={stop}>今天到这里</button></div></>;
      case "S20": return <><div className={styles.card}><h2>记录一次学习</h2><p>练习范围：比较叶片插画。反馈状态：{serverReviewed ? "演示服务已记录练习反馈" : "没有正式学习证明"}。</p><p>练习记录不能交易、提现或兑换。现实中的合法权益仍需按自己的依据核实，不由这份练习决定。</p></div><div className={styles.actions}>{button("我对记录有疑问", "S23")}{button("为什么还不知道树的近况？", "S21")}</div></>;
      case "S21": return <><div className={styles.card}><h2>不知道，也是诚实的回答</h2><p>断网、旧记录或没有打开页面，都不能说明树已经死亡。没有足够的新信息时，可以先停下来，等合适的人核查。</p></div><div className={styles.actions}>{button("回到学习小结", "S19")}{button("可选话题：树木的生命结束时", "S22")}</div></>;
      case "S22": return <><div className={styles.card}><h2>你不用为此责怪自己</h2><p>真实树木会因天气、病害或其他原因死亡。它的生命不由你是否打开页面决定。原因没有查清时，我们可以说不知道。</p><p>过去的观察仍然有意义。如果后来种了一棵新树，应当清楚说明那是一棵新树。</p></div><div className={styles.actions}>{button("暂时不看，回到学习小结", "S19")}{button("找一位可信的大人", "S30")}</div></>;
      case "S23": return <><div className={styles.card}><label htmlFor="challenge-reason">选一个练习中的问题</label><select id="challenge-reason" className={styles.select} value={challengeReason} onChange={event => setChallengeReason(event.target.value)}><option value="wrong_time">记录的时间可能不对</option><option value="wrong_tree">可能不是同一棵树</option><option value="do_not_share">我不想公开这份内容</option><option value="not_understood">有些内容我没看懂</option></select><p className={styles.note}>这里只用预设问题，不填写真实事件或个人资料。如果某位大人让你不安全，请找另一位可信的人，不需要先向让你不安的人求得同意。</p></div><button className={styles.primary} disabled={busy} onClick={() => void openChallenge()}>继续这个问题练习</button><div className={styles.actions}>{button("如果需要真实帮助", "S30")}</div></>;
      case "S24": return <><div className={styles.card}><h2>{challenge || "还没有选择练习问题"}</h2><p>真实问题需要由合适、独立的人跟进。这里没有真实保护团队接单，也不承诺答复时间。</p><p>提出疑问不应让人失去已有学习记录或依法成立的权益。</p></div>{button("返回学习小结", "S19")}</>;
      case "S25": return <><div className={styles.card}><h2>看看这次的练习选择</h2><p>练习角色：{profile === "synthetic-a" ? "小叶子 A" : "小叶子 B"}（虚构）</p><p>本次学习选择：{learning ? "愿意" : "未选择或已暂停"}</p><p>本次发送选择：{upload ? "愿意；每份仍需另外确认并点击发送" : "未选择或已暂停"}</p><p>这个角色没有经过真实身份或监护关系核验。</p><p className={styles.note}>这里不接收真实安全举报，也不展示孩子的私密求助内容。学校需要的班级账户和教师后台尚未开放。</p></div><div className={styles.actions}>{button("查看或调整选择", "S26")}{button("查看设备与草稿", "S27")}{button("了解奖励与权益说明", "S31")}</div></>;
      case "S26": return <><div className={styles.card}><h2>先停下来，再核对状态</h2><p>本次学习：{learning ? "已选择愿意" : "未选择或已停止"}；发送：{upload ? "已选择愿意" : "未选择或已停止"}。</p><p>暂停不会删除已经发送的内容。导出或删除服务记录需要连接可用的演示服务，再分别确认结果。家庭页面不展示受保护的举报记录。如果下次恢复用的凭据无法清除，服务也未确认撤回，重新打开后可能记不住这次停止选择。</p><dl aria-label="暂停与清理状态"><dt>本页暂停</dt><dd>{withdrawalRequested ? "已经暂停，本页停止新的发送" : "还没有请求"}</dd><dt>在线服务确认</dt><dd>{withdrawalServer === "consent" ? "已确认撤回学习与发送选择" : withdrawalServer === "ticket" ? "已确认取消下次恢复" : withdrawalServer === "pending" ? "正在等待在线确认" : withdrawalServer === "unknown" ? "还没有确认，请联网后重试" : "还没有在线确认"}</dd><dt>清除本机的恢复凭据</dt><dd>{withdrawalLocal === "cleared" ? "已确认清除本机恢复凭据" : withdrawalLocal === "pending" ? "正在清理" : withdrawalLocal === "unknown" ? "还没有确认清除，请重试并保留设备" : "还没有请求清理"}</dd></dl><p>如果没有确认，请联网后重试暂停，并到设备与草稿页面检查本机清理。重新打开只能先阅读草稿；发送仍要重新核对，再逐份明确选择。</p><button className={styles.secondary} onClick={stop}>立即暂停学习与发送</button><div className={styles.actions}><button className={styles.secondary} disabled={busy || !connected} onClick={() => void requestPrivacy("export_learning")}>申请导出演示学习记录</button><button className={styles.secondary} disabled={busy || !connected} onClick={() => void requestPrivacy("delete_learning")}>申请删除演示学习记录</button>{privacyRequest && <button className={styles.secondary} disabled={busy || !connected} onClick={() => void checkPrivacy()}>查询资料请求状态</button>}{privacyExport !== null && <button className={styles.secondary} disabled={busy} onClick={() => void downloadPrivacy()}>下载演示学习记录</button>}</div></div><div className={styles.actions}>{button("重新查看各项选择", "S04")}{button("管理本机草稿", "S27")}</div></>;
      case "S27": return <><div className={styles.card}><h2>清除这个练习角色的草稿</h2><p>这会删除当前角色在这个浏览器里的草稿和对应加密密钥。其他角色、其他设备和已经发送的服务记录不会在这里被删除。</p><p className={styles.note}>浏览器还开着时，其他使用设备的人仍可能看到草稿。跨设备退出、真实账户恢复和远程清除尚未开放。</p><button className={styles.secondary} disabled={busy} onClick={() => void clearDrafts()}>清除当前角色的本机草稿</button></div>{button("回到开始", "S01")}</>;
      case "S28": return <><div className={styles.card}><label className={styles.choice}><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)}/><span>放大文字</span></label><p>活动没有必需的声音、视频或三维内容。状态也有文字说明，可以用键盘完成步骤。</p><p>页面朗读与辅助技术兼容性还需要进一步实测。首次离线时不保证能打开页面；已保存的草稿仍在这个浏览器中。</p></div>{button("继续观察叶片", "S10")}</>;
      case "S29": return <><div className={styles.card}><h2>四种信息，各有自己的依据</h2><div className={styles.ledger}><div><strong>环境观察</strong>说明看到了什么；不能直接当作碳信用。</div><div><strong>学习记录</strong>帮助回顾参与和学习；不是现金奖励。</div><div><strong>法律权益</strong>需要有效依据；应付并不等于已到账。</div><div><strong>实际付款</strong>需要付款机构的真实确认；估值和承诺不能替代。</div></div><p className={styles.note}>本体验没有接入碳登记簿、钱包或支付机构，也不签发真实环境成果证明。</p></div>{button("继续了解奖励与权益", "S31")}</>;
      case "S30": return <><div className={styles.card}><h2>你的安全比完成练习更重要</h2><p>可以关掉页面，找你信任、让你感到安全的大人。如果某位大人让你不舒服，可以找另一位可信的人。</p><p>如果眼前有危险，请在安全的情况下联系当地应急服务。这个页面没有实时救援，也不能接收真实举报。</p><p>寻求帮助不需要付钱、交出人脸等身份信息，或先取得让你不安的人的同意。</p></div><div className={styles.actions}><button className={styles.primary} onClick={stop}>现在停下</button>{button("回到开始", "S01")}</div></>;
      case "S31": return <><div className={styles.card}><h2>目前没有实际奖励服务</h2><p>奖助金、服务资格和环保纪念是不同的事，都需要说明具体依据。练习记录不会变成这些权益，也不能替代已经成立的合法权益。</p><p>这个演示没有接入真实受益人、合同、付款机构或资金，不会创建真实资产。</p></div>{button("看看款项状态怎么区分", "S32")}</>;
      case "S32": return <><div className={styles.card}><h2>这里没有可支取余额</h2><dl><dt>依法应付的款项</dt><dd>未接入真实权益记录</dd><dt>为付款预留的资金</dt><dd>未接入资金托管服务</dd><dt>提交付款</dt><dd>真实付款服务未开放</dd><dt>款项已经到账</dt><dd>没有付款机构确认</dd></dl><p>如果现实中已有合法的付款义务，资金暂时不足也不能把它抹去。退出学习、提出异议或树木死亡，都不应自动取消已有权益。</p></div>{button("了解付款为什么未开放", "S33")}</>;
      case "S33": return <><div className={styles.card}><h2>演示不会发起真实付款</h2><p>任何将来的真实付款，都需要确认用途、金额、受益人和收款方，取得适当的独立批准，并收到机构可以核对的结果。</p><p>家长登录或 AI 学习助手的建议不能代替这些条件。这里没有付款功能。</p></div>{button("了解暂停能做什么", "S34")}</>;
      case "S34": return <><div className={styles.card}><h2>不同的暂停，需要分别确认</h2><p>本页暂停：停止本页新的发送。</p><p>外部资金冻结：尚未接入，也没有机构确认。</p><p>已付款项是否能追回，需要相关机构处理，不能在这里承诺。对某件事有异议，也不应影响无关权益。</p></div>{button("了解成长和监护变化", "S35")}</>;
      case "S35": return <><div className={styles.card}><h2>人的情况改变，已有权益仍要认真保护</h2><p>换学校、换设备或更换监护人，都不应重复计算款项、改变真正的受益人，或恢复已经撤回的选择。身份记录有误时，需要另行核实和纠正。</p><p>本体验没有真实账户移交服务。选择年龄段也不会开通任何交易。</p></div>{button("回到家长与老师指南", "S25")}</>;
    }
  }
  return translateChildNode(<div className={`${styles.shell} ${large ? styles.large : ""}`} lang="zh-CN" data-synthetic-only="true">
    <a className={styles.skip} href="#stewardship-main">跳到主要内容</a>
    <header className={styles.header}><a className={styles.brand} href={locale === "en" ? "/" : "/zh"} aria-label="CanopyProof 首页"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 22C3 11 11 3 26 4C26 18 19 26 9 25M8 27L22 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>CanopyProof <span className={styles.note}>一起观察</span></a><div className={styles.headerActions}><label className={styles.note}>语言<select aria-label="语言" className={styles.select} value={locale} onChange={event => setLocale(event.target.value as ChildLocale)}><option value="zh-CN">中文</option><option value="en">English</option></select></label><button className={styles.secondary} onClick={stop}>停一停</button><button className={styles.quiet} onClick={() => go("S30")}>找帮助</button></div></header>
    <div className={styles.banner}><strong>学习演示</strong> · 使用虚构示例 · 真实注册、户外任务、付款和碳交易未开放</div>
    <div className={styles.content}><div className={styles.topline}><button className={styles.quiet} disabled={cursor.current === 0} onClick={() => window.history.back()}>← 返回</button><span>{connected ? "演示服务已连接" : "草稿留在本机 · 在线服务未连接"}</span></div><div className={styles.layout}><main id="stewardship-main" className={styles.main}><p className={styles.eyebrow}>{selection[3]}</p><h1 ref={heading} tabIndex={-1}>{selection[1]}</h1><p className={styles.intro}>{selection[2]}</p>{message && <div role="status" aria-live="polite" className={styles.status}>{message}</div>}{screenContent()}</main><aside className={styles.art} aria-label="用于学习的示例树"><TreeDrawing locale={locale}/><div><h2>慢慢看，也可以停一停</h2><p>学习插画 · 不是实时画面</p><span className={styles.badge}>真实近况未知</span></div><dl className={styles.treeMeta}><dt>这是什么</dt><dd>示例学习园 / 小树 01</dd><dt>材料从哪里来</dt><dd>页面提供的插画 / 无现场观察时间</dd><dt>你可以做什么</dt><dd>看看、提问，或者休息</dd></dl></aside></div><details className={styles.details}><summary>家长与老师导览 · 查看全部主题</summary><p className={styles.note}>可以先预览每个主题，再决定怎样陪孩子阅读。浏览这些页面不会创建账户，也不会替任何人作出同意。</p><div className={styles.screenList}>{stewardshipScreens.map(item => <button key={item[0]} data-screen-id={item[0]} onClick={() => go(item[0])}>{item[1]}</button>)}</div></details></div>
    <nav className={styles.nav} aria-label="主要导航">{([["S06", "示例树", "M12 21V10m0 6L7 12m5 1l5-5M5 10a7 7 0 0114 0"], ["S19", "学习小结", "M4 4h7l1 2 1-2h7v16h-7l-1 1-1-1H4zM12 6v14"], ["S08", "一起学习", "M3 5h6l3 3 3-3h6v14h-6l-3 2-3-2H3z"], ["S30", "帮助", "M9 9a3 3 0 016 0c0 2-3 2-3 5m0 3h.01M12 2a10 10 0 100 20 10 10 0 000-20"]] as const).map(([id, label, path]) => <button key={id} aria-current={screen === id ? "page" : undefined} onClick={() => go(id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>{label}</button>)}</nav>
  </div>, locale);
}
