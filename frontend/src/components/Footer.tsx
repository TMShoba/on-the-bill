import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

/**
 * Compact site footer. Parent page should use:
 *   className="min-h-dvh flex flex-col …"
 * and wrap main content in a flex-1 region so this stays at the bottom.
 */
export default function Footer() {
  return (
    <footer className="mt-auto shrink-0 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:py-3.5">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <BrandLogo to="/" size="sm" variant="dark" />
          <span className="hidden text-slate-300 sm:inline" aria-hidden>
            ·
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/artists" className="hover:text-emerald-700">
              Artists
            </Link>
            <Link to="/support" className="hover:text-emerald-700">
              Support
            </Link>
            <Link to="/legal/terms" className="hover:text-emerald-700">
              Terms
            </Link>
            <Link to="/legal/privacy" className="hover:text-emerald-700">
              Privacy
            </Link>
            <Link to="/legal/cancellation" className="hover:text-emerald-700">
              Cancellation
            </Link>
          </nav>
        </div>
        <p className="text-[11px] text-slate-400">
          © {new Date().getFullYear()} The LineUp
        </p>
      </div>
    </footer>
  );
}
