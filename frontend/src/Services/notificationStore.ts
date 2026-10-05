/**
 * In-app notifications. The API creates them on booking requests, accept/decline,
 * payments and new messages; the client only lists them and marks them read.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type NotificationType =
  | "booking_accepted"
  | "booking_declined"
  | "booking_request"
  | "message"
  | "booking_paid"
  | "system";

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional link path e.g. /dashboard */
  href?: string;
  createdAt: string;
  read: boolean;
};

const POLL_MS = 20_000;

export function notificationsQueryKey(userId: string | undefined) {
  return ["notifications", userId] as const;
}

export function notificationsUnreadQueryKey(userId: string | undefined) {
  return ["notifications", userId, "unread"] as const;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>("/notifications");
  return Array.isArray(data) ? data : [];
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>("/notifications/unread-count");
  return Number(data?.count || 0);
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}

export function useNotifications(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: getNotifications,
    enabled: Boolean(userId) && enabled,
    refetchInterval: POLL_MS,
  });
}

export function useNotificationUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: notificationsUnreadQueryKey(userId),
    queryFn: getUnreadCount,
    enabled: Boolean(userId),
    refetchInterval: POLL_MS,
  });
}

/** Mark one (id) or all (no id) notifications read, then refresh list + badge. */
export function useMarkNotificationsRead(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) =>
      id ? markNotificationRead(id) : markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}

