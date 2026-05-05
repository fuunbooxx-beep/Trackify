"use client";

import { Navbar } from "@/components/Navbar";
import { TopAlerts, TopSafePage } from "@/components/TrendingWidgets";
import { useLanguage } from "@/lib/i18n/context";
import { AlertTriangle, ChevronDown, ShieldCheck, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";

type TrendTone = "danger" | "safe";

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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3.5 py-2 text-xs font-black text-primary dark:border-neon-blue/20 dark:bg-neon-blue/10 dark:text-neon-blue sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>{lang === "ar" ? "لوحة متابعة الترند" : "Live trend board"}</span>
            </div>
            <h1 className="text-4xl font-black tracking-normal sm:text-5xl md:text-6xl">
              {lang === "ar" ? "الترند" : "Trending targets"}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600 dark:text-muted-foreground sm:text-base md:text-lg">
              {lang === "ar"
                ? "افتح القسم اللي يهمك وشوف الصفحات بنظام صفحات صغيرة بدل عرض كل النتائج مرة واحدة."
                : "Open the section you need and browse results in small pages instead of one long list."}
            </p>
          </header>

          <section className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:gap-4">
            <TrendSection
              tone="danger"
              eyebrow={lang === "ar" ? "تنبيه" : "Alert list"}
              title={lang === "ar" ? "الأكثر خطورة" : "High risk"}
              badge={lang === "ar" ? "راجع قبل الدفع" : "Check first"}
              summary={lang === "ar" ? "الصفحات اللي عليها أعلى عدد بلاغات." : "Targets with the highest report counts."}
            >
              <TopAlerts />
            </TrendSection>

            <TrendSection
              tone="safe"
              eyebrow={lang === "ar" ? "موثوق" : "Trusted list"}
              title={lang === "ar" ? "الأكثر ثقة" : "Trusted"}
              badge={lang === "ar" ? "اختيارات آمنة" : "Safer picks"}
              summary={lang === "ar" ? "الصفحات ذات أعلى نسبة ثقة." : "Targets with the strongest trust scores."}
            >
              <TopSafePage />
            </TrendSection>
          </section>
        </div>
      </main>
    </>
  );
}

function TrendSection({
  tone,
  defaultOpen = false,
  eyebrow,
  title,
  badge,
  summary,
  children,
}: {
  tone: TrendTone;
  defaultOpen?: boolean;
  eyebrow: string;
  title: string;
  badge: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isDanger = tone === "danger";
  const panelClass = isDanger
    ? "border-red-200/80 bg-white/85 shadow-red-950/5 dark:border-red-500/15 dark:bg-card/85"
    : "border-emerald-200/80 bg-white/85 shadow-emerald-950/5 dark:border-emerald-500/15 dark:bg-card/85";
  const titleClass = isDanger ? "text-destructive" : "text-emerald-600 dark:text-emerald-400";
  const badgeClass = isDanger
    ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  const Icon = isDanger ? AlertTriangle : ShieldCheck;

  return (
    <div className={`trend-section rounded-2xl border p-3 shadow-sm backdrop-blur sm:rounded-3xl sm:p-4 ${panelClass}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-start"
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl ${badgeClass}`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-black uppercase tracking-wide ${isDanger ? "text-red-500/80 dark:text-red-300" : "text-emerald-600/80 dark:text-emerald-300"}`}>
              {eyebrow}
            </p>
            <h2 className={`mt-0.5 text-2xl font-black leading-none sm:text-3xl ${titleClass}`}>{title}</h2>
            <p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-slate-600 dark:text-slate-200 sm:text-sm">{summary}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className={`hidden rounded-full px-3 py-1 text-xs font-black sm:inline-flex ${badgeClass}`}>
            {badge}
          </span>
          <span className={`trend-inner grid h-9 w-9 place-items-center rounded-full border bg-white transition dark:bg-background dark:text-slate-200 sm:h-10 sm:w-10 ${open ? "rotate-180" : ""}`}>
            <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
        </div>
      </button>

      {open && <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-border">{children}</div>}
    </div>
  );
}
