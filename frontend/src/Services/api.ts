import axios from "axios";

/**
 * Backend mounts routes under /api (e.g. /api/bookings, /api/messages).
 * Accept VITE_API_URL with or without trailing /api.
 */
function resolveApiBase(): string {
  const raw =
    import.meta.env.VITE_API_URL ||
    "https://amused-prosperity-production-55d1.up.railway.app";
  const trimmed = String(raw).replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

export const api = axios.create({
  baseURL: resolveApiBase(),
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
