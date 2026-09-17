import { Outlet, NavLink } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";

export default function DashboardLayout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <aside className="w-full border-b border-slate-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center px-5">
          <BrandLogo to="/" size="md" variant="dark" />
        </div>

        <nav className="space-y-1 px-3 pb-6">
          <NavLink to="/dashboard" end className={linkClass}>
            Overview
          </NavLink>
          <NavLink to="/artists" className={linkClass}>
            Browse Artists
          </NavLink>
          <NavLink to="/" className={linkClass}>
            Back to site
          </NavLink>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
