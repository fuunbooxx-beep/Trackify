"use client";

import { Moon, Sun, Menu, X, User as UserIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useContext, useEffect } from "react";
import { AuthContext } from "@/lib/providers";
import { isAdminUser } from "@/lib/auth-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n/context";
import { reloadWithRouteLoader, showRouteLoader } from "@/components/RouteLoadingController";
import Link from "next/link";
import { getAvatarUrl } from "@/lib/avatar";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

export function Navbar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, loading } = useContext(AuthContext);
  const { lang, toggleLang, t } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = isAdminUser(user);
  const logoSrc =
    mounted && resolvedTheme === "dark"
      ? "https://res.cloudinary.com/dv4qomvdt/image/upload/v1778000404/ChatGPT_Image_May_5_2026_07_58_44_PM_2_-Photoroom_grak0v.png"
      : "https://res.cloudinary.com/dv4qomvdt/image/upload/v1778000404/ChatGPT_Image_May_5_2026_07_58_44_PM_1_-Photoroom_p33maf.png";

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const routes = ["/", "/report", "/trending", "/about", user ? "/profile" : "/auth"];
    if (isAdmin) routes.push("/dashboard");
    routes.forEach((route) => router.prefetch(route));
  }, [router, isAdmin, user]);

  const handleLogout = async () => {
    showRouteLoader();
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* missing env etc. */
    } finally {
      reloadWithRouteLoader();
    }
  };

  const handleLanguageToggle = () => {
    showRouteLoader();
    const nextLang = lang === "en" ? "ar" : "en";
    window.localStorage.setItem("trackify_lang", nextLang);
    toggleLang();
    reloadWithRouteLoader();
  };

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    // Force reload so theme-specific assets/styles are fully refreshed.
    window.setTimeout(() => {
      reloadWithRouteLoader();
    }, 80);
  };

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/10 dark:border-white/5 transition-all duration-300 overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3 overflow-visible">
          <Link
            href="/"
            onClick={showRouteLoader}
            className="relative z-10 flex min-w-0 shrink items-center py-1 sm:shrink-0"
            aria-label="Trackify"
          >
            <img
              src={logoSrc}
              alt="Trackify Logo"
              className="h-auto w-[138px] object-contain min-[380px]:w-[152px] sm:w-[210px] md:w-[230px] lg:w-[255px]"
            />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <NavLink href="/" text={t("navbar.home", "Home")} />
            <NavLink href="/report" text={t("navbar.report", "Rate & Share")} />
            {isAdmin && <NavLink href="/dashboard" text={t("navbar.dashboard", "Dashboard")} />}
            <NavLink href="/trending" text={t("navbar.trending", "Trending")} />
            <NavLink href="/about" text={t("navbar.about", "About")} />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {mounted && (
              <button
                onClick={handleLanguageToggle}
                className="hidden px-3 py-1.5 rounded-full hover:bg-secondary/80 transition-colors text-sm font-bold sm:inline-flex"
                aria-label="Toggle language"
              >
                {lang === "en" ? "AR" : "EN"}
              </button>
            )}

            {mounted && (
              <button
                onClick={handleThemeToggle}
                className="relative hidden rounded-full p-2 transition-colors hover:bg-secondary/80 sm:inline-flex"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-700" />
                )}
              </button>
            )}

            {!loading && user ? (
              <div className="flex items-center gap-2">
                <Link href="/profile" onClick={showRouteLoader} className="hidden sm:flex items-center gap-2 hover:bg-secondary/80 py-1.5 px-3 rounded-full transition-colors">
                  <span className="text-sm font-medium">{user.displayName?.split(" ")[0]}</span>
                  <img src={getAvatarUrl(user.photoURL)} alt="Avatar" className="w-7 h-7 rounded-full border border-border object-cover" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="hidden text-sm font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-full transition-colors sm:inline-flex"
                >
                  {t("common.logout", "Log out")}
                </button>
              </div>
            ) : (
              <Link href="/auth" onClick={showRouteLoader} className="hidden items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-bold transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] dark:shadow-[0_0_15px_rgba(0,243,255,0.3)] dark:bg-neon-blue dark:text-black sm:flex">
                <UserIcon className="w-4 h-4" />
                <span>{t("navbar.signIn", "Sign in")}</span>
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background/80 text-foreground shadow-sm md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-0 right-0 top-full md:hidden glass-panel border-b border-border"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-6 pt-3">
            <MobileNavLink href="/" text={t("navbar.home", "Home")} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/report" text={t("navbar.report", "Rate & Share")} onClick={() => setMobileMenuOpen(false)} />
            {isAdmin && <MobileNavLink href="/dashboard" text={t("navbar.dashboard", "Dashboard")} onClick={() => setMobileMenuOpen(false)} />}
            <MobileNavLink href="/trending" text={t("navbar.trending", "Trending")} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/about" text={t("navbar.about", "About")} onClick={() => setMobileMenuOpen(false)} />
            {user ? (
              <>
                <MobileNavLink href="/profile" text={t("common.myAccount", "My account")} onClick={() => setMobileMenuOpen(false)} />
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleLogout();
                  }}
                  className="rounded-xl px-4 py-3 text-start text-base font-bold text-destructive hover:bg-destructive/10"
                >
                  {t("common.logout", "Log out")}
                </button>
              </>
            ) : (
              <MobileNavLink href="/auth" text={t("navbar.signIn", "Sign in")} onClick={() => setMobileMenuOpen(false)} />
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLanguageToggle();
                }}
                className="rounded-xl border border-border px-4 py-3 text-sm font-black"
              >
                {lang === "en" ? "AR" : "EN"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleThemeToggle();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-black"
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4" />}
                {resolvedTheme === "dark" ? "Light" : "Dark"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

function NavLink({ href, text }: { href: string; text: string }) {
  return (
    <Link href={href} onClick={showRouteLoader} className="text-sm font-semibold text-foreground/80 hover:text-primary dark:hover:text-neon-blue transition-colors relative group">
      {text}
      <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-primary dark:bg-neon-blue transition-all group-hover:w-full"></span>
    </Link>
  );
}

function MobileNavLink({ href, text, onClick }: { href: string; text: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={() => { showRouteLoader(); onClick(); }} className="block rounded-xl px-4 py-3 text-base font-bold hover:bg-secondary">
      {text}
    </Link>
  );
}
