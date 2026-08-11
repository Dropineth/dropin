"use client";

import type {
  CanopyProofMobileEvidenceCapture,
  CanopyProofMobileEvidenceDraft,
  CanopyProofMobileEvidenceType,
} from "@dropin/schemas/canopyproof-mobile-evidence";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanopyProofMobileEvidenceVault,
  canopyProofLegacyMobileEvidenceStorageKey,
  isCanopyProofMobileEvidenceVaultError,
  parseCanopyProofMobileEvidenceCapture,
  type CanopyProofMobileEvidenceVaultErrorCode,
} from "@/lib/canopyproof-mobile-evidence-vault";
import {
  createCanopyProofMobileEvidenceBrowserVault,
  migrateCanopyProofLegacyMobileEvidenceLocalStorage,
} from "@/lib/canopyproof-mobile-evidence-indexeddb";

type DraftForm = {
  readonly evidenceType: CanopyProofMobileEvidenceType;
  readonly projectId: string;
  readonly observedAt: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly gpsAccuracyMeters: string;
  readonly mediaHash: string;
  readonly deviceFingerprintHash: string;
  readonly exifHash: string;
  readonly notes: string;
};

type VaultViewState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly drafts: readonly CanopyProofMobileEvidenceDraft[];
      readonly migratedLegacyCount: number;
    }
  | { readonly kind: "unavailable"; readonly code: CanopyProofMobileEvidenceVaultErrorCode }
  | { readonly kind: "recovery_required"; readonly code: CanopyProofMobileEvidenceVaultErrorCode };

const evidenceTypes: readonly { value: CanopyProofMobileEvidenceType; label: string }[] = [
  { value: "tree_planting", label: "Tree planting" },
  { value: "restoration", label: "Restoration" },
  { value: "biodiversity", label: "Biodiversity" },
  { value: "water", label: "Water project" },
  { value: "soil", label: "Soil regeneration" },
  { value: "climate_observation", label: "Climate observation" },
];

const initialDraft: DraftForm = {
  evidenceType: "tree_planting",
  projectId: "",
  observedAt: "",
  latitude: "",
  longitude: "",
  gpsAccuracyMeters: "",
  mediaHash: "",
  deviceFingerprintHash: "",
  exifHash: "",
  notes: "",
};

