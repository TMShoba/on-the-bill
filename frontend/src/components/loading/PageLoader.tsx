/**
 * Full-page loading overlay — glass panel + On the Line spinner.
 * Use while routes, auth, or data boot.
 */
import OnTheLineSpinner from "./OnTheLineSpinner";
import { cn } from "../../lib/utils";

type Props = {
  /** Optional secondary message under the brand line */
  message?: string;
  /** Cover the full viewport (fixed) vs fill parent (absolute) */
  fullScreen?: boolean;
  className?: string;
};

export default function PageLoader({
  message = "Loading your lineup…",
  fullScreen = true,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "z-50 flex flex-col items-center justify-center gap-4",
        fullScreen
          ? "fixed inset-0 bg-gradient-to-br from-slate-50/95 via-emerald-50/90 to-teal-50/95 backdrop-blur-md"
          : "absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-xl",
        className
      )}
    >
      <div className="rounded-3xl border border-white/60 bg-white/50 px-10 py-8 shadow-xl shadow-emerald-900/5 ring-1 ring-black/5 backdrop-blur-xl">
        <OnTheLineSpinner size="lg" label="On the Line" />
        {message && (
          <p className="mt-4 text-center text-sm text-slate-600">{message}</p>
        )}
      </div>
    </div>
  );
}
