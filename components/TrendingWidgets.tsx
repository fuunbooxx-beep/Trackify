"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Facebook,
  Globe2,
  Instagram,
  Link as LinkIcon,
  Loader2,
  Phone,
  Send,
  ShieldCheck,
  Store,
  Youtube,
} from "lucide-react";
import {
  getTargetLinks,
  getTargetPhones,
  getTargetHref,
  getStatusLabel,
  hostFromUrl,
  platformLabel,
  type TargetRecord,
} from "@/lib/target-utils";
import { useLanguage } from "@/lib/i18n/context";
import { motion } from "motion/react";

export function TopAlerts() {
  const { lang } = useLanguage();
  const { targets, loading } = useTrendingTargets("high_risk");

  if (loading) return <LoadingList />;
  if (!targets.length) {
    return <EmptyList tone="danger" text={lang === "ar" ? "لا يوجد شيء للعرض الآن، سيتم إضافة نتائج قريبًا." : "Nothing to show now. Results will appear soon."} />;
  }

  return <CompactTrendList targets={targets} tone="danger" />;
}

export function TopSafePage() {
  const { lang } = useLanguage();
  const { targets, loading } = useTrendingTargets("trusted");

  if (loading) return <LoadingList />;
  if (!targets.length) {
    return <EmptyList tone="safe" text={lang === "ar" ? "لا يوجد شيء للعرض الآن، سيتم إضافة نتائج قريبًا." : "Nothing to show now. Results will appear soon."} />;
  }

  return <CompactTrendList targets={targets} tone="safe" />;
}

function useTrendingTargets(status: string) {
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const targetsQuery = query(collection(db, "targets"), where("status", "==", status), limit(100));
        const snapshot = await getDocs(targetsQuery);
        const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as TargetRecord));
        const sorted = data.sort((a, b) => {
          if (status === "trusted") return Number(b.trustScore || 0) - Number(a.trustScore || 0);
          return Number(b.reportCount || 0) - Number(a.reportCount || 0);
        });
        setTargets(sorted);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTrending();
  }, [status]);

  return { targets, loading };
}

