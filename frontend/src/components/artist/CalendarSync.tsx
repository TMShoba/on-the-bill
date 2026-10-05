import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { calendarAppLinks, useCalendarFeed, useRotateCalendarFeed } from "../../Services/calendarStore";

const APPS = [
  { key: "google", label: "Google Calendar", color: "bg-[#4285F4]" },
  { key: "apple", label: "Apple Calendar", color: "bg-slate-900" },
  { key: "outlook", label: "Outlook", color: "bg-[#0F6CBD]" },
] as const;

/** Subscribe-to-calendar card: confirmed gigs, holds and blocked dates, kept in sync */
export default function CalendarSync() {
  const { user } = useAuth();
  const { data: feed, isLoading, isError } = useCalendarFeed(user?.id);
  const rotate = useRotateCalendarFeed(user?.id);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function copy() {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your calendar link:", feed.url);
    }
  }

  const links = feed ? calendarAppLinks(feed) : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/30">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zm4 9l2 2 4-4" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Sync to your calendar</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Confirmed gigs, holds and blocked dates appear in your phone's calendar and stay up to date.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton mt-4 h-24 rounded-2xl" />
      ) : isError || !feed || !links ? (
        <p className="mt-4 text-sm text-rose-600">Couldn't create your calendar link. Please refresh and try again.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {APPS.map((app) => (
              <motion.a
                key={app.key}
                href={links[app.key]}
                target={app.key === "apple" ? undefined : "_blank"}
                rel="noreferrer"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2.5 rounded-2xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:shadow-sm"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${app.color}`} />
                Add to {app.label}
              </motion.a>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 p-2 pl-3.5">
            <code className="min-w-0 flex-1 truncate text-xs text-slate-500">{feed.url}</code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={copied ? "y" : "n"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="block">
                  {copied ? "Copied ✓" : "Copy link"}
                </motion.span>
              </AnimatePresence>
            </button>
            <a
              href={feed.url}
              download="lineup-calendar.ics"
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
            >
              .ics
            </a>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>🔒 Private link — anyone with it can see your gigs. Calendar apps refresh it every few hours.</span>
            {confirmReset ? (
              <span className="flex items-center gap-2">
                <span>Old link stops working.</span>
                <button
                  type="button"
                  onClick={() => rotate.mutate(undefined, { onSettled: () => setConfirmReset(false) })}
                  className="font-semibold text-rose-600 hover:underline"
                >
                  {rotate.isPending ? "Resetting…" : "Reset"}
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className="font-semibold text-slate-600">
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="font-semibold text-slate-600 hover:text-slate-900">
                Reset link
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
