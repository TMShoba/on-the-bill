import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMarkNotificationsRead,
  useNotificationUnreadCount,
  useNotifications,
} from "../Services/notificationStore";
import { useAuth } from "../context/AuthContext";

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: unread = 0 } = useNotificationUnreadCount(user?.id);
  // Only load the full list while the panel is open
  const { data: items = [] } = useNotifications(user?.id, open);
  const markRead = useMarkNotificationsRead(user?.id);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-x-3 top-[4.25rem] z-50 max-h-[min(70vh,28rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-h-none sm:max-w-none"
            style={{ maxWidth: "calc(100vw - 1.5rem)" }}
          >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => {
                  markRead.mutate(undefined);
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No notifications yet
              </li>
            ) : (
              items.slice(0, 20).map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.href || "/dashboard"}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                    className={`block border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50 ${
                      !n.read ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                      {n.body}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
        </>
      )}
    </div>
  );
}
