import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Studio, User } from "./types";

interface AuthState {
  user: User | null;
  studio: Studio | null;
  loading: boolean;
  setSession: (user: User, studio: Studio) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: User; studio: Studio }>("/api/auth/me")
      .then(({ user, studio }) => {
        setUser(user);
        setStudio(studio);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setSession = (u: User, s: Studio) => {
    setUser(u);
    setStudio(s);
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    setUser(null);
    setStudio(null);
  };

  return <AuthContext.Provider value={{ user, studio, loading, setSession, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
