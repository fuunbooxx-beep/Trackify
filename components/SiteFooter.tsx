"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { showRouteLoader } from "@/components/RouteLoadingController";

export function SiteFooter() {
  const { lang, t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const logoSrc =
    mounted && resolvedTheme === "dark"
      ? "https://res.cloudinary.com/dv4qomvdt/image/upload/v1778000404/ChatGPT_Image_May_5_2026_07_58_44_PM_2_-Photoroom_grak0v.png"
      : "https://res.cloudinary.com/dv4qomvdt/image/upload/v1778000404/ChatGPT_Image_May_5_2026_07_58_44_PM_1_-Photoroom_p33maf.png";
  const navLinks = [
    { href: "/", label: t("navbar.home", "Home") },
    { href: "/report", label: t("navbar.report", "Rate & Share") },
    { href: "/category", label: t("navbar.category", "Categories") },
    { href: "/trending", label: t("navbar.trending", "Trending") },
    { href: "/about", label: t("navbar.about", "About") },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <footer className="mt-auto border-t border-border bg-secondary/20 py-10">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-2 md:items-start">
        <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
          <Link href="/" onClick={showRouteLoader} aria-label="Trackify home" className="inline-flex">
            <img
              src={logoSrc}
              alt="Trackify Logo"
              className="h-auto w-[150px] object-contain sm:w-[190px]"
            />
          </Link>
          <p className="font-medium text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            {lang === "ar" ? "مجتمع آمن للجميع." : "A safer community for everyone."}
          </p>
          <p className="text-sm font-bold text-foreground/70">
            Website Powered By : <span className="text-primary dark:text-neon-blue">Funbox Store</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 text-center md:items-end md:text-right">
          <h3 className="text-base font-extrabold text-foreground">
            {lang === "ar" ? "روابط سريعة" : "Quick Links"}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-end">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={showRouteLoader}
                className="text-sm font-semibold text-foreground/80 transition-colors hover:text-primary dark:hover:text-neon-blue"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
