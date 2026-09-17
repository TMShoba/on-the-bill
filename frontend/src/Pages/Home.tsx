import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import ActivityFeed from "../components/ActivityFeed";
import Footer from "../components/Footer";
import { artistImage } from "../utils/imageCdn";
import BlurText from "../components/animations/BlurText";
import TextType from "../components/animations/TextType";
import FadeIn, { Stagger, StaggerItem } from "../components/animations/FadeIn";

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

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-white pb-mobile-nav">
      <NavBar />

      {/* Live activity strip — directly under navbar */}
      <ActivityFeed />

      <div className="flex-1">
      {/* HERO — dark, high-impact */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={artistImage("1", "full")}
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28">
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
          <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <BlurText
              text="Build the night."
              delay={80}
              animateBy="words"
              direction="top"
              className="justify-start"
            />
            <span className="text-emerald-400">
              <BlurText
                text="Set the lineup."
                delay={100}
                animateBy="words"
                direction="bottom"
                className="justify-start"
              />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            The LineUp connects promoters with verified SA talent — from Amapiano
            headliners to Hip Hop heavyweights. Discover, request, and confirm
            without the WhatsApp chaos.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/artists"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-4 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
            >
              Browse the roster
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              I&apos;m an artist / promoter
            </Link>
          </div>

          <div className="mt-14 flex flex-wrap gap-8 border-t border-white/10 pt-8 text-sm">
            <div>
              <p className="text-3xl font-black text-white">25+</p>
              <p className="text-slate-400">Artists live</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">R12k–100k</p>
              <p className="text-slate-400">Transparent rates</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">Same day</p>
              <p className="text-slate-400">Request to inbox</p>
            </div>
          </div>
        </div>
      </section>


      {/* ROSTER STRIP */}
      <section className="border-y border-white/10 bg-slate-900/50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
              Featured on The LineUp
            </h2>
            <Link
              to="/artists"
              className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
            >
              View all →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {roster.map((a) => (
              <Link
                key={a.id}
                to={`/artists/${a.id}`}
                className="group w-40 shrink-0 sm:w-48"
              >
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-slate-800">
                  <img
                    src={artistImage(a.id, "card")}
                    alt={a.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 truncate text-sm font-bold">{a.name}</p>
                <p className="text-xs text-slate-400">{a.tag}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PITCH */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Built for people who book{" "}
              <span className="text-emerald-400">real shows</span>
            </h2>
            <p className="mt-4 text-slate-400">
              Whether you&apos;re filling a club in Sandton or a festival stage
              in Durban — The LineUp keeps talent, rates and conversations in
              one place.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <Stagger className="contents">
            {[
              {
                title: "Verified roster",
                body: "Profiles with real rates and bios. No endless “who is available?” threads.",
              },
              {
                title: "Request in one form",
                body: "Date, venue, fee, notes — the artist gets a clean request, not a wall of screenshots.",
              },
              {
                title: "Chat + documents",
                body: "In-app messages, attach riders and contracts, track pending to confirmed.",
              },
            ].map((c) => (
              <StaggerItem key={c.title}>
              <div
                className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur transition hover:border-emerald-500/30 hover:bg-white/[0.07]"
              >
                <h3 className="text-lg font-bold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {c.body}
                </p>
              </div>
              </StaggerItem>
            ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* SPLIT CTA */}
      <section className="pb-20 sm:pb-28">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl bg-emerald-500 p-8 text-slate-950 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">
              Promoters
            </p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">
              Fill the lineup. Fast.
            </h3>
            <p className="mt-3 max-w-sm text-sm font-medium opacity-80">
              Browse artists, send requests, and manage every booking from one
              dashboard.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Login as promoter
            </Link>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-900 p-8 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Artists
            </p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">
              Own your calendar.
            </h3>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              See requests, confirm gigs, set reminders, and message promoters
              without the chaos.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100"
            >
              Login as artist
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL STRIP */}
      <section className="border-t border-white/10 bg-slate-900 py-16 text-center">
        <FadeIn>
        <h2 className="text-2xl font-black sm:text-3xl">
          <BlurText
            text="Ready to lock your next lineup?"
            delay={60}
            animateBy="words"
            direction="top"
            className="justify-center"
          />
        </h2>
        </FadeIn>
        <Link
          to="/artists"
          className="mt-6 inline-flex rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
        >
          Start browsing
        </Link>
      </section>

      </div>
      <Footer />
    </div>
  );
}
