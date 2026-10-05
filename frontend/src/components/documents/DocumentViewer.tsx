import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { downloadContract, downloadReceipt } from "../../Services/documentsService";
import {
  formatDocDate,
  formatRand,
  METHOD_LABEL,
  parseContractText,
  receiptTitle,
  type ViewerDocument,
} from "./documentModel";

type Props = {
  doc: ViewerDocument | null;
  onClose: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-3 py-1 text-[13px] sm:grid-cols-[11rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "font-bold text-slate-900" : "text-slate-800"}>{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-1 mt-5 border-b border-slate-200 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
      {children}
    </h3>
  );
}

function ContractPaper({ doc }: { doc: Extract<ViewerDocument, { kind: "contract" }> }) {
  const { blocks } = parseContractText(doc.contract.text);
  return (
    <>
      <h2 className="text-2xl font-black tracking-tight text-slate-900">Booking confirmation</h2>
      <p className="mt-1 text-xs text-slate-500">
        Ref {doc.context.bookingId.slice(0, 8).toUpperCase()} · Confirmed {formatDocDate(doc.contract.generatedAt)}
      </p>
      <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
        Accepted electronically by the artist on {formatDocDate(doc.contract.generatedAt)}. Unchanged since acceptance.
      </p>
      <div className="mt-2">
        {blocks.map((b, i) =>
          b.type === "heading" ? (
            <SectionTitle key={i}>{b.text}</SectionTitle>
          ) : b.type === "kv" ? (
            <dl key={i}>
              <Row label={b.label} value={b.value} strong={/deposit due|artist receives|total/i.test(b.label)} />
            </dl>
          ) : (
            <p key={i} className="py-1 text-[13px] leading-relaxed text-slate-600">
              {b.text}
            </p>
          )
        )}
      </div>
    </>
  );
}

function ReceiptPaper({ doc }: { doc: Extract<ViewerDocument, { kind: "receipt" }> }) {
  const r = doc.receipt;
  const kind = r.kind === "deposit" ? "Deposit" : doc.isBalance ? "Balance payment" : "Full payment";
  return (
    <>
      <h2 className="text-2xl font-black tracking-tight text-slate-900">Payment receipt</h2>
      <p className="mt-1 text-xs text-slate-500">
        {kind} for {doc.context.artistName}
      </p>
      <div className="mt-4 flex items-start justify-between rounded-2xl bg-emerald-50 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Amount paid</p>
          <p className="mt-0.5 text-3xl font-black tracking-tight text-slate-900">{formatRand(r.amount)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
            r.status === "refunded" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {r.status}
        </span>
      </div>
      <SectionTitle>Payment details</SectionTitle>
      <dl>
        <Row label="Receipt number" value={r.id} />
        <Row label="Date paid" value={formatDocDate(r.paidAt || r.createdAt)} />
        <Row label="Payment type" value={kind} />
        <Row label="Method" value={METHOD_LABEL[r.method] || r.method} />
        <Row label="Currency" value="South African Rand (ZAR)" />
      </dl>
      <SectionTitle>Booking</SectionTitle>
      <dl>
        <Row label="Booking reference" value={r.bookingId} />
        <Row label="Artist" value={doc.context.artistName} />
        <Row label="Promoter" value={`${r.promoterName}${r.promoterEmail ? ` (${r.promoterEmail})` : ""}`} />
        <Row label="Event" value={doc.context.venue || "TBC"} />
        <Row label="Event date" value={formatDocDate(doc.context.eventDate)} />
      </dl>
      <SectionTitle>Breakdown</SectionTitle>
      <dl>
        <Row label="Towards artist fee" value={formatRand(r.artistPayout)} />
        <Row label="Platform fee" value={formatRand(r.platformFee)} />
        <Row label="Total paid" value={formatRand(r.amount)} strong />
      </dl>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        The artist receives the full agreed performance fee; the platform fee is paid by the promoter.
      </p>
    </>
  );
}

/**
 * In-app preview of a contract or receipt, styled like the PDF, with a download button.
 * Portalled to <body>: dashboards sit inside animated (transformed) wrappers,
 * which would otherwise trap a fixed-position overlay.
 */
export default function DocumentViewer({ doc, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [doc, onClose]);

  async function download() {
    if (!doc) return;
    setDownloading(true);
    try {
      if (doc.kind === "contract") await downloadContract(doc.contract);
      else await downloadReceipt(doc.receipt);
    } finally {
      setDownloading(false);
    }
  }

  const title = doc
    ? doc.kind === "contract"
      ? "Booking confirmation"
      : receiptTitle(doc.receipt, doc.isBalance)
    : "";

  return createPortal(
    <AnimatePresence>
      {doc && (
        <motion.div
          key="doc-viewer"
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close document"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative z-10 flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-slate-100 shadow-2xl sm:rounded-3xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${
                  doc.kind === "contract" ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {doc.kind === "contract" ? "DOC" : "R"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{title}</p>
                <p className="truncate text-xs text-slate-500">
                  {doc.context.artistName} · {doc.context.venue || "Venue TBC"}
                </p>
              </div>
              <button
                type="button"
                onClick={download}
                disabled={downloading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
                </svg>
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Paper */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">
              <motion.article
                className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.08 }}
              >
                <div className="h-1.5 bg-emerald-600" />
                <div className="px-5 pb-7 pt-5 sm:px-8 sm:pt-6">
                  <div className="mb-5 flex items-start justify-between border-b border-slate-200 pb-4">
                    <p className="text-lg font-black text-slate-900">
                      The Line<span className="text-emerald-600">Up</span>
                    </p>
                    <p className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {doc.kind === "contract" ? "Booking confirmation" : "Payment receipt"}
                      <span className="block font-medium normal-case tracking-normal text-slate-400">
                        Ref {(doc.kind === "contract" ? doc.context.bookingId : doc.receipt.id).slice(0, 8).toUpperCase()}
                      </span>
                    </p>
                  </div>
                  {doc.kind === "contract" ? <ContractPaper doc={doc} /> : <ReceiptPaper doc={doc} />}
                </div>
              </motion.article>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
