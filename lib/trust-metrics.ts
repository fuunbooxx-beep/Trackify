import { type EvidenceTier, evidenceTierMultiplier, classifyEvidenceTier } from "@/lib/evidence-classify";
import { getRiskStatusFromReportCount } from "@/lib/target-utils";

export type ReportForScore = {
  category?: string; createdAt?: number; evidenceImages?: string[]; description?: string;
  evidenceTier?: EvidenceTier; adminVerified?: boolean; status?: string;
};

function recencyWeight(createdAt?: number) {
  if (!createdAt) return 0.75;
  const ageDays = Math.max(0, (Date.now() - createdAt) / 86_400_000);
  if (ageDays <= 14) return 1;
  if (ageDays <= 60) return 0.85;
  if (ageDays <= 180) return 0.65;
  return 0.5;
}

function evidenceWeight(report: ReportForScore) {
  const imageCount = report.evidenceImages?.length || 0;
  const tier = report.evidenceTier || classifyEvidenceTier(imageCount, String(report.description || ""));
  return evidenceTierMultiplier(tier) + Math.min(0.2, imageCount * 0.04) + (report.adminVerified ? 0.2 : 0);
}

function reportImpact(report: ReportForScore) {
  const base: Record<string, number> = { scam: -18, delay: -8, bad_treatment: -6, successful_transaction: 12 };
  return (base[String(report.category || "")] ?? -7) * recencyWeight(report.createdAt) * evidenceWeight(report);
}

export function calculateTrustMetrics(reports: ReportForScore[]) {
  const approved = reports.filter((item) => item.status === "approved");
  if (!approved.length) return {
    trustScore: 0, status: "no_data" as const, reportCount: 0,
    stats: { approvedReports: 0, scamReports: 0, successReports: 0, delayReports: 0, badTreatmentReports: 0,
      verifiedReports: 0, evidenceStrongReports: 0, lastReportAt: 0, lastScamAt: 0, lastSuccessAt: 0, successRatio: 0 },
  };
  const count = (category: string) => approved.filter((item) => item.category === category).length;
  const latest = (category?: string) => approved.filter((item) => !category || item.category === category)
    .reduce((max, item) => Math.max(max, Number(item.createdAt || 0)), 0);
  const scamReports = count("scam");
  const successReports = count("successful_transaction");
  const score = Math.round(Math.max(0, Math.min(100, 60 + approved.reduce((sum, item) => sum + reportImpact(item), 0))));
  return {
    trustScore: score,
    status: getRiskStatusFromReportCount(scamReports, score >= 70 ? "trusted" : "reviewing"),
    reportCount: approved.length,
    stats: {
      approvedReports: approved.length, scamReports, successReports, delayReports: count("delay"),
      badTreatmentReports: count("bad_treatment"), verifiedReports: approved.filter((item) => item.adminVerified).length,
      evidenceStrongReports: approved.filter((item) => {
        const tier = item.evidenceTier || classifyEvidenceTier(item.evidenceImages?.length || 0, String(item.description || ""));
        return tier === "strong" || tier === "strong_plus" || (item.evidenceImages?.length || 0) >= 3;
      }).length,
      lastReportAt: latest(), lastScamAt: latest("scam"), lastSuccessAt: latest("successful_transaction"),
      successRatio: successReports / approved.length,
    },
  };
}
