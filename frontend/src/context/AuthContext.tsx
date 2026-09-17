import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, UserRole } from "../Types/Artist";
import {
  DEMO_ARTIST,
  DEMO_PROMOTER,
  ensureDemoGigs,
} from "../Services/demoStore";
import {
  saveAuth,
  clearAuth,
  getStoredUser,
  updateStoredUser,
} from "../Services/authService";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  loginDemo: (role: "artist" | "promoter") => void;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_PASSWORD = "Demo1234!";

function mapApiUser(resUser: {
  id: string;
  name: string;
  email: string;
  role: string;
  artistId?: string;
  createdAt?: string;
}): User {
  const role: UserRole =
    resUser.role === "artist"
      ? "artist"
      : resUser.role === "client"
        ? "promoter"
        : (resUser.role as UserRole);
  return {
    id: resUser.id,
    name: resUser.name,
    email: resUser.email,
    role,
    artistId: resUser.artistId,
    createdAt: resUser.createdAt || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = getStoredUser();
    if (stored) {
      ensureDemoGigs();
      return stored as User;
    }
    return null;
  });

  const loginDemo = useCallback(async (role: "artist" | "promoter") => {
    const demo = role === "artist" ? DEMO_ARTIST : DEMO_PROMOTER;
    ensureDemoGigs();

    // Prefer real API login so bookings come from SQLite and IDs match
    try {
      const { login } = await import("../Services/authService");
      const res = await login({
        email: demo.email,
        password: DEMO_PASSWORD,
      });
      const mapped = mapApiUser(res.user);
      // Ensure artist always has catalog link
      if (role === "artist" && !mapped.artistId) {
        mapped.artistId = DEMO_ARTIST.artistId;
      }
      saveAuth(res.token, mapped);
      setUser(mapped);
      return;
    } catch {
      // API offline — local demo token (backend ALLOW_DEMO_TOKENS=true)
      saveAuth(`demo-token-${demo.id}`, demo);
      setUser(demo);
    }
  }, []);

  const loginWithCredentials = useCallback(
    async (email: string, password: string) => {
      const normalized = email.toLowerCase().trim();

      // Demo emails → same path as quick login (API first)
      if (normalized === DEMO_ARTIST.email.toLowerCase()) {
        await loginDemo("artist");
        return;
      }
      if (normalized === DEMO_PROMOTER.email.toLowerCase()) {
        await loginDemo("promoter");
        return;
      }

      const { login } = await import("../Services/authService");
      const res = await login({ email, password });
      const mapped = mapApiUser(res.user);
      saveAuth(res.token, mapped);
      setUser(mapped);
    },
    [loginDemo]
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    }) => {
      const { register: apiRegister } = await import("../Services/authService");
      const role =
        input.role === "promoter"
          ? "client"
          : input.role === "artist"
            ? "artist"
            : "client";
      const res = await apiRegister({
        name: input.name,
        email: input.email,
        password: input.password,
        role: role as "client" | "artist",
      });
      const mapped = mapApiUser({ ...res.user, role: input.role });
      saveAuth(res.token, mapped);
      setUser(mapped);
    },
    []
  );

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      updateStoredUser(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loginDemo: (role: "artist" | "promoter") => {
        void loginDemo(role);
      },
      loginWithCredentials,
      register,
      updateUser,
      logout,
    }),
    [user, loginDemo, loginWithCredentials, register, updateUser, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
