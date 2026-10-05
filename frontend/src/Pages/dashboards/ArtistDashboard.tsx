import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import axios from "axios";
import CountUp from "../../components/animations/CountUp";
import GigCalendar from "../../components/GigCalendar";
import GigDetailsModal from "../../components/GigDetailsModal";
import BookingDocuments from "../../components/BookingDocuments";
import RemindersPanel from "../../components/RemindersPanel";
import MessagesPanel from "../../components/Messages/MessagesPanel";
import ArtistPhotoUpload from "../../components/ArtistPhotoUpload";
import ProfileStrengthMeter from "../../components/ProfileStrengthMeter";
import EarningsStats from "../../components/EarningsStats";
import TrustEducation from "../../components/TrustEducation";
import ArtistVerificationPanel from "../../components/ArtistVerificationPanel";
import VerificationBadge from "../../components/VerificationBadge";
import CalendarSync from "../../components/artist/CalendarSync";
import PriceVisibilityCard from "../../components/artist/PriceVisibilityCard";
import { isIdentityVerifiedStatus, useMyVerification } from "../../Services/verificationStore";
import { getProfileStrength, useMyArtistProfile } from "../../Services/artistProfileStore";
import { useBlockedDates, useToggleBlockedDate } from "../../Services/calendarStore";
import {
  getDemoGigs,
  loadBookingsForUser,
  toggleReminderAsync,
  updateBookingStatusAsync,
  openBookingDisputeAsync,
} from "../../Services/demoStore";
import { useArtist } from "../../hooks/useArtists";
import { resolveArtistImage } from "../../utils/imageCdn";
import { findCountry } from "../../Services/international";
import type { Booking } from "../../Types/Artist";
import { useAuth } from "../../context/AuthContext";

