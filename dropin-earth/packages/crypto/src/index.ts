import { createHash } from "node:crypto";

export type HashAlgorithm = "sha256" | "sha3_256";

export function hashHex(input: string | Buffer, algorithm: HashAlgorithm = "sha256") {
  return createHash(algorithm).update(input).digest("hex");
}

export function hashJson(value: unknown, algorithm: HashAlgorithm = "sha256") {
  return hashHex(stableStringify(value), algorithm);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

export function merkleRoot(leaves: readonly string[]) {
  if (leaves.length === 0) {
    return hashHex("dropin-empty-merkle-root");
  }

  let level = leaves.map((leaf) => hashHex(leaf));

  while (level.length > 1) {
    const next: string[] = [];

    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(hashHex(`${left}${right}`));
    }

    level = next;
  }

  return level[0] ?? hashHex("dropin-empty-merkle-root");
}

export function deterministicInteger(seed: string, label: string, modulo: number) {
  if (!Number.isInteger(modulo) || modulo <= 0) {
    throw new Error("Modulo must be a positive integer.");
  }

  const digest = hashHex(`${seed}:${label}`);
  const value = BigInt(`0x${digest.slice(0, 16)}`);
  return Number(value % BigInt(modulo));
}

export function deterministicScore(seed: string, label: string) {
  return deterministicInteger(seed, label, 10_000) / 100;
}

export function deterministicPick<T>(items: readonly T[], seed: string, label: string): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }

  const index = deterministicInteger(seed, label, items.length);
  const item = items[index];

  if (item === undefined) {
    throw new Error("Deterministic pick resolved outside item bounds.");
  }

  return item;
}

export function deterministicRank<T>(
  items: readonly T[],
  seed: string,
  labelForItem: (item: T) => string,
) {
  return [...items].sort((left, right) => {
    const leftRank = hashHex(`${seed}:${labelForItem(left)}`);
    const rightRank = hashHex(`${seed}:${labelForItem(right)}`);
    return leftRank.localeCompare(rightRank);
  });
}

export function evidenceHash(content: string, uri: string) {
  return hashJson({
    content,
    uri,
    kind: "dropin-evidence-v1",
  });
}

export type PoccAhinEvidenceSourceInput = {
  id: string;
  kind: "payment" | "ticket" | "fund" | "evidence" | "certificate" | "anchor" | "challenge" | "oracle";
  hash: string;
  weight: number;
  signer: string;
};

export type PoccAhinConsensusInput = {
  subjectType: "round" | "campaign" | "tree" | "certificate" | "anchor" | "payment";
  subjectId: string;
  requiredWeight: number;
  sources: readonly PoccAhinEvidenceSourceInput[];
  createdAt?: string;
};

export type PoccAhinConsensusReceipt = {
  id: string;
  subjectType: PoccAhinConsensusInput["subjectType"];
  subjectId: string;
  evidenceRoot: string;
  quorumWeight: number;
  requiredWeight: number;
  accepted: boolean;
  sources: PoccAhinEvidenceSourceInput[];
  warnings: string[];
  createdAt: string;
};

export type AnchorVerificationInput = {
  chain: "solana" | "ton" | "monad" | "evm" | "manual";
  subjectId: string;
  localRoot: string;
  anchoredRoot?: string;
  txHash?: string;
  verifier: string;
  checkedAt?: string;
};

export type AnchorVerificationReceipt = {
  id: string;
  chain: AnchorVerificationInput["chain"];
  subjectId: string;
  localRoot: string;
  anchoredRoot?: string;
  status: "verified" | "pending" | "mismatch" | "unavailable";
  txHash?: string;
  verifier: string;
  checkedAt: string;
};

