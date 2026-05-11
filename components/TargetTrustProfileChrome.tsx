"use client";

import { useId } from "react";
import type { TargetRecord } from "@/lib/target-utils";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  MessageCircle,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export type DerivedReportStats = {
  approvedCount: number;
  scamCount: number;
  successCount: number;
  evidenceImageCount: number;
  evidenceUrls: string[];
  lastActivityAt: number;
};

export function deriveReportStats(reports: any[]): DerivedReportStats {
  const approved = reports.filter((r) => r.status === "approved");
  const scamCount = approved.filter((r) => String(r.category) === "scam").length;
  const successCount = approved.filter((r) => String(r.category) === "successful_transaction").length;
  let lastActivityAt = 0;
  const evidenceWithTime: { url: string; t: number }[] = [];

  for (const r of approved) {
    const t = Number(r.createdAt || 0);
    lastActivityAt = Math.max(lastActivityAt, t);
    const imgs = Array.isArray(r.evidenceImages) ? r.evidenceImages : [];
    for (const u of imgs) {
      if (typeof u === "string" && u) {
        evidenceWithTime.push({ url: u, t });
      }
    }
  }

  evidenceWithTime.sort((a, b) => b.t - a.t);
  return {
    approvedCount: approved.length,
    scamCount,
    successCount,
    evidenceImageCount: evidenceWithTime.length,
    evidenceUrls: evidenceWithTime.map((x) => x.url),
    lastActivityAt,
  };
}

function trustScoreHue(score: number): { stroke: string; glow: string; labelKey: "danger" | "medium" | "caution" | "trusted" } {
  if (score < 40) return { stroke: "#ef4444", glow: "rgba(15,23,42,0)", labelKey: "danger" };
  if (score < 60) return { stroke: "#f97316", glow: "rgba(249,115,22,0.4)", labelKey: "medium" };
  if (score < 80) return { stroke: "#eab308", glow: "rgba(234,179,8,0.38)", labelKey: "caution" };
  return { stroke: "#22c55e", glow: "rgba(34,197,94,0.4)", labelKey: "trusted" };
}

