import { useEffect, useState } from "react";
import type { Booking } from "../Types/Artist";
import {
  downloadContract,
  downloadReceipt,
  listDocumentsApi,
  listDocumentsLocal,
  type BookingDocumentsRow,
} from "../Services/documentsService";

type Props = {
  bookings: Booking[];
  role: "artist" | "promoter";
  onOpenBooking?: (booking: Booking) => void;
};

export default function BookingDocuments({ bookings, role, onOpenBooking }: Props) {
  const [rows, setRows] = useState<BookingDocumentsRow[]>([]);
  const [source, setSource] = useState<"postgres" | "browser">("browser");

  useEffect(() => {
    let cancelled = false;
    listDocumentsApi()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setSource("postgres");
      })
      .catch(() => {
        if (cancelled) return;
        setRows(listDocumentsLocal(bookings));
        setSource("browser");
      });
    return () => {
      cancelled = true;
    };
  }, [bookings]);

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Receipts & contracts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Stored in Postgres and visible to both the artist and the promoter on this booking.
            {source === "browser" ? " Showing this browser copy until the API is reachable." : ""}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Nothing yet. A contract is saved when a booking is confirmed. A receipt is saved when a deposit or full payment is recorded.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.bookingId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const match = bookings.find((b) => b.id === row.bookingId);
                    if (match) onOpenBooking?.(match);
                  }}
                  className="text-left"
                >
                  <p className="font-semibold text-slate-900">
                    {role === "promoter" ? row.artistName : row.promoterName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.eventDate} · {row.venue || "Venue TBC"} · {row.status}
                  </p>
                </button>
                <div className="flex flex-wrap gap-2">
                  {row.contract && (
                    <button
                      type="button"
                      onClick={() => downloadContract(row.contract!)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Download contract
                    </button>
                  )}
                  {row.receipts.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => downloadReceipt(r)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Receipt · {r.kind} · R{r.amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
