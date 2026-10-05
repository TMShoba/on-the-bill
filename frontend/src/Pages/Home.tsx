import { Link } from "react-router-dom";
import { MotionConfig, motion, type Variants } from "motion/react";
import NavBar from "../components/NavBar";
import ActivityFeed from "../components/ActivityFeed";
import Footer from "../components/Footer";
import { artistImage } from "../utils/imageCdn";
import BlurText from "../components/animations/BlurText";
import TextType from "../components/animations/TextType";
import ParticleBackground from "../components/animations/ParticleBackground";
import PageTransition from "../components/animations/PageTransition";
import CountUp from "../components/animations/CountUp";

const EASE = [0.22, 1, 0.36, 1] as const;

const roster = [
  { id: "1", name: "Tyla", tag: "Pop / Amapiano" },
  { id: "7", name: "Black Coffee", tag: "Afro House" },
  { id: "2", name: "DJ Maphorisa", tag: "Amapiano" },
  { id: "3", name: "Master KG", tag: "Afro Pop" },
  { id: "14", name: "Uncle Waffles", tag: "Amapiano" },
  { id: "9", name: "Nasty C", tag: "Hip Hop" },
  { id: "21", name: "A-Reece", tag: "Hip Hop" },
  { id: "23", name: "DBN Gogo", tag: "Amapiano" },
  { id: "25", name: "Cassper Nyovest", tag: "Hip Hop" },
  { id: "22", name: "Dlala Thukzin", tag: "Gqom" },
];

