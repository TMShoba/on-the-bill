import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useState } from "react";
import { resolveArtistImage } from "../utils/imageCdn";
import VerificationBadge from "./VerificationBadge";
import { getVerification } from "../Services/verificationStore";
import { useAuth } from "../context/AuthContext";
import { isFavorite, toggleFavorite } from "../Services/favoritesStore";

type Artist = {
  id: string;
  stageName: string;
  genre: string;
  location: string;
  rate: number;
  imageUrl: string;
};

interface ArtistCardProps {
  artist: Artist;
}

export default function ArtistCard({ artist }: ArtistCardProps) {
  const { user, isAuthenticated } = useAuth();
  const src = resolveArtistImage(artist.imageUrl, artist.id, "card");
  const canSave =
    isAuthenticated &&
    (user?.role === "promoter" || user?.role === "client");
  const [saved, setSaved] = useState(() =>
    user ? isFavorite(user.id, artist.id) : false
  );

  function onToggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !canSave) return;
    const nowSaved = toggleFavorite(user.id, artist);
    setSaved(nowSaved);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
    <Link
      to={`/artists/${artist.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
        <img
          src={src}
          alt={artist.stageName}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
          {artist.genre}
        </span>
        {canSave && (
          <button
            type="button"
            onClick={onToggleSave}
            title={saved ? "Remove from saved" : "Save for later"}
            className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur transition ${
              saved
                ? "bg-rose-500 text-white"
                : "bg-white/90 text-slate-600 hover:bg-white hover:text-rose-500"
            }`}
          >
            {saved ? "♥" : "♡"}
          </button>
        )}
      </div>

      <div className="p-5 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-slate-700">
            {artist.stageName}
          </h3>
          <VerificationBadge
            status={getVerification(artist.id).status}
            hideIfUnverified
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">{artist.location}</p>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-base font-bold text-emerald-600">
            R{artist.rate.toLocaleString()}
            <span className="text-sm font-medium text-slate-400">+</span>
          </p>
          <span className="text-sm font-medium text-slate-400 transition group-hover:text-slate-900">
            View →
          </span>
        </div>
      </div>
    </Link>
    </motion.div>
  );
}
