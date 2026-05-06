"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/lib/i18n/context";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { lang } = useLanguage();

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-28 min-h-screen">
        <section className="glass-panel rounded-3xl p-10 text-center border border-border/70">
          <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
          <h1 className="text-3xl font-black mb-2">{lang === "ar" ? "الصفحة غير موجودة" : "Page not found"}</h1>
          <p className="text-muted-foreground font-medium">
            {lang === "ar"
              ? "للأسف، هذه الصفحة غير متاحة لك."
              : "Sorry, this page is not available for your account."}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-black text-primary-foreground hover:bg-primary/90 dark:bg-neon-blue dark:text-black"
            >
              {lang === "ar" ? "العودة للرئيسية" : "Back to home"}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

