/** Artist profile data (stored on the API): banking + completeness fields */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { PriceVisibility } from "../Types/Artist";

export type BankingDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  accountType: "cheque" | "savings" | "transmission" | "";
  referenceHint?: string;
};

export type ArtistProfileExtras = {
  bio?: string;
  demoMixUrl?: string;
  phone?: string;
  instagram?: string;
  hasPhoto?: boolean;
  /** Public URL of the uploaded profile photo */
  photoUrl?: string | null;
  priceVisibility?: PriceVisibility;
};

export type ArtistProfile = {
  artistId: string;
  extras: ArtistProfileExtras;
  banking: BankingDetails | null;
};

export function artistProfileQueryKey(userId: string | undefined) {
  return ["artist-profile", userId] as const;
}

export async function getMyArtistProfile(): Promise<ArtistProfile> {
  const { data } = await api.get<ArtistProfile>("/artist-profile/me");
  return data;
}

export async function saveProfileExtras(
  extras: ArtistProfileExtras
): Promise<ArtistProfile> {
  const { data } = await api.patch<ArtistProfile>("/artist-profile/me", extras);
  return data;
}

export async function saveBankingDetails(
  details: BankingDetails
): Promise<ArtistProfile> {
  const { data } = await api.put<ArtistProfile>("/artist-profile/me/banking", details);
  return data;
}

/**
 * Banking for a booked artist. The API only returns it to the artist or to a
 * promoter with a confirmed booking; anything else resolves to null.
 */
export async function getArtistBanking(
  artistId: string
): Promise<BankingDetails | null> {
  try {
    const { data } = await api.get<{ banking: BankingDetails | null }>(
      `/artist-profile/${encodeURIComponent(artistId)}/banking`
    );
    return data?.banking || null;
  } catch {
    return null;
  }
}

/** The signed-in artist's own profile (extras + banking). */
export function useMyArtistProfile(userId: string | undefined) {
  return useQuery({
    queryKey: artistProfileQueryKey(userId),
    queryFn: getMyArtistProfile,
    enabled: Boolean(userId),
  });
}

export function useSaveProfileExtras(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveProfileExtras,
    onSuccess: (profile) => qc.setQueryData(artistProfileQueryKey(userId), profile),
  });
}

export function useSaveBankingDetails(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveBankingDetails,
    onSuccess: (profile) => qc.setQueryData(artistProfileQueryKey(userId), profile),
  });
}

export async function uploadProfilePhoto(dataUrl: string): Promise<ArtistProfile> {
  const { data } = await api.put<ArtistProfile>("/artist-profile/me/photo", { dataUrl }, { timeout: 60000 });
  return data;
}

export async function removeProfilePhoto(): Promise<ArtistProfile> {
  const { data } = await api.delete<ArtistProfile>("/artist-profile/me/photo");
  return data;
}

/** Upload/remove the profile photo and refresh every view that shows it */
export function useProfilePhoto(userId: string | undefined) {
  const qc = useQueryClient();
  const onSuccess = (profile: ArtistProfile) => {
    qc.setQueryData(artistProfileQueryKey(userId), profile);
    qc.invalidateQueries({ queryKey: ["artist"] });
    qc.invalidateQueries({ queryKey: ["artists"] });
  };
  return {
    upload: useMutation({ mutationFn: uploadProfilePhoto, onSuccess }),
    remove: useMutation({ mutationFn: removeProfilePhoto, onSuccess }),
  };
}

export type ProfileCheck = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  hint: string;
};

/** Score profile completeness — complete profiles book and get paid faster */
export function getProfileStrength(
  profile: ArtistProfile | undefined,
  opts?: {
    artistId?: string;
    hasPhoto?: boolean;
    hasPublicBio?: boolean;
  }
): { percent: number; checks: ProfileCheck[]; nextHint: string } {
  const bank = profile?.banking;
  const extras = profile?.extras || {};
  const photo = opts?.hasPhoto || extras.hasPhoto;

  const bankComplete = Boolean(
    bank?.bankName &&
      bank?.accountName &&
      bank?.accountNumber &&
      bank?.branchCode
  );

  const checks: ProfileCheck[] = [
    {
      id: "photo",
      label: "Profile photo",
      done: Boolean(photo),
      weight: 20,
      hint: "Add a clear press photo so promoters recognise you",
    },
    {
      id: "bio",
      label: "Bio",
      done: Boolean(
        (extras.bio && extras.bio.trim().length > 20) || opts?.hasPublicBio
      ),
      weight: 15,
      hint: "Write a short bio (at least a few sentences)",
    },
    {
      id: "demo",
      label: "Demo mix / link",
      done: Boolean(extras.demoMixUrl?.trim()),
      weight: 25,
      hint: "Add a SoundCloud, Mixcloud or Drive link to a demo mix",
    },
    {
      id: "banking",
      label: "Banking details",
      done: bankComplete,
      weight: 25,
      hint: "Add banking so promoters can pay you after confirmed gigs",
    },
    {
      id: "contact",
      label: "Contact / social",
      done: Boolean(extras.phone?.trim() || extras.instagram?.trim()),
      weight: 15,
      hint: "Add a phone number or Instagram handle",
    },
  ];

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.done ? c.weight : 0), 0);
  const percent = Math.round((earned / totalWeight) * 100);
  const next = checks.find((c) => !c.done);

  return {
    percent,
    checks,
    nextHint: next
      ? `Your profile is ${percent}% complete — ${next.hint.toLowerCase()} to keep climbing.`
      : "Your profile is 100% complete — promoters can book and pay you smoothly.",
  };
}