export function TrustScoreRing({
  score,
  isNoData,
  lang,
}: {
  score: number;
  isNoData: boolean;
  lang: "en" | "ar";
}) {
  const gradId = useId().replace(/:/g, "");
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = isNoData ? 0 : (s / 100) * c;
  const { stroke, glow, labelKey } = isNoData ? { stroke: "#64748b", glow: "rgba(100,116,139,0.3)", labelKey: "medium" as const } : trustScoreHue(s);

  const tierLabel =
    lang === "ar"
      ? {
          danger: "مخاطر عالية",
          medium: "مخاطر متوسطة",
          caution: "تحذير مجتمعي",
          trusted: "ثقة مجتمعية",
        }[labelKey]
      : {
          danger: "High risk",
          medium: "Medium risk",
          caution: "Community caution",
          trusted: "Trusted by community",
        }[labelKey];

  const explain =
    lang === "ar"
      ? "يُحسب من البلاغات الموثقة، جودة الأدلة، وتنوع التجارب المسجلة."
      : "Computed from verified reports, evidence strength, and the mix of community experiences.";

  const showRoundCap = !isNoData && s >= 2;

  return (
    <div className="glass-cyber-card relative isolate overflow-hidden border-primary/10 p-5 dark:border-primary/15">
      {/* Soft highlight fully inside padding — no negative offsets / heavy blur */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-1/4 -translate-y-1/4 rounded-full opacity-[0.22] blur-2xl dark:opacity-[0.28]"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 72%)` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent dark:from-white/[0.06]" />

      <div className="relative z-[1] flex w-full flex-col items-center gap-5">
        <p className="w-full text-center text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          {lang === "ar" ? "مؤشر الثقة" : "Trust score"}
        </p>

        <div className="relative grid h-[148px] w-[148px] shrink-0 place-items-center">
          <svg className="col-start-1 row-start-1 -rotate-90" width="100%" height="100%" viewBox="0 0 120 120" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={stroke} stopOpacity="1" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0.65" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-700/35 dark:text-slate-800/90" />
            {!isNoData ? (
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth="7"
                strokeLinecap={showRoundCap ? "round" : "butt"}
                strokeDasharray={`${dash} ${c}`}
                className="transition-[stroke-dasharray] duration-700 ease-out"
              />
            ) : null}
          </svg>
          <div className="col-start-1 row-start-1 flex flex-col items-center justify-center px-2 text-center">
            {isNoData ? (
              <span className="text-base font-black text-slate-500 dark:text-slate-400">{lang === "ar" ? "لا بيانات" : "No data"}</span>
            ) : (
              <>
                <span className="text-4xl font-black tabular-nums tracking-tight" style={{ color: stroke }}>
                  {s}
                </span>
                <span className="mt-0.5 text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">/ 100</span>
              </>
            )}
          </div>
        </div>

        <div className="w-full space-y-3 border-t border-border/50 pt-4 dark:border-white/10">
          <p className="text-center text-base font-black leading-snug tracking-tight md:text-lg" style={{ color: stroke }}>
            {tierLabel}
          </p>
          <p className="text-pretty text-center text-[13px] font-medium leading-7 text-slate-600 dark:text-slate-300 md:text-sm md:leading-8">
            {explain}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CyberTrustStatusBadge({
  status,
  lang,
}: {
  status: string;
  lang: "en" | "ar";
}) {
  const map: Record<
    string,
    { en: string; ar: string; className: string; icon: "shield" | "alert" | "radar" }
  > = {
    trusted: {
      en: "Trusted",
      ar: "موثوق",
      className:
        "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 shadow-[0_0_24px_rgba(34,197,94,0.15)] dark:text-emerald-300",
      icon: "shield",
    },
    high_risk: {
      en: "High scam risk",
      ar: "مخاطرة احتيال عالية",
      className: "border-red-500/40 bg-red-500/10 text-red-700 shadow-[0_0_24px_rgba(239,68,68,0.18)] dark:text-red-300",
      icon: "alert",
    },
    warning: {
      en: "Mixed reports",
      ar: "بلاغات متباينة",
      className:
        "border-amber-500/40 bg-amber-500/10 text-amber-800 shadow-[0_0_20px_rgba(245,158,11,0.12)] dark:text-amber-200",
      icon: "radar",
    },
    severe_warning: {
      en: "Mixed reports",
      ar: "بلاغات متباينة",
      className:
        "border-amber-500/45 bg-amber-500/12 text-amber-800 shadow-[0_0_22px_rgba(245,158,11,0.14)] dark:text-amber-200",
      icon: "radar",
    },
    reviewing: {
      en: "Under investigation",
      ar: "قيد التحقيق",
      className: "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200",
      icon: "radar",
    },
    no_data: {
      en: "Under investigation",
      ar: "قيد التحقيق",
      className: "border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-200",
      icon: "radar",
    },
  };

  const cfg = map[status] || map.reviewing;
  const label = lang === "ar" ? cfg.ar : cfg.en;
  const Icon = cfg.icon === "shield" ? ShieldCheck : cfg.icon === "alert" ? ShieldAlert : Radar;

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-black uppercase tracking-wide md:text-base ${cfg.className}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {label}
    </div>
  );
}

export function buildBehaviorSummary(
  target: TargetRecord,
  stats: DerivedReportStats,
  lang: "en" | "ar"
): string {
  const name = String(target.name || "This page");
  const score = Number(target.trustScore ?? 0);
  const n = stats.approvedCount;
  const scams = stats.scamCount;
  const ok = stats.successCount;

  if (target.status === "no_data" || n === 0) {
    return lang === "ar"
      ? `لا توجد بعد بلاغات موثقة كافية لبناء ملف ثقة تفصيلي لـ «${name}». راقب التحديثات وراجع الأدلة فور توفرها.`
      : `There isn’t enough verified community signal yet to profile “${name}” in depth. Check back as new reports and evidence arrive.`;
  }

  if (target.status === "trusted" && score >= 75) {
    return lang === "ar"
      ? `تشير إشارات المجتمع إلى تجارب إيجابية نسبيًا مع «${name}» (تقييم ثقة حوالي ${score}٪ من ${n} بلاغًا موثقًا). ما زال من الحكمة مراجعة الأدلة قبل أي دفعة كبيرة.`
      : `Community signals for “${name}” skew positive overall (trust score ~${score}% across ${n} verified reports). Still review recent evidence before large payments.`;
  }

  if (target.status === "high_risk" || score < 45) {
    return lang === "ar"
      ? `ملف «${name}» يظهر ضغطًا سلبيًا قويًا: تقييم ثقة حوالي ${score}٪ مع ${scams} بلاغ احتيال موثق ضمن ${n} بلاغًا. تعامل بحذر شديد وراجع لقطات الشاشة والتفاصيل قبل التحويل.`
      : `“${name}” shows heavy negative pressure: trust score ~${score}% with ${scams} verified scam reports among ${n} total. Treat as high risk—inspect screenshots and timelines before sending money.`;
  }

  return lang === "ar"
    ? `الصورة مختلطة لـ «${name}»: تقييم ثقة حوالي ${score}٪ من ${n} بلاغًا (${ok} نجاح · ${scams} احتيال). راجع التقارير الحديثة والأدلة قبل الالتزام ماليًا.`
    : `Mixed signals for “${name}”: trust score ~${score}% from ${n} verified reports (${ok} successful · ${scams} scam). Read recent reports and evidence before you commit funds.`;
}

export function QuickSignalChips({
  stats,
  verifiedReportCount,
  lastActivityLabel,
  extraChips = [],
  lang,
}: {
  stats: DerivedReportStats;
  verifiedReportCount: number;
  lastActivityLabel: string;
  extraChips?: { label: string; value: string | number; accent?: "emerald" | "rose" | "amber" | "slate" }[];
  lang: "en" | "ar";
}) {
  const chips: { label: string; value: string | number; accent?: "emerald" | "rose" | "amber" | "slate" }[] = [
    {
      label: lang === "ar" ? "تجارب ناجحة" : "Successful reports",
      value: stats.successCount,
      accent: "emerald",
    },
    {
      label: lang === "ar" ? "بلاغات نصب" : "Scam reports",
      value: stats.scamCount,
      accent: "rose",
    },
    {
      label: lang === "ar" ? "لقطات أدلة" : "Evidence shots",
      value: stats.evidenceImageCount,
      accent: "amber",
    },
    {
      label: lang === "ar" ? "بلاغات موثقة" : "Verified reports",
      value: verifiedReportCount,
    },
    {
      label: lang === "ar" ? "آخر نشاط" : "Last activity",
      value: lastActivityLabel || (lang === "ar" ? "—" : "—"),
    },
    ...extraChips,
  ];

  const accentRing = {
    emerald: "border-emerald-500/25 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(34,197,94,0.12)]",
    rose: "border-rose-500/25 hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]",
    amber: "border-amber-500/25 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]",
    slate: "border-border hover:border-primary/30 dark:hover:border-neon-blue/35",
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {chips.map((c) => (
        <div
          key={c.label}
          className={`glass-cyber-card group rounded-xl border px-3 py-3 transition duration-300 hover:-translate-y-0.5 ${
            c.accent ? accentRing[c.accent] : accentRing.slate
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{c.label}</p>
          <p className="mt-1.5 truncate text-lg font-black tabular-nums text-foreground md:text-xl">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function BehaviorFlagStrip({
  reasons,
  reasonLabel,
  reasonTitle,
  lang,
}: {
  reasons: string[];
  reasonLabel: (reason: string, lang: "en" | "ar") => string;
  reasonTitle?: (reason: string, lang: "en" | "ar") => string;
  lang: "en" | "ar";
}) {
  if (!reasons.length) return null;

  return (
    <div className="glass-cyber-card rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 dark:bg-amber-500/[0.08]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
          {lang === "ar" ? "إشارات سلوكية" : "Behavior flags"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {reasons.map((reason) => (
          <span
            key={reason}
            title={reasonTitle ? reasonTitle(reason, lang) : undefined}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-500/30 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm transition hover:border-amber-500/50"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <span className="truncate">{reasonLabel(reason, lang)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function EvidencePreviewGallery({
  urls,
  extraCount,
  lang,
  onOpen,
  onViewMore,
}: {
  urls: string[];
  extraCount: number;
  lang: "en" | "ar";
  onOpen: (index: number) => void;
  onViewMore: () => void;
}) {
  if (!urls.length) return null;

  const preview = urls.slice(0, 4);

  return (
    <div className="glass-cyber-card rounded-2xl p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-amber-700 dark:text-neon-blue" />
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {lang === "ar" ? "معاينة الأدلة" : "Evidence preview"}
          </span>
        </div>
        {extraCount > 0 ? (
          <button
            type="button"
            onClick={onViewMore}
            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 transition hover:bg-amber-100 dark:border-neon-blue/40 dark:bg-neon-blue/10 dark:text-neon-blue dark:hover:bg-neon-blue/20"
          >
            +{extraCount} {lang === "ar" ? "أدلة إضافية" : "more evidence"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {preview.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => onOpen(index)}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border/60 bg-background/50 shadow-inner transition hover:border-primary/40 dark:hover:border-neon-blue/40"
          >
            <img src={url} alt="" className="h-full w-full object-cover blur-sm transition duration-300 group-hover:blur-[2px]" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
              <Eye className="h-6 w-6 text-white" />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {lang === "ar"
          ? "المعاينات مشوشة للخصوصية؛ افتح الصورة لمراجعة الأدلة بوضوح."
          : "Thumbnails are softened for privacy—open to review evidence clearly."}
      </p>
    </div>
  );
}

export function SafetyBeforePayCard({ lang }: { lang: "en" | "ar" }) {
  const tips =
    lang === "ar"
      ? [
          "لا تدفع المبلغ كاملًا مقدمًا إن لم تكن متأكدًا من الطرف.",
          "فضّل وسيطًا موثوقًا أو دفعات مقسمة عند التعامل مع بائعين جدد.",
          "اقرأ أحدث البلاغات والأدلة قبل التحويل.",
          "تأكد من تفاصيل الدفع (الاسم، الرقم، المنصة) خارج المحادثة فقط.",
        ]
      : [
          "Avoid paying the full amount upfront unless the counterparty is well established.",
          "Prefer a trusted middleman or milestone payments with new sellers.",
          "Read the latest reports and screenshots before you transfer funds.",
          "Verify payment details (name, number, platform) through independent checks.",
        ];

  return (
    <div className="glass-cyber-card rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-50 via-transparent to-amber-100/60 p-4 md:p-5 dark:border-primary/25 dark:from-neon-blue/10 dark:to-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300 bg-amber-50 dark:border-neon-blue/35 dark:bg-neon-blue/10">
          <Sparkles className="h-5 w-5 text-amber-700 dark:text-neon-blue" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-foreground md:text-base">
            {lang === "ar" ? "قبل ما ترسل فلوس" : "Before you send money"}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {tips.map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ProfileCyberActionBar({
  lang,
  reportHref,
  shareExperienceHref,
  onCopyLink,
  copied,
  reportsAnchorId,
}: {
  lang: "en" | "ar";
  reportHref: string;
  shareExperienceHref: string;
  onCopyLink: () => void;
  copied: boolean;
  reportsAnchorId: string;
}) {
  const baseBtn =
    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wide transition sm:text-sm";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <a
        href={`#${reportsAnchorId}`}
        className={`${baseBtn} border-border/80 bg-background/70 text-foreground hover:border-primary/40 hover:bg-primary/10 dark:hover:border-neon-blue/40 dark:hover:bg-neon-blue/10`}
      >
        <Eye className="h-4 w-4 shrink-0" />
        {lang === "ar" ? "عرض البلاغات" : "View reports"}
      </a>
      <Link
        href={reportHref}
        className={`${baseBtn} border-red-500/35 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300`}
      >
        <ShieldAlert className="h-4 w-4 shrink-0" />
        {lang === "ar" ? "بلّغ عن نصب" : "Report scam"}
      </Link>
      <Link
        href={shareExperienceHref}
        className={`${baseBtn} border-primary/35 bg-primary/10 text-primary hover:bg-primary/18 dark:border-neon-blue/40 dark:bg-neon-blue/10 dark:text-neon-blue`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" />
        {lang === "ar" ? "شارك تجربتك" : "Share experience"}
      </Link>
      <button
        type="button"
        onClick={onCopyLink}
        className={`${baseBtn} border-border/80 bg-background/70 text-foreground hover:border-primary/40 dark:hover:border-neon-blue/40`}
      >
        {copied ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Copy className="h-4 w-4 shrink-0" />}
        {copied ? (lang === "ar" ? "تم النسخ" : "Copied") : lang === "ar" ? "نسخ الرابط" : "Copy page link"}
      </button>
    </div>
  );
}
