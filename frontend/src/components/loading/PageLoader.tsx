/**
 * Full-page splash: dark stage with a soft glow, the animated LineUp mark,
 * wordmark and an indeterminate progress line.
 */
import OnTheLineSpinner from "./OnTheLineSpinner";
import { cn } from "../../lib/utils";

type Props = {
  /** Optional message under the wordmark */
  message?: string;
  /** Cover the full viewport (fixed) vs fill parent (absolute) */
  fullScreen?: boolean;
  className?: string;
};

export default function PageLoader({
  message = "Getting the lineup ready",
  fullScreen = true,
  className,
}: Props) {
  if (!fullScreen) {
    return (
      <div className={cn("absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm", className)}>
        <OnTheLineSpinner size="md" />
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-slate-950", className)}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="relative flex flex-col items-center">
        <OnTheLineSpinner size="lg" light />
        <p className="mt-6 text-2xl font-black tracking-tight text-white">
          The Line<span className="text-emerald-400">Up</span>
        </p>
        {message && <p className="mt-1 text-sm text-slate-400">{message}</p>}
        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 [animation:pl-slide_1.1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`
        @keyframes pl-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }
        @media (prefers-reduced-motion: reduce) { [class*="pl-slide"] { animation: none !important; } }
      `}</style>
    </div>
  );
}
