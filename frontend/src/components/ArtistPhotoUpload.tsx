import { useRef, useState, type ChangeEvent } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useMyArtistProfile, useProfilePhoto } from "../Services/artistProfileStore";

type Props = {
  /** Catalog image shown until the artist uploads their own */
  currentImageUrl?: string;
  onPhotoChange?: (photoUrl: string | null) => void;
};

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/** Profile photo control for the artist's dashboard — uploads to file storage */
export default function ArtistPhotoUpload({ currentImageUrl, onPhotoChange }: Props) {
  const { user } = useAuth();
  const { data: profile } = useMyArtistProfile(user?.id);
  const { upload, remove } = useProfilePhoto(user?.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const photoUrl = profile?.extras.photoUrl || null;
  const displaySrc = preview || photoUrl || currentImageUrl;
  const busy = upload.isPending || remove.isPending;

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (!TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setPreview(dataUrl);
      const next = await upload.mutateAsync(dataUrl);
      onPhotoChange?.(next.extras.photoUrl || null);
    } catch (err) {
      setError((axios.isAxiosError(err) && err.response?.data?.message) || "Upload failed. Please try again.");
    } finally {
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function clearPhoto() {
    setError("");
    try {
      await remove.mutateAsync();
      onPhotoChange?.(null);
    } catch {
      setError("Could not remove the photo. Please try again.");
    }
  }

  return (
    <div>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          {displaySrc ? (
            <img src={displaySrc} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No photo</div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {upload.isPending ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={handleFile}
            />
          </label>
          {photoUrl && (
            <button
              type="button"
              onClick={clearPhoto}
              disabled={busy}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <p className="mt-3 text-xs text-slate-400">
        JPG, PNG or WebP · max 5 MB. Shown on your public profile and in search.
      </p>
    </div>
  );
}
