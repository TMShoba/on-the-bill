import { useMemo, useState } from "react";
import ArtistCard from "../components/ArtistCard";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import { useArtists } from "../hooks/useArtists";
import BlurText from "../components/animations/BlurText";

export default function Artists() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [location, setLocation] = useState("");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Text search hits the API; genre / location / rate filtered client-side so
  // dropdown options stay complete.
  const apiParams = useMemo(() => {
    if (!q.trim()) return undefined;
    return { q: q.trim() };
  }, [q]);

  const { data: artists, isLoading, isError, error } = useArtists(apiParams);

  const filtered = useMemo(() => {
    if (!artists) return [];
    let list = artists;
    if (genre.trim()) {
      list = list.filter(
        (a) => a.genre.toLowerCase() === genre.trim().toLowerCase()
      );
    }
    if (location.trim()) {
      list = list.filter((a) =>
        a.location.toLowerCase().includes(location.trim().toLowerCase())
      );
    }
    const min = minRate ? Number(minRate) : null;
    const max = maxRate ? Number(maxRate) : null;
    if (min !== null && !Number.isNaN(min)) {
      list = list.filter((a) => a.rate >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      list = list.filter((a) => a.rate <= max);
    }
    return list;
  }, [artists, genre, location, minRate, maxRate]);

  const genreOptions = useMemo(() => {
    if (!artists) return [];
    return Array.from(new Set(artists.map((a) => a.genre))).sort();
  }, [artists]);

  const locationOptions = useMemo(() => {
    if (!artists) return [];
    return Array.from(new Set(artists.map((a) => a.location))).sort();
  }, [artists]);

  function clearFilters() {
    setGenre("");
    setLocation("");
    setMinRate("");
    setMaxRate("");
  }

  const activeFilterCount = [
    Boolean(genre.trim()),
    Boolean(location.trim()),
    Boolean(minRate),
    Boolean(maxRate),
  ].filter(Boolean).length;

  const hasActiveFilters = Boolean(q.trim()) || activeFilterCount > 0;

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 pb-mobile-nav">
      <NavBar />

      <div className="flex-1 w-full mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-14 animate-fade-up">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            <BlurText
              text="Browse Artists"
              delay={90}
              animateBy="words"
              direction="top"
              className="justify-start"
            />
          </h1>
          <p className="mt-2 text-slate-600">
            Verified DJs and producers ready for your next event
          </p>
        </div>

        <div className="mb-6 sticky top-14 z-30 -mx-3 rounded-none border-y border-slate-200/80 bg-white/95 p-3 shadow-sm backdrop-blur-lg sm:static sm:mx-0 sm:rounded-2xl sm:border sm:p-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, genre, or city…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-emerald-500/30 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition sm:px-4 ${
                filtersOpen || activeFilterCount > 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 9h12M9 14h6M11 19h2" />
              </svg>
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {filtersOpen && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Genre
                  </label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">All genres</option>
                    {genreOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">All locations</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Min rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={minRate}
                    onChange={(e) => setMinRate(e.target.value)}
                    placeholder="R0"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Max rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={maxRate}
                    onChange={(e) => setMaxRate(e.target.value)}
                    placeholder="Any"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {isLoading
                ? "Loading…"
                : `${filtered.length} artist${filtered.length === 1 ? "" : "s"}`}
              {hasActiveFilters ? " matching filters" : ""}
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl bg-slate-200"
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-medium text-red-800">Could not load artists</p>
            <p className="mt-1 text-sm text-red-600">
              {(error as Error)?.message ||
                "Make sure the API is running on http://localhost:4000"}
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No artists match your filters. Try clearing search or widening rate
            range.
          </p>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
