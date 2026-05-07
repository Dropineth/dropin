import type { TreasuryTransaction } from "@dropin/schemas";

export function reverseLedgerTransaction(
  transaction: TreasuryTransaction,
  input: {
    id: string;
    createdAt: string;
    postedAt: string;
    memo?: string | undefined;
  },
): TreasuryTransaction {
  return {
    id: input.id,
    type: "revoke_reversal",
    debitAccountId: transaction.creditAccountId,
    creditAccountId: transaction.debitAccountId,
    amount: transaction.amount,
    currency: transaction.currency,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    status: "posted",
    reversalOfId: transaction.id,
    memo: input.memo ?? `Reversal for ${transaction.id}`,
    createdAt: input.createdAt,
    postedAt: input.postedAt,
  };
}
