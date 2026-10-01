/**
 * Simple local receipts for demo — both sides can view payment status + history.
 */

export type Receipt = {
  id: string;
  bookingId: string;
  artistId: string;
  artistName: string;
  promoterName: string;
  promoterEmail?: string;
  amount: number;
  platformFee: number;
  artistPayout: number;
  /** deposit | full */
  kind: "deposit" | "full";
  method: "payfast" | "eft" | "manual";
  status: "pending" | "paid" | "refunded";
  createdAt: string;
  paidAt?: string;
};

const KEY = "otb_receipts";

function read(): Receipt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Receipt[]) : [];
  } catch {
    return [];
  }
}

function write(list: Receipt[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getReceiptsForBooking(bookingId: string): Receipt[] {
  return read().filter((r) => r.bookingId === bookingId);
}

export function getReceiptsForUser(opts: {
  artistId?: string;
  email?: string;
}): Receipt[] {
  return read().filter(
    (r) =>
      (opts.artistId && r.artistId === opts.artistId) ||
      (opts.email && r.promoterEmail === opts.email)
  );
}

export function createReceipt(
  input: Omit<Receipt, "id" | "createdAt" | "status"> & { status?: Receipt["status"] }
): Receipt {
  const receipt: Receipt = {
    ...input,
    id: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: input.status || "pending",
  };
  const list = read();
  list.unshift(receipt);
  write(list.slice(0, 200));
  return receipt;
}

export function markReceiptPaid(id: string): Receipt | null {
  const list = read();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  list[idx] = {
    ...list[idx],
    status: "paid",
    paidAt: new Date().toISOString(),
  };
  write(list);
  return list[idx];
}


export function receiptText(r: Receipt): string {
  return [
    "THE LINEUP — PAYMENT RECEIPT",
    `Receipt: ${r.id}`,
    `Booking: ${r.bookingId}`,
    `Artist: ${r.artistName}`,
    `Promoter: ${r.promoterName}${r.promoterEmail ? ` (${r.promoterEmail})` : ""}`,
    `Kind: ${r.kind}`,
    `Method: ${r.method}`,
    `Status: ${r.status}`,
    `Amount paid: R${r.amount.toLocaleString()}`,
    `Platform fee: R${r.platformFee.toLocaleString()}`,
    `Artist payout: R${r.artistPayout.toLocaleString()}`,
    `Created: ${r.createdAt}`,
    r.paidAt ? `Paid: ${r.paidAt}` : "",
  ].filter(Boolean).join("\n");
}

export function downloadReceipt(r: Receipt) {
  const blob = new Blob([receiptText(r)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lineup-receipt-${r.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
