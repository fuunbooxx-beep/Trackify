"use client";

import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/lib/i18n/context";
import { AlertTriangle, Database, FileCheck2, Search, ShieldCheck, Sparkles, Users } from "lucide-react";

export default function AboutPage() {
  const { lang } = useLanguage();

  const valueCards = [
    {
      icon: <Search className="h-6 w-6" />,
      title: lang === "ar" ? "تحقق قبل الدفع" : "Check before paying",
      text:
        lang === "ar"
          ? "ابحث برقم الهاتف، رابط الصفحة، أو الاسم قبل ما تحول فلوس أو تشتري حساب."
          : "Search by phone, page link, or name before sending money or buying an account.",
    },
    {
      icon: <FileCheck2 className="h-6 w-6" />,
      title: lang === "ar" ? "بلاغات موثقة" : "Evidence-based reports",
      text:
        lang === "ar"
          ? "كل بلاغ يقدر يتدعم بصور وإثباتات عشان التحذير يبقى مفيد وعادل."
          : "Reports can include screenshots and proof so warnings stay useful and fair.",
    },
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: lang === "ar" ? "تقييم ثقة واضح" : "Clear trust score",
      text:
        lang === "ar"
          ? "نلخص حالة الصفحة في مؤشر بسيط يساعدك تفهم مستوى المخاطرة بسرعة."
          : "We summarize each target into a simple score that helps you judge risk fast.",
    },
  ];

  const steps = [
    lang === "ar" ? "ابحث عن البائع أو الصفحة" : "Search the seller or page",
    lang === "ar" ? "راجع البلاغات ومستوى الثقة" : "Review reports and trust score",
    lang === "ar" ? "بلغ لو عندك تجربة مثبتة" : "Report if you have evidence",
  ];

  return (
    <>
      <Navbar />
      <main className="about-page relative min-h-screen overflow-hidden px-4 pb-20 pt-28">
        <div className="absolute inset-x-0 top-16 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.14),transparent_64%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(0,243,255,0.12),transparent_64%)]" />
        <div className="absolute left-0 top-52 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute right-0 top-80 h-72 w-72 rounded-full bg-red-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl space-y-8">
          <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-black text-primary dark:border-neon-blue/20 dark:bg-neon-blue/10 dark:text-neon-blue">
                <Sparkles className="h-4 w-4" />
                <span>{lang === "ar" ? "منصة أمان لمجتمع الجيمنج" : "Safety layer for gamers"}</span>
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                {lang === "ar" ? "عن منصة Trackify" : "About Trackify"}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-slate-600 dark:text-muted-foreground">
                {lang === "ar"
                  ? "Trackify منصة مصرية بتساعد اللاعبين يعرفوا الصفحات والبائعين الخطرين قبل الشراء، وتدي المجتمع طريقة واضحة للإبلاغ والتحقق."
                  : "Trackify helps gamers check risky pages and sellers before buying, while giving the community a clear way to report and verify incidents."}
              </p>
            </div>

            <div className="about-surface rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-xl shadow-primary/5 backdrop-blur dark:border-neon-blue/15 dark:shadow-neon-blue/5">
              <div className="grid grid-cols-2 gap-3">
                <Metric icon={<Users className="h-5 w-5" />} label={lang === "ar" ? "مجتمع" : "Community"} value="32K+" />
                <Metric icon={<Database className="h-5 w-5" />} label={lang === "ar" ? "قاعدة بيانات" : "Database"} value="Live" />
                <Metric icon={<AlertTriangle className="h-5 w-5" />} label={lang === "ar" ? "تحذيرات" : "Warnings"} value="24/7" />
                <Metric icon={<ShieldCheck className="h-5 w-5" />} label={lang === "ar" ? "ثقة" : "Trust"} value="Score" />
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {valueCards.map((card) => (
              <div key={card.title} className="about-surface rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:hover:border-neon-blue/25 dark:hover:shadow-neon-blue/10">
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary dark:bg-neon-blue/10 dark:text-neon-blue">
                  {card.icon}
                </div>
                <h2 className="text-xl font-black">{card.title}</h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 dark:text-muted-foreground">{card.text}</p>
              </div>
            ))}
          </section>

          <section className="about-surface rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm dark:border-white/10 md:p-8">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-black text-primary dark:text-neon-blue">
                  {lang === "ar" ? "طريقة الاستخدام" : "How it works"}
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  {lang === "ar" ? "ثلاث خطوات قبل أي تعامل" : "Three steps before any deal"}
                </h2>
              </div>
              <p className="max-w-md text-sm font-semibold text-slate-600 dark:text-muted-foreground">
                {lang === "ar"
                  ? "الفكرة بسيطة: تحقق، اقرأ، ثم قرر. ولو عندك دليل، ساعد غيرك ببلاغ واضح."
                  : "Simple flow: check, review, then decide. If you have proof, help others with a clear report."}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step} className="about-inner rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-black text-white dark:bg-neon-blue dark:text-black">
                    {index + 1}
                  </span>
                  <p className="mt-4 text-base font-black text-slate-800 dark:text-foreground">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="about-callout rounded-3xl border border-cyan-200 bg-cyan-50 p-6 text-center shadow-sm dark:border-neon-blue/20 md:p-8">
            <p className="text-xl font-black text-cyan-800 dark:text-neon-blue">
              {lang === "ar"
                ? "كن جزءا من مجتمع أكثر أمانا: تحقق قبل الشراء، وبلغ عند التعرض للنصب."
                : "Be part of a safer community: check before buying, and report scams when they happen."}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="about-inner rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10">
      <div className="mb-4 flex items-center justify-between text-primary dark:text-neon-blue">
        {icon}
        <span className="text-xs font-black uppercase text-slate-500 dark:text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}
