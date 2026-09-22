import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { mockMessagingApi } from "../Services/mockMessagingApi";
import NotificationBell from "./NotificationBell";
import BrandLogo from "./BrandLogo";
import AppleGlassNav, { type GlassNavItem } from "./AppleGlassNav";

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: () => mockMessagingApi.totalUnread(user!.id),
    enabled: Boolean(user),
    refetchInterval: 5000,
  });

  const navItems: GlassNavItem[] = [
    { name: "Home", to: "/", end: true },
    { name: "Artists", to: "/artists" },
  ];

  if (isAuthenticated) {
    navItems.push(
      { name: "Dashboard", to: "/dashboard" },
      { name: "Messages", to: "/messages", badge: unread }
    );
  } else {
    navItems.push({ name: "Login", to: "/login" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/75 shadow-sm shadow-black/5 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLogo to="/" variant="dark" size="md" />

        {/* Desktop glass pill nav */}
        <div className="hidden flex-1 justify-center sm:flex">
          <AppleGlassNav items={navItems} />
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          {isAuthenticated && <NotificationBell />}
          {!isAuthenticated ? (
            <Link
              to="/register"
              className="rounded-full border border-emerald-500/30 bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 backdrop-blur-md transition hover:bg-emerald-500"
            >
              Sign up
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/settings"
                className="max-w-[140px] truncate rounded-full border border-white/50 bg-white/50 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md hover:bg-white/80"
                title={user?.email}
              >
                {user?.name || user?.email || "Account"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="rounded-full border border-white/50 bg-white/40 px-3 py-1.5 text-sm font-medium text-slate-700 backdrop-blur-md transition hover:bg-white/70"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Mobile compact */}
        <div className="flex items-center gap-2 sm:hidden">
          {isAuthenticated && <NotificationBell />}
          <Link
            to="/artists"
            className="rounded-full border border-white/40 bg-white/40 px-3 py-1.5 text-sm font-medium text-slate-700 backdrop-blur-md"
          >
            Artists
          </Link>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-emerald-600/90 px-3 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-md"
            >
              Dash{unread > 0 ? ` (${unread})` : ""}
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-emerald-600/90 px-3 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-md"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
