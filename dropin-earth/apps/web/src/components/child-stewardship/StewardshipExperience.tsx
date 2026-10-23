"use client";

import { useEffect, useRef, useState } from "react";
import { CHILD_DRAFT_SCHEMA, ChildDraftSync, ChildDraftVault, IndexedChildDraftStorage, type ChildDraft, type ObservationChoice } from "@/lib/child-stewardship-offline";
import { ChildDemoApi } from "@/lib/child-stewardship-api";
import { stewardshipScreens, type StewardshipScreenId } from "@/lib/child-stewardship-screens";
import styles from "./Stewardship.module.css";

const answers: Record<ObservationChoice, string> = { green_leaves: "我看到了绿色的叶片", yellow_leaves: "我看到了黄色的叶片", not_sure: "我还不确定" };
function TreeDrawing() {
  return <svg viewBox="0 0 270 300" role="img" aria-label="合成树木插画，不表示实时健康"><ellipse cx="137" cy="271" rx="91" ry="12" fill="#ccd5b9"/><path d="M132 263l7-128m-4 68l-37-38m39 17l38-43" stroke="#817056" strokeWidth="11" fill="none" strokeLinecap="round"/><path d="M67 170C22 154 47 89 77 87C73 24 148 11 173 54C226 49 249 113 214 144C228 200 158 221 135 189C103 207 75 199 67 170Z" fill="#789867"/><path d="M81 141C56 111 88 74 114 86C119 49 160 48 174 81C206 76 217 119 192 137C197 169 158 181 143 155C115 174 92 165 81 141Z" fill="#96ad7d"/><path d="M90 252l-6-14m99 20l6-19m-21 23l-3-11" stroke="#718753" strokeWidth="4" strokeLinecap="round"/></svg>;
}
function Leaves() {
  return <div className={styles.leaves}>{["#6e9256", "#b69d4f"].map((color, index) => <figure key={color}><svg viewBox="0 0 100 120" role="img" aria-label={index ? "黄色示意叶片" : "绿色示意叶片"}><path d="M48 104C4 91 14 25 78 12C91 70 80 95 48 104Z" fill={color}/><path d="M37 115L71 29M48 88L29 70M55 69L76 60M62 50L47 38" stroke="#4d623c" strokeWidth="3" fill="none" strokeLinecap="round"/></svg><figcaption>合成示意 {index ? "B" : "A"}</figcaption></figure>)}</div>;
}
export function StewardshipExperience({ apiBase = process.env.NEXT_PUBLIC_DROPIN_API_URL ?? "" }: { apiBase?: string }) {
  const [screen, setScreen] = useState<StewardshipScreenId>("S01");
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
    catch { setMessage("这个浏览器暂时不能安全保存草稿。你仍然可以阅读，不会显示保存成功。"); }
    return () => { sync.current.withdraw(); api.current?.close(); };
  }, []);
  useEffect(() => {
    if (!storageReady || !vault.current) return;
    let active = true;
    void vault.current.list(profile).then(result => { if (active) setDrafts(result); }).catch(() => { if (active) setMessage("本机草稿暂时无法读取。请保留这台设备，尚未确认清除或上传。"); });
    return () => { active = false; };
  }, [profile, storageReady]);
  function storedEpoch(value: ChildDraft["profile"]): number {
    try { const epoch = Number(localStorage.getItem(`cp-synthetic-epoch:${value}`) ?? 0); return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0; } catch { return 0; }
  }
  useEffect(() => {
    sync.current = new ChildDraftSync(profile, storedEpoch(profile));
    const onStorage = (event: StorageEvent) => {
      if (event.key === `cp-synthetic-epoch:${profile}` && Number(event.newValue) > sync.current.currentEpoch) {
        sync.current.withdraw(Number(event.newValue)); setLearning(false); setUpload(false); setPermissionCheck(false);
        setMessage("另一个标签页已暂停这个演示档案。本页不会继续发送。");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [profile]);
  useEffect(() => { if (initialScreen.current) { initialScreen.current = false; return; } heading.current?.focus({ preventScroll: true }); }, [screen]);
  function go(next: StewardshipScreenId) { setScreen(next); setMessage(""); }
  function revokeLocal() {
    sync.current.withdraw();
    try { localStorage.setItem(`cp-synthetic-epoch:${profile}`, String(sync.current.currentEpoch)); } catch { /* Local stop still applies; no persisted permission is ever granted. */ }
  }
  function stop() {
    revokeLocal(); setLearning(false); setUpload(false); setPermissionCheck(false);
    setScreen("S26"); setMessage("本机已暂停：不再发送新的草稿。已发送内容的服务端处置需另行确认。");
    if (connected && api.current) void api.current.withdraw().then(() => setMessage("本机与合成服务端均已确认暂停新的学习和上传。此前接收的记录尚未确认删除，既有学习贡献不因此清零。")).catch(() => setMessage("本机已暂停。服务端暂停未确认，请保留已有回执；不会继续发送草稿。"));
  }
  function setPermission(purpose: "learning" | "upload", value: boolean) {
    if (!value) {
      revokeLocal();
      if (connected && api.current) void api.current.command("child", { type: "set-assent", profileId: api.current.profileId, purpose, willing: false }).catch(() => setMessage("本机已停止发送；服务端撤回未确认。"));
    }
    if (purpose === "learning") setLearning(value); else setUpload(value);
    setPermissionCheck(false);
  }
  function confirmPermissions() {
    if (learning && upload) sync.current.grant();
    setPermissionCheck(true); go("S05");
  }
  async function saveDraft() {
    if (!learning || !permissionCheck || !vault.current) { setMessage("先在权限说明中选择愿意学习；不愿意也可以继续阅读。"); return; }
    setBusy(true);
    try {
      const draft: ChildDraft = savingDraft.current ?? { schema: CHILD_DRAFT_SCHEMA, id: crypto.randomUUID(), profile, task: "synthetic-indoor-comparison", answer, source: "synthetic_reference", createdAt: new Date().toISOString(), consentEpoch: sync.current.currentEpoch, serverBinding: null };
      savingDraft.current = draft;
      await vault.current.save(draft);
      currentPageDrafts.current.add(draft.id);
      setDrafts(await vault.current.list(profile)); savingDraft.current = null;
      setScreen("S15"); setMessage("已加密保存在这台设备，还没有发出。你可以离开这一步。");
    } catch { setMessage("没有确认保存成功。请不要关闭这页，可以稍后重试或放弃本次记录。"); }
    finally { setBusy(false); }
  }
  async function connect() {
    if (!learning || !upload || !permissionCheck) { setMessage("发送练习需要学习和上传两项选择。现在仍可使用本机观察册。"); return; }
    setBusy(true);
    const service = new ChildDemoApi(apiBase.replace(/\/$/, ""), fetch, profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b");
    try {
      await service.start(); await service.setup(ageBand, true);
      api.current = service; setConnected(true); sync.current.grant();
      setMessage("合成服务已连接。演示角色已完成练习授权；这不证明真实身份或监护关系。草稿尚未发送。");
    } catch { service.close(); setConnected(false); setMessage("合成服务暂不可用，尚未确认接收任何草稿。加密草稿仍在本机。部分初始化是否完成未知，不代表真实账户已创建。"); }
    finally { setBusy(false); }
  }
  async function sendDraft(draft: ChildDraft) {
    if (!api.current || !connected) { setMessage("服务未连接。草稿仍在本机，没有接收回执。"); return; }
    setBusy(true);
    try {
      const bound = api.current.bindDraft(draft, currentPageDrafts.current.has(draft.id));
      if (bound !== draft) {
        if (!vault.current) throw new Error("LOCAL_STORAGE_UNAVAILABLE");
        await vault.current.save(bound);
        setDrafts(previous => previous.map(item => item.id === bound.id ? bound : item));
      }
      const receipt = await sync.current.sync(bound, api.current.transport(bound));
      setReceived(previous => ({ ...previous, [draft.id]: receipt.receiptId }));
      setMessage(`合成服务已收到。接收编号：${receipt.receiptId}。尚未审核，不表示树存活。`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "DRAFT_REAUTHORIZATION_REQUIRED" ? "这份未绑定草稿来自较早的页面会话，只能在本机查看。不能恢复旧授权；你可以重新选择权限后创建一份新的合成观察。" : code === "CONSENT_WITHDRAWN" ? "本机授权已撤回或已变化。未开始的发送已阻止；已经传出的部分需要核对，不能保证从未发出。" : "没有收到有效接收回执，结果待核实。草稿保留；重试使用同一请求编号，不会另建一份记录。");
    } finally { setBusy(false); }
  }
  async function review() {
    if (!observationId || !api.current || !connected) { setLocalReviewed(true); setMessage("仅在本页模拟：这份合成观察可用于学习，但不足以确认存活。没有人类审阅员接单，也没有签发真实凭据。"); return; }
    setBusy(true);
    try {
      await api.current.command("reviewer", { type: "review-observation", observationId, decision: "insufficient_for_survival", reason: "synthetic_source" });
      await api.current.command("reviewer", { type: "grant-contribution", observationId, policyVersion: "child-learning-demo-v1" });
      setServerReviewed(true); setMessage("合成服务记录了演示审核与学习反馈：仍不足以确认树存活。演示角色切换不是独立真人审核。");
    } catch { setMessage("审核或学习反馈没有全部确认完成。请核对服务记录，不能显示真实核查通过。"); }
    finally { setBusy(false); }
  }
  async function openChallenge() {
    if (!observationId || !api.current || !connected) { setChallenge("本地练习，尚未发送"); setScreen("S24"); return; }
    setBusy(true);
    try {
      const result = await api.current.command("child", { type: "open-dispute", profileId: api.current.profileId, targetId: observationId, reason: challengeReason });
      setChallenge(`合成服务接收编号：${result.id}。等待演示复核，不代表真实保护服务接单。`); setScreen("S24");
    } catch { setMessage("未收到异议接收回执，不能确认已发送。真实安全问题请找可信的大人。"); }
    finally { setBusy(false); }
  }
  async function clearDrafts() {
    revokeLocal(); setLearning(false); setUpload(false); setPermissionCheck(false);
    if (!vault.current) { setMessage("本机存储不可用，未确认清除。"); return; }
    setBusy(true);
    try { await vault.current?.clear(profile); setDrafts([]); setMessage("当前演示档案的本机草稿与加密密钥已清除。服务端记录和其他设备副本不包含在这次清除中。"); }
    catch { setMessage("清除未确认完成，请不要把设备交给其他人。你可以再次尝试。"); }
    finally { setBusy(false); }
  }
  function changeProfile(value: ChildDraft["profile"]) {
    revokeLocal(); api.current?.close(); api.current = null;
    sync.current = new ChildDraftSync(value, storedEpoch(value)); setProfile(value); setDrafts([]); setReceived({});
    setConnected(false); setLearning(false); setUpload(false); setPermissionCheck(false); setLocalReviewed(false); setServerReviewed(false); setChallenge(""); savingDraft.current = null;
  }
  const button = (label: string, next: StewardshipScreenId) => <button className={styles.primary} onClick={() => go(next)}>{label}</button>;
  const learningRecord = localReviewed || serverReviewed;
  function screenContent() {
    switch (screen) {
      case "S01": return <><div className={styles.card}><h2>小小观察，慢慢认识</h2><p>你不需要拥有一棵树，也不需要证明什么。看一看、说「不知道」、选择休息，都可以。</p><p className={styles.note}>全程合成演示 · 不采集真实身份 · 不需要相机与定位</p></div><div className={styles.actions}>{button("和大人一起开始", "S02")}<button className={styles.secondary} onClick={() => go("S08")}>先看看学习材料</button></div></>;
      case "S02": return <><div className={styles.card}><h2>这里不创建真实账户</h2><p>Passkey 注册、法定监护核验与正式恢复尚未开放。你可以了解流程，再使用固定演示档案。</p><p className={styles.note}>设备的 PIN 或系统解锁方式不等于网站收集生物模板。此演示不调用身份验证器。</p></div><div className={styles.actions}>{button("使用合成演示档案", "S03")}{button("跳过，直接学习", "S08")}</div></>;
      case "S03": return <><div className={styles.card}><label htmlFor="demo-profile">合成观察者</label><select id="demo-profile" className={styles.select} value={profile} onChange={event => changeProfile(event.target.value as ChildDraft["profile"])}><option value="synthetic-a">小叶子 A（虚构）</option><option value="synthetic-b">小叶子 B（虚构）</option></select><label htmlFor="reading-age">阅读方式，不是法律年龄核验</label><select id="reading-age" className={styles.select} value={ageBand} onChange={event => setAgeBand(event.target.value as typeof ageBand)}><option value="6-8">6–8 岁 · 一起阅读</option><option value="9-12">9–12 岁 · 慢慢探索</option><option value="13-17">13–17 岁 · 看看依据</option></select><label className={styles.choice}><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)}/><span>放大文字</span></label></div>{button("看看权限说明", "S04")}</>;
      case "S04": return <><div className={styles.card}><fieldset><legend>先问问自己愿不愿意</legend><label className={styles.choice}><input type="checkbox" checked={learning} onChange={event => setPermission("learning", event.target.checked)}/><span>愿意进行这次合成学习，并在本机保存一个预设描述。</span></label><label className={styles.choice}><input type="checkbox" checked={upload} onChange={event => setPermission("upload", event.target.checked)}/><span>愿意在明确点击发送后，把合成描述发给可用的演示服务。</span></label></fieldset><p className={styles.note}>不公开、不用于模型训练、不自动发送。正式地区、数据保留与儿童保护服务未获准前，不接收真实儿童资料。</p></div><div className={styles.actions}><button className={styles.primary} onClick={confirmPermissions}>保存我的选择</button>{button("都不选择，继续阅读", "S08")}</div></>;
      case "S05": return <><div className={styles.card}><h2>样例学习园 · 小树 01</h2><dl><dt>材料来源</dt><dd>应用内合成插画与预设描述</dd><dt>真实管理许可</dt><dd>未核验；无现场任务</dd><dt>守护关系</dt><dd>学习参与，不是树木产权</dd></dl></div>{button("打开树的观察页", "S06")}</>;
      case "S06": return <><div className={styles.card}><span className={styles.badge}>当前未知 · 合成示例</span><h2>先看看我们有哪些记录</h2><p>没有真实现场观察，没有实时传感器，也没有碳核证。</p><p className={styles.note}>最后真实观察：未接入。这里的插画不反映树的当下状态。</p></div><div className={styles.actions}>{button("认识讲解员", "S07")}{button("选一次室内观察", "S10")}</div></>;
      case "S07": return <><div className={styles.card}><h2>讲解员能知道树现在的一切吗？</h2><div className={styles.actions}><button className={styles.secondary} onClick={() => setQuestion("还不能。讲解只能依据已有材料，不能看见没有记录的当下。你可以再选一次。")}>能</button><button className={styles.primary} onClick={() => { setQuestion("对，我们可以一起看来源，也可以说不知道。"); go("S08"); }}>不能，只能看已有记录</button></div>{question && <p role="status">{question}</p>}</div></>;
      case "S08": return <><div className={styles.card}><h2>选择一个问题</h2><div className={styles.actions}><button className={styles.secondary} onClick={() => setQuestion("叶片颜色可能不同。这里只展示两张合成插画，不能判断真实树是否缺水或生病。来源：合成学习材料 v1。")}>叶子为什么不一样？</button><button className={styles.secondary} onClick={() => setQuestion("我们还不知道真实树在哪里、什么时候被观察、现在是什么状态。对话不会生成存活证明或碳信用。来源：合成学习材料 v1。")}>我们还不知道什么？</button></div>{question && <p role="status" className={styles.status}>{question}</p>}<p className={styles.note}>静态批准内容 · 产品侧演示适配器 · PoCC / ChainRank 未接入</p></div>{button("看材料的来源", "S09")}</>;
      case "S09": return <><div className={styles.card}><Leaves/><p><strong>来源：</strong>应用内合成示意，版本 1。</p><p><strong>观察时间：</strong>无真实拍摄时间。</p><p><strong>能说明：</strong>我们在比较两张示意叶片。</p><p><strong>不能说明：</strong>现场身份、持续存活、碳移除或法律权益。</p><p className={styles.note}>E0 学习表达。图像完整性不等于现实真实性。</p></div>{button("用这些材料做观察", "S10")}</>;
      case "S10": return <><div className={styles.card}><h2>在室内比较两片叶子</h2><p>任务：选一个你看到的颜色，或选择不确定。</p><p>来源：合成材料 · 风险：低 · 随时可退出</p><p className={styles.note}>真实户外任务未开放。无需设备权限，不影响基本学习参与。</p></div>{button("看看安全约定", "S11")}</>;
      case "S11": return <><div className={styles.card}><h2>今天只看屏幕里的示意图</h2><p>不去外面找树，不使用工具、药剂，不靠近虫巢或野生动物。浇水、施肥、修剪由有资格的大人按现场方案判断。</p><p>如果不舒服，随时点「停一停」。</p></div>{button("开始室内比较", "S12")}</>;
      case "S12": return <><div className={styles.card}><Leaves/><fieldset><legend>选择你的观察</legend>{Object.entries(answers).map(([value, label]) => <label className={styles.choice} key={value}><input type="radio" name="observation" value={value} checked={answer === value} onChange={() => { setAnswer(value as ObservationChoice); savingDraft.current = null; }}/><span>{label}</span></label>)}</fieldset></div>{button("预览我的记录", "S13")}</>;
      case "S13": return <><div className={styles.card}><h2>{answers[answer]}</h2><p>来源：已提供的合成材料，不是现场采集。</p><p>预设描述、合成任务、随机草稿编号和本机保存时间。</p><p className={styles.note}>不含照片、位置、设备指纹、姓名或自由文字。时间是本机声明，不能证明拍摄时点。</p></div><div className={styles.actions}>{button("继续保存", "S14")}{button("换一个描述", "S12")}</div></>;
      case "S14": return <><div className={styles.card}><h2>还没有发出</h2><p>当前浏览器支持安全存储：{storageReady ? "已初始化，保存时仍会检查" : "尚未确认"}</p><p>共享设备上的加密不替代退出与清除。没有确认保存成功时，请不要依赖草稿恢复。</p></div><button className={styles.primary} disabled={busy || !storageReady} onClick={() => void saveDraft()}>{busy ? "正在保存…" : "加密保存到本机"}</button>{!permissionCheck && <div className={styles.actions}>{button("先选择学习权限", "S04")}</div>}</>;
      case "S15": return <><div className={styles.card}><h2>{drafts.length ? `${drafts.length} 份本机草稿` : "还没有本机草稿"}</h2>{drafts.map(draft => <article key={draft.id}><h3>{answers[draft.answer]}</h3><p className={styles.note}>{received[draft.id] ? "合成服务已接收；本机保留副本" : "保存在本机，尚无接收回执"} · 非现场材料</p><button className={styles.quiet} disabled={busy} onClick={() => void vault.current?.storage.remove(draft.id, profile).then(() => setDrafts(previous => previous.filter(item => item.id !== draft.id))).catch(() => setMessage("移除尚未确认完成。"))}>移除这份本机草稿</button></article>)}</div><div className={styles.actions}>{button("查看发送状态", "S16")}{button("再做一次观察", "S10")}</div></>;
      case "S16": return <><div className={styles.card}><h2>{connected ? "合成服务已连接" : "当前只有本机草稿"}</h2><p>发送前会重新查询当前授权。服务不可用或权限已撤回时，不发送草稿内容。</p>{!connected && <button className={styles.secondary} disabled={busy} onClick={() => void connect()}>检查并连接合成服务</button>}{drafts.map(draft => <div className={styles.card} key={draft.id}><strong>{answers[draft.answer]}</strong><p className={styles.note}>{received[draft.id] ? `已收到 · ${received[draft.id]}` : "没有接收回执"}</p><button className={styles.primary} disabled={busy || !connected || !upload || !learning} onClick={() => void sendDraft(draft)}>{received[draft.id] ? "核对同一请求回执" : "发送这份合成草稿"}</button></div>)}<p className={styles.note}>服务端返回接收不等于审核通过。关闭页面后的旧草稿可继续读取，但演示不恢复旧身份或上传授权，不能自动绑定新会话。</p></div>{button("看看审核步骤", "S17")}</>;
      case "S17": return <><div className={styles.card}><h2>{learningRecord ? "不足以确认存活" : "尚未审核"}</h2><p>{serverReviewed ? "合成服务记录了演示角色的审核和学习反馈。" : localReviewed ? "仅本页模拟，没有服务端审核回执。" : "没有真实审阅员接单，不承诺处理时间。"}</p><button className={styles.secondary} disabled={busy} onClick={() => void review()}>{observationId ? "演示审阅角色：核对合成记录" : "本地演练：为什么不足以确认存活"}</button></div>{button("看看任务回执", "S18")}</>;
      case "S18": return <><div className={styles.card}><h2>练习内容：比较与描述</h2><p>真实现场行动：没有执行。</p><p>服务接收：{observationId ? "已有合成接收回执" : "没有回执"}。</p><p>生态结论：未知；合成材料不足以确认存活。</p></div>{button("放进我的观察册", "S19")}</>;
      case "S19": return <><div className={styles.card}><h2>{learningRecord ? "你练习了认真描述，也保留了未知" : "观察册可以慢慢积累"}</h2><p>{serverReviewed ? "合成学习反馈已记录在演示服务。" : localReviewed ? "这条反馈只在本页演练，不是签发凭据。" : "本机草稿与接收、审核状态分别展示。"}</p><p>可以不显示积分。暂停、树死亡或不再登录，不会把你的善意学习变成债务。</p></div><div className={styles.actions}>{button("看看学习记录的范围", "S20")}<button className={styles.secondary} onClick={stop}>今天到这里</button></div></>;
      case "S20": return <><div className={styles.card}><h2>学习贡献 · 非金融</h2><p>范围：比较合成叶片。证据等级：E0。审核状态：{serverReviewed ? "合成服务演示审核" : "没有已签发的服务凭据"}。</p><p>没有交易、提现或兑换接口。贡献归属与真实法律权益分别记录。</p></div><div className={styles.actions}>{button("这里可能不对", "S23")}{button("为什么近况未知", "S21")}</div></>;
      case "S21": return <><div className={styles.card}><h2>未知可以诚实地留下</h2><p>断网、旧记录、冬季落叶或没有登录，都不能单独证明树死亡。没有新证据时，先看历史或休息。</p></div><div className={styles.actions}>{button("回到观察册", "S19")}{button("了解树死亡的学习情境", "S22")}</div></>;
      case "S22": return <><div className={styles.card}><h2>这不是你的错</h2><p>真实树可能因天气、病害或其他原因死亡。它的生命不由你有没有打开应用决定。尚未确认原因时，我们仍然说不知道。</p><p>原有观察册可以保留。补种的新树需要新身份，不能冒充原树继续生长。</p></div><div className={styles.actions}>{button("暂时不看，回观察册", "S19")}{button("找可信的大人", "S30")}</div></>;
      case "S23": return <><div className={styles.card}><label htmlFor="challenge-reason">演练一个异议类别</label><select id="challenge-reason" className={styles.select} value={challengeReason} onChange={event => setChallengeReason(event.target.value)}><option value="wrong_time">记录的时间可能不对</option><option value="wrong_tree">可能不是同一棵树</option><option value="do_not_share">我不想公开</option><option value="not_understood">我没有看懂</option></select><p className={styles.note}>不填写真实事件或个人信息。真实危险或不安全成人问题不进入这个演示，请使用帮助出口。被指涉成人不应自动收到求助内容。</p></div><button className={styles.primary} disabled={busy} onClick={() => void openChallenge()}>提交合成异议练习</button><div className={styles.actions}>{button("真实安全问题：查看帮助", "S30")}</div></>;
      case "S24": return <><div className={styles.card}><h2>{challenge || "还没有异议练习"}</h2><p>处理责任：需要独立人工复核。真实处置团队：尚未开放。没有处理期限承诺。</p><p>投诉不会自动减少学习贡献，也不会没收依法已有权益。</p></div>{button("返回观察册", "S19")}</>;
      case "S25": return <><div className={styles.card}><h2>当前演示范围</h2><p>档案：{profile === "synthetic-a" ? "小叶子 A" : "小叶子 B"}（虚构）</p><p>本机学习意愿：{learning ? "愿意" : "未同意或已暂停"}</p><p>本机上传意愿：{upload ? "愿意，仍需逐次点击" : "未同意或已暂停"}</p><p>真实监护关系：未核验。正式 Passkey：未开放。</p><p className={styles.note}>家庭视图不展示保护举报、举报计数或安全联系方式。</p></div><div className={styles.actions}>{button("调整权限", "S26")}{button("设备与恢复", "S27")}{button("了解权益", "S31")}</div></>;
      case "S26": return <><div className={styles.card}><h2>停止新的发送，保留你的选择</h2><p>本机学习：{learning ? "当前愿意" : "已停止或未选择"}；上传：{upload ? "当前愿意" : "已停止或未选择"}。</p><p>本机暂停不会假装抹去已经传出的字节。服务端删除与合法保留需要单独确认；正式隐私请求服务未开放。</p><button className={styles.secondary} onClick={stop}>立即暂停学习与上传</button></div><div className={styles.actions}>{button("重新查看分项权限", "S04")}{button("管理本机草稿", "S27")}</div></>;
      case "S27": return <><div className={styles.card}><h2>清除当前演示档案</h2><p>删除当前浏览器里的草稿和对应加密密钥，不删除其他演示档案。已传到服务端的记录不在本机清除范围内。</p><p className={styles.note}>加密无法保护仍然解锁的共享浏览器。正式设备撤销、恢复及跨设备删除尚未开放。</p><button className={styles.secondary} disabled={busy} onClick={() => void clearDrafts()}>清除当前档案的本机草稿</button></div>{button("回到欢迎页", "S01")}</>;
      case "S28": return <><div className={styles.card}><label className={styles.choice}><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)}/><span>放大文字</span></label><p>默认没有声音、视频或三维下载，没有只靠颜色表达的状态。可以用键盘操作全部步骤。</p><p>中文朗读与真实辅助技术共创尚待验收。浏览器离线缓存未就绪时，不能保证离线首次打开页面；已保存草稿仍保留在设备。</p></div>{button("继续室内观察", "S10")}</>;
      case "S29": return <><div className={styles.card}><h2>四类记录，分别核对</h2><div className={styles.ledger}><div><strong>E · 生态证据</strong>记录了什么，不是碳信用。</div><div><strong>C · 学习贡献</strong>贡献署名，不是钱。</div><div><strong>R · 法律义务</strong>有效依据下的应付，不是到账。</div><div><strong>F · 资金履约</strong>机构真实回执，不是未来估值。</div></div><p className={styles.note}>PoCC、ChainRank、碳登记簿、钱包与支付机构均未接入此体验。</p></div>{button("查看权益来源边界", "S31")}</>;
      case "S30": return <><div className={styles.card}><h2>你的安全比完成任务重要</h2><p>可以关掉应用，找你信任、让你感到安全的大人。如果某位大人让你不舒服，可以寻找另一位可信的人。</p><p>如果有眼前危险，请在安全情况下联系所在地的应急服务。这里没有实时救援，也不收集真实举报内容。</p><p>你不需要付款、提供生物信息，或先得到被投诉人的同意，才可以寻求帮助。</p></div><div className={styles.actions}><button className={styles.primary} onClick={stop}>现在停下</button>{button("回到欢迎页", "S01")}</div></>;
      case "S31": return <><div className={styles.card}><h2>当前未开放</h2><p>合同奖助、合法服务受益与碳退休纪念是不同权利类型。学习积分不能替代已成立的法律权益。</p><p>本演示没有真实受益人、义务人、合同、机构或资金。没有创建任何真实资产。</p></div>{button("看看对账的区别", "S32")}</>;
      case "S32": return <><div className={styles.card}><h2>没有可支取余额</h2><dl><dt>法律应付</dt><dd>未连接真实权利登记</dd><dt>已预留资金</dt><dd>未连接托管机构</dd><dt>付款提交</dt><dd>真实执行关闭</dd><dt>最终到账</dt><dd>没有机构回执</dd></dl><p>即使资金不足，依法产生的义务也必须如实保留。争议、退出或树死亡不能自动抹账。</p></div>{button("了解受控支出", "S33")}</>;
      case "S33": return <><div className={styles.card}><h2>真实付款关闭</h2><p>真实执行需要独立角色、当前有效授权、固定受益人与目的地、逐币种预留和可核验机构回执。</p><p>监护人登录、AI 建议或一个开关不能替代这些条件。此页面没有付款按钮。</p></div>{button("了解权益保护", "S34")}</>;
      case "S34": return <><div className={styles.card}><h2>保护状态要说清楚</h2><p>本机暂停：只能停止本机新的提交。</p><p>机构冻结：未接入，也没有收到确认。</p><p>追回已付资金：不能承诺。争议应限于相关范围，不因投诉没收其他权益。</p></div>{button("了解成年或监护移交", "S35")}</>;
      case "S35": return <><div className={styles.card}><h2>变化的是有效控制，不是孩子的权益</h2><p>换学校、恢复设备或监护变化，不应复制余额、改变受益主体或复活旧权限。法定身份纠错需要独立的特殊程序。</p><p>真实移交尚未开放；不提供年龄开关或自动交易入口。</p></div>{button("回到成人视图", "S25")}</>;
    }
  }
  return <div className={`${styles.shell} ${large ? styles.large : ""}`} lang="zh-CN" data-synthetic-only="true">
    <a className={styles.skip} href="#stewardship-main">跳到主要内容</a>
    <header className={styles.header}><a className={styles.brand} href="/" aria-label="CanopyProof 首页"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 22C3 11 11 3 26 4C26 18 19 26 9 25M8 27L22 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>CanopyProof <span className={styles.note}>树木观察册</span></a><div className={styles.headerActions}><button className={styles.secondary} onClick={stop}>停一停</button><button className={styles.quiet} onClick={() => go("S30")}>找帮助</button></div></header>
    <div className={styles.banner}><strong>合成演示</strong> · 虚构角色与树木 · 真实身份、现场任务、资金和碳交易未开放</div>
    <div className={styles.content}><div className={styles.topline}><button className={styles.quiet} onClick={() => go(screen === "S01" ? "S01" : stewardshipScreens[Math.max(0, stewardshipScreens.findIndex(item => item[0] === screen) - 1)]![0])}>← 返回</button><span>{connected ? "合成服务已连接" : "本机体验 · 服务未连接"}</span></div><div className={styles.layout}><main id="stewardship-main" className={styles.main}><p className={styles.eyebrow}>{selection[3]} · {screen}</p><h1 ref={heading} tabIndex={-1}>{selection[1]}</h1><p className={styles.intro}>{selection[2]}</p>{message && <div role="status" aria-live="polite" className={styles.status}>{message}</div>}{screenContent()}</main><aside className={styles.art} aria-label="合成树木材料"><TreeDrawing/><div><h2>慢慢观察就好</h2><p>合成插画 · 不是实时画面</p><span className={styles.badge}>近况未知</span></div><dl className={styles.treeMeta}><dt>材料</dt><dd>样例学习园 / 小树 01</dd><dt>来源与时点</dt><dd>合成示意 / 无真实观察时间</dd><dt>今天可以做</dt><dd>看一看，提个问题，或休息</dd></dl></aside></div><details className={styles.details}><summary>成人演示导览 · 全部 35 个屏幕与状态</summary><p className={styles.note}>此导览用于检查产品边界；查看某个页面不会取得真实权限或创建账户。</p><div className={styles.screenList}>{stewardshipScreens.map(item => <button key={item[0]} onClick={() => go(item[0])}>{item[0]} · {item[1]}</button>)}</div></details></div>
    <nav className={styles.nav} aria-label="主要导航">{([["S06", "我的树", "M12 21V10m0 6L7 12m5 1l5-5M5 10a7 7 0 0114 0"], ["S19", "观察册", "M4 4h7l1 2 1-2h7v16h-7l-1 1-1-1H4zM12 6v14"], ["S08", "一起学习", "M3 5h6l3 3 3-3h6v14h-6l-3 2-3-2H3z"], ["S30", "帮助", "M9 9a3 3 0 016 0c0 2-3 2-3 5m0 3h.01M12 2a10 10 0 100 20 10 10 0 000-20"]] as const).map(([id, label, path]) => <button key={id} aria-current={screen === id ? "page" : undefined} onClick={() => go(id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>{label}</button>)}</nav>
  </div>;
}
