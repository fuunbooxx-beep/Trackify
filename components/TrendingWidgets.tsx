"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpLeft,
  ChevronLeft,
  ChevronRight,
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
      <div className="trend-inner rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-border dark:bg-card/80 sm:px-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
          {tone === "danger"
            ? lang === "ar" ? "أعلى 3 بلاغات" : "Top 3 by reports"
            : lang === "ar" ? "أعلى 3 ثقة" : "Top 3 by trust score"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {visibleTargets.map((target, index) => (
          <TrendingCard key={target.id} target={target} rank={index + 1} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function TrendingCard({ target, rank, tone }: { target: TargetRecord; rank: number; tone: "danger" | "safe" }) {
  const { lang } = useLanguage();
  const phones = getTargetPhones(target);
  const links = getTargetLinks(target);
  const firstLink = links[0];
  const isDanger = tone === "danger";
  const accentText = isDanger ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
  const topLine = isDanger
    ? "from-red-500 via-orange-400 to-red-500"
    : "from-emerald-500 via-cyan-400 to-emerald-500";

  return (
    <Link href={getTargetHref(target)} className="group block">
      <article className="trend-card relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 dark:border-border dark:bg-card/85 sm:p-3">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${topLine}`} />
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="relative shrink-0">
            <div className="trend-inner flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner dark:border-border sm:h-12 sm:w-12">
              {target.logoUrl ? (
                <img src={target.logoUrl} alt={target.name || ""} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-5 w-5 text-slate-500 dark:text-muted-foreground sm:h-6 sm:w-6" />
              )}
            </div>
            <span className={`trend-inner absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white text-[10px] font-black shadow-md dark:border-card ${accentText}`}>
              {rank}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-slate-950 transition group-hover:text-primary dark:text-foreground dark:group-hover:text-neon-blue sm:text-base">
                  {target.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-black sm:gap-2 sm:text-xs">
                  <span className="trend-inner rounded-full bg-slate-100 px-2.5 py-1 uppercase text-slate-600 dark:bg-background dark:text-slate-200">
                    {target.type || "page"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${isDanger ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                    {isDanger ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {getStatusLabel(target.status || "reviewing", lang)}
                  </span>
                </div>
              </div>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary dark:border-border dark:text-muted-foreground dark:group-hover:text-neon-blue">
                <ArrowUpLeft className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2">
              <MiniStat
                label={isDanger ? (lang === "ar" ? "البلاغات" : "Reports") : lang === "ar" ? "الثقة" : "Score"}
                value={isDanger ? Number(target.reportCount || 0) : `${Number(target.trustScore || 0)}%`}
                tone={tone}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
              {phones[0] && (
                <span className="trend-inner inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-border dark:bg-background" dir="ltr">
                  <Phone className="h-3.5 w-3.5" />
                  {phones[0]}
                </span>
              )}
              {firstLink && (
                <span className="trend-inner inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-border dark:bg-background">
                  <PlatformIcon platform={firstLink.platform} className="h-3.5 w-3.5 shrink-0" />
                  <span>{platformLabel(firstLink.platform)}</span>
                  <span className="max-w-[100px] truncate" dir="ltr">
                    {hostFromUrl(firstLink.url)}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone: "danger" | "safe" }) {
  const color = tone === "danger" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="trend-inner rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-border sm:rounded-2xl sm:p-3">
      <p className="text-[11px] font-black text-slate-500 dark:text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-black sm:text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function LoadingList() {
  const { lang } = useLanguage();

  return (
    <div className="trend-card rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm dark:border-border dark:bg-card/85 dark:text-slate-200 sm:p-8">
      <div className="flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-black">{lang === "ar" ? "تحميل الترند..." : "Loading trending..."}</span>
      </div>
    </div>
  );
}

function EmptyList({ text, tone }: { text: string; tone: "danger" | "safe" }) {
  const isDanger = tone === "danger";

  return (
    <div className="trend-card grid min-h-[160px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-center shadow-sm dark:border-border dark:bg-card/70 sm:min-h-[220px] sm:p-8">
      <div className="max-w-xs">
        <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl ${isDanger ? "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
          {isDanger ? <AlertTriangle className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <p className="text-base font-black text-slate-700 dark:text-slate-200">{text}</p>
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
