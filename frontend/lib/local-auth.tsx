"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

type AppRole = "doctor" | "patient" | "pending";

type AuthUser = {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  username?: string;
  mobile?: string;
  role: AppRole;
  account_id?: string;
  doctor_id?: string;
  patient_id?: string;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

type LoginRedirectOptions = {
  appState?: { returnTo?: string };
  authorizationParams?: { screen_hint?: "signup" | "login" };
};

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | undefined;
  user: AuthUser | undefined;
  loginWithRedirect: (options?: LoginRedirectOptions) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: (options?: { logoutParams?: { returnTo?: string } }) => void;
  loginWithPassword: (input: { role: AppRole; email: string; password: string }) => Promise<AuthSession>;
  registerWithPassword: (input: {
    role: AppRole;
    email: string;
    password: string;
    username: string;
    mobile: string;
  }) => Promise<AuthSession>;
};

const SESSION_KEY = "caresync_local_auth_session";
const INTENDED_ROLE_KEY = "caresync_intended_role";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AuthContext = createContext<AuthContextValue | null>(null);

function nextAuthRoute(options?: LoginRedirectOptions) {
  const isSignup = options?.authorizationParams?.screen_hint === "signup";
  return isSignup ? "/signUp" : "/signIn";
}

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  const persistSession = useCallback((next: AuthSession | null) => {
    setSession(next);
    if (next) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return;
    }
    window.localStorage.removeItem(SESSION_KEY);
  }, []);

  // Sync Supabase Auth with our Backend Session
  const syncSession = useCallback(async (supabaseUser: any, token: string, intendedRole?: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: intendedRole, // can be null/undefined
          auth_user_id: supabaseUser.id,
          token,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Build the correct AuthSession object
        const sessionPayload = {
          token,
          user: {
            sub: supabaseUser.id,
            email: supabaseUser.email || "",
            role: data.role || "pending",
            name: supabaseUser.user_metadata?.name || supabaseUser.email || "User",
            account_id: supabaseUser.id,
            doctor_id: data.doctor_id || undefined,
            patient_id: data.patient_id || undefined,
          }
        };
        
        persistSession(sessionPayload as AuthSession);
        
        if (data.is_new && window.location.pathname !== "/onboarding") {
          router.push("/onboarding");
        } else if (!data.is_new) {
          // If logged in on a public page or signIn, redirect appropriately
          const path = window.location.pathname;
          if (path === "/" || path === "/signIn" || path === "/signUp") {
             router.push(data.role === "patient" ? "/patient" : "/dashboard");
          }
        }
        
        return data;
      }
    } catch (err) {
      console.error("Auth sync failed", err);
    }
    return null;
  }, [persistSession, router]);

  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Try local storage first
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw) {
          setSession(JSON.parse(raw));
        }

        // 2. Check Supabase session (handles Google redirect)
        const { data: { session: sbSession } } = await supabase.auth.getSession();

        // Check for possible clock skew by decoding JWT issued-at (iat) claim.
        try {
          const token = sbSession?.access_token;
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              try {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                const iat = payload?.iat;
                if (typeof iat === 'number') {
                  const now = Math.floor(Date.now() / 1000);
                  if (iat > now + 60) {
                    console.warn('Supabase session appears to be issued in the future. Check your device clock for skew.');
                  }
                }
              } catch { /* ignore malformed token */ }
            }
          }
        } catch { /* no-op */ }

        if (sbSession?.user) {
          const intendedRole = window.localStorage.getItem(INTENDED_ROLE_KEY) || undefined;
          await syncSession(sbSession.user, sbSession.access_token, intendedRole);
        }
      } catch (err) {
        console.error("Auth initialization error", err);
        setSession(null);
      } finally {
        setIsLoading(false);
      }

      // Listen for changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
        if (event === 'SIGNED_IN' && sbSession) {
          const intendedRole = window.localStorage.getItem(INTENDED_ROLE_KEY) || undefined;
          await syncSession(sbSession.user, sbSession.access_token, intendedRole);
        } else if (event === 'SIGNED_OUT') {
          persistSession(null);
        }
      });

      return () => subscription.unsubscribe();
    };

    initialize();
  }, [syncSession, persistSession]);

  const loginWithPassword = useCallback(async (input: { role: AppRole; email: string; password: string }) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(detail || "Login failed");
    }

    const data = (await response.json()) as AuthSession;
    persistSession(data);
    return data;
  }, [persistSession]);

  const registerWithPassword = useCallback(async (input: {
    role: AppRole;
    email: string;
    password: string;
    username: string;
    mobile: string;
  }) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(detail || "Registration failed");
    }

    const data = (await response.json()) as AuthSession;
    persistSession(data);
    return data;
  }, [persistSession]);

  const loginWithGoogle = useCallback(async () => {
    // We don't know the role yet, we just authenticate.
    // The role will be discovered or asked during onboarding.
    window.localStorage.removeItem(INTENDED_ROLE_KEY);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    if (error) throw error;
  }, []);

  const loginWithRedirect = useCallback(async (options?: LoginRedirectOptions) => {
    router.push(nextAuthRoute(options));
  }, [router]);

  const logout = useCallback((options?: { logoutParams?: { returnTo?: string } }) => {
    supabase.auth.signOut();
    persistSession(null);
    router.push(options?.logoutParams?.returnTo || "/");
  }, [persistSession, router]);

  const value = useMemo<AuthContextValue>(() => ({
    isLoading,
    isAuthenticated: !!session?.token,
    token: session?.token,
    user: session?.user,
    loginWithRedirect,
    loginWithGoogle,
    logout,
    loginWithPassword,
    registerWithPassword,
  }), [isLoading, session, loginWithRedirect, loginWithGoogle, logout, loginWithPassword, registerWithPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useLocalAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useLocalAuth must be used within LocalAuthProvider");
  }
  return ctx;
}
