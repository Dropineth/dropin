import { TicketCard as SharedTicketCard } from "@dropin/ui";

export function TicketCard({
  ticketId,
  status,
  amount,
  token,
  receiptHash,
}: {
  ticketId: string;
  status: "pending" | "confirmed" | "failed" | "challenged";
  amount: number | string;
  token: "TON" | "USDC" | "USDT" | "SOL" | "EHKD";
  receiptHash?: string;
}) {
  return (
    <SharedTicketCard
      receiptHash={receiptHash ?? `${amount} ${token} testnet Payment Intent`}
      status={status}
      ticketNumber={ticketId}
    />
  );
}
