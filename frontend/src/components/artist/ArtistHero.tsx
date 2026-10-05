import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, type Variants } from "motion/react";
import type { Artist } from "../../Types/Artist";
import VerificationBadge from "../VerificationBadge";
import CurrencySelect from "./CurrencySelect";
import { useCurrency } from "../../context/CurrencyContext";
import { ARTIST_TIMEZONE, nowInZone } from "../../Services/international";
import { priceDisplay } from "../../Services/pricing";

type Props = {
  artist: Artist;
  imageSrc: string;
  completedCount: number;
  upcomingCount: number;
  canSave: boolean;
  saved: boolean;
  onToggleSave: () => void;
  onBook: () => void;
  onBack: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const nameContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
};
const nameWord: Variants = {
  hidden: { y: "110%", opacity: 0 },
  show: { y: "0%", opacity: 1, transition: { duration: 0.8, ease: EASE } },
};
const fadeUp: Variants = {
  hidden: { y: 16, opacity: 0 },
  show: (i: number = 0) => ({
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: EASE, delay: 0.5 + i * 0.08 },
  }),
};

function useLocalTime(timeZone: string) {
  const [time, setTime] = useState(() => nowInZone(timeZone));
  useEffect(() => {
    const id = window.setInterval(() => setTime(nowInZone(timeZone)), 30_000);
    return () => window.clearInterval(id);
  }, [timeZone]);
  return time;
}

export default function ArtistHero({
  artist,
  imageSrc,
  completedCount,
  upcomingCount,
  canSave,
  saved,
  onToggleSave,
  onBook,
  onBack,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0.35]);
  const { estimate } = useCurrency();
  const localTime = useLocalTime(ARTIST_TIMEZONE);
  const words = artist.stageName.split(" ");

  const price = priceDisplay(artist);
  const stats = [
    {
      label: price.kind === "band" ? "Typical fee" : "Starting from",
      value: price.label,
      sub:
        price.kind === "hidden"
          ? "Sign in or request a quote"
          : (price.amount != null && estimate(price.amount)) || "Charged in ZAR",
    },
    {
      label: "Completed on The LineUp",
      value: String(completedCount),
      sub: completedCount === 1 ? "booking" : "bookings",
    },
    {
      label: "Upcoming dates",
      value: String(upcomingCount),
      sub: upcomingCount ? "on the calendar" : "Calendar open",
    },
    {
      label: "Local time",
      value: localTime,
      sub: "Johannesburg (SAST)",
    },
  ];

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl shadow-slate-900/20"
    >
      {/* Image with slow zoom-in on load and parallax on scroll */}
      <motion.div className="absolute inset-0 -z-10" style={{ y: imageY }}>
        <motion.img
          src={imageSrc}
          alt=""
          className="h-[115%] w-full object-cover object-top"
          initial={{ scale: 1.12, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/70 via-transparent to-transparent" />

      <motion.div
        style={{ y: contentY, opacity: fade }}
        className="flex min-h-[440px] flex-col justify-between gap-6 p-5 sm:min-h-[480px] sm:p-8"
      >
        {/* Top bar */}
        <motion.div
          className="flex items-center justify-between gap-3"
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={-4}
        >
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Artists
          </motion.button>
          <CurrencySelect tone="glass" />
        </motion.div>

        {/* Identity */}
        <div className="max-w-3xl">
          <motion.div
            className="flex flex-wrap items-center gap-2"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={-3}
          >
            <span className="rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950">
              {artist.genre}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              {artist.location}, South Africa
            </span>
            <VerificationBadge
              status={artist.verificationStatus || "unverified"}
              size="md"
              hideIfUnverified
            />
          </motion.div>

          <motion.h1
            className="mt-3 text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl"
            variants={nameContainer}
            initial="hidden"
            animate="show"
            aria-label={artist.stageName}
          >
            {words.map((word, i) => (
              <span key={`${word}-${i}`} className="mr-[0.22em] inline-block overflow-hidden pb-1 align-bottom">
                <motion.span className="inline-block" variants={nameWord}>
                  {word}
                </motion.span>
              </span>
            ))}
          </motion.h1>

          <motion.div
            className="mt-5 flex flex-wrap items-center gap-3"
            initial="hidden"
            animate="show"
            variants={fadeUp}
            custom={1}
          >
            <motion.button
              type="button"
              onClick={onBook}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="group relative overflow-hidden rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/30"
            >
              <span className="relative z-10">Book now</span>
              {/* sheen sweep on hover */}
              <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/40 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
            </motion.button>
            {canSave && (
              <motion.button
                type="button"
                onClick={onToggleSave}
                whileTap={{ scale: 0.92 }}
                aria-pressed={saved}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold backdrop-blur-md transition ${
                  saved
                    ? "border-rose-300/60 bg-rose-500/90 text-white"
                    : "border-white/25 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <motion.span
                  key={saved ? "on" : "off"}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: [0.4, 1.35, 1] }}
                  transition={{ duration: 0.45 }}
                  aria-hidden
                >
                  {saved ? "♥" : "♡"}
                </motion.span>
                {saved ? "Saved" : "Save"}
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* Stats strip */}
        <motion.dl
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.75 } } }}
        >
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
              }}
              className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-md sm:px-4 sm:py-3"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/60 sm:text-[11px]">
                {s.label}
              </dt>
              <dd className="mt-0.5 text-lg font-black tabular-nums text-white sm:text-xl">{s.value}</dd>
              <dd className="truncate text-xs text-white/70">{s.sub}</dd>
            </motion.div>
          ))}
        </motion.dl>
      </motion.div>
    </section>
  );
}
