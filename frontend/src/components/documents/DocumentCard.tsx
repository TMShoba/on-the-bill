import { useState } from "react";
import { motion } from "motion/react";
import { downloadContract, downloadReceipt } from "../../Services/documentsService";
import { formatDocDate, formatRand, METHOD_LABEL, receiptTitle, type ViewerDocument } from "./documentModel";

type Props = {
  doc: ViewerDocument;
  /** Who the document is with, from the viewer's point of view */
  counterparty?: string;
  onView: (doc: ViewerDocument) => void;
  compact?: boolean;
};

export default function DocumentCard({ doc, counterparty, onView, compact = false }: Props) {
  const [downloading, setDownloading] = useState(false);
  const isContract = doc.kind === "contract";
  const title = isContract ? "Booking contract" : receiptTitle(doc.receipt, doc.isBalance);
  const date = isContract ? doc.contract.generatedAt : doc.receipt.paidAt || doc.receipt.createdAt;

  async function download() {
    setDownloading(true);
    try {
      if (doc.kind === "contract") await downloadContract(doc.contract);
      else await downloadReceipt(doc.receipt);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-3.5"
    >
      {/* Mini page icon */}
      <button
        type="button"
        onClick={() => onView(doc)}
        aria-label={`View ${title}`}
        className={`relative flex h-14 w-11 shrink-0 flex-col justify-between rounded-md border p-1.5 transition group-hover:-rotate-2 ${
          isContract ? "border-slate-200 bg-slate-50" : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <span className={`h-1 w-full rounded-full ${isContract ? "bg-slate-900" : "bg-emerald-600"}`} />
        <span className="space-y-0.5">
          <span className="block h-0.5 w-full rounded bg-slate-300" />
          <span className="block h-0.5 w-4/5 rounded bg-slate-300" />
          <span className="block h-0.5 w-3/5 rounded bg-slate-300" />
        </span>
        <span className={`self-end text-[7px] font-black ${isContract ? "text-slate-500" : "text-emerald-700"}`}>PDF</span>
      </button>

      <button type="button" onClick={() => onView(doc)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-bold text-slate-900">{title}</p>
        {/* Compact cards sit under a booking header, so skip the venue */}
        {!compact && (
          <p className="truncate text-xs text-slate-500">
            {[counterparty, doc.context.venue].filter(Boolean).join(" · ") || "Booking"}
          </p>
        )}
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {isContract ? `Confirmed ${formatDocDate(date)}` : `${METHOD_LABEL[doc.receipt.method] || doc.receipt.method} · ${formatDocDate(date)}`}
        </p>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {!isContract && <span className="text-sm font-black tabular-nums text-emerald-700">{formatRand(doc.receipt.amount)}</span>}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onView(doc)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            View
          </button>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            aria-label={`Download ${title} PDF`}
            className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {downloading ? "…" : "PDF"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
