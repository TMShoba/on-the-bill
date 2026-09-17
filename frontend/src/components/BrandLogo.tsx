import { Link } from "react-router-dom";

type Props = {
  to?: string;
  /** dark = for light backgrounds; light = for dark hero/nav */
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { box: "h-7 w-7", text: "text-base", pad: "p-1" },
  md: { box: "h-8 w-8", text: "text-lg", pad: "p-1.5" },
  lg: { box: "h-10 w-10", text: "text-xl", pad: "p-2" },
};

/**
 * LineUp mark: three ascending bars = a setlist / lineup.
 * Reads as “the lineup” without relying on generic initials.
 */
export function LineUpMark({
  className = "h-full w-full",
  tone = "onDark",
}: {
  className?: string;
  tone?: "onDark" | "onLight";
}) {
  const a = tone === "onDark" ? "#10b981" : "#059669";
  const b = tone === "onDark" ? "#34d399" : "#10b981";
  const c = tone === "onDark" ? "#6ee7b7" : "#34d399";
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="20" width="20" height="3" rx="1.5" fill={a} />
      <rect x="6" y="14" width="14" height="3" rx="1.5" fill={b} />
      <rect x="6" y="8" width="9" height="3" rx="1.5" fill={c} />
    </svg>
  );
}

export default function BrandLogo({
  to = "/",
  variant = "dark",
  size = "md",
  showWordmark = true,
  className = "",
}: Props) {
  const s = sizeMap[size];
  const onDark = variant === "light";
  const boxBg = onDark ? "bg-white/10 ring-1 ring-white/15" : "bg-slate-900";
  const word = onDark ? "text-white" : "text-slate-900";
  const accent = onDark ? "text-emerald-400" : "text-emerald-600";

  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex ${s.box} shrink-0 items-center justify-center rounded-lg ${boxBg}`}
      >
        <LineUpMark
          className="h-[70%] w-[70%]"
          tone={onDark ? "onDark" : "onLight"}
        />
      </span>
      {showWordmark && (
        <span className={`${s.text} font-extrabold tracking-tight ${word}`}>
          The Line<span className={accent}>Up</span>
        </span>
      )}
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="group inline-flex items-center" aria-label="The LineUp home">
        {inner}
      </Link>
    );
  }
  return inner;
}
