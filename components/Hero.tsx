"use client";

import { collection, getDocs, limit, query as firestoreQuery } from "firebase/firestore";
import { Search, ShieldAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/lib/i18n/context";
import type { TargetRecord } from "@/lib/target-utils";

type PopularSearch = {
  label: string;
  query: string;
};

export function Hero() {
  const [query, setQuery] = useState("");
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { lang } = useLanguage();
  const prefersReducedMotion = useReducedMotion();

  const fallbackSearches: PopularSearch[] =
    lang === "ar"
      ? [
          { label: "حسابات ببجي", query: "حسابات ببجي" },
          { label: "شحن شدات", query: "شحن شدات" },
          { label: "فالورانت بوينتس", query: "فالورانت بوينتس" },
        ]
      : [
          { label: "PUBG accounts", query: "PUBG accounts" },
          { label: "UC top-up", query: "UC top-up" },
          { label: "Valorant points", query: "Valorant points" },
        ];

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    goToSearch(query);
  };

  const goToSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  useEffect(() => {
    let alive = true;

    const fetchPopularSearches = async () => {
      try {
        const snapshot = await getDocs(firestoreQuery(collection(db, "targets"), limit(100)));
        const ranked = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as TargetRecord))
          .filter((target) => String(target.name || "").trim())
          .sort((a, b) => {
            const reportsDifference = Number(b.reportCount || 0) - Number(a.reportCount || 0);
            if (reportsDifference !== 0) return reportsDifference;
            return Number(b.trustScore || 0) - Number(a.trustScore || 0);
          })
          .slice(0, 3)
          .map((target) => ({
            label: String(target.name || ""),
            query: String(target.name || ""),
          }));

        if (alive) setPopularSearches(ranked);
      } catch (error) {
        console.error(error);
      }
    };

    void fetchPopularSearches();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const updateMobileState = () => setIsMobile(mobileQuery.matches);
    updateMobileState();
    mobileQuery.addEventListener("change", updateMobileState);

    return () => {
      mobileQuery.removeEventListener("change", updateMobileState);
    };
  }, []);

  const visibleSearches = popularSearches.length ? popularSearches : fallbackSearches;
  const tickerMessages =
    lang === "ar"
      ? [
          "راجع قبل ما تحوّل فلوسك",
          "اعرف تجارب الناس قبل ما تشتري",
          "افحص رقم البائع أو رابط الصفحة قبل الدفع",
          "التحقق السريع بيحميك من الاحتيال",
          "شوف تقييم الثقة قبل أي عملية شراء",
          "اقرأ البلاغات المعتمدة وخد قرارك",
        ]
      : [
          "Check before you send your money",
          "See real experiences before you buy",
          "Verify seller phone or page link before paying",
          "A quick check protects you from fraud",
          "Review trust score before any purchase",
          "Read verified reports, then decide",
        ];
  const tickerItems = Array.from({ length: 4 }).flatMap(() => tickerMessages);
  const shouldSimplifyMotion = Boolean(prefersReducedMotion) || isMobile;

  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden pb-16 pt-24 sm:pt-32 md:pb-32 md:pt-48">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-0" />
      <div className="hero-grid absolute inset-0 z-0 opacity-70" />
      {!shouldSimplifyMotion && (
        <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-[18%] z-0 h-px w-[min(86vw,980px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent dark:via-neon-blue/50"
        animate={{ y: [0, 360, 0], opacity: [0, 0.55, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      )}
      {!shouldSimplifyMotion && (
        <motion.div
        aria-hidden="true"
        className="hero-signal-panel absolute left-[10%] top-[34%] z-0 hidden h-20 w-36 rounded-md border border-primary/15 bg-white/35 shadow-[0_18px_60px_rgba(37,99,235,0.12)] backdrop-blur-sm dark:border-neon-blue/20 dark:bg-white/[0.03] dark:shadow-[0_18px_60px_rgba(0,243,255,0.10)] md:block"
        animate={{ y: [0, -14, 0], opacity: [0.22, 0.48, 0.22], rotate: [-3, 2, -3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      )}
      {!shouldSimplifyMotion && (
        <motion.div
        aria-hidden="true"
        className="hero-signal-panel absolute right-[12%] top-[24%] z-0 hidden h-16 w-32 rounded-md border border-blue-500/15 bg-white/30 shadow-[0_16px_50px_rgba(14,165,233,0.12)] backdrop-blur-sm dark:border-blue-500/20 dark:bg-white/[0.03] dark:shadow-[0_16px_50px_rgba(0,243,255,0.08)] md:block"
        animate={{ y: [0, -18, 0], x: [0, 8, 0], opacity: [0.18, 0.42, 0.18] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />
      )}

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <motion.div
            className="mx-auto mb-6 w-full max-w-3xl overflow-hidden rounded-xl border border-primary/20 bg-background/65 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div className="hero-marquee" dir="ltr">
              <div className={`hero-marquee-track ${shouldSimplifyMotion ? "hero-marquee-track--static" : ""}`}>
                {(shouldSimplifyMotion ? [0] : [0, 1]).map((segment) => (
                  <div key={`segment-${segment}`} className="hero-marquee-segment" aria-hidden={segment === 1}>
                    {tickerItems.map((message, i) => (
                      <div key={`ticker-${segment}-${i}`} className="hero-marquee-item" dir={lang === "ar" ? "rtl" : "ltr"}>
                        <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
                          {lang === "ar" ? "تنبيه مهم" : "Important"}
                        </span>
                        <span className="text-sm font-bold text-foreground/90 md:text-base">{message}</span>
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-muted-foreground md:text-base">
                          {lang === "ar" ? "تحقق أولًا لحماية فلوسك." : "Verify first to protect your money."}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.h1
            className="mx-auto mb-5 max-w-[14ch] select-none text-[clamp(2.35rem,11vw,3.75rem)] font-black leading-[1.12] tracking-normal md:mb-6 md:max-w-none md:text-6xl"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
          >
            {lang === "ar" ? "إفحص " : "Check "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500 dark:from-neon-blue dark:to-neon-purple">
              {lang === "ar" ? "البائعين والصفحات" : "sellers and pages"}
            </span>
            <br />
            {lang === "ar" ? "قبل ما تشتري الداتا أو الحسابات" : "before buying top-ups or accounts"}
          </motion.h1>

          <motion.p
            className="mx-auto mb-8 max-w-2xl text-base font-medium leading-7 text-muted-foreground sm:text-lg md:mb-10 md:text-xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
          >
            {lang === "ar"
              ? "تحقق قبل أن تتعامل: ابحث برقم الهاتف، أو رابط الصفحة، أو الاسم، واطلع على مستوى الثقة وتجارب الآخرين."
              : "Search by phone number, page link, or name and instantly view trust score and user experiences."}
          </motion.p>

          <motion.form
            onSubmit={handleSearch}
            className="group relative mx-auto w-full max-w-2xl"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.34, ease: "easeOut" }}
          >
            <div className="search-aura absolute -inset-1 bg-gradient-to-r from-primary via-sky-400 to-blue-500 dark:from-neon-blue dark:via-blue-500 dark:to-neon-purple rounded-full blur opacity-30 group-hover:opacity-55 transition duration-500" />
            <div className="relative flex items-center bg-card/95 rounded-full p-2 border border-primary/15 shadow-[0_18px_45px_rgba(37,99,235,0.16)] backdrop-blur dark:border-border dark:shadow-xl">
              <input
                type="text"
                placeholder={lang === "ar" ? "رقم الفون مثلا: 01000000000 أو لينك الصفحة..." : "Example: 01000000000 or page URL..."}
                className="min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground rtl:text-right sm:px-6 sm:text-base"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="submit"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105 dark:bg-neon-blue dark:text-black sm:h-12 sm:w-12"
              >
                <Search className="w-5 h-5 ltr-icon" />
              </button>
            </div>
          </motion.form>

          <motion.div
            className="mt-6 flex flex-wrap justify-center gap-2 text-sm font-medium text-muted-foreground sm:mt-8 sm:gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.52 }}
          >
            <span>{lang === "ar" ? "عمليات بحث شائعة:" : "Popular searches:"}</span>
            {visibleSearches.map((item) => (
              <button
                key={item.query}
                type="button"
                onClick={() => goToSearch(item.query)}
                className="hover:text-primary dark:hover:text-neon-blue cursor-pointer transition-colors bg-secondary/50 px-2 py-0.5 rounded-md font-bold"
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