const STEPS = [
  {
    title: "Discover",
    body: "Verified profiles with rates, bios and a live availability calendar.",
    icon: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z",
  },
  {
    title: "Request",
    body: "Date, venue, fee and travel in one clean form. No screenshots, no WhatsApp maze.",
    icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  },
  {
    title: "Confirm",
    body: "The artist accepts and a PDF contract is generated for both sides, frozen at acceptance.",
    icon: "M9 12l2 2 4-4M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z",
  },
  {
    title: "Pay & play",
    body: "Deposit by card or EFT, receipts for both sides, and chat right up to showtime.",
    icon: "M3 10h18M7 15h2m4 0h4M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: i * 0.08 } }),
};

/** Right side of the hero: a stack of artist cards and the booking moments the product delivers */
function HeroShowcase() {
  const cards = [
    { id: "7", name: "Black Coffee", tag: "Afro House", rotate: -8, x: -120, y: 26 },
    { id: "14", name: "Uncle Waffles", tag: "Amapiano", rotate: 7, x: 120, y: 30 },
    { id: "2", name: "DJ Maphorisa", tag: "Amapiano", rotate: 0, x: 0, y: 0 },
  ];
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md" aria-hidden>
      {cards.map((c, i) => (
        <motion.div
          key={c.id}
          // Centred with a negative margin so motion owns the transform
          className="absolute left-1/2 top-4 -ml-24 w-48"
          style={{ zIndex: i }}
          initial={{ opacity: 0, y: 60, rotate: 0, x: 0 }}
          animate={{ opacity: 1, y: c.y, rotate: c.rotate, x: c.x }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.12 }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
            className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50"
          >
            <div className="relative aspect-[3/4]">
              <img src={artistImage(c.id, "card")} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="truncate text-sm font-bold text-white">{c.name}</p>
                <p className="text-[11px] text-emerald-300">{c.tag}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ))}

      {/* Booking confirmed toast */}
      <motion.div
        className="absolute -left-2 bottom-16 z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/95 px-4 py-3 text-slate-900 shadow-xl sm:-left-6"
        initial={{ opacity: 0, x: -24, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 1 }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span>
          <span className="block text-xs font-bold">Booking confirmed</span>
          <span className="block text-[11px] text-slate-500">Printworks London · 12 Dec</span>
        </span>
      </motion.div>

      {/* Contract chip */}
      <motion.div
        className="absolute -right-2 bottom-6 z-10 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 shadow-xl backdrop-blur sm:-right-6"
        initial={{ opacity: 0, x: 24, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 1.25 }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-[10px] font-black text-rose-300">
          PDF
        </span>
        <span>
          <span className="block text-xs font-bold text-white">Contract ready</span>
          <span className="block text-[11px] text-slate-400">Deposit R12,960 paid</span>
        </span>
      </motion.div>
    </div>
  );
}

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-slate-950 text-white pb-mobile-nav">
        <NavBar />
        <ActivityFeed />

        <PageTransition className="flex-1">
          {/* HERO */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0">
              <img src={artistImage("1", "full")} alt="" className="h-full w-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/70" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
              <div className="absolute -right-40 top-10 h-[480px] w-[480px] rounded-full bg-emerald-500/20 blur-[120px]" />
              <ParticleBackground count={40} tone="mixed" opacity={0.6} />
            </div>

            <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pb-16">
              <div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
                  <TextType
                    text={[
                      "South Africa's live-music booking platform",
                      "Amapiano · Hip Hop · House · Gqom",
                      "Book talent without the WhatsApp chaos",
                    ]}
                    typingSpeed={42}
                    deletingSpeed={28}
                    pauseDuration={2200}
                    cursorCharacter="|"
                    cursorClassName="text-emerald-400"
                    className="inline"
                  />
                </p>
                <h1 className="text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                  <BlurText text="Build the night." delay={80} animateBy="words" direction="top" className="justify-start" />
                  <span className="text-emerald-400">
                    <BlurText text="Set the lineup." delay={100} animateBy="words" direction="bottom" className="justify-start" />
                  </span>
                </h1>
                <motion.p
                  className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg"
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  custom={3}
                >
                  The direct line between South African artists and promoters at home and abroad.
                  Discover verified talent, request a date, and confirm with a contract on a shared
                  calendar.
                </motion.p>

                <motion.div
                  className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  custom={4}
                >
                  <Link
                    to="/artists"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
                  >
                    Browse the roster
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
                  >
                    Join as artist or promoter
                  </Link>
                </motion.div>

                <motion.dl
                  className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6"
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  custom={5}
                >
                  <div>
                    <dt className="text-xs text-slate-400">Artists live</dt>
                    <dd className="text-2xl font-black sm:text-3xl">
                      <CountUp value={45} suffix="+" className="tabular-nums" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Markets</dt>
                    <dd className="text-2xl font-black sm:text-3xl">
                      <CountUp value={30} suffix="+" className="tabular-nums" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Request to inbox</dt>
                    <dd className="text-2xl font-black sm:text-3xl">Instant</dd>
                  </div>
                </motion.dl>
              </div>

              <div className="hidden sm:block">
                <HeroShowcase />
              </div>
            </div>
          </section>

          {/* ROSTER */}
          <section className="border-y border-white/10 bg-slate-900/60 py-8">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Featured on The LineUp</h2>
                <Link to="/artists" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
                  View all →
                </Link>
              </div>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
                {roster.map((a, i) => (
                  <motion.div
                    key={a.id}
                    className="w-36 shrink-0 snap-start sm:w-40"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 6) * 0.05 }}
                  >
                    <Link to={`/artists/${a.id}`} className="group relative block overflow-hidden rounded-2xl bg-slate-800">
                      <div className="aspect-[3/4]">
                        <img
                          src={artistImage(a.id, "card")}
                          alt={a.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
                      <div className="absolute bottom-2.5 left-3 right-3">
                        <p className="truncate text-sm font-bold">{a.name}</p>
                        <p className="text-[11px] text-emerald-300">{a.tag}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="py-14 sm:py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">How it works</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    From request to stage in <span className="text-emerald-400">four steps</span>
                  </h2>
                </div>
                <p className="max-w-sm text-sm text-slate-400">
                  A club in Sandton or a festival in London: talent, contracts, payments and chat in one place.
                </p>
              </div>

              <motion.ol
                className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
              >
                {STEPS.map((s, i) => (
                  <motion.li
                    key={s.title}
                    variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}
                    whileHover={{ y: -4 }}
                    className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-emerald-500/30 hover:bg-white/[0.07]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                        </svg>
                      </span>
                      <span className="text-xs font-black text-white/20">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 font-bold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.body}</p>
                  </motion.li>
                ))}
              </motion.ol>
            </div>
          </section>

          {/* AUDIENCES + PRICING */}
          <section className="pb-14 sm:pb-16">
            <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
              <motion.div
                className="relative overflow-hidden rounded-3xl bg-emerald-500 p-7 text-slate-950 sm:p-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">Promoters</p>
                <h3 className="mt-2 text-2xl font-black sm:text-3xl">Fill the lineup. Fast.</h3>
                <ul className="mt-4 space-y-1.5 text-sm font-medium">
                  <li>✓ Free to browse and request</li>
                  <li>✓ Small platform fee only when a booking is confirmed</li>
                  <li>✓ Prices shown in your currency, contracts and receipts as PDFs</li>
                </ul>
                <Link
                  to="/register"
                  className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Start booking
                </Link>
              </motion.div>
              <motion.div
                className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-900 p-7 sm:p-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
              >
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl" />
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Artists</p>
                <h3 className="mt-2 text-2xl font-black sm:text-3xl">Own your calendar.</h3>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                  <li>✓ Requests from local and international promoters</li>
                  <li>✓ Verified badge, contracts on acceptance, paid in full</li>
                  <li>✓ One inbox for chat, riders and invoices</li>
                </ul>
                <Link
                  to="/register"
                  className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100"
                >
                  List yourself
                </Link>
              </motion.div>
            </div>
          </section>
        </PageTransition>
        <Footer />
      </div>
    </MotionConfig>
  );
}
