import { useMemo, useState } from "react";
import type { Booking, BookingStatus } from "../Types/Artist";

const STATUS_COLOR: Record<BookingStatus, string> = {
  confirmed: "bg-emerald-500",
  pending: "bg-amber-400",
  declined: "bg-rose-400",
  paid: "bg-sky-500",
  blocked: "bg-slate-400",
};

type Props = {
  gigs: Booking[];
  onSelectDay: (date: string, gigsOnDay: Booking[]) => void;
  onSelectGig?: (gig: Booking) => void;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function toKey(y: number, m: number, day: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function GigCalendar({ gigs, onSelectDay, onSelectGig }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const byDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const g of gigs) {
      const key = g.eventDate.slice(0, 10);
      const list = map.get(key) || [];
      list.push(g);
      map.set(key, list);
    }
    return map;
  }, [gigs]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = startOfMonth(cursor).getDay(); // 0 Sun
  const total = daysInMonth(cursor);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleString("en-ZA", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{monthLabel}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="aspect-square" />;
          }
          const key = toKey(year, month, day);
          const dayGigs = byDate.get(key) || [];
          const blocked = dayGigs.some((g) => g.status === "blocked");
          const realGigs = dayGigs.filter((g) => g.status !== "blocked");
          const isToday =
            key ===
            `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectDay(key, dayGigs);
                // A blocked day isn't a gig, so never open the gig view for it
                if (realGigs.length === 1 && !blocked && onSelectGig) onSelectGig(realGigs[0]);
              }}
              title={blocked ? "Unavailable" : undefined}
              className={`flex aspect-square flex-col items-center justify-start rounded-xl border p-1 text-sm transition hover:border-slate-400 hover:bg-slate-50 ${
                isToday
                  ? "border-slate-900 bg-slate-50 font-semibold"
                  : "border-transparent"
              } ${blocked ? "bg-[repeating-linear-gradient(135deg,#f1f5f9_0_6px,#e2e8f0_6px_8px)]" : ""}`}
            >
              <span className={blocked ? "text-slate-400 line-through" : "text-slate-800"}>{day}</span>
              {realGigs.length > 0 && (
                <div className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5">
                  {realGigs.slice(0, 3).map((g) => (
                    <span
                      key={g.id}
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[g.status]}`}
                      title={`${g.venue} (${g.status})`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Declined
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,#f1f5f9_0_2px,#cbd5e1_2px_3px)] ring-1 ring-slate-300" /> Unavailable
        </span>
      </div>
    </div>
  );
}
