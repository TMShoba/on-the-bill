import { useMemo, useState, type FormEvent } from "react";
import {
  getProfileStrength,
  useMyArtistProfile,
  useSaveProfileExtras,
  type ArtistProfileExtras,
} from "../Services/artistProfileStore";
import { useAuth } from "../context/AuthContext";

type Props = {
  /** Used to find the locally stored profile photo */
  artistId: string;
  hasPublicBio?: boolean;
  /** Bump when photo/banking changes so the meter recalculates */
  refreshKey?: number;
};

export default function ProfileStrengthMeter({
  artistId,
  hasPublicBio,
  refreshKey = 0,
}: Props) {
  const { user } = useAuth();
  const { data: profile } = useMyArtistProfile(user?.id);
  const save = useSaveProfileExtras(user?.id);
  const [extras, setExtras] = useState<ArtistProfileExtras>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(
    () => getProfileStrength(profile, { artistId, hasPublicBio }),
    // refreshKey: the photo lives in localStorage, so recompute when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, artistId, hasPublicBio, refreshKey]
  );

  function startEditing() {
    setExtras(profile?.extras || {});
    setError("");
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await save.mutateAsync({
        bio: extras.bio || "",
        demoMixUrl: extras.demoMixUrl || "",
        phone: extras.phone || "",
        instagram: extras.instagram || "",
      });
      setEditing(false);
    } catch {
      setError("Could not save your profile. Please try again.");
    }
  }

  const color =
    strength.percent >= 100
      ? "bg-emerald-500"
      : strength.percent >= 70
        ? "bg-emerald-400"
        : strength.percent >= 40
          ? "bg-amber-400"
          : "bg-rose-400";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Profile strength</h2>
          <p className="mt-1 text-sm text-slate-500">
            Complete profiles book more — promoters trust what they can see and
            pay.
          </p>
        </div>
        <p className="text-2xl font-black text-slate-900">
          {strength.percent}
          <span className="text-base font-semibold text-slate-400">%</span>
        </p>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${strength.percent}%` }}
        />
      </div>

      <p className="mt-3 text-sm font-medium text-slate-700">
        {strength.nextHint}
      </p>

      <ul className="mt-4 space-y-2">
        {strength.checks.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 text-sm text-slate-600"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                c.done
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {c.done ? "✓" : "·"}
            </span>
            <span className={c.done ? "text-slate-500 line-through" : ""}>
              {c.label}
            </span>
          </li>
        ))}
      </ul>

      {!editing ? (
        <button
          type="button"
          onClick={startEditing}
          className="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Update bio, demo & contact →
        </button>
      ) : (
        <form onSubmit={handleSave} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Bio
            </label>
            <textarea
              rows={3}
              value={extras.bio || ""}
              onChange={(e) =>
                setExtras((x) => ({ ...x, bio: e.target.value }))
              }
              placeholder="Who you are on stage, signature sound, cities you play…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Demo mix URL
            </label>
            <input
              type="url"
              value={extras.demoMixUrl || ""}
              onChange={(e) =>
                setExtras((x) => ({ ...x, demoMixUrl: e.target.value }))
              }
              placeholder="https://soundcloud.com/…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Phone
              </label>
              <input
                value={extras.phone || ""}
                onChange={(e) =>
                  setExtras((x) => ({ ...x, phone: e.target.value }))
                }
                placeholder="+27…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Instagram
              </label>
              <input
                value={extras.instagram || ""}
                onChange={(e) =>
                  setExtras((x) => ({ ...x, instagram: e.target.value }))
                }
                placeholder="@yourhandle"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save profile"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
