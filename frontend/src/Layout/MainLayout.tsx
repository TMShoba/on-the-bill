import { Outlet } from "react-router-dom";
import Navbar from "../components/NavBar";

export default function MainLayout() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/50">
      {/* Soft ambient orbs — glass theme backdrop */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute -right-16 top-40 h-80 w-80 rounded-full bg-teal-300/25 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <Navbar />

      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  );
}
