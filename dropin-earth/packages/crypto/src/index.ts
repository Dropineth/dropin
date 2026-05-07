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
