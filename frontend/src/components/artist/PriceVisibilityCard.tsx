import { motion } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useMyArtistProfile, useSaveProfileExtras } from "../../Services/artistProfileStore";
import type { PriceVisibility } from "../../Types/Artist";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  /** The artist's catalog rate, for the preview */
  rate: number | null;
};

function band(rate: number) {
  const step = rate >= 20000 ? 5000 : 1000;
  const k = (n: number) => `R${Math.round(n / 1000)}k`;
  return `${k(Math.max(step, Math.floor((rate * 0.85) / step) * step))}–${k(Math.ceil((rate * 1.15) / step) * step)}`;
}

const OPTIONS: { value: PriceVisibility; title: string; body: string }[] = [
  { value: "exact", title: "Show my rate", body: "Everyone sees your starting fee." },
  { value: "band", title: "Show a range", body: "The public sees a range; signed-in promoters see your rate." },
  { value: "on_request", title: "On request", body: "Hidden from the public; signed-in promoters see your rate." },
];

/** Lets the artist choose who sees their asking price */
export default function PriceVisibilityCard({ rate }: Props) {
  const { user } = useAuth();
  const { data: profile } = useMyArtistProfile(user?.id);
  const save = useSaveProfileExtras(user?.id);
  const qc = useQueryClient();
  const current = profile?.extras.priceVisibility || "band";

  function choose(value: PriceVisibility) {
    if (value === current) return;
    save.mutate(
      { priceVisibility: value },
      // Public listings change too
      { onSuccess: () => qc.invalidateQueries({ queryKey: ["artists"] }) }
    );
  }

  const preview =
    current === "exact" ? (rate ? `From R${rate.toLocaleString()}` : "Your rate") : current === "band" ? (rate ? band(rate) : "A range") : "Price on request";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black tracking-tight text-slate-900">Price visibility</h2>
      <p className="mt-0.5 text-sm text-slate-500">Choose what people see before they request a booking.</p>

      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Price visibility">
        {OPTIONS.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={save.isPending}
              onClick={() => choose(o.value)}
              className={`relative flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                active ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-emerald-500" : "border-slate-300"}`}>
                {active && <motion.span layoutId="price-dot" className="h-2 w-2 rounded-full bg-emerald-500" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                <span className="text-xs text-slate-500">{o.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
        <span className="text-xs text-white/60">Public profile shows</span>
        <motion.span key={preview} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold">
          {preview}
        </motion.span>
      </div>
      {save.isError && <p className="mt-2 text-sm text-rose-600">Couldn't save. Please try again.</p>}
    </section>
  );
}
