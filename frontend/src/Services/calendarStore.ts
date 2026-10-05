import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type BlockedDate = { date: string; note: string };
export type FeedUrls = { url: string; webcalUrl: string };

export function blocksQueryKey(userId: string | undefined) {
  return ["calendar-blocks", userId] as const;
}

export async function getBlockedDates(): Promise<BlockedDate[]> {
  const { data } = await api.get<BlockedDate[]>("/calendar/blocks");
  return Array.isArray(data) ? data : [];
}

export function useBlockedDates(userId: string | undefined) {
  return useQuery({ queryKey: blocksQueryKey(userId), queryFn: getBlockedDates, enabled: Boolean(userId) });
}

/** Block or unblock a date; the list in the cache is replaced with the server's */
export function useToggleBlockedDate(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; block: boolean; note?: string }) => {
      const { data } = input.block
        ? await api.post<BlockedDate[]>("/calendar/blocks", { date: input.date, note: input.note })
        : await api.delete<BlockedDate[]>(`/calendar/blocks/${input.date}`);
      return data;
    },
    onSuccess: (list) => {
      qc.setQueryData(blocksQueryKey(userId), list);
      qc.invalidateQueries({ queryKey: ["artist-calendar"] });
    },
  });
}

export function useCalendarFeed(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["calendar-feed", userId],
    queryFn: async () => (await api.get<FeedUrls>("/calendar/feed-url")).data,
    enabled: Boolean(userId) && enabled,
    staleTime: Infinity,
  });
}

export function useRotateCalendarFeed(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<FeedUrls>("/calendar/feed-url/rotate")).data,
    onSuccess: (urls) => qc.setQueryData(["calendar-feed", userId], urls),
  });
}

/** Subscribe links for the common calendar apps */
export function calendarAppLinks(feed: FeedUrls) {
  return {
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.webcalUrl)}`,
    apple: feed.webcalUrl,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed.url)}&name=${encodeURIComponent("The LineUp gigs")}`,
  };
}
