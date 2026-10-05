import { useQuery } from "@tanstack/react-query";
import { getArtists, getArtistById } from "../Services/artistService";
import { useAuth } from "../context/AuthContext";

export function useArtists(params?: {
  q?: string;
  genre?: string;
  location?: string;
}) {
  // The API shows different price detail to promoters vs the public
  const { user } = useAuth();
  return useQuery({
    queryKey: ["artists", params, user?.id ?? null],
    queryFn: () => getArtists(params),
  });
}

export function useArtist(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["artist", id, user?.id ?? null],
    queryFn: () => getArtistById(id!),
    enabled: Boolean(id),
  });
}
