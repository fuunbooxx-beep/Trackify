"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Particles } from "@/components/Particles";
import { ShieldCheck, AlertTriangle, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { motion } from "motion/react";

export default function Home() {
  const { lang } = useLanguage();
  return (
    <>
      <Particles />
      <Navbar />
      
      <main className="flex-1">
        <Hero />
        
        {/* Quick Stats Section */}
        <section className="relative overflow-hidden border-y border-border/50 bg-secondary/30 py-10 sm:py-16">
          <div className="section-sheen absolute inset-0 opacity-50" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:gap-8"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.12 } },
              }}
            >
              <StatCard 
                icon={<ShieldCheck className="h-10 w-10 text-green-500 sm:h-12 sm:w-12" />}
                number="5"
                label={lang === "ar" ? "بائع موثوق" : "Trusted seller"}
                glowClass="glow-secure"
              />
              <StatCard 
                icon={<AlertTriangle className="h-10 w-10 text-red-500 sm:h-12 sm:w-12" />}
                number="2"
                label={lang === "ar" ? "نصاب تم كشفه" : "Scammer detected"}
                glowClass="glow-warning"
              />
              <StatCard 
                icon={<Users className="h-10 w-10 text-primary dark:text-neon-blue sm:h-12 sm:w-12" />}
                number="15"
                label={lang === "ar" ? "مستخدم نشط" : "Active users"}
                glowClass="dark:glow-neon shadow-[0_0_15px_rgba(37,99,235,0.2)]"
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
            className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.16 } },
            }}
          >
            <motion.div
              className="glass-panel lively-card group relative overflow-hidden rounded-2xl p-5 transition-colors hover:border-primary/50 dark:hover:border-neon-blue/50 sm:p-7 md:p-8"
              variants={{
                hidden: { opacity: 0, y: 28 },
                show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
              }}
              whileHover={{ y: -8 }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-neon-blue/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-125" />
              <h3 className="mb-3 flex items-center gap-3 text-xl font-bold sm:text-2xl md:mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-black text-white shadow-lg dark:bg-neon-blue dark:text-black sm:h-10 sm:w-10 sm:text-xl">1</span>
                <span>{lang === "ar" ? "بحث سريع قبل الشراء" : "Quick check before buying"}</span>
              </h3>
              <p className="text-base font-medium leading-7 text-muted-foreground sm:text-lg">
                {lang === "ar"
                  ? "قبل ما تحول مليم لأي صفحة أو بائع، خد رقم الفون أو لينك الصفحة واعمل سيرش عندنا. هتشوف تقييم البائع وتجارب الناس بناءً على أدلة حقيقية."
                  : "Before sending money to any page or seller, search using the phone number or page URL. You will see trust insights backed by real evidence."}
              </p>
            </motion.div>

            <motion.div
              className="glass-panel lively-card group relative overflow-hidden rounded-2xl p-5 transition-colors hover:border-destructive/50 sm:p-7 md:p-8"
              variants={{
                hidden: { opacity: 0, y: 28 },
                show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
              }}
              whileHover={{ y: -8 }}
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-destructive/10 rounded-br-full -ml-16 -mt-16 transition-transform group-hover:scale-125" />
              <h3 className="mb-3 flex items-center gap-3 text-xl font-bold sm:text-2xl md:mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive text-lg font-black text-white shadow-lg sm:h-10 sm:w-10 sm:text-xl">2</span>
                <span>{lang === "ar" ? "تقديم بلاغات موثقة" : "Submit verified reports"}</span>
              </h3>
              <p className="text-base font-medium leading-7 text-muted-foreground sm:text-lg">
                {lang === "ar"
                  ? "اتعرضت لنصب أو معاملة سيئة؟ قدم بلاغ وارفع السكرين شوتس كإثبات. البلاغ بتاعك هيحمي غيرك وهيأثر على الثقة (Trust Score) بتاع الصفحة دي."
                  : "Got scammed or treated badly? Submit a report with screenshots as proof. Your report helps protect others and impacts that page trust score."}
              </p>
            </motion.div>
          </motion.div>
        </section>
      </main>

    </>
  );
}

function StatCard({ icon, number, label, glowClass }: { icon: React.ReactNode, number: string, label: string, glowClass: string }) {
  return (
    <motion.div
      className={`glass-panel stat-card relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/50 p-5 text-center transition-transform hover:-translate-y-2 sm:p-8 ${glowClass}`}
      variants={{
        hidden: { opacity: 0, y: 24, scale: 0.96 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: "easeOut" } },
      }}
      whileHover={{ y: -8, scale: 1.02 }}
    >
      <div className="mb-4 inline-block rounded-2xl bg-background p-3 shadow-sm sm:mb-6 sm:p-4">{icon}</div>
      <div className="mb-2 font-inter text-4xl font-black tracking-normal sm:mb-3 sm:text-5xl">{number}</div>
      <div className="text-base font-bold tracking-normal text-muted-foreground sm:text-lg">{label}</div>
    </motion.div>
  );
}