export function MobileEvidenceDraftQueue() {
  const [view, setView] = useState<VaultViewState>({ kind: "loading" });
  const [form, setForm] = useState<DraftForm>(initialDraft);
  const [operationPending, setOperationPending] = useState(false);
  const [operationError, setOperationError] = useState<CanopyProofMobileEvidenceVaultErrorCode | null>(null);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const vaultRef = useRef<CanopyProofMobileEvidenceVault | null>(null);
  const loadGenerationRef = useRef(0);

  const loadVault = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    let vault: CanopyProofMobileEvidenceVault | null = null;
    setView({ kind: "loading" });
    setOperationError(null);
    setResetConfirmation(false);
    vaultRef.current?.close();
    try {
      vault = createCanopyProofMobileEvidenceBrowserVault();
      vaultRef.current = vault;
      const migration = await migrateCanopyProofLegacyMobileEvidenceLocalStorage(vault);
      await vault.initialize();
      const drafts = await vault.listDrafts();
      if (loadGenerationRef.current !== generation) return;
      setView({
        kind: "ready",
        drafts,
        migratedLegacyCount: migration.state === "migrated" ? migration.recordCount : 0,
      });
    } catch (error) {
      vault?.close();
      if (vaultRef.current === vault) vaultRef.current = null;
      if (loadGenerationRef.current !== generation) return;
      setView(classifyVaultFailure(error));
    }
  }, []);

  useEffect(() => {
    void loadVault();
    return () => {
      loadGenerationRef.current += 1;
      vaultRef.current?.close();
      vaultRef.current = null;
    };
  }, [loadVault]);

  const parsedCapture = useMemo(() => parseDraftForm(form), [form]);
  const canQueue = parsedCapture !== null;

  function updateField<Key extends keyof DraftForm>(key: Key, value: DraftForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function queueDraft() {
    const vault = vaultRef.current;
    if (!vault || view.kind !== "ready" || parsedCapture === null || operationPending) return;
    setOperationPending(true);
    setOperationError(null);
    try {
      await vault.queueCapture(parsedCapture);
      setView({ ...view, drafts: await vault.listDrafts(), migratedLegacyCount: 0 });
      setForm(initialDraft);
    } catch (error) {
      handleOperationFailure(error);
    } finally {
      setOperationPending(false);
    }
  }

  async function removeDraft(id: string) {
    const vault = vaultRef.current;
    if (!vault || view.kind !== "ready" || operationPending) return;
    setOperationPending(true);
    setOperationError(null);
    try {
      await vault.removeDraft(id);
      setView({ ...view, drafts: await vault.listDrafts(), migratedLegacyCount: 0 });
    } catch (error) {
      handleOperationFailure(error);
    } finally {
      setOperationPending(false);
    }
  }

  async function eraseVaultForRecovery() {
    if (!resetConfirmation || operationPending) return;
    const vault = vaultRef.current ?? createCanopyProofMobileEvidenceBrowserVault();
    setOperationPending(true);
    setOperationError(null);
    try {
      await vault.eraseLocalVault();
      window.localStorage.removeItem(canopyProofLegacyMobileEvidenceStorageKey);
      await loadVault();
    } catch (error) {
      const failure = classifyVaultFailure(error);
      setView(failure);
    } finally {
      setOperationPending(false);
    }
  }

  function handleOperationFailure(error: unknown) {
    if (!isCanopyProofMobileEvidenceVaultError(error)) {
      setView({
        kind: "unavailable",
        code: "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE",
      });
      return;
    }
    if (
      error.code === "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED" ||
      error.code === "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID"
    ) {
      setView({ kind: "recovery_required", code: error.code });
      return;
    }
    if (
      error.code === "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE" ||
      error.code === "CANOPYPROOF_MOBILE_EVIDENCE_CRYPTO_UNAVAILABLE"
    ) {
      setView({ kind: "unavailable", code: error.code });
      return;
    }
    setOperationError(error.code);
  }

  if (view.kind === "loading") return <MobileEvidenceVaultSkeleton />;

  if (view.kind === "unavailable") {
    return (
      <MobileEvidenceVaultFailure
        code={view.code}
        title="Encrypted offline storage is unavailable"
        detail="No evidence was queued. Restore browser storage and Web Crypto access before capturing field data."
        actionLabel="Retry secure storage"
        action={loadVault}
        actionDisabled={operationPending}
      />
    );
  }

  if (view.kind === "recovery_required") {
    return (
      <section className="border border-rose-800 bg-rose-950/40 p-5 lg:p-6" role="alert">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-200">Recovery required</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">The encrypted local vault could not be authenticated.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-rose-100">
          The queue is not being shown as empty. This can indicate a damaged record, missing local key, or an invalid
          legacy migration. No data was synchronized or accepted as proof.
        </p>
        <p className="mt-3 font-mono text-xs text-rose-200">{view.code}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="border border-slate-600 bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            type="button"
            disabled={operationPending}
            onClick={() => void loadVault()}
          >
            Retry recovery
          </button>
          {!resetConfirmation ? (
            <button
              className="border border-rose-700 px-4 py-3 text-sm font-semibold text-rose-100"
              type="button"
              onClick={() => setResetConfirmation(true)}
            >
              Review local reset
            </button>
          ) : (
            <button
              className="border border-rose-500 bg-rose-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              type="button"
              disabled={operationPending}
              onClick={() => void eraseVaultForRecovery()}
            >
              Erase local encrypted drafts
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-5 border border-slate-800 bg-slate-900/60 p-5 lg:grid-cols-[1fr_0.8fr] lg:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Encrypted offline queue</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Capture locally. Preserve authority boundaries.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Draft payloads are encrypted in this browser with a non-exportable local key. Production synchronization is
          not activated, and local capture never issues proof, moves funds, or creates a public claim.
        </p>

        {view.migratedLegacyCount > 0 ? (
          <p className="mt-4 border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100" role="status">
            {view.migratedLegacyCount} legacy {view.migratedLegacyCount === 1 ? "draft was" : "drafts were"} encrypted and
            removed from plaintext browser storage.
          </p>
        ) : null}
        {operationError ? (
          <p className="mt-4 border border-amber-800 bg-amber-950/40 px-3 py-2 font-mono text-xs text-amber-100" role="alert">
            {operationError}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Evidence type
            <select
              className="border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300"
              value={form.evidenceType}
              onChange={(event) => updateField("evidenceType", event.target.value as CanopyProofMobileEvidenceType)}
            >
              {evidenceTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>

          <DraftInput label="Project ID" value={form.projectId} onChange={(value) => updateField("projectId", value)} />
          <DraftInput label="Observed at" type="datetime-local" value={form.observedAt} onChange={(value) => updateField("observedAt", value)} />
          <DraftInput label="GPS accuracy meters" inputMode="decimal" value={form.gpsAccuracyMeters} onChange={(value) => updateField("gpsAccuracyMeters", value)} />
          <DraftInput label="Latitude" inputMode="decimal" value={form.latitude} onChange={(value) => updateField("latitude", value)} />
          <DraftInput label="Longitude" inputMode="decimal" value={form.longitude} onChange={(value) => updateField("longitude", value)} />
          <DraftInput label="Media SHA-256" value={form.mediaHash} onChange={(value) => updateField("mediaHash", value)} />
          <DraftInput label="Device fingerprint SHA-256" value={form.deviceFingerprintHash} onChange={(value) => updateField("deviceFingerprintHash", value)} />
          <DraftInput label="EXIF SHA-256 (optional)" value={form.exifHash} onChange={(value) => updateField("exifHash", value)} />
        </div>

        <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-200">
          Field notes
          <textarea
            className="min-h-24 border border-slate-700 bg-slate-950 px-3 py-3 text-sm leading-6 text-white outline-none focus:border-cyan-300"
            maxLength={2_000}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </label>

        <button
          className="mt-4 border border-cyan-300 bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400"
          type="button"
          disabled={!canQueue || operationPending}
          onClick={() => void queueDraft()}
        >
          {operationPending ? "Securing draft..." : "Encrypt and queue draft"}
        </button>
      </div>

      <aside className="border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Local vault</h3>
            <p className="mt-1 text-xs text-amber-200">Server sync closed</p>
          </div>
          <span className="border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300">
            {view.drafts.length} drafts
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {view.drafts.length === 0 ? (
            <p className="border border-slate-800 bg-slate-900 p-4 text-sm leading-6 text-slate-400">
              No encrypted local drafts. A queued capture remains on this device until the governed sync path is activated.
            </p>
          ) : view.drafts.map((draft) => (
            <article className="border border-slate-800 bg-slate-900 p-4" key={draft.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-cyan-100">{draft.id}</p>
                  <h4 className="mt-2 font-semibold text-white">{labelForType(draft.capture.evidenceType)}</h4>
                </div>
                <button
                  className="text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
                  type="button"
                  disabled={operationPending || draft.state === "sync_leased"}
                  onClick={() => void removeDraft(draft.id)}
                >
                  Remove
                </button>
              </div>
              <dl className="mt-3 grid gap-2 text-xs text-slate-300">
                <DraftDetail label="Project" value={draft.capture.projectId} mono />
                <DraftDetail label="Accuracy" value={`${draft.capture.gpsAccuracyMeters} m`} />
                <DraftDetail label="State" value={draftStateLabel(draft.state)} emphasis />
              </dl>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}

function MobileEvidenceVaultSkeleton() {
  return (
    <section className="border border-slate-800 bg-slate-900/60 p-5 lg:p-6" aria-busy="true" aria-label="Loading encrypted evidence vault">
      <div className="h-4 w-40 bg-slate-800" />
      <div className="mt-4 h-8 w-72 max-w-full bg-slate-800" />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="h-12 border border-slate-800 bg-slate-950" key={index} />
        ))}
      </div>
    </section>
  );
}

function MobileEvidenceVaultFailure({
  code,
  title,
  detail,
  actionLabel,
  action,
  actionDisabled,
}: {
  readonly code: CanopyProofMobileEvidenceVaultErrorCode;
  readonly title: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly action: () => Promise<void>;
  readonly actionDisabled: boolean;
}) {
  return (
    <section className="border border-amber-800 bg-amber-950/40 p-5 lg:p-6" role="alert">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-200">Capture unavailable</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100">{detail}</p>
      <p className="mt-3 font-mono text-xs text-amber-200">{code}</p>
      <button
        className="mt-5 border border-amber-500 px-4 py-3 text-sm font-semibold text-amber-50 disabled:opacity-50"
        type="button"
        disabled={actionDisabled}
        onClick={() => void action()}
      >
        {actionLabel}
      </button>
    </section>
  );
}

function DraftInput({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: string;
  readonly inputMode?: "decimal" | "text";
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-200">
      {label}
      <input
        className="border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300"
        inputMode={inputMode}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DraftDetail({
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly emphasis?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className={`${mono ? "font-mono " : ""}${emphasis ? "text-amber-100" : "text-slate-100"}`}>{value}</dd>
    </div>
  );
}

function classifyVaultFailure(error: unknown): VaultViewState {
  if (!isCanopyProofMobileEvidenceVaultError(error)) {
    return { kind: "unavailable", code: "CANOPYPROOF_MOBILE_EVIDENCE_STORAGE_UNAVAILABLE" };
  }
  if (
    error.code === "CANOPYPROOF_MOBILE_EVIDENCE_RECOVERY_REQUIRED" ||
    error.code === "CANOPYPROOF_MOBILE_EVIDENCE_LEGACY_MIGRATION_INVALID"
  ) {
    return { kind: "recovery_required", code: error.code };
  }
  return { kind: "unavailable", code: error.code };
}

function normalizedHash(value: string): string {
  return value.trim().toLowerCase().replace(/^sha256:/, "");
}

function parseDraftForm(form: DraftForm): CanopyProofMobileEvidenceCapture | null {
  try {
    return parseCanopyProofMobileEvidenceCapture({
      evidenceType: form.evidenceType,
      projectId: form.projectId.trim(),
      observedAt: new Date(form.observedAt).toISOString(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      gpsAccuracyMeters: Number(form.gpsAccuracyMeters),
      mediaHash: normalizedHash(form.mediaHash),
      deviceFingerprintHash: normalizedHash(form.deviceFingerprintHash),
      exifHash: form.exifHash.trim().length > 0 ? normalizedHash(form.exifHash) : null,
      notes: form.notes.trim().length > 0 ? form.notes.trim() : null,
    });
  } catch {
    return null;
  }
}

function labelForType(type: CanopyProofMobileEvidenceType): string {
  return evidenceTypes.find((candidate) => candidate.value === type)?.label ?? type;
}

function draftStateLabel(state: CanopyProofMobileEvidenceDraft["state"]): string {
  switch (state) {
    case "draft_queued": return "Encrypted local draft";
    case "blocked_prerequisites": return "Awaiting authority prerequisites";
    case "ready_to_sync": return "Ready for governed sync";
    case "sync_leased": return "Sync in progress";
    case "acknowledged": return "Durably acknowledged";
    case "rejected": return "Rejected for review";
  }
}
