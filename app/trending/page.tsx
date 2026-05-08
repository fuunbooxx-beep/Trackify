"use client";

import { Navbar } from "@/components/Navbar";
import { TopAlerts, TopSafePage } from "@/components/TrendingWidgets";
import { useLanguage } from "@/lib/i18n/context";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export default function TrendingPage() {
  const { lang } = useLanguage();

  return (
    <>
      <Navbar />
      <main className="trending-page relative min-h-screen overflow-hidden px-4 pb-16 pt-24 sm:pb-20 sm:pt-28">
        <div className="absolute inset-x-0 top-16 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.14),transparent_62%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(0,243,255,0.12),transparent_62%)]" />
        <div className="absolute left-0 top-44 h-72 w-72 rounded-full bg-red-500/5 blur-3xl" />
        <div className="absolute right-0 top-72 h-72 w-72 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-5xl space-y-6 sm:space-y-8">
          <header className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-black tracking-normal sm:text-5xl md:text-6xl">
              {lang === "ar" ? "الترند" : "Trending targets"}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600 dark:text-muted-foreground sm:text-base md:text-lg">
              {lang === "ar"
                ? "أهم 3 صفحات خطرة وأهم 3 صفحات موثوقة بتتحدث تلقائيًا حسب البلاغات والثقة."
                : "Top 3 risky targets and top 3 trusted targets, automatically ranked by reports and trust score."}
            </p>
          </header>

          <section className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:gap-4">
            <div className="trend-section rounded-2xl border border-red-500/20 bg-card/85 p-3 shadow-sm backdrop-blur sm:rounded-3xl sm:p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-red-400">{lang === "ar" ? "تنبيه" : "Alert list"}</p>
                  <h2 className="text-2xl font-black text-red-400 sm:text-3xl">{lang === "ar" ? "الأكثر خطورة" : "High risk"}</h2>
                </div>
              </div>
              <TopAlerts />
            </div>

            <div className="trend-section rounded-2xl border border-emerald-500/20 bg-card/85 p-3 shadow-sm backdrop-blur sm:rounded-3xl sm:p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-300">{lang === "ar" ? "موثوق" : "Trusted list"}</p>
                  <h2 className="text-2xl font-black text-emerald-400 sm:text-3xl">{lang === "ar" ? "الأكثر ثقة" : "Trusted"}</h2>
                </div>
              </div>
              <TopSafePage />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
