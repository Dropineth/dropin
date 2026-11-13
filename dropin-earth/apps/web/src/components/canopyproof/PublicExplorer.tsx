"use client";

import {
  canopyProofPublicExplorerErrorSchema,
  canopyProofPublicExplorerProjectResponseSchema,
  type CanopyProofPublicExplorerProjectResponse,
} from "@dropin/schemas/canopyproof-public-explorer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, type FormEvent, useEffect, useState } from "react";
import { CanopyProofLogo } from "./CanopyProofLogo";

type ExplorerLocale = "en" | "zh";
const ExplorerLanguage = createContext<ExplorerLocale>("en");
function useExplorerCopy() {
  const locale = useContext(ExplorerLanguage);
  return (en: string, zh: string) => locale === "zh" ? zh : en;
}

const publicProjectIdPattern = /^cp_public_project_[a-f0-9]{24}$/;

type ExplorerErrorCode =
  | "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND"
  | "CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED"
  | "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID"
  | "CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED"
  | "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID";

type ExplorerViewState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly publicProjectId: string }
  | { readonly kind: "ready"; readonly response: CanopyProofPublicExplorerProjectResponse }
  | { readonly kind: "unavailable"; readonly code: ExplorerErrorCode };

export type PublicExplorerProps = {
  readonly initialPublicProjectId?: string;
  readonly locale?: ExplorerLocale;
};

export function PublicExplorer({ initialPublicProjectId, locale = "en" }: PublicExplorerProps) {
  const t = (en: string, zh: string) => locale === "zh" ? zh : en;
  const pagePath = initialPublicProjectId ? `/explorer/project/${encodeURIComponent(initialPublicProjectId)}` : "/explorer";
  const router = useRouter();
  const [query, setQuery] = useState(initialPublicProjectId ?? "");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [view, setView] = useState<ExplorerViewState>(
    initialPublicProjectId ? { kind: "loading", publicProjectId: initialPublicProjectId } : { kind: "idle" },
  );

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (!initialPublicProjectId) {
      setView({ kind: "idle" });
      return;
    }
    setQuery(initialPublicProjectId);
    if (!publicProjectIdPattern.test(initialPublicProjectId)) {
      setView({ kind: "unavailable", code: "CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID" });
      return;
    }

    const controller = new AbortController();
    setView({ kind: "loading", publicProjectId: initialPublicProjectId });
    void loadPublicProject(initialPublicProjectId, controller.signal).then((nextView) => {
      if (!controller.signal.aborted) setView(nextView);
    });
    return () => controller.abort();
  }, [initialPublicProjectId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publicProjectId = query.trim();
    if (!publicProjectIdPattern.test(publicProjectId)) {
      setValidationMessage(t("Copy the complete project ID exactly as it appears in the public record.", "请完整复制公开记录中的项目编号，不要修改。"));
      return;
    }
    setValidationMessage(null);
    router.push(`/explorer/project/${encodeURIComponent(publicProjectId)}${locale === "zh" ? "?lang=zh" : ""}`);
  }

  return (
    <ExplorerLanguage.Provider value={locale}><main className="min-h-screen bg-zinc-950 text-zinc-100" lang={locale === "zh" ? "zh-CN" : "en"}>
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link className="flex items-center gap-3" href={locale === "zh" ? "/zh" : "/"} aria-label={t("CanopyProof home", "CanopyProof 首页")}>
            <CanopyProofLogo loading="eager" size={38} />
            <span>
              <strong className="block text-sm font-semibold">CanopyProof</strong>
              <span className="block font-mono text-xs text-zinc-500">{t("Public project records", "公开项目记录")}</span>
            </span>
          </Link>
          <span className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-amber-200">
            {t("Published records only", "仅展示已公开记录")}
          </span>
          <Link className="py-3 text-sm underline underline-offset-4" href={`${pagePath}${locale === "zh" ? "" : "?lang=zh"}`} lang={locale === "zh" ? "en" : "zh-CN"}>{locale === "zh" ? "English" : "中文"}</Link>
        </div>
      </header>

      <section className="border-b border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
          <p className="font-mono text-xs font-semibold uppercase text-emerald-300">{t("Public Explorer", "公开记录查询")}</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl">
            {t("Look up a project record", "查询一份项目记录")}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            {t("Use the project ID provided with a published record to check its current status and review history. Private identities, precise locations and original evidence are not shown.", "输入公开记录中的项目编号，查看当前状态与审核信息。这里不会展示个人身份、精确位置或原始证据。") }
          </p>

          <form className="mt-7 grid max-w-4xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="public-project-id">
                {t("Public project ID", "公开项目编号")}
              </label>
              <input
                aria-describedby="public-project-id-help"
                aria-invalid={validationMessage !== null}
                autoComplete="off"
                className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 font-mono text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                id="public-project-id"
                name="publicProjectId"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="cp_public_project_000000000000000000000000"
                spellCheck={false}
                value={query}
              />
              <p className={validationMessage ? "mt-2 text-sm text-rose-300" : "mt-2 text-xs text-zinc-500"} id="public-project-id-help">
                {validationMessage ?? t("Copy the ID from the published record. A project name will not work here.", "请复制公开记录中的完整编号，此处不能按项目名称搜索。")}
              </p>
            </div>
            <button
              className="h-11 self-start rounded bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-zinc-950 sm:mt-7"
              type="submit"
            >
              {t("View record", "查看记录")}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto min-h-[32rem] w-full max-w-7xl px-5 py-8 sm:px-8" aria-live="polite">
        {view.kind === "idle" ? <IdleState /> : null}
        {view.kind === "loading" ? <LoadingState publicProjectId={view.publicProjectId} /> : null}
        {view.kind === "unavailable" ? <UnavailableState code={view.code} /> : null}
        {view.kind === "ready" ? <ProjectPublication response={view.response} /> : null}
      </div>
    </main></ExplorerLanguage.Provider>
  );
}

