"use client";

import { Navbar } from "@/components/Navbar";
import { TopAlerts, TopSafePage } from "@/components/TrendingWidgets";
import { useLanguage } from "@/lib/i18n/context";
import { AlertTriangle, ShieldCheck, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

export default function TrendingPage() {
  const { lang } = useLanguage();

  return (
    <>
      <Navbar />
      <main className="trending-page relative min-h-screen overflow-hidden px-4 pb-20 pt-24 sm:pb-28 sm:pt-32">
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.18),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(250,204,21,0.1),transparent_65%)]" />
          <div className="absolute -left-32 top-48 h-96 w-96 rounded-full bg-red-500/6 blur-3xl dark:bg-red-500/8" />
          <div className="absolute -right-32 top-80 h-96 w-96 rounded-full bg-emerald-500/6 blur-3xl dark:bg-emerald-500/8" />
          <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/4 blur-3xl dark:bg-primary/6" />
        </div>

        <div className="relative mx-auto max-w-5xl space-y-8 sm:space-y-12">
          {/* Page Header */}
          <motion.header
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-primary dark:border-primary/30 dark:bg-primary/15">
              <TrendingUp className="h-3.5 w-3.5" />
              {lang === "ar" ? "يتحدث تلقائيًا" : "Auto updated"}
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              {lang === "ar" ? "الترند" : "Trending"}
              <span className="text-primary"> {lang === "ar" ? "" : "Targets"}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-7 text-muted-foreground sm:text-base md:text-lg">
              {lang === "ar"
                ? "أهم 3 صفحات خطرة وأهم 3 صفحات موثوقة بتتحدث تلقائيًا حسب البلاغات والثقة."
                : "Top 3 risky and top 3 trusted targets, automatically ranked by reports and trust score."}
            </p>
          </motion.header>

          {/* Sections */}
          <motion.section
            className="grid max-w-4xl mx-auto grid-cols-1 gap-5 sm:gap-6"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15 } } }}
          >
            {/* High Risk Section */}
            <motion.div
              className="trend-section overflow-hidden rounded-3xl border border-red-500/25 bg-card/80 shadow-lg shadow-red-500/5 backdrop-blur-sm dark:border-red-500/20 dark:bg-card/60 dark:shadow-red-500/8"
              variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } }}
            >
              {/* Section header */}
              <div className="flex items-center gap-4 border-b border-red-500/15 bg-red-500/5 px-5 py-4 sm:px-6 sm:py-5 dark:bg-red-500/8">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-500/15 text-red-500 dark:bg-red-500/20">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-red-400/80">{lang === "ar" ? "تنبيه" : "Alert list"}</p>
                  <h2 className="text-2xl font-black text-red-500 dark:text-red-400 sm:text-3xl">{lang === "ar" ? "الأكثر خطورة" : "High Risk"}</h2>
                </div>
                <div className="ms-auto h-2 w-2 animate-pulse rounded-full bg-red-500" />
              </div>
              <div className="p-4 sm:p-5">
                <TopAlerts />
              </div>
            </motion.div>

            {/* Trusted Section */}
            <motion.div
              className="trend-section overflow-hidden rounded-3xl border border-emerald-500/25 bg-card/80 shadow-lg shadow-emerald-500/5 backdrop-blur-sm dark:border-emerald-500/20 dark:bg-card/60 dark:shadow-emerald-500/8"
              variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } }}
            >
              <div className="flex items-center gap-4 border-b border-emerald-500/15 bg-emerald-500/5 px-5 py-4 sm:px-6 sm:py-5 dark:bg-emerald-500/8">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-400/80">{lang === "ar" ? "موثوق" : "Trusted list"}</p>
                  <h2 className="text-2xl font-black text-emerald-500 dark:text-emerald-400 sm:text-3xl">{lang === "ar" ? "الأكثر ثقة" : "Trusted"}</h2>
                </div>
                <div className="ms-auto h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <div className="p-4 sm:p-5">
                <TopSafePage />
              </div>
            </motion.div>
          </motion.section>
        </div>
      </main>
    </>
  );
}
