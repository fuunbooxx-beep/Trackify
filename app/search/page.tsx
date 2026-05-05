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
  getTargetAliases,
  getTargetHref,
  getTargetLinks,
  getTargetPhones,
  hostFromUrl,
  normalizePhone,
  normalizeTargetName,
  normalizeUrl,
  type TargetRecord,
} from "@/lib/target-utils";

type ScoredTarget = TargetRecord & { id: string; searchScore: number };

function compactSearchText(value: string) {
  return normalizeTargetName(value).replace(/\s+/g, "");
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function fuzzyScore(queryText: string, candidateText: string) {
  if (!queryText || !candidateText) return 0;

  const queryCompact = compactSearchText(queryText);
  const candidateCompact = compactSearchText(candidateText);
  const queryWords = normalizeTargetName(queryText).split(/\s+/).filter(Boolean);
  const candidateWords = normalizeTargetName(candidateText).split(/\s+/).filter(Boolean);

  if (!queryCompact || !candidateCompact) return 0;
  if (candidateCompact === queryCompact) return 100;
  if (candidateCompact.startsWith(queryCompact)) return 96;
  if (candidateWords.some((word) => word.startsWith(queryCompact))) return 91;
  if (candidateCompact.includes(queryCompact)) return queryCompact.length === 1 ? 70 : 84;
  if (candidateWords.some((word) => word.includes(queryCompact))) return queryCompact.length === 1 ? 68 : 80;

  if (queryCompact.length < 3) return 0;

  let best = 0;
  const candidates = [candidateCompact, ...candidateWords];
  const queryPieces = [queryCompact, ...queryWords.filter((word) => word.length >= 3)];

  for (const piece of queryPieces) {
    for (const candidate of candidates) {
      if (candidate.length < 3) continue;
      const distance = levenshteinDistance(piece, candidate);
      const maxLength = Math.max(piece.length, candidate.length);
      const similarity = 1 - distance / maxLength;
      if (similarity >= 0.72) {
        best = Math.max(best, Math.round(similarity * 76));
      }
    }
  }

  return best;
}

function scoreTarget(queryText: string, target: TargetRecord) {
  const normalizedQuery = normalizeTargetName(queryText);
  const compactQuery = compactSearchText(queryText);
  const phoneQuery = normalizePhone(queryText);
  const rawQuery = queryText.trim().toLowerCase();
  const looksLikeLink = /https?:\/\//i.test(rawQuery) || rawQuery.includes(".") || rawQuery.includes("/");
  const linkQuery = looksLikeLink ? normalizeUrl(queryText).toLowerCase() : "";
  const canSearchLinks = looksLikeLink || compactQuery.length >= 3;
  const terms = Array.isArray(target.searchTerms)
    ? target.searchTerms.filter((term) => {
        const value = String(term || "");
        if (canSearchLinks) return true;
        return !value.includes(".") && !/^https?:\/\//i.test(value);
      })
    : [];
  const phones = getTargetPhones(target);
  const links = getTargetLinks(target);

  let score = 0;
  score = Math.max(score, fuzzyScore(normalizedQuery, String(target.name || "")));
  for (const alias of getTargetAliases(target)) {
    score = Math.max(score, fuzzyScore(normalizedQuery, alias) - 2);
  }
  score = Math.max(score, fuzzyScore(normalizedQuery, String(target.type || "")) - 20);

  for (const term of terms) {
    score = Math.max(score, fuzzyScore(normalizedQuery, String(term)) - 4);
  }

  if (phoneQuery) {
    for (const phone of phones) {
      if (phone === phoneQuery) score = Math.max(score, 100);
      else if (phone.includes(phoneQuery)) score = Math.max(score, phoneQuery.length <= 2 ? 68 : 88);
    }
  }

  if (canSearchLinks && linkQuery) {
    for (const link of links) {
      const url = normalizeUrl(link.url).toLowerCase();
      const host = hostFromUrl(url).toLowerCase();
      if (url === linkQuery) score = Math.max(score, 100);
      else if (url.includes(linkQuery) || (compactQuery.length >= 3 && host.includes(normalizedQuery))) score = Math.max(score, 86);
    }
  }

  return score;
}

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

  return (
    <Link href={getTargetHref(target)} className="block">
      <div className={`glass-panel p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-l-4 transition-all hover:scale-[1.01] ${borderClass}`}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold">{target.name}</h3>
            <span className="text-xs font-bold px-2 py-1 bg-secondary rounded-md uppercase tracking-wider">{target.type}</span>
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
