import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type SavedArtist = {
  id: string;
  stageName: string;
  genre: string;
  location: string;
  rate: number | null;
  imageUrl: string;
  savedAt: string;
};

export function favoritesQueryKey(userId: string | undefined) {
  return ["favorites", userId] as const;
}

export async function getFavorites(): Promise<SavedArtist[]> {
  const { data } = await api.get<SavedArtist[]>("/favorites");
  return Array.isArray(data) ? data : [];
}

export async function addFavorite(artistId: string): Promise<void> {
  await api.put(`/favorites/${encodeURIComponent(artistId)}`);
}

export async function removeFavorite(artistId: string): Promise<void> {
  await api.delete(`/favorites/${encodeURIComponent(artistId)}`);
}

/** Saved artists for the signed-in user (one shared query for every card on the page). */
export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: favoritesQueryKey(userId),
    queryFn: getFavorites,
    enabled: Boolean(userId),
  });
}

/**
 * Save / unsave an artist. Updates the cached list optimistically and
 * rolls back if the API call fails.
 */
export function useToggleFavorite(userId: string | undefined) {
  const qc = useQueryClient();
  const key = favoritesQueryKey(userId);

  return useMutation({
    mutationFn: async (input: { artist: Omit<SavedArtist, "savedAt">; save: boolean }) => {
      if (input.save) await addFavorite(input.artist.id);
      else await removeFavorite(input.artist.id);
    },
    onMutate: async ({ artist, save }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SavedArtist[]>(key);
      qc.setQueryData<SavedArtist[]>(key, (list = []) => {
        const without = list.filter((a) => a.id !== artist.id);
        return save
          ? [{ ...artist, savedAt: new Date().toISOString() }, ...without]
          : without;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
