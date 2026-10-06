import { Link } from "react-router-dom";
import { MotionConfig, motion } from "motion/react";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import { artistImage } from "../utils/imageCdn";

const EASE = [0.22, 1, 0.36, 1] as const;

const FEATURED = [
  { id: "7", name: "Black Coffee", tag: "Afro House" },
  { id: "14", name: "Uncle Waffles", tag: "Amapiano" },
  { id: "1", name: "Tyla", tag: "Pop / Amapiano" },
  { id: "2", name: "DJ Maphorisa", tag: "Amapiano" },
  { id: "9", name: "Nasty C", tag: "Hip Hop" },
];

const STEPS = [
  { title: "Find an artist", body: "Browse verified profiles and live availability." },
  { title: "Request a date", body: "Send venue, fee and travel details in one form." },
  { title: "Confirm & pay", body: "Get a contract, pay a deposit, and you're booked." },
];

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-slate-950 text-white pb-mobile-nav">
        <NavBar />

        <main className="flex-1">
          {/* Hero */}
          <section className="relative overflow-hidden">
            <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />

            <div className="relative mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold text-emerald-300"
              >
                South Africa's live-music booking platform
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
                className="mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl"
              >
                Build the night.
                <br />
                <span className="text-emerald-400">Set the lineup.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
                className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400"
              >
                Book South African artists for your event, at home or abroad, with contracts and
                payments handled in one place.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.24 }}
                className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"
              >
                <Link
                  to="/artists"
                  className="rounded-full bg-emerald-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
                >
                  Browse artists
                </Link>
                <Link
                  to="/register"
                  className="rounded-full border border-white/15 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/5"
                >
                  Join The LineUp
                </Link>
              </motion.div>
            </div>

            {/* Featured artists */}
            <div className="relative mx-auto mt-16 max-w-5xl px-4 pb-20 sm:mt-20 sm:px-6">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
                {FEATURED.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.3 + i * 0.07 }}
                    className={i > 2 ? "hidden sm:block" : ""}
                  >
                    <Link
                      to={`/artists/${a.id}`}
                      className={`group relative block overflow-hidden rounded-2xl bg-slate-900 ${i % 2 === 1 ? "sm:mt-8" : ""}`}
                    >
                      <div className="aspect-[3/4]">
                        <img
                          src={artistImage(a.id, "card")}
                          alt={a.name}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 text-left">
                        <p className="truncate text-sm font-bold">{a.name}</p>
                        <p className="text-[11px] text-emerald-300">{a.tag}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="border-t border-white/10 py-16 sm:py-20">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">How it works</h2>
              <ol className="mt-10 grid gap-8 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <motion.li
                    key={s.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
                    className="text-center"
                  >
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300">
                      {i + 1}
                    </span>
                    <h3 className="mt-4 font-bold">{s.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{s.body}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </section>

          {/* Closing call to action */}
          <section className="px-4 pb-20 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="mx-auto max-w-5xl rounded-3xl bg-emerald-500 px-6 py-12 text-center text-slate-950 sm:px-12"
            >
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Ready to book your next act?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-900/70">
                Promoters browse free. Artists get booked, paid and verified.
              </p>
              <Link
                to="/artists"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-7 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Get started
              </Link>
            </motion.div>
          </section>
        </main>

        <Footer />
      </div>
    </MotionConfig>
  );
}
