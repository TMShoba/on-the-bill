import type { BookingContract } from "../../Services/contractStore";
import type { Receipt } from "../../Services/receiptStore";
import type { BookingDocumentsRow } from "../../Services/documentsService";

/** Booking context shown alongside a document */
export type DocumentContext = {
  bookingId: string;
  artistName: string;
  promoterName: string;
  venue: string;
  eventDate: string;
};

export type ViewerDocument =
  | { kind: "contract"; contract: BookingContract; context: DocumentContext }
  | { kind: "receipt"; receipt: Receipt; context: DocumentContext; isBalance: boolean };

export type ContractBlock =
  | { type: "heading"; text: string }
  | { type: "kv"; label: string; value: string }
  | { type: "para"; text: string };

/**
 * Parse the frozen contract text into display blocks.
 * Mirrors parseContractText in backend/src/lib/pdf.js so screen and PDF match.
 */
export function parseContractText(text: string): {
  title: string;
  blocks: ContractBlock[];
} {
  const lines = String(text || "").split(/\r?\n/);
  const blocks: ContractBlock[] = [];
  let title = "";
  let para: string[] | null = null;
  const flush = () => {
    if (para) blocks.push({ type: "para", text: para.join(" ") });
    para = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!title && line.trim()) {
      title = line.trim();
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const indented = /^\s{2,}/.test(line);
    const trimmed = line.trim();
    const kv = /^([A-Za-z][A-Za-z0-9 ()/&'-]{0,48}):\s+(.+)$/.exec(trimmed);

    // Header metadata (Booking / Generated) is shown separately
    if (!indented && !blocks.length && (/^(Booking|Generated):/.test(trimmed) || /^Generated\s/.test(trimmed))) continue;
    if (!indented && /^[A-Z][A-Z0-9 ()&/,'-]+$/.test(trimmed) && trimmed.length < 60) {
      flush();
      blocks.push({ type: "heading", text: trimmed });
      continue;
    }
    if (indented && kv) {
      flush();
      blocks.push({ type: "kv", label: kv[1], value: kv[2] });
      continue;
    }
    para = para || [];
    para.push(trimmed);
  }
  flush();
  return { title, blocks };
}

export function receiptTitle(receipt: Receipt, isBalance: boolean): string {
  if (receipt.kind === "deposit") return "Deposit receipt";
  return isBalance ? "Balance receipt" : "Payment receipt";
}

export function formatRand(amount: number): string {
  return `R${(Number(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDocDate(value: string | undefined): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const METHOD_LABEL: Record<string, string> = {
  payfast: "Card (PayFast)",
  eft: "Bank transfer",
  manual: "Recorded payment",
};

/** Flatten booking rows into viewer documents, newest booking first */
export function documentsFromRows(rows: BookingDocumentsRow[]): ViewerDocument[] {
  const docs: ViewerDocument[] = [];
  for (const row of rows) {
    const context = {
      bookingId: row.bookingId,
      artistName: row.artistName,
      promoterName: row.promoterName,
      venue: row.venue,
      eventDate: row.eventDate,
    };
    if (row.contract) docs.push({ kind: "contract", contract: row.contract, context });
    const hasDeposit = row.receipts.some((r) => r.kind === "deposit");
    for (const receipt of row.receipts) {
      docs.push({ kind: "receipt", receipt, context, isBalance: receipt.kind === "full" && hasDeposit });
    }
  }
  return docs;
}
