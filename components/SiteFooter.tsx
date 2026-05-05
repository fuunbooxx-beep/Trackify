"use client";

import { useLanguage } from "@/lib/i18n/context";

export function SiteFooter() {
  const { lang } = useLanguage();

  return (
    <footer className="border-t border-border mt-auto py-10 bg-secondary/20 relative">
      <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground font-medium flex flex-col items-center gap-4">
        <div className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-foreground to-foreground/60 mb-2">
          Trackify
        </div>
        <p>
          © {new Date().getFullYear()}{" "}
          {lang === "ar" ? "مجتمع جيمنج آمن للجميع." : "A safer gaming community for everyone."}
        </p>
        <p className="text-sm font-bold text-foreground/70">
          Website Powered By : <span className="text-primary dark:text-neon-blue">Funbox Store</span>
        </p>
      </div>
    </footer>
  );
}
