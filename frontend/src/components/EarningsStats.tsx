import { useMemo } from "react";
import CountUp from "./animations/CountUp";
import type { Booking } from "../Types/Artist";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Props = {
  gigs: Booking[];
};

export default function EarningsStats({ gigs }: Props) {
  const stats = useMemo(() => {
    const confirmed = gigs.filter((g) => g.status === "confirmed" || g.status === "paid");
    const totalEarned = confirmed.reduce(
      (sum, g) => sum + (typeof g.fee === "number" ? g.fee : 0),
      0
    );
    const gigsPlayed = confirmed.length;

    // Busiest month by count of confirmed gigs
    const byMonth: Record<string, number> = {};
    const earningsByMonth: Record<string, number> = {};
    for (const g of confirmed) {
      const d = new Date(g.eventDate);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
      earningsByMonth[key] =
        (earningsByMonth[key] || 0) + (typeof g.fee === "number" ? g.fee : 0);
    }
    let busiestKey = "";
    let busiestCount = 0;
    for (const [k, c] of Object.entries(byMonth)) {
      if (c > busiestCount) {
        busiestCount = c;
        busiestKey = k;
      }
    }
    let busiestMonthLabel = "—";
    if (busiestKey) {
      const [y, m] = busiestKey.split("-");
      busiestMonthLabel = `${MONTHS[Number(m) - 1]} ${y} (${busiestCount} gig${busiestCount === 1 ? "" : "s"})`;
    }

    // Top venues by frequency then fee
    const venueMap: Record<string, { count: number; earned: number }> = {};
    for (const g of confirmed) {
      const name = g.venue || "Unknown venue";
      if (!venueMap[name]) venueMap[name] = { count: 0, earned: 0 };
      venueMap[name].count += 1;
      venueMap[name].earned += typeof g.fee === "number" ? g.fee : 0;
    }
    const topVenues = Object.entries(venueMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || b.earned - a.earned)
      .slice(0, 5);

    // Recent months chart data (last 6 calendar months)
    const chart: { label: string; earned: number; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      chart.push({
        label: MONTHS[d.getMonth()],
        earned: earningsByMonth[key] || 0,
        count: byMonth[key] || 0,
      });
    }
    const maxEarned = Math.max(1, ...chart.map((c) => c.earned));

    return {
      totalEarned,
      gigsPlayed,
      busiestMonthLabel,
      topVenues,
      chart,
      maxEarned,
      pendingValue: gigs
        .filter((g) => g.status === "pending")
        .reduce((s, g) => s + (typeof g.fee === "number" ? g.fee : 0), 0),
    };
  }, [gigs]);

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Earnings & stats</h2>
          <p className="text-sm text-slate-500">
            From confirmed gigs — open the app to watch the numbers grow
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80">
            Total earned
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">
            <CountUp value={stats.totalEarned} prefix="R" className="tabular-nums" />
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Gigs played
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            <CountUp value={stats.gigsPlayed} className="tabular-nums" />
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Busiest month
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {stats.busiestMonthLabel}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/80">
            Pipeline (pending)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">
            <CountUp value={stats.pendingValue} prefix="R" className="tabular-nums" />
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            Earnings (last 6 months)
          </h3>
          <div className="flex h-36 items-end gap-2">
            {stats.chart.map((c) => (
              <div
                key={c.label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] font-medium text-slate-500">
                  {c.earned > 0 ? `R${(c.earned / 1000).toFixed(0)}k` : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-emerald-500/90 transition"
                  style={{
                    height: `${Math.max(4, (c.earned / stats.maxEarned) * 100)}%`,
                  }}
                  title={`${c.label}: R${c.earned.toLocaleString()} · ${c.count} gigs`}
                />
                <span className="text-[11px] font-medium text-slate-600">
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-900">Top venues</h3>
          {stats.topVenues.length === 0 ? (
            <p className="text-sm text-slate-500">
              Accept bookings to build your venue history.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.topVenues.map((v, i) => (
                <li
                  key={v.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-900">
                      {v.name}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">
                      {v.count}×
                    </span>
                    {" · "}
                    R{v.earned.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