export function buildPoccAhinConsensusReceipt(input: PoccAhinConsensusInput): PoccAhinConsensusReceipt {
  if (!Number.isInteger(input.requiredWeight) || input.requiredWeight <= 0) {
    throw new Error("PoCC/AHIN requiredWeight must be a positive integer.");
  }
  if (input.sources.length === 0) {
    throw new Error("PoCC/AHIN consensus requires at least one evidence source.");
  }

  const sortedSources = [...input.sources].sort((left, right) => {
    const leftKey = `${left.kind}:${left.id}:${left.signer}:${left.hash}`;
    const rightKey = `${right.kind}:${right.id}:${right.signer}:${right.hash}`;
    return leftKey.localeCompare(rightKey);
  });

  const warnings = sortedSources.flatMap((source) => {
    const sourceWarnings: string[] = [];
    if (!source.hash || source.hash.length < 16) {
      sourceWarnings.push(`weak_hash:${source.id}`);
    }
    if (!Number.isInteger(source.weight) || source.weight <= 0) {
      sourceWarnings.push(`invalid_weight:${source.id}`);
    }
    if (!source.signer || source.signer.toLowerCase().includes("anonymous")) {
      sourceWarnings.push(`unattributed_source:${source.id}`);
    }
    return sourceWarnings;
  });

  const validSources = sortedSources.filter(
    (source) => source.hash.length >= 16 && Number.isInteger(source.weight) && source.weight > 0 && !source.signer.toLowerCase().includes("anonymous"),
  );
  const quorumWeight = validSources.reduce((sum, source) => sum + source.weight, 0);
  const evidenceRoot = merkleRoot(
    validSources.map((source) =>
      hashJson({
        id: source.id,
        kind: source.kind,
        hash: source.hash,
        signer: source.signer,
        weight: source.weight,
      }),
    ),
  );
  const createdAt = input.createdAt ?? new Date(0).toISOString();
  const id = `pocc_ahin_${hashJson({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    evidenceRoot,
    quorumWeight,
    requiredWeight: input.requiredWeight,
  }).slice(0, 24)}`;

  return {
    id,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    evidenceRoot,
    quorumWeight,
    requiredWeight: input.requiredWeight,
    accepted: quorumWeight >= input.requiredWeight && warnings.length === 0,
    sources: sortedSources,
    warnings,
    createdAt,
  };
}

export function validatePoccAhinConsensusReceipt(receipt: PoccAhinConsensusReceipt) {
  const rebuilt = buildPoccAhinConsensusReceipt({
    subjectType: receipt.subjectType,
    subjectId: receipt.subjectId,
    requiredWeight: receipt.requiredWeight,
    sources: receipt.sources,
    createdAt: receipt.createdAt,
  });

  return (
    rebuilt.id === receipt.id &&
    rebuilt.evidenceRoot === receipt.evidenceRoot &&
    rebuilt.quorumWeight === receipt.quorumWeight &&
    rebuilt.accepted === receipt.accepted &&
    stableStringify(rebuilt.warnings) === stableStringify(receipt.warnings)
  );
}

export function buildAnchorVerificationReceipt(input: AnchorVerificationInput): AnchorVerificationReceipt {
  if (!input.localRoot) {
    throw new Error("Anchor verification requires a local environmental root.");
  }

  const status = !input.anchoredRoot
    ? "pending"
    : input.anchoredRoot === input.localRoot
      ? "verified"
      : "mismatch";
  const checkedAt = input.checkedAt ?? new Date(0).toISOString();
  const id = `anchor_${hashJson({
    chain: input.chain,
    subjectId: input.subjectId,
    localRoot: input.localRoot,
    anchoredRoot: input.anchoredRoot,
    txHash: input.txHash,
    verifier: input.verifier,
  }).slice(0, 24)}`;

  return {
    id,
    chain: input.chain,
    subjectId: input.subjectId,
    localRoot: input.localRoot,
    status: input.txHash || input.anchoredRoot ? status : "unavailable",
    verifier: input.verifier,
    checkedAt,
    ...(input.anchoredRoot ? { anchoredRoot: input.anchoredRoot } : {}),
    ...(input.txHash ? { txHash: input.txHash } : {}),
  };
}
