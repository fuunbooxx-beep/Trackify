"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Particles } from "@/components/Particles";
import { ShieldCheck, AlertTriangle, FileCheck2, SearchCheck, FileWarning, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { motion } from "motion/react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

type HomeStats = {
  trustedSellers: number;
  scammersDetected: number;
  totalReports: number;
};

export default function Home() {
  const { lang } = useLanguage();
  const [stats, setStats] = useState<HomeStats>({
    trustedSellers: 0,
    scammersDetected: 0,
    totalReports: 0,
  });

  useEffect(() => {
    let alive = true;

    const fetchHomeStats = async () => {
      try {
        const [trustedSnapshot, riskySnapshot, reportsSnapshot] = await Promise.all([
          getCountFromServer(query(collection(db, "targets"), where("status", "==", "trusted"))),
          getCountFromServer(query(collection(db, "targets"), where("status", "==", "high_risk"))),
          getCountFromServer(query(collection(db, "reports"), where("status", "==", "approved"))),
        ]);

        if (alive) {
          setStats({
            trustedSellers: trustedSnapshot.data().count,
            scammersDetected: riskySnapshot.data().count,
            totalReports: reportsSnapshot.data().count,
          });
        }
      } catch (error) {
        console.error(error);
      }
    };

    void fetchHomeStats();

    return () => {
      alive = false;
    };
  }, []);

  const numberLocale = lang === "ar" ? "ar-EG" : "en-US";
  const formattedStats = useMemo(
    () => ({
      trustedSellers: stats.trustedSellers.toLocaleString(numberLocale),
      scammersDetected: stats.scammersDetected.toLocaleString(numberLocale),
      totalReports: stats.totalReports.toLocaleString(numberLocale),
    }),
    [numberLocale, stats.totalReports, stats.scammersDetected, stats.trustedSellers]
  );

  return (
    <>
      <Particles />
      <Navbar />
      
      <main className="flex-1">
        <Hero />
        
        {/* Quick Stats Section */}
        <section className="relative overflow-hidden border-y border-border/50 bg-secondary/30 py-12 sm:py-20">
          <div className="section-sheen absolute inset-0 opacity-50" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              className="grid grid-cols-1 gap-5 sm:gap-7 md:grid-cols-3 md:gap-10"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.14 } },
              }}
            >
              <StatCard 
                icon={<ShieldCheck className="h-10 w-10 sm:h-12 sm:w-12" />}
                number={formattedStats.trustedSellers}
                label={lang === "ar" ? "بائع موثوق" : "Trusted Sellers"}
                accent="green"
              />
              <StatCard 
                icon={<AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12" />}
                number={formattedStats.scammersDetected}
                label={lang === "ar" ? "نصاب تم كشفه" : "Scammers Detected"}
                accent="red"
              />
              <StatCard 
                icon={<FileCheck2 className="h-10 w-10 sm:h-12 sm:w-12" />}
                number={formattedStats.totalReports}
                label={lang === "ar" ? "بلاغ معتمد" : "Approved Reports"}
                accent="yellow"
              />
            </motion.div>
          </div>
        </section>

        {/* Info Section */}
        <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20 md:py-24">
          <motion.div
            className="mb-10 text-center sm:mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2 className="mb-4 text-3xl font-black tracking-normal md:mb-6 md:text-5xl">
              {lang === "ar" ? "ليه تستخدم " : "Why use "}
              <span className="text-primary dark:text-neon-blue">Trackify</span>
              {lang === "ar" ? "؟" : "?"}
            </h2>
            <p className="mx-auto max-w-2xl text-base font-medium leading-7 text-muted-foreground sm:text-xl">
              {lang === "ar"
                ? "مجتمع الجيمنج في مصر كبير، وللأسف عمليات النصب بتزيد. إحنا هنا علشان نحمي فلوسك وحساباتك."
                : "The gaming community in Egypt is huge, and scams are increasing. We are here to protect your money and accounts."}
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.18 } },
            }}
          >
            {/* Card 1 - Quick Check */}
            <motion.div
              className="info-card info-card--blue group relative overflow-hidden rounded-3xl p-6 sm:p-8 md:p-9"
              variants={{
                hidden: { opacity: 0, y: 32 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
              whileHover={{ y: -6, scale: 1.015 }}
            >
              {/* bg glow blob */}
              <div className="info-card__blob info-card__blob--tr" />
              {/* accent top bar */}
              <div className="info-card__accent-bar" />
              {/* number badge */}
              <div className="mb-5 flex items-center gap-4">
                <span className="info-card__badge info-card__badge--blue">1</span>
                <div className="info-card__divider" />
              </div>
              <h3 className="mb-3 text-xl font-extrabold tracking-tight sm:text-2xl md:mb-4">
                {lang === "ar" ? "بحث سريع قبل الشراء" : "Quick Check Before Buying"}
              </h3>
              <p className="text-base font-medium leading-7 text-muted-foreground sm:text-lg">
                {lang === "ar"
                  ? "قبل ما تحول مليم لأي صفحة أو بائع، خد رقم الفون أو لينك الصفحة واعمل سيرش عندنا. هتشوف تقييم البائع وتجارب الناس بناءً على أدلة حقيقية."
                  : "Before sending money to any page or seller, search using the phone number or page URL. You will see trust insights backed by real evidence."}
              </p>
            </motion.div>

            {/* Card 2 - Submit Report */}
            <motion.div
              className="info-card info-card--red group relative overflow-hidden rounded-3xl p-6 sm:p-8 md:p-9"
              variants={{
                hidden: { opacity: 0, y: 32 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
              whileHover={{ y: -6, scale: 1.015 }}
            >
              <div className="info-card__blob info-card__blob--tl info-card__blob--red" />
              <div className="info-card__accent-bar info-card__accent-bar--red" />
              <div className="mb-5 flex items-center gap-4">
                <span className="info-card__badge info-card__badge--red">2</span>
                <div className="info-card__divider" />
              </div>
              <h3 className="mb-3 text-xl font-extrabold tracking-tight sm:text-2xl md:mb-4">
                {lang === "ar" ? "تقديم بلاغات موثقة" : "Submit Verified Reports"}
              </h3>
              <p className="text-base font-medium leading-7 text-muted-foreground sm:text-lg">
                {lang === "ar"
                  ? "اتعرضت لنصب أو معاملة سيئة؟ قدم بلاغ وارفع السكرين شوتس كإثبات. البلاغ بتاعك هيحمي غيرك وهيأثر على الثقة (Trust Score) بتاع الصفحة دي."
                  : "Got scammed or treated badly? Submit a report with screenshots as proof. Your report helps protect others and impacts that page trust score."}
              </p>
            </motion.div>
          </motion.div>
        </section>

        <section className="border-y border-border/60 bg-card/40 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">{lang === "ar" ? "ثلاث خطوات بسيطة" : "Three simple steps"}</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">{lang === "ar" ? "اتأكد قبل ما تدفع" : "Confidence before every payment"}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">{lang === "ar" ? "اعرف مين قدامك، شوف الدليل، وخد قرارك على أساس تجارب حقيقية." : "Know who you are dealing with, inspect the evidence, and decide with real experiences."}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: SearchCheck, n: "01", en: "Search the seller", ar: "ابحث عن البائع", copyEn: "Use a phone, page name, or link.", copyAr: "استخدم رقم الهاتف أو اسم الصفحة أو الرابط." },
                { icon: FileWarning, n: "02", en: "Read the signals", ar: "اقرأ مؤشرات الثقة", copyEn: "See score, reports, dates, and evidence.", copyAr: "شوف التقييم والبلاغات والتواريخ والأدلة." },
                { icon: ShieldCheck, n: "03", en: "Pay with clarity", ar: "ادفع وأنت مطمن", copyEn: "If something feels wrong, report it.", copyAr: "لو حصلت مشكلة، شارك تجربتك واحمِ غيرك." },
              ].map(({ icon: Icon, n, en, ar, copyEn, copyAr }) => (
                <div key={n} className="group rounded-3xl border border-border bg-background/70 p-6 transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl sm:p-8">
                  <div className="mb-8 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></span><span className="font-mono text-sm font-black text-muted-foreground/60">{n}</span></div>
                  <h3 className="text-xl font-black">{lang === "ar" ? ar : en}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{lang === "ar" ? copyAr : copyEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[2rem] border border-red-500/20 bg-red-500/[.04] p-7 sm:p-10">
            <div className="mb-7 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-red-500">{lang === "ar" ? "تنبيهات حديثة" : "Recent alerts"}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{lang === "ar" ? "اعرف المخاطر قبل غيرك" : "See the risk signals early"}</h2></div><FileWarning className="h-8 w-8 text-red-500" /></div>
            <div className="space-y-3"><div className="flex items-center justify-between rounded-2xl border border-red-500/15 bg-background/70 p-4"><span className="font-bold">{lang === "ar" ? "صفحات تحت المراجعة" : "Targets under review"}</span><span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-500">{lang === "ar" ? "تحقق" : "Check"}</span></div><div className="flex items-center justify-between rounded-2xl border border-border bg-background/70 p-4"><span className="font-bold">{lang === "ar" ? "شوف قائمة الترند" : "Browse the live trend list"}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div></div>
            <a href="/trending" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-red-500 hover:underline">{lang === "ar" ? "عرض كل التنبيهات" : "View all alerts"}<ArrowUpRight className="h-4 w-4" /></a>
          </div>
          <div className="flex flex-col justify-between rounded-[2rem] bg-primary p-7 text-primary-foreground sm:p-10"><div><p className="text-xs font-black uppercase tracking-[.18em] opacity-70">{lang === "ar" ? "ساعد المجتمع" : "Help the community"}</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">{lang === "ar" ? "تجربتك ممكن تحمي حد" : "Your experience can protect someone"}</h2><p className="mt-4 max-w-md leading-7 opacity-80">{lang === "ar" ? "كل بلاغ موثق بيخلي قرار الشراء أوضح للاعبين في مصر." : "Every verified report makes the next gaming deal safer."}</p></div><a href="/report" className="mt-10 inline-flex w-fit items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-black text-white transition hover:bg-black/80">{lang === "ar" ? "شارك تجربتك" : "Share your experience"}<ArrowUpRight className="h-4 w-4" /></a></div>
        </section>
      </main>

    </>
  );
}

const accentMap = {
  green: {
    iconBg: "bg-green-500/15 dark:bg-green-500/20",
    iconColor: "text-green-500",
    glow: "shadow-[0_0_30px_rgba(34,197,94,0.18)] dark:shadow-[0_0_30px_rgba(34,197,94,0.25)]",
    border: "border-green-500/20 dark:border-green-500/30",
    bar: "bg-gradient-to-r from-green-500/0 via-green-500 to-green-500/0",
    numColor: "text-green-600 dark:text-green-400",
  },
  red: {
    iconBg: "bg-red-500/15 dark:bg-red-500/20",
    iconColor: "text-red-500",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.18)] dark:shadow-[0_0_30px_rgba(239,68,68,0.25)]",
    border: "border-red-500/20 dark:border-red-500/30",
    bar: "bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0",
    numColor: "text-red-600 dark:text-red-400",
  },
  yellow: {
    iconBg: "bg-primary/15 dark:bg-primary/20",
    iconColor: "text-primary",
    glow: "shadow-[0_0_30px_rgba(250,204,21,0.18)] dark:shadow-[0_0_30px_rgba(250,204,21,0.25)]",
    border: "border-primary/20 dark:border-primary/30",
    bar: "bg-gradient-to-r from-primary/0 via-primary to-primary/0",
    numColor: "text-yellow-600 dark:text-primary",
  },
} as const;

function StatCard({ icon, number, label, accent }: { icon: React.ReactNode; number: string; label: string; accent: keyof typeof accentMap }) {
  const a = accentMap[accent];
  return (
    <motion.div
      className={`stat-card relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border bg-card/70 backdrop-blur-md p-6 text-center sm:p-9 ${a.glow} ${a.border} transition-all duration-300`}
      variants={{
        hidden: { opacity: 0, y: 28, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: "easeOut" } },
      }}
      whileHover={{ y: -8, scale: 1.03 }}
    >
      {/* Top shimmer bar */}
      <span className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-2/3 rounded-full opacity-70 ${a.bar}`} />
      {/* Icon */}
      <div className={`mb-5 sm:mb-6 inline-flex items-center justify-center rounded-2xl p-4 sm:p-5 ${a.iconBg} ${a.iconColor}`}>
        {icon}
      </div>
      {/* Number */}
      <div className={`mb-2 font-inter text-4xl font-black tracking-tight sm:mb-3 sm:text-5xl ${a.numColor}`}>{number}</div>
      {/* Label */}
      <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground sm:text-base">{label}</div>
      {/* Bottom shimmer bar */}
      <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-1/3 rounded-full opacity-40 ${a.bar}`} />
    </motion.div>
  );
}
