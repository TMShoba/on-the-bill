import { api } from "./api";
import type { Artist } from "../Types/Artist";

export async function getArtists(params?: {
  q?: string;
  genre?: string;
  location?: string;
}) {
  const { data } = await api.get<Artist[]>("/artists", {
    params,
  });

  return data;
}

export async function getArtistById(id: string) {
  const { data } = await api.get<Artist>(`/artists/${id}`);

  return data;
}
