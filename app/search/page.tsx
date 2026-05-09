"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AlertTriangle, HelpCircle, Loader2, Search as SearchIcon, ArrowLeft, Phone, ExternalLink } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion } from "motion/react";
import { useLanguage } from "@/lib/i18n/context";
import {
  getStatusLabel,
  getTargetCategoryLabel,
  getTargetHref,
  hostFromUrl,
  normalizeTargetCategory,
  type TargetRecord,
} from "@/lib/target-utils";
import { scoreTarget } from "@/lib/target-search-score";

type ScoredTarget = TargetRecord & { id: string; searchScore: number };

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      
      try {
        const snapshot = await getDocs(collection(db, "targets"));
        const data = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as TargetRecord & { id: string }))
          .map((target) => ({ ...target, searchScore: scoreTarget(q, target) }))
          .filter((target): target is ScoredTarget => target.searchScore > 0)
          .sort((a, b) => {
            if (b.searchScore !== a.searchScore) return b.searchScore - a.searchScore;
            const reportsDifference = Number(b.reportCount || 0) - Number(a.reportCount || 0);
            if (reportsDifference !== 0) return reportsDifference;
            return String(a.name || "").localeCompare(String(b.name || ""));
          });

        setResults(data);
      } catch (error) {
        console.error(error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [q]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-32 min-h-screen">
      <Link href="/" className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors font-medium">
        <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />
        <span>{lang === "ar" ? "رجوع للرئيسية" : "Back to home"}</span>
      </Link>
      
      <div className="mb-12">
        <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
          <SearchIcon className="w-8 h-8 text-primary dark:text-neon-blue" />
          <span>{lang === "ar" ? `نتائج البحث عن "${q}"` : `Search results for "${q}"`}</span>
        </h1>
        <p className="text-muted-foreground font-medium">
          {lang === "ar" ? `تم العثور على ${results.length} نتيجة مطابقة.` : `${results.length} matching results found.`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary dark:text-neon-blue" />
          <p className="text-muted-foreground font-medium text-lg animate-pulse">{lang === "ar" ? "جاري البحث في قاعدة البيانات..." : "Searching the database..."}</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-6">
          {results.map((target, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={target.id}
            >
              <TargetCard target={target} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-panel rounded-3xl border border-dashed border-border/60">
          <HelpCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{lang === "ar" ? "مفيش نتائج!" : "No results found!"}</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            {lang === "ar" ? "مفيش أي بيانات أو بلاغات عن الرقم أو الصفحة دي حاليا. لو اتنصب عليك منهم، ياريت تقدم بلاغ وتساعد غيرك." : "No reports are currently linked to this number or page. If you were scammed by them, submit a report to help others."}
          </p>
          <Link href={`/report?target=${encodeURIComponent(q)}`} className="inline-flex items-center gap-2 bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-6 py-3 rounded-xl hover:scale-105 transition-transform shadow-[0_0_15px_rgba(37,99,235,0.3)] dark:shadow-[0_0_15px_rgba(0,243,255,0.3)]">
            <AlertTriangle className="w-5 h-5" />
            <span>{lang === "ar" ? "قدم بلاغ عن الصفحة دي" : "Submit a report about this page"}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
        <SearchContent />
      </Suspense>
    </>
  );
}

function TargetCard({ target }: { target: any }) {
  const { lang } = useLanguage();
  const reportCount = Number(target.reportCount ?? 0);
  const isHeavyReports = reportCount >= 15;
  const isNoData = target.status === "no_data";
  const isHighRisk = target.status === "high_risk";
  const isTrusted = target.status === "trusted";
  const isWarning = target.status === "warning" || target.status === "severe_warning";
  const scoreClass = isNoData
    ? "text-muted-foreground"
    : isHighRisk
      ? "text-destructive"
      : isTrusted
        ? "text-green-500"
        : isWarning
          ? "text-orange-500"
          : "text-yellow-500";
  const borderClass = isNoData
    ? "border-l-border"
    : isHighRisk
      ? "border-l-destructive glow-warning"
      : isTrusted
        ? "border-l-green-500 hover:glow-secure"
        : isWarning
          ? "border-l-orange-500"
          : "border-l-yellow-500";
  const heavyBorder = isHeavyReports ? "ring-2 ring-destructive/35 dark:ring-destructive/45" : "";

  return (
    <Link href={getTargetHref(target)} className="block">
      <div
        className={`glass-panel p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-l-4 transition-all hover:scale-[1.01] ${borderClass} ${heavyBorder}`}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-xl font-bold">{target.name}</h3>
            <span className="text-xs font-bold px-2 py-1 bg-secondary rounded-md uppercase tracking-wider">{target.type}</span>
            <span className="inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary dark:text-neon-blue">
              {getTargetCategoryLabel(normalizeTargetCategory(target.category), lang)}
            </span>
            {isHeavyReports ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-[11px] font-black text-destructive">
                {lang === "ar" ? `بلاغات كثيرة (${reportCount})` : `Many reports (${reportCount})`}
              </span>
            ) : null}
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground font-medium">
            {target.phone && (
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Phone className="h-4 w-4" />
                {target.phone}
              </span>
            )}
            {target.link && (
              <span className="inline-flex items-center gap-1.5 underline decoration-muted-foreground/30 underline-offset-4">
                <ExternalLink className="h-4 w-4" />
                <span dir="ltr">{hostFromUrl(target.link)}</span>
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-6 shrink-0 bg-background/50 p-4 rounded-xl">
          <div className="text-center">
            <div className="text-xs text-muted-foreground font-bold mb-1 uppercase tracking-wider">Score</div>
            <div className={`text-2xl font-black font-inter ${scoreClass}`}>
              {isNoData ? (lang === "ar" ? "—" : "—") : `${target.trustScore ?? 0}%`}
            </div>
          </div>
          <div className="w-px h-10 bg-border"></div>
          <div className="text-center w-24">
            <div className="text-xs text-muted-foreground font-bold mb-1 uppercase tracking-wider">{lang === "ar" ? "الحالة" : "Status"}</div>
            <div className={`font-bold ${scoreClass}`}>
              {getStatusLabel(target.status || "reviewing", lang)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Removed mockData