async function loadPublicProject(publicProjectId: string, signal: AbortSignal): Promise<ExplorerViewState> {
  try {
    const response = await fetch(`/api/canopyproof/explorer/projects/${encodeURIComponent(publicProjectId)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      method: "GET",
      signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = canopyProofPublicExplorerErrorSchema.safeParse(payload);
      return {
        kind: "unavailable",
        code: error.success ? error.data.error : "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID",
      };
    }
    const parsed = canopyProofPublicExplorerProjectResponseSchema.safeParse(payload);
    return parsed.success
      ? { kind: "ready", response: parsed.data }
      : { kind: "unavailable", code: "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID" };
  } catch {
    return signal.aborted
      ? { kind: "loading", publicProjectId }
      : { kind: "unavailable", code: "CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID" };
  }
}

function IdleState() {
  const t = useExplorerCopy();
  return (
    <section className="border-t border-zinc-800 pt-7">
      <p className="font-mono text-xs uppercase text-zinc-500">{t("Ready to search", "输入编号即可查询")}</p>
      <h2 className="mt-3 text-xl font-semibold">{t("Have a public project ID? Enter it above.", "已有公开项目编号？请在上方输入。")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
        {t("Projects are not listed in a public directory. Ask the project organization for a record it has approved for sharing.", "这里不提供全部项目的公开目录。请向项目机构索取已获准公开的记录。")}
        {/* There is no browse-all endpoint; private project enumeration remains unavailable. */}
      </p>
    </section>
  );
}

function LoadingState({ publicProjectId }: { readonly publicProjectId: string }) {
  const t = useExplorerCopy();
  return (
    <section aria-busy="true" className="border-t border-zinc-800 pt-7">
      <p className="font-mono text-xs text-zinc-500">{t("Checking the latest record", "正在查询最新记录")} · {publicProjectId}</p>
      <div className="mt-6 grid animate-pulse gap-5 md:grid-cols-2">
        <div className="h-36 rounded bg-zinc-900" />
        <div className="h-36 rounded bg-zinc-900" />
        <div className="h-48 rounded bg-zinc-900 md:col-span-2" />
      </div>
    </section>
  );
}

function UnavailableState({ code }: { readonly code: ExplorerErrorCode }) {
  const t = useExplorerCopy();
  const copy = unavailableCopy[code];
  const chinese = unavailableChinese[code];
  return (
    <section className="border-l-2 border-amber-300 bg-zinc-900/40 px-5 py-6" role="status">
      <p className="font-mono text-xs font-semibold uppercase text-amber-200">{t(copy.label, chinese.label)}</p>
      <h2 className="mt-3 text-xl font-semibold">{t(copy.title, chinese.title)}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{t(copy.detail, chinese.detail)}</p>
      <details className="mt-5 text-xs text-zinc-400"><summary className="cursor-pointer py-2">{t("Technical reference", "技术参考编号")}</summary><code className="block break-all py-2">{code}</code></details>
    </section>
  );
}

const unavailableCopy: Record<ExplorerErrorCode, { readonly label: string; readonly title: string; readonly detail: string }> = {
  CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND: {
    label: "Publication unavailable",
    title: "This record is not available to view.",
    detail: "Check the ID with the project organization. The same message is shown for missing, private and unpublished records to protect project information.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED: {
    label: "Service not open",
    title: "Public record lookup is not available yet.",
    detail: "You can still read the guide and explore examples. No project record has been retrieved.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID: {
    label: "Unable to check",
    title: "We could not confirm the current record.",
    detail: "Please try again later. We will not show an unverified result or replace it with sample data.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED: {
    label: "Please wait",
    title: "Too many requests in a short time.",
    detail: "Wait a little before trying again. Your project ID has not changed.",
  },
  CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID: {
    label: "Check the project ID",
    title: "The public project ID is not valid.",
    detail: "Copy the full ID from the published record, including the cp_public_project_ prefix.",
  },
};

const unavailableChinese: typeof unavailableCopy = {
  CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND: { label: "记录暂不可查", title: "目前无法查看这份记录。", detail: "请向项目机构核对编号。为保护项目信息，记录不存在、未公开或无权访问时，均会显示此提示。" },
  CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED: { label: "服务尚未开放", title: "公开记录查询暂不可用。", detail: "你仍可以阅读指南和查看示例。此次查询没有取得项目记录。" },
  CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID: { label: "暂时无法核对", title: "未能确认记录的当前状态。", detail: "请稍后重试。我们不会展示无法核实的结果，也不会用示例数据替代。" },
  CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED: { label: "请稍等", title: "短时间内查询次数较多。", detail: "请稍等片刻再试，项目编号无需更改。" },
  CANOPYPROOF_PUBLIC_EXPLORER_REQUEST_INVALID: { label: "请核对项目编号", title: "项目编号格式不正确。", detail: "请复制公开记录中的完整编号，包括 cp_public_project_ 前缀。" },
};

function ProjectPublication({ response }: { readonly response: CanopyProofPublicExplorerProjectResponse }) {
  const { project, lineage } = response;
  const t = useExplorerCopy();
  return (
    <article>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StateBadge state={project.state} />
            <span className="font-mono text-xs text-zinc-500">{t("Checked", "查询时间")} {response.evaluatedAt}</span>
          </div>
          <h2 className="mt-4 break-all font-mono text-xl font-semibold text-zinc-100">{project.publicProjectId}</h2>
          <p className="mt-2 font-mono text-xs text-zinc-500">{t("Publication", "公开记录编号")} {project.publicationId}</p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          <p>{t("Issued", "出具日期")} {project.recordIssuedOn}</p>
          <p className="mt-1">{t("Confidence", "可信度分级")}: {t({ limited: "Limited", moderate: "Moderate", high: "High" }[project.confidenceBand], { limited: "有限", moderate: "中等", high: "较高" }[project.confidenceBand])}</p>
        </div>
      </div>

      <section className="grid gap-8 border-b border-zinc-800 py-7 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">{t("Public record", "公开记录")}</h3>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Fact label={t("Organization", "项目机构")} value={project.publicOrganizationId} mono />
            <Fact label={t("Area disclosure", "公开面积范围")} value={formatAreaBand(project.areaBand, t)} />
            <Fact label={t("Observation starts", "观察开始日期")} value={project.observationPeriod.startsOn} />
            <Fact label={t("Observation ends", "观察结束日期")} value={project.observationPeriod.endsOn} />
            <Fact label={t("Valid from", "生效日期")} value={project.validity.validFrom} />
            <Fact label={t("Expires at", "到期日期")} value={project.validity.expiresAt} />
            <Fact label={t("Location disclosure", "位置公开程度")} value={project.location.disclosure === "region" ? t("Region only", "仅公开区域") : t("Not disclosed", "未公开")} />
            <Fact label={t("Region", "区域")} value={project.location.regionId ?? t("Not disclosed", "未公开")} />
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">{t("Evidence and governance", "证据与审核")}</h3>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
            <Count label={t("Evidence", "证据")} value={project.evidence.count} />
            <Count label={t("Verification", "审核")} value={project.verification.count} />
            <Count label={t("Monitoring", "监测")} value={project.monitoring.count} />
            <Count label={t("Approvals", "批准记录")} value={project.governance.approvalCount} />
          </dl>
          <div className="mt-5 border-l-2 border-zinc-700 pl-4">
            <p className="text-xs uppercase text-zinc-500">{t("Methodology", "采用的方法")}</p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-200">{project.methodology.id}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-zinc-800 py-7 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">{t("Current challenge state", "当前异议状态")}</h3>
          <p className="mt-3 text-base font-medium text-zinc-100">{project.challenge.state ? t({ open: "Open", under_review: "Under review", resolved: "Resolved", rejected: "Rejected" }[project.challenge.state], { open: "待处理", under_review: "审核中", resolved: "已处理", rejected: "未获支持" }[project.challenge.state]) : t("No published challenge", "暂无已公开异议")}</p>
          {project.challenge.root ? <RootLine label={t("Challenge root", "异议记录校验值")} value={project.challenge.root} /> : null}
          {project.issueCodes.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("Current issue codes", "当前问题编号")}>
              {project.issueCodes.map((code) => (
                <li className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-xs text-amber-100" key={code}>
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">{t("No current issue has been published.", "目前没有已公开的问题记录。")}</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-zinc-300">{t("Public lineage", "记录来源")}</h3>
          <div className="mt-3 grid gap-3">
            <RootLine label={t("Projection root", "查询结果校验值")} value={lineage.projectionRoot} />
            <RootLine label={t("Publication root", "公开版本校验值")} value={lineage.publicationRoot} />
            <RootLine label={t("Record root", "原始记录校验值")} value={lineage.recordRoot} />
            <RootLine label={t("Lifecycle projection", "状态记录校验值")} value={lineage.currentLifecycleProjectionRoot} />
          </div>
        </div>
      </section>

      <section className="py-7">
        <h3 className="text-sm font-semibold uppercase text-zinc-300">{t("Reliance boundaries", "如何使用这份记录")}</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">
          {t("Use this record to understand the project's published evidence and review status. It is not a certified carbon credit, proof of ownership or a financial product. It does not authorize payments, tax offsets or token rewards.", "这份记录用于了解项目已公开的证据和审核状态，不是核证碳信用、所有权证明或金融产品，也不能用于授权支付、抵税或代币奖励。") }
        </p>
      </section>
    </article>
  );
}

function StateBadge({ state }: { readonly state: CanopyProofPublicExplorerProjectResponse["project"]["state"] }) {
  const adverse = state !== "active";
  const t = useExplorerCopy();
  const labels = {
    active: t("Active", "有效"), challenged: t("Under challenge", "存在异议"), suspended: t("Suspended", "已暂停"),
    revoked: t("Revoked", "已撤销"), expired: t("Expired", "已到期"), superseded: t("Replaced by a newer record", "已由新记录替代"), stale: t("Update needed", "待更新"),
  };
  return (
    <span className={adverse
      ? "rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-amber-100"
      : "rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 font-mono text-xs font-semibold uppercase text-emerald-200"}
    >
      {labels[state]}
    </span>
  );
}

function Fact({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div className="min-w-0 border-t border-zinc-800 pt-3">
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className={mono ? "mt-1 break-all font-mono text-sm text-zinc-200" : "mt-1 break-words text-sm text-zinc-200"}>{value}</dd>
    </div>
  );
}

function Count({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="bg-zinc-950 px-3 py-4">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</dd>
    </div>
  );
}

function RootLine({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="border-l border-zinc-700 pl-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <code className="mt-1 block break-all text-xs leading-5 text-zinc-300">{value}</code>
    </div>
  );
}

function formatAreaBand(value: CanopyProofPublicExplorerProjectResponse["project"]["areaBand"], t: (en: string, zh: string) => string): string {
  return { withheld: t("Not disclosed", "未公开"), under_10_ha: t("Under 10 hectares", "不足 10 公顷"), "10_to_100_ha": t("10–100 hectares", "10–100 公顷"), "100_to_1000_ha": t("100–1,000 hectares", "100–1,000 公顷"), over_1000_ha: t("Over 1,000 hectares", "超过 1,000 公顷") }[value];
}
