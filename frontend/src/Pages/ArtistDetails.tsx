import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import GigCalendar from "../components/GigCalendar";
import CompletedBadge from "../components/CompletedBadge";
import ArtistHero from "../components/artist/ArtistHero";
import BookingModal from "../components/artist/BookingModal";
import CurrencySelect from "../components/artist/CurrencySelect";
import { useArtist } from "../hooks/useArtists";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { resolveArtistImage } from "../utils/imageCdn";
import { api } from "../Services/api";
import type { Booking } from "../Types/Artist";
import { useFavorites, useToggleFavorite } from "../Services/favoritesStore";
import { getArtistBadges } from "../Services/reputationStore";
import { findCountry } from "../Services/international";
import { priceDisplay } from "../Services/pricing";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Section that fades up as it scrolls into view */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {children && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{children}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  paid: "bg-sky-50 text-sky-700",
  pending: "bg-amber-50 text-amber-700",
  declined: "bg-rose-50 text-rose-700",
  blocked: "bg-slate-100 text-slate-600",
};

const ABROAD = [
  {
    title: "Your time zone, handled",
    body: "Enter the start time at your venue. We show the artist exactly when that is in South Africa, including date changes.",
    icon: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  },
  {
    title: "Prices in your currency",
    body: "See every fee as an estimate in your currency. Payments are charged in ZAR; your bank converts at checkout.",
    icon: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.7 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3",
  },
  {
    title: "Travel in the contract",
    body: "Flights, accommodation, transfers and visa letters are agreed up front and written into the booking confirmation.",
    icon: "M2.5 19h19M3 13.5l5.5 1.5L17 7l2.5.5L15 15l5 1.4-.8 2.1L3.3 15.4z",
  },
];

const STEPS = [
  ["Request a date", "Pick a date, share venue and travel details, and make your offer."],
  ["Artist accepts", "A booking confirmation is generated and frozen for both sides."],
  ["Pay the deposit", "Secure the date by card or bank transfer. Receipts are issued automatically."],
  ["Showtime", "Message the artist in-app, settle the balance, and enjoy the set."],
];

