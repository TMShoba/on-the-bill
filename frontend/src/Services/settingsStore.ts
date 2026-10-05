import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type UserSettings = {
  emailNotifications: boolean;
  reminderDefaultOptIn: boolean;
};

const DEFAULTS: UserSettings = {
  emailNotifications: true,
  reminderDefaultOptIn: true,
};

const KEY_PREFIX = "otb_settings_";

export function getSettings(userId: string): UserSettings {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(userId: string, patch: Partial<UserSettings>): UserSettings {
  const next = { ...getSettings(userId), ...patch };
  localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(next));
  return next;
}

/** Wipes this browser's demo data (bookings, messages, favorites, notifications,
 * profile extras) but keeps the logged-in session. Useful before a demo/launch. */
export function clearLocalDemoData() {
  const keepKeys = new Set(["token", "user"]);
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !keepKeys.has(key)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/** Email notifications live on the server (the API sends the emails) */
export function useEmailNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  const key = ["settings", userId];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<{ emailNotifications: boolean }>("/settings")).data,
    enabled: Boolean(userId),
  });
  const mutation = useMutation({
    mutationFn: async (emailNotifications: boolean) =>
      (await api.patch<{ emailNotifications: boolean }>("/settings", { emailNotifications })).data,
    onMutate: async (value) => {
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, { emailNotifications: value });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSuccess: (data) => qc.setQueryData(key, data),
  });
  return {
    enabled: query.data?.emailNotifications ?? true,
    loading: query.isLoading,
    setEnabled: (value: boolean) => mutation.mutate(value),
  };
}
