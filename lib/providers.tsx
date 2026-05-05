"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, useState } from "react";
import React, { Suspense } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { syncSupabaseProfile } from "@/lib/supabase/sync-profile";
import { mapSupabaseUser, type AppUser } from "@/lib/auth-user";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { LanguageProvider } from "@/lib/i18n/context";
import { RouteLoadingController } from "@/components/RouteLoadingController";

export const AuthContext = React.createContext<{ user: AppUser | null; loading: boolean }>({
  user: null,
  loading: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const loadingFallback = window.setTimeout(() => {
      if (alive) setLoading(false);
    }, 3500);

    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      window.clearTimeout(loadingFallback);
      setLoading(false);
      return;
    }

    const applySession = async (sessionUser: User | null) => {
      const mapped = mapSupabaseUser(sessionUser);
      setUser(mapped);
      if (sessionUser && supabase) {
        void syncSupabaseProfile(supabase, sessionUser).catch((error: unknown) => {
          console.warn("[Supabase profiles]", error);
        });
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (!alive) return;
        void applySession(session?.user ?? null).finally(() => {
          if (alive) {
            window.clearTimeout(loadingFallback);
            setLoading(false);
          }
        });
      })
      .catch((error: unknown) => {
        console.warn("[Supabase session]", error);
        if (alive) {
          window.clearTimeout(loadingFallback);
          setUser(null);
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void applySession(session?.user ?? null);
      window.clearTimeout(loadingFallback);
      setLoading(false);
    });

    return () => {
      alive = false;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="trackify_theme">
      <LanguageProvider>
        <Suspense fallback={null}>
          <RouteLoadingController />
        </Suspense>
        <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
      </LanguageProvider>
    </NextThemesProvider>
  );
}
