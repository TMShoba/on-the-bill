import { useCurrency } from "../../context/CurrencyContext";
import { CURRENCIES } from "../../Services/international";

type Props = {
  /** "light" for white surfaces, "glass" for use over imagery */
  tone?: "light" | "glass";
  className?: string;
};

export default function CurrencySelect({ tone = "light", className = "" }: Props) {
  const { currency, setCurrency } = useCurrency();
  const styles =
    tone === "glass"
      ? "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 [&>option]:text-slate-900"
      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300";

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Display currency</span>
      <svg
        className={`pointer-events-none absolute left-3 h-4 w-4 ${tone === "glass" ? "text-white/80" : "text-slate-400"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
      </svg>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className={`max-w-[10.5rem] cursor-pointer appearance-none truncate rounded-full border py-1.5 pl-9 pr-8 text-xs font-semibold sm:max-w-none transition focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${styles}`}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.label}
          </option>
        ))}
      </select>
      <svg
        className={`pointer-events-none absolute right-3 h-3 w-3 ${tone === "glass" ? "text-white/80" : "text-slate-400"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
