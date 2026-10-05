/**
 * Branded loader: the LineUp mark's three bars "set the lineup" one by one,
 * inside a slowly rotating gradient ring.
 */
import { cn } from "../../lib/utils";

type Size = "sm" | "md" | "lg";

type Props = {
  /** Caption under the mark; `true` shows the default */
  label?: boolean | string;
  size?: Size;
  className?: string;
  /** Use on dark backgrounds */
  light?: boolean;
};

const sizeMap: Record<Size, { box: string; ring: string; text: string }> = {
  sm: { box: "h-7 w-7", ring: "p-[2px]", text: "text-[10px]" },
  md: { box: "h-12 w-12", ring: "p-[2px]", text: "text-xs" },
  lg: { box: "h-20 w-20", ring: "p-[3px]", text: "text-sm" },
};

const BARS = [
  { y: 8, w: 9, delay: 0.3 },
  { y: 14, w: 14, delay: 0.15 },
  { y: 20, w: 20, delay: 0 },
];

export default function OnTheLineSpinner({
  label = false,
  size = "md",
  className,
  light = false,
}: Props) {
  const s = sizeMap[size];
  const caption = typeof label === "string" ? label : label ? "Loading" : null;

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-label={caption || "Loading"}
    >
      <div className={cn("relative rounded-[30%]", s.ring)} aria-hidden>
        {/* Rotating gradient ring */}
        <span className="otl-ring absolute inset-0 rounded-[30%]" />
        <span
          className={cn(
            "relative flex items-center justify-center rounded-[28%]",
            s.box,
            light ? "bg-slate-950" : "bg-slate-900"
          )}
        >
          <svg viewBox="0 0 32 32" className="h-3/4 w-3/4" fill="none">
            {BARS.map((b, i) => (
              <rect
                key={i}
                x="6"
                y={b.y}
                width={b.w}
                height="3"
                rx="1.5"
                fill={["#6ee7b7", "#34d399", "#10b981"][i]}
                className="otl-bar"
                style={{ animationDelay: `${b.delay}s` }}
              />
            ))}
          </svg>
        </span>
      </div>

      {caption && (
        <p
          className={cn(
            s.text,
            "font-semibold tracking-[0.18em] uppercase",
            light ? "text-white/70" : "text-slate-500"
          )}
        >
          {caption}
        </p>
      )}

      <style>{`
        .otl-ring {
          background: conic-gradient(from 0deg, #10b981, #2dd4bf, transparent 55%, transparent 70%, #10b981);
          animation: otl-spin 1.4s linear infinite;
        }
        .otl-bar {
          transform-box: fill-box;
          transform-origin: left center;
          animation: otl-build 1.4s cubic-bezier(.22,1,.36,1) infinite;
        }
        @keyframes otl-spin { to { transform: rotate(360deg); } }
        @keyframes otl-build {
          0% { transform: scaleX(0.15); opacity: 0.35; }
          35%, 70% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0.15); opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .otl-ring, .otl-bar { animation: none; }
        }
      `}</style>
    </div>
  );
}