export default function ArtistDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data: artist, isLoading, isError } = useArtist(id);
  const { estimate } = useCurrency();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [artistGigs, setArtistGigs] = useState<Booking[]>([]);
  const [dayGigs, setDayGigs] = useState<Booking[]>([]);
  const [bioExpanded, setBioExpanded] = useState(false);
  // Show the sticky "Book" bar once the hero (and its button) scrolls away.
  // Callback ref: the hero only mounts after the artist loads.
  const [heroEl, setHeroEl] = useState<HTMLDivElement | null>(null);
  const [heroInView, setHeroInView] = useState(true);

  useEffect(() => {
    if (!heroEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.intersectionRatio >= 0.25),
      { threshold: 0.25 }
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, [heroEl]);


  useEffect(() => {
    if (!artist?.id) return;
    let cancelled = false;
    api
      .get<Booking[]>(`/bookings/artist/${artist.id}/calendar`)
      .then(({ data }) => {
        if (!cancelled) setArtistGigs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setArtistGigs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [artist?.id]);

  const canSave = isAuthenticated && (user?.role === "promoter" || user?.role === "client");
  const favoritesUserId = canSave ? user?.id : undefined;
  const { data: favorites = [] } = useFavorites(favoritesUserId);
  const toggleFavorite = useToggleFavorite(favoritesUserId);
  const saved = Boolean(artist && favorites.some((a) => a.id === artist.id));

  const badges = useMemo(() => (artist ? getArtistBadges(artist) : null), [artist]);
  const upcomingCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return artistGigs.filter((g) => g.eventDate >= today && g.status !== "declined" && g.status !== "blocked").length;
  }, [artistGigs]);

  function openBooking() {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    setBookingOpen(true);
  }
  const closeBooking = useCallback(() => setBookingOpen(false), []);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-50 pb-mobile-nav">
        <NavBar />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <div className="h-[480px] skeleton rounded-[2rem]" />
          <div className="mx-auto mt-10 max-w-5xl space-y-6">
            <div className="h-8 w-48 skeleton rounded-lg" />
            <div className="h-56 skeleton rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !artist) {
    return (
      <div className="min-h-dvh bg-slate-50 pb-mobile-nav">
        <NavBar />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Artist not found</h1>
          <Link to="/artists" className="mt-6 inline-block text-emerald-600">
            ← Back to artists
          </Link>
        </div>
      </div>
    );
  }

  const bio = artist.bio || "";
  const price = priceDisplay(artist);
  const longBio = bio.length > 320;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-slate-50 pb-mobile-nav">
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 sm:pt-8">
          <div ref={setHeroEl}>
          <ArtistHero
            artist={artist}
            imageSrc={resolveArtistImage(artist.imageUrl, artist.id, "full")}
            completedCount={badges?.completedCount || 0}
            upcomingCount={upcomingCount}
            canSave={canSave}
            saved={saved}
            onToggleSave={() => toggleFavorite.mutate({ artist, save: !saved })}
            onBook={openBooking}
            onBack={() => navigate("/artists")}
          />
          </div>

          <div className="mx-auto mt-8 max-w-5xl lg:mt-10">
            <div className="min-w-0 space-y-10 sm:space-y-12">
              <Reveal>
                <SectionHeading eyebrow="About" title={`Meet ${artist.stageName}`} />
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                  {bio ? (
                    <>
                      <motion.div
                        initial={false}
                        animate={{ height: longBio && !bioExpanded ? 140 : "auto" }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className="relative overflow-hidden"
                      >
                        <p className="whitespace-pre-line text-base leading-relaxed text-slate-600 sm:text-lg">{bio}</p>
                        {longBio && !bioExpanded && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white" />
                        )}
                      </motion.div>
                      {longBio && (
                        <button
                          type="button"
                          onClick={() => setBioExpanded((v) => !v)}
                          className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          {bioExpanded ? "Show less" : "Read full bio"}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500">This artist hasn't added a biography yet.</p>
                  )}

                  <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-6 sm:grid-cols-4">
                    {[
                      ["Genre", artist.genre],
                      ["Based in", artist.location],
                      ["Books", "South Africa & worldwide"],
                      [price.kind === "band" ? "Typical fee" : "Fee from", price.label],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                          {v}
                          {/fee/i.test(k) && price.amount != null && estimate(price.amount) && (
                            <span className="block text-xs font-medium text-slate-500">{estimate(price.amount)}</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {badges?.completedBooking && (
                    <div className="mt-5">
                      <CompletedBadge label={badges.label} count={badges.completedCount} size="md" />
                    </div>
                  )}
                </div>
              </Reveal>

              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionHeading eyebrow="International" title="Booking from abroad">
                    Everything you need to book a South African act for an event anywhere in the world.
                  </SectionHeading>
                  <CurrencySelect className="mb-5" />
                </div>
                <motion.div
                  className="grid gap-4 sm:grid-cols-3"
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
                >
                  {ABROAD.map((item) => (
                    <motion.div
                      key={item.title}
                      variants={{
                        hidden: { opacity: 0, y: 24 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
                      }}
                      whileHover={{ y: -4 }}
                      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/30">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                      </span>
                      <h3 className="mt-4 font-bold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.body}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </Reveal>

              <Reveal>
                <SectionHeading eyebrow="Availability" title="Calendar">
                  Dots show booked and held dates. Tap a day to see where they're playing; other
                  promoters' names and fees stay private.
                </SectionHeading>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                  <GigCalendar
                    gigs={artistGigs}
                    onSelectDay={(_date, list) => setDayGigs(list)}
                    onSelectGig={(gig) => setDayGigs([gig])}
                  />
                  <AnimatePresence initial={false}>
                    {dayGigs.length > 0 && (
                      <motion.ul
                        key={dayGigs.map((g) => g.id).join()}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="mt-4 space-y-2 overflow-hidden"
                      >
                        {dayGigs.map((g) => {
                          const abroad = g.eventCountry && g.eventCountry !== "ZA";
                          return (
                            <li
                              key={g.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                            >
                              <span>
                                <span className="font-semibold text-slate-900">{g.venue || "Gig"}</span>
                                <span className="text-slate-500">
                                  {" "}· {g.eventDate}
                                  {g.time ? ` · ${g.time}` : ""}
                                  {g.city ? ` · ${g.city}` : ""}
                                  {abroad ? `, ${findCountry(g.eventCountry)?.name || g.eventCountry}` : ""}
                                </span>
                              </span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[g.status] || ""}`}>
                                {g.status}
                              </span>
                            </li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                  {artistGigs.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No gigs on the calendar yet. Every date is open to request.
                    </p>
                  )}
                </div>
              </Reveal>

              <Reveal>
                <SectionHeading eyebrow="Process" title="How booking works" />
                <ol className="relative space-y-6 pl-12">
                  <motion.span
                    aria-hidden
                    className="absolute bottom-4 left-[19px] top-4 w-0.5 origin-top bg-gradient-to-b from-emerald-400 to-teal-200"
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 1.1, ease: EASE }}
                  />
                  {STEPS.map(([title, body], i) => (
                    <motion.li
                      key={title}
                      className="relative"
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.15 * i }}
                    >
                      <span className="absolute -left-12 flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-slate-900 text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <h3 className="pt-1.5 font-bold text-slate-900">{title}</h3>
                      <p className="mt-0.5 text-sm text-slate-500">{body}</p>
                    </motion.li>
                  ))}
                </ol>
              </Reveal>
            </div>

          </div>
        </main>
        <Footer />

        <BookingModal
          artist={artist}
          open={bookingOpen}
          onClose={closeBooking}
          blockedDates={artistGigs.filter((g) => g.status === "blocked").map((g) => g.eventDate.slice(0, 10))}
        />

        {/* Sticky booking bar: appears once the hero's button is off screen */}
        <AnimatePresence>
          {!heroInView && !bookingOpen && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              // Phones: full width above the bottom nav. Larger screens: bottom-left, clear of the Messages button.
              className={`fixed inset-x-3 z-40 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[26rem] ${
                isAuthenticated
                  ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
                  : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]"
              }`}
            >
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 pl-4 shadow-2xl shadow-slate-900/15 backdrop-blur-lg">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{artist.stageName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {price.kind === "exact" ? `From ${price.label}` : price.label}
                    {price.amount != null && estimate(price.amount) ? ` · ${estimate(price.amount)}` : ""}
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={openBooking}
                  className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/25 hover:bg-emerald-400"
                >
                  Book now
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
