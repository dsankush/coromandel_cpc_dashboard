import { AuthUser } from "@/types/auth";

const AUTH_STORAGE_KEY = "coro_cpc_auth_session";

/**
 * Validates login credentials:
 * 1. Admin login:
 *    username -> coro-cpc
 *    password -> coro-cpc
 * 2. Client login:
 *    username -> namsute-cpc (or namaste-cpc)
 *    password -> n@muste-cpc
 */
export function authenticateUser(username: string, password: string): AuthUser | null {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  // Admin login credentials
  if (cleanUser === "coro-cpc" && cleanPass === "coro-cpc") {
    return {
      username: "coro-cpc",
      role: "admin",
      name: "Coromandel Admin",
      loginTime: new Date().toISOString(),
    };
  }

  // Client login credentials
  if (
    (cleanUser === "namsute-cpc" || cleanUser === "namaste-cpc") &&
    cleanPass === "n@muste-cpc"
  ) {
    return {
      username: "namsute-cpc",
      role: "client",
      name: "Client Access",
      loginTime: new Date().toISOString(),
    };
  }

  return null;
}

export function getStoredAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function setStoredAuth(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to store auth:", err);
  }
}