type TabKey = "overview" | "calendar" | "profile" | "messages";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "calendar", label: "Calendar" },
  { key: "profile", label: "Profile" },
  { key: "messages", label: "Messages" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE, delay: i * 0.06 } }),
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDay(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function apiError(e: unknown, fallback: string) {
  return (axios.isAxiosError(e) && e.response?.data?.message) || fallback;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">{eyebrow}</p>}
        <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function ArtistDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") as TabKey;
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab) ? initialTab : "overview");
  const [gigs, setGigs] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [dayInfo, setDayInfo] = useState<{ date: string; gigs: Booking[] } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [responding, setResponding] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState("");

  const { data: verification } = useMyVerification(user?.id);
  const { data: profile } = useMyArtistProfile(user?.id);
  const { data: catalogArtist } = useArtist(user?.artistId);
  const { data: blocks = [] } = useBlockedDates(user?.id);
  const toggleBlock = useToggleBlockedDate(user?.id);
  const verified = isIdentityVerifiedStatus(verification?.status);

  useEffect(() => {
    let cancelled = false;
    loadBookingsForUser()
      .then((list) => !cancelled && setGigs(list))
      .catch(() => !cancelled && setGigs(getDemoGigs()))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Keep the URL in sync so notifications can deep-link (e.g. ?tab=profile)
  useEffect(() => {
    const fromUrl = searchParams.get("tab") as TabKey;
    if (fromUrl && TABS.some((t) => t.key === fromUrl) && fromUrl !== tab) setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function selectTab(key: TabKey) {
    setTab(key);
    setSearchParams(key === "overview" ? {} : { tab: key }, { replace: true });
  }

  const mine = useMemo(() => {
    if (!user) return gigs;
    const key = user.artistId || user.id;
    const forMe = gigs.filter((g) => g.artistId === key || g.artistId === user.id);
    return forMe.length > 0 ? forMe : gigs;
  }, [gigs, user]);

  const today = todayKey();
  const pending = useMemo(() => mine.filter((g) => g.status === "pending"), [mine]);
  const upcoming = useMemo(
    () =>
      mine
        .filter((g) => (g.status === "confirmed" || g.status === "paid") && g.eventDate.slice(0, 10) >= today)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [mine, today]
  );
  const paidTotal = useMemo(
    () => mine.filter((g) => g.status === "paid" || g.paymentStatus === "paid").reduce((s, g) => s + (g.fee || 0), 0),
    [mine]
  );
  const strength = getProfileStrength(profile, { hasPublicBio: Boolean(catalogArtist?.bio) }).percent;

  // Calendar shows bookings plus the artist's own blocked days
  const calendarItems = useMemo<Booking[]>(
    () => [
      ...mine,
      ...blocks.map((b) => ({
        id: `block-${b.date}`,
        artistId: user?.artistId || "",
        artistName: "",
        clientName: "",
        clientEmail: "",
        eventDate: b.date,
        venue: b.note || "Unavailable",
        message: "",
        status: "blocked" as const,
        createdAt: "",
      })),
    ],
    [mine, blocks, user?.artistId]
  );

  async function refresh() {
    try {
      setGigs(await loadBookingsForUser());
    } catch {
      setGigs(getDemoGigs());
    }
  }

  function openGig(g: Booking) {
    if (g.status === "blocked") return;
    setSelected(g);
    setModalOpen(true);
  }

  async function handleRespond(gigId: string, status: "confirmed" | "declined") {
    if (status === "confirmed" && !verified) {
      setModalOpen(false);
      selectTab("profile");
      return;
    }
    setResponding(true);
    try {
      const updated = await updateBookingStatusAsync(gigId, status);
      await refresh();
      if (updated) setSelected(updated);
    } catch (e) {
      window.alert(apiError(e, "Could not update this booking. Please try again."));
    } finally {
      setResponding(false);
    }
  }

  async function onCalendarDay(date: string, list: Booking[]) {
    setCalendarMsg("");
    if (!blockMode) {
      setDayInfo({ date, gigs: list });
      return;
    }
    const isBlocked = list.some((g) => g.status === "blocked");
    if (!isBlocked && list.some((g) => g.status === "confirmed" || g.status === "paid")) {
      setCalendarMsg("You have a confirmed gig that day.");
      return;
    }
    if (!isBlocked && date < today) {
      setCalendarMsg("Past dates can't be blocked.");
      return;
    }
    try {
      await toggleBlock.mutateAsync({ date, block: !isBlocked });
    } catch (e) {
      setCalendarMsg(apiError(e, "Couldn't update that date."));
    }
  }

  const heroImage = catalogArtist ? resolveArtistImage(catalogArtist.imageUrl, catalogArtist.id, "full") : null;
  const stats = [
    { label: "Requests", value: pending.length, sub: pending.length ? "need a reply" : "all answered", accent: pending.length > 0 },
    { label: "Upcoming gigs", value: upcoming.length, sub: upcoming[0] ? `next ${formatDay(upcoming[0].eventDate)}` : "none booked" },
    { label: "Fees paid", value: paidTotal, prefix: "R", sub: "completed bookings" },
    { label: "Profile", value: strength, suffix: "%", sub: strength >= 100 ? "complete" : "strength" },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative isolate overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/15 sm:p-8"
        >
          {heroImage && (
            <motion.img
              src={heroImage}
              alt=""
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.45 }}
              transition={{ duration: 1.4, ease: EASE }}
              className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-top sm:w-2/3"
            />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/30" />
          <div className="absolute -left-20 -top-20 -z-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Artist dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Welcome back, {user?.name?.split(" ")[0] || "there"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <VerificationBadge status={verification?.status || "unverified"} size="md" />
                {!verified && (
                  <button
                    type="button"
                    onClick={() => selectTab("profile")}
                    className="rounded-full bg-amber-400/90 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-300"
                  >
                    {verification?.status === "pending_review" ? "Verification in review" : "Verify to accept bookings →"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.artistId && (
                <Link
                  to={`/artists/${user.artistId}`}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md hover:bg-white/20"
                >
                  View public profile
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  selectTab("calendar");
                  setBlockMode(true);
                }}
                className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
              >
                Block dates
              </button>
            </div>
          </div>

          <motion.dl
            className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
          >
            {stats.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className={`rounded-2xl border px-4 py-3 backdrop-blur-md ${
                  s.accent ? "border-amber-300/40 bg-amber-400/15" : "border-white/15 bg-white/10"
                }`}
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{s.label}</dt>
                <dd className="mt-0.5 text-2xl font-black tabular-nums">
                  <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} />
                </dd>
                <dd className="truncate text-xs text-white/60">{s.sub}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </motion.header>

        {/* Tabs */}
        <div className="sticky top-16 z-20 -mx-4 mt-5 overflow-x-auto bg-slate-50/90 px-4 py-2 backdrop-blur scrollbar-none sm:static sm:mx-0 sm:bg-transparent sm:px-0">
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => selectTab(t.key)}
                className="relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
              >
                {tab === t.key && (
                  <motion.span
                    layoutId="artist-tab"
                    className="absolute inset-0 rounded-full bg-slate-900"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className={`relative flex items-center gap-1.5 ${tab === t.key ? "text-white" : "text-slate-600"}`}>
                  {t.label}
                  {t.key === "overview" && pending.length > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                      {pending.length}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-5"
          >
            {tab === "overview" && (
              <div className="space-y-6">
                <Card>
                  <SectionTitle
                    eyebrow="Inbox"
                    title={pending.length ? `${pending.length} booking request${pending.length === 1 ? "" : "s"}` : "Booking requests"}
                  />
                  {!loaded ? (
                    <div className="space-y-2">
                      {[0, 1].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
                    </div>
                  ) : pending.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      <span className="text-xl">🎧</span>
                      You're all caught up. New requests appear here and in your email.
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      <AnimatePresence initial={false}>
                        {pending.map((g, i) => {
                          const abroad = g.eventCountry && g.eventCountry !== "ZA";
                          return (
                            <motion.li
                              key={g.id}
                              layout
                              custom={i}
                              initial="hidden"
                              animate="show"
                              exit={{ opacity: 0, x: 20 }}
                              variants={fadeUp}
                              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
                            >
                              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-900 text-white">
                                <span className="text-[10px] font-semibold uppercase text-white/60">
                                  {new Date(`${g.eventDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}
                                </span>
                                <span className="text-lg font-black leading-none">{Number(g.eventDate.slice(8, 10))}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                                  {g.venue || "Event"}
                                  {abroad && (
                                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                      🌍 {findCountry(g.eventCountry)?.name || g.eventCountry}
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {g.promoterName || g.clientName}
                                  {g.city ? ` · ${g.city}` : ""}
                                  {g.time ? ` · ${g.time}` : ""}
                                  {typeof g.fee === "number" ? ` · R${g.fee.toLocaleString()}` : ""}
                                </p>
                                {g.message && <p className="mt-1 line-clamp-1 text-sm text-slate-600">“{g.message}”</p>}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  disabled={responding}
                                  onClick={() => handleRespond(g.id, "declined")}
                                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  disabled={responding}
                                  onClick={() => openGig(g)}
                                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  Review & accept
                                </button>
                              </div>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  )}
                </Card>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <EarningsStats gigs={mine} />
                  <Card>
                    <SectionTitle
                      eyebrow="Coming up"
                      title="Next gigs"
                      action={
                        <button type="button" onClick={() => selectTab("calendar")} className="text-sm font-semibold text-emerald-700">
                          Calendar →
                        </button>
                      }
                    />
                    {upcoming.length === 0 ? (
                      <p className="text-sm text-slate-500">No confirmed gigs yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {upcoming.slice(0, 5).map((g) => (
                          <li key={g.id}>
                            <button
                              type="button"
                              onClick={() => openGig(g)}
                              className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-50"
                            >
                              <span className="w-16 shrink-0 text-xs font-bold text-slate-500">{formatDay(g.eventDate)}</span>
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{g.venue}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  g.status === "paid" || g.paymentStatus === "paid"
                                    ? "bg-sky-50 text-sky-700"
                                    : g.paymentStatus === "deposit"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {g.status === "paid" || g.paymentStatus === "paid" ? "Paid" : g.paymentStatus === "deposit" ? "Deposit" : "Confirmed"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>

                <BookingDocuments bookings={mine} role="artist" onOpenBooking={openGig} />
                <RemindersPanel gigs={mine} onOpenGig={openGig} />
                <TrustEducation compact />
              </div>
            )}

            {tab === "calendar" && (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-slate-900">Availability</h2>
                      <p className="text-sm text-slate-500">
                        {blockMode ? "Tap days to block or unblock them." : "Tap a day to see what's on."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBlockMode((v) => !v);
                        setCalendarMsg("");
                      }}
                      aria-pressed={blockMode}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        blockMode ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {blockMode ? "Done blocking" : "Block dates"}
                    </button>
                  </div>
                  <AnimatePresence>
                    {(blockMode || calendarMsg) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`overflow-hidden rounded-2xl px-4 py-2.5 text-sm ${
                          calendarMsg ? "bg-rose-50 text-rose-700" : "bg-slate-900 text-white"
                        }`}
                      >
                        {calendarMsg || "Blocking mode — promoters can't request blocked days."}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <div className={blockMode ? "rounded-2xl ring-2 ring-slate-900 ring-offset-2" : ""}>
                    <GigCalendar gigs={calendarItems} onSelectDay={onCalendarDay} onSelectGig={blockMode ? undefined : openGig} />
                  </div>
                  <AnimatePresence>
                    {dayInfo && !blockMode && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Card>
                          <SectionTitle title={formatDay(dayInfo.date)} />
                          {dayInfo.gigs.length === 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                              Free day.
                              {dayInfo.date >= today && (
                                <button
                                  type="button"
                                  onClick={() => toggleBlock.mutate({ date: dayInfo.date, block: true }, { onSuccess: () => setDayInfo(null) })}
                                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Block this day
                                </button>
                              )}
                            </div>
                          ) : (
                            <ul className="space-y-2">
                              {dayInfo.gigs.map((g) => (
                                <li key={g.id}>
                                  {g.status === "blocked" ? (
                                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                                      <span>🚫 {g.venue}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleBlock.mutate({ date: dayInfo.date, block: false }, { onSuccess: () => setDayInfo(null) })}
                                        className="text-xs font-semibold text-emerald-700"
                                      >
                                        Unblock
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openGig(g)}
                                      className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    >
                                      <span className="font-medium">{g.venue}</span>
                                      <span className="capitalize text-slate-500">{g.status}</span>
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-6">
                  <CalendarSync />
                  <Card>
                    <SectionTitle eyebrow="Unavailable" title="Blocked dates" />
                    {blocks.filter((b) => b.date >= today).length === 0 ? (
                      <p className="text-sm text-slate-500">No blocked dates. Use “Block dates” to mark days you can't play.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        <AnimatePresence initial={false}>
                          {blocks
                            .filter((b) => b.date >= today)
                            .map((b) => (
                              <motion.li
                                key={b.date}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-semibold text-slate-700"
                              >
                                {formatDay(b.date)}
                                <button
                                  type="button"
                                  aria-label={`Unblock ${b.date}`}
                                  onClick={() => toggleBlock.mutate({ date: b.date, block: false })}
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900"
                                >
                                  ×
                                </button>
                              </motion.li>
                            ))}
                        </AnimatePresence>
                      </ul>
                    )}
                  </Card>
                </div>
              </div>
            )}

            {tab === "profile" && (
              <div className="space-y-6">
                {user && <ArtistVerificationPanel userId={user.id} />}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <SectionTitle eyebrow="Public profile" title="Profile photo" />
                    <ArtistPhotoUpload currentImageUrl={heroImage || undefined} />
                  </Card>
                  <PriceVisibilityCard rate={catalogArtist?.rate ?? null} />
                </div>
                <ProfileStrengthMeter artistId={user?.artistId || user?.id || ""} hasPublicBio={Boolean(catalogArtist?.bio)} />
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  Banking details for payouts live in{" "}
                  <Link to="/dashboard/settings" className="font-semibold text-emerald-700 hover:underline">
                    Settings
                  </Link>
                  .
                </div>
              </div>
            )}

            {tab === "messages" && <MessagesPanel />}
          </motion.div>
        </AnimatePresence>

        <GigDetailsModal
          open={modalOpen}
          gig={selected}
          onClose={() => setModalOpen(false)}
          showReminderToggle
          canRespond
          responding={responding}
          onRespond={handleRespond}
          onDispute={async (id, reason) => {
            try {
              const updated = await openBookingDisputeAsync(id, reason);
              await refresh();
              if (updated) setSelected(updated);
            } catch (e) {
              window.alert(apiError(e, "Could not update this booking. Please try again."));
            }
          }}
          onToggleReminder={async (id, value) => {
            try {
              await toggleReminderAsync(id, value);
              await refresh();
              setSelected((prev) => (prev && prev.id === id ? { ...prev, reminderOptIn: value } : prev));
            } catch (e) {
              window.alert(apiError(e, "Could not update this booking. Please try again."));
            }
          }}
        />
      </div>
    </MotionConfig>
  );
}
