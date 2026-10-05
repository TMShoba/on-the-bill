import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotificationUnreadCount } from "../Services/notificationStore";
import { useQuery } from "@tanstack/react-query";
import { mockMessagingApi } from "../Services/mockMessagingApi";

const iconClass = "h-5 w-5";

function HomeIcon() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
    </svg>
  );
}

function ArtistsIcon() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function MsgIcon() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export default function MobileBottomNav() {
  const { user, isAuthenticated } = useAuth();
  const { data: notifUnread = 0 } = useNotificationUnreadCount(user?.id);

  const { data: msgUnread = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: () => mockMessagingApi.totalUnread(user!.id),
    enabled: Boolean(user),
    refetchInterval: 5000,
  });

  if (!isAuthenticated) return null;

  const badge = (n: number) =>
    n > 0 ? (
      <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
        {n > 9 ? "9+" : n}
      </span>
    ) : null;

  const item = ({
    to,
    end,
    label,
    icon,
    count,
  }: {
    to: string;
    end?: boolean;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold transition ${
          isActive ? "text-emerald-600" : "text-slate-400 active:text-slate-600"
        }`
      }
    >
      <span className="relative">
        {icon}
        {badge(count || 0)}
      </span>
      {label}
    </NavLink>
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 shadow-[0_-4px_24px_rgb(15_23_42/0.06)] backdrop-blur-lg sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1 pt-1">
        {item({ to: "/", end: true, label: "Home", icon: <HomeIcon /> })}
        {item({ to: "/artists", label: "Artists", icon: <ArtistsIcon /> })}
        {item({
          to: "/dashboard",
          label: "Dashboard",
          icon: <DashIcon />,
          count: notifUnread,
        })}
        {item({
          to: "/messages",
          label: "Messages",
          icon: <MsgIcon />,
          count: msgUnread,
        })}
      </div>
    </nav>
  );
}