function CompactTrendList({ targets, tone }: { targets: TargetRecord[]; tone: "danger" | "safe" }) {
  const { lang } = useLanguage();
  const visibleTargets = useMemo(() => targets.slice(0, 3), [targets]);

  return (
    <div className="space-y-3">
      {/* Sub-header label */}
      <div className="trend-inner flex items-center gap-2 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-2.5">
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          {tone === "danger"
            ? lang === "ar" ? "أعلى 3 بلاغات" : "Top 3 by reports"
            : lang === "ar" ? "أعلى 3 ثقة" : "Top 3 by trust score"}
        </span>
      </div>

      {/* Cards grid */}
      <motion.div
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      >
        {visibleTargets.map((target, index) => (
          <TrendingCard key={target.id} target={target} rank={index + 1} tone={tone} />
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Rank badge colors ─── */
const rankStyles = [
  { ring: "ring-yellow-400/50 dark:ring-yellow-400/60", bg: "bg-yellow-400/15 dark:bg-yellow-400/20", text: "text-yellow-600 dark:text-yellow-300", label: "🥇" },
  { ring: "ring-slate-400/50 dark:ring-slate-300/50", bg: "bg-slate-300/20 dark:bg-slate-300/15", text: "text-slate-500 dark:text-slate-300", label: "🥈" },
  { ring: "ring-amber-600/40 dark:ring-amber-500/50", bg: "bg-amber-700/10 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", label: "🥉" },
];

function TrendingCard({ target, rank, tone }: { target: TargetRecord; rank: number; tone: "danger" | "safe" }) {
  const { lang } = useLanguage();
  const phones = getTargetPhones(target);
  const links = getTargetLinks(target);
  const firstLink = links[0];
  const isDanger = tone === "danger";
  const reportCount = Number(target.reportCount ?? 0);
  const isHeavyReports = isDanger && reportCount >= 15;

  const topBar = isDanger
    ? "from-red-500/0 via-red-500 to-red-500/0"
    : "from-emerald-500/0 via-emerald-500 to-emerald-500/0";

  const hoverGlow = isDanger
    ? "hover:shadow-red-500/15 dark:hover:shadow-red-500/20"
    : "hover:shadow-emerald-500/15 dark:hover:shadow-emerald-500/20";

  const scoreColor = isDanger
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";

  const scoreBg = isDanger
    ? "bg-red-500/8 border-red-500/20 dark:bg-red-500/12 dark:border-red-500/25"
    : "bg-emerald-500/8 border-emerald-500/20 dark:bg-emerald-500/12 dark:border-emerald-500/25";

  const rankStyle = rankStyles[(rank - 1) % 3];

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } }}
    >
      <Link href={getTargetHref(target)} className="group block h-full">
        <article
          className={`trend-card relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${hoverGlow} dark:bg-card/70 ${isHeavyReports ? "ring-2 ring-red-500/30 dark:ring-red-500/40" : ""}`}
        >
          {/* Gradient top bar */}
          <span className={`absolute inset-x-8 top-0 h-[2px] rounded-full bg-gradient-to-r opacity-80 ${topBar}`} />

          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
            {/* Top row: logo + rank + name + arrow */}
            <div className="flex items-start gap-3">
              {/* Logo + rank badge */}
              <div className="relative shrink-0">
                <div className="trend-inner flex h-13 w-13 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-secondary/50 shadow-inner sm:h-14 sm:w-14">
                  {target.logoUrl ? (
                    <img src={target.logoUrl} alt={target.name || ""} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                {/* Rank medal badge */}
                <span className={`absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[10px] font-black ring-1 ${rankStyle.ring} ${rankStyle.bg} ${rankStyle.text}`}>
                  {rank}
                </span>
              </div>

              {/* Name + tags */}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-foreground transition-colors group-hover:text-primary dark:group-hover:text-primary sm:text-base">
                  {target.name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="trend-inner rounded-full border border-border/60 bg-secondary/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    {target.type || "page"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${isDanger ? "bg-red-100 text-red-700 dark:bg-red-500/12 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-400"}`}>
                    {isDanger ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                    {getStatusLabel(target.status || "reviewing", lang)}
                  </span>
                  {isHeavyReports && (
                    <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-black text-red-700 dark:border-red-500/30 dark:text-red-300">
                      {lang === "ar" ? `🔥 ${reportCount} بلاغ` : `🔥 ${reportCount} reports`}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground transition-all group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>

            {/* Score / Reports box */}
            <div className={`rounded-xl border p-3 ${scoreBg}`}>
              <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {isDanger ? (lang === "ar" ? "البلاغات" : "Reports") : lang === "ar" ? "Trust Score" : "Trust Score"}
              </p>
              <p className={`text-2xl font-black sm:text-3xl ${scoreColor}`}>
                {isDanger ? reportCount : `${Number(target.trustScore || 0)}%`}
              </p>
            </div>

            {/* Contact chips */}
            {(phones[0] || firstLink) && (
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted-foreground">
                {phones[0] && (
                  <span className="trend-inner inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1.5" dir="ltr">
                    <Phone className="h-3.5 w-3.5" />
                    {phones[0]}
                  </span>
                )}
                {firstLink && (
                  <span className="trend-inner inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1.5">
                    <PlatformIcon platform={firstLink.platform} className="h-3.5 w-3.5 shrink-0" />
                    <span>{platformLabel(firstLink.platform)}</span>
                    <span className="max-w-[90px] truncate text-muted-foreground/70" dir="ltr">
                      {hostFromUrl(firstLink.url)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function LoadingList() {
  const { lang } = useLanguage();
  return (
    <div className="trend-card flex min-h-[180px] items-center justify-center rounded-2xl border border-border/60 bg-card/80 shadow-sm">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm font-black">{lang === "ar" ? "تحميل الترند..." : "Loading trending..."}</span>
      </div>
    </div>
  );
}

function EmptyList({ text, tone }: { text: string; tone: "danger" | "safe" }) {
  const isDanger = tone === "danger";
  return (
    <div className="trend-card grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center sm:min-h-[240px]">
      <div className="max-w-xs">
        <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ${isDanger ? "bg-red-500/10 text-red-500 dark:bg-red-500/15" : "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15"}`}>
          {isDanger ? <AlertTriangle className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </div>
        <p className="text-sm font-black text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "facebook") return <Facebook className={className} />;
  if (platform === "instagram") return <Instagram className={className} />;
  if (platform === "youtube") return <Youtube className={className} />;
  if (platform === "telegram") return <Send className={className} />;
  if (platform === "website") return <Globe2 className={className} />;
  return <LinkIcon className={className} />;
}
