/**
 * "On the Line" — branded loading spinner for The LineUp / On the Bill.
 * Equalizer-style bars + pulsing line + optional label.
 */
import { cn } from "../../lib/utils";

type Size = "sm" | "md" | "lg";

type Props = {
  /** Show the "On the Line" caption under the bars */
  label?: boolean | string;
  size?: Size;
  className?: string;
  /** Use light text (for dark overlays) */
  light?: boolean;
};

const sizeMap: Record<Size, { bar: string; gap: string; text: string }> = {
  sm: { bar: "w-0.5 h-3", gap: "gap-0.5", text: "text-[10px]" },
  md: { bar: "w-1 h-5", gap: "gap-1", text: "text-xs" },
  lg: { bar: "w-1.5 h-8", gap: "gap-1.5", text: "text-sm" },
};

const BAR_DELAYS = [0, 0.1, 0.2, 0.15, 0.05, 0.25, 0.12];

export default function OnTheLineSpinner({
  label = true,
  size = "md",
  className,
  light = false,
}: Props) {
  const s = sizeMap[size];
  const caption =
    typeof label === "string" ? label : label ? "On the Line" : null;

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-label={caption || "Loading"}
    >
      {/* Equalizer bars */}
      <div className={cn("flex items-end", s.gap)} aria-hidden>
        {BAR_DELAYS.map((delay, i) => (
          <span
            key={i}
            className={cn(
              s.bar,
              "inline-block origin-bottom rounded-full bg-emerald-500",
              light && "bg-emerald-300"
            )}
            style={{
              animation: `otl-bar 0.9s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Horizontal "the line" */}
      <div
        className={cn(
          "relative h-px w-16 overflow-hidden rounded-full bg-emerald-500/25",
          light && "bg-white/20"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-1/2 rounded-full bg-emerald-500",
            light && "bg-emerald-200"
          )}
          style={{ animation: "otl-sweep 1.2s ease-in-out infinite" }}
        />
      </div>

      {caption && (
        <p
          className={cn(
            s.text,
            "font-semibold tracking-[0.2em] uppercase",
            light ? "text-white/90" : "text-emerald-800/80"
          )}
        >
          {caption}
        </p>
      )}

      {/* Local keyframes — no global CSS file required */}
      <style>{`
        @keyframes otl-bar {
          0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes otl-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  );
}
