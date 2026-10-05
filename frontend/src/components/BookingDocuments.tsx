import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Booking } from "../Types/Artist";
import { listDocumentsApi, type BookingDocumentsRow } from "../Services/documentsService";
import DocumentCard from "./documents/DocumentCard";
import DocumentViewer from "./documents/DocumentViewer";
import { documentsFromRows, formatDocDate, formatRand, type ViewerDocument } from "./documents/documentModel";

type Props = {
  bookings: Booking[];
  role: "artist" | "promoter";
  onOpenBooking?: (booking: Booking) => void;
};

type Filter = "all" | "contracts" | "receipts";

export default function BookingDocuments({ bookings, role, onOpenBooking }: Props) {
  const [rows, setRows] = useState<BookingDocumentsRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewing, setViewing] = useState<ViewerDocument | null>(null);
  const closeViewer = useCallback(() => setViewing(null), []);

  useEffect(() => {
    let cancelled = false;
    listDocumentsApi()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookings]);

  const docs = useMemo(() => documentsFromRows(rows || []), [rows]);
  const contracts = docs.filter((d) => d.kind === "contract").length;
  const receipts = docs.filter((d) => d.kind === "receipt");
  const totalPaid = receipts.reduce((sum, d) => sum + (d.kind === "receipt" ? d.receipt.amount : 0), 0);

  // Group the filtered documents by booking for readable sections
  const groups = useMemo(() => {
    const visible = docs.filter((d) =>
      filter === "all" ? true : filter === "contracts" ? d.kind === "contract" : d.kind === "receipt"
    );
    const map = new Map<string, ViewerDocument[]>();
    for (const d of visible) {
      const list = map.get(d.context.bookingId) || [];
      list.push(d);
      map.set(d.context.bookingId, list);
    }
    return [...map.entries()];
  }, [docs, filter]);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: docs.length },
    { key: "contracts", label: "Contracts", count: contracts },
    { key: "receipts", label: "Receipts", count: receipts.length },
  ];

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">Documents</p>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Contracts & receipts</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Shared with both sides of each booking. View them here or download the PDF.
              {loadFailed ? " Couldn't reach the server — showing the last loaded copy." : ""}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            {[
              ["Contracts", String(contracts)],
              ["Receipts", String(receipts.length)],
              [role === "promoter" ? "Paid" : "Received", formatRand(totalPaid).replace(".00", "")],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <dd className="text-base font-black tabular-nums text-slate-900">{v}</dd>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              onClick={() => setFilter(t.key)}
              className="relative rounded-full px-3.5 py-1.5 text-xs font-semibold"
            >
              {filter === t.key && (
                <motion.span
                  layoutId="doc-tab"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={`relative ${filter === t.key ? "text-slate-900" : "text-slate-500"}`}>
                {t.label} <span className="text-slate-400">{t.count}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {rows === null && !loadFailed ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-14 w-11 flex-col justify-between rounded-md border border-dashed border-slate-300 p-1.5">
              <span className="h-1 w-full rounded-full bg-slate-200" />
              <span className="space-y-0.5">
                <span className="block h-0.5 w-full rounded bg-slate-200" />
                <span className="block h-0.5 w-3/5 rounded bg-slate-200" />
              </span>
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-700">No documents yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              A contract is created when a booking is accepted. Receipts appear when a deposit or payment is recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <AnimatePresence initial={false} mode="popLayout">
              {groups.map(([bookingId, list]) => {
                const ctx = list[0].context;
                const booking = bookings.find((b) => b.id === bookingId);
                return (
                  <motion.div key={bookingId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={!booking}
                        onClick={() => booking && onOpenBooking?.(booking)}
                        className="min-w-0 text-left disabled:cursor-default"
                      >
                        <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-500 enabled:hover:text-slate-900">
                          {role === "promoter" ? ctx.artistName : ctx.promoterName} · {ctx.venue || "Venue TBC"}
                        </p>
                      </button>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatDocDate(ctx.eventDate)}</span>
                    </div>
                    <div className="grid gap-2.5 lg:grid-cols-2">
                      {list.map((d) => (
                        <DocumentCard
                          key={d.kind === "contract" ? `c-${bookingId}` : d.receipt.id}
                          doc={d}
                          compact
                          onView={setViewing}
                        />
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <DocumentViewer doc={viewing} onClose={closeViewer} />
    </section>
  );
}
