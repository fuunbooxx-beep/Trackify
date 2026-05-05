import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from "firebase/firestore";
import { type EvidenceTier, evidenceTierMultiplier, classifyEvidenceTier } from "@/lib/evidence-classify";
import { TargetStatsRecord, getRiskStatusFromReportCount } from "@/lib/target-utils";

type ReportCategory = "scam" | "delay" | "bad_treatment" | "successful_transaction" | string;

type ReportForScore = {
  category?: ReportCategory;
  createdAt?: number;
  evidenceImages?: string[];
  description?: string;
  evidenceTier?: EvidenceTier;
  adminVerified?: boolean;
  status?: string;
};

function recencyWeight(createdAt?: number) {
  if (!createdAt) return 0.75;
  const ageDays = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60 * 24));
  if (ageDays <= 14) return 1;
  if (ageDays <= 60) return 0.85;
  if (ageDays <= 180) return 0.65;
  return 0.5;
}

function evidenceWeight(report: ReportForScore) {
  const imageCount = Array.isArray(report.evidenceImages) ? report.evidenceImages.length : 0;
  const tier =
    report.evidenceTier ||
    classifyEvidenceTier(imageCount, String(report.description || ""));
  const tierMult = evidenceTierMultiplier(tier);
  const imageBoost = Math.min(0.2, imageCount * 0.04);
  const verifiedBoost = report.adminVerified ? 0.2 : 0;
  return tierMult + imageBoost + verifiedBoost;
}

function reportImpact(report: ReportForScore) {
  const baseByCategory: Record<string, number> = {
    scam: -18,
    delay: -8,
    bad_treatment: -6,
    successful_transaction: 12,
  };
  const base = baseByCategory[String(report.category || "")] ?? -7;
  return base * recencyWeight(report.createdAt) * evidenceWeight(report);
}

function maxCreatedAt(reports: ReportForScore[], predicate: (r: ReportForScore) => boolean) {
  return reports.filter(predicate).reduce((max, item) => Math.max(max, Number(item.createdAt || 0)), 0);
}

export function calculateTrustMetrics(reports: ReportForScore[]) {
  const approved = reports.filter((item) => item.status === "approved");
  const approvedReports = approved.length;

  if (approvedReports === 0) {
    return {
      trustScore: 50,
      status: "no_data" as const,
      reportCount: 0,
      stats: {
        approvedReports: 0,
        scamReports: 0,
        successReports: 0,
        delayReports: 0,
        badTreatmentReports: 0,
        verifiedReports: 0,
        evidenceStrongReports: 0,
        lastReportAt: 0,
        lastScamAt: 0,
        lastSuccessAt: 0,
        successRatio: 0,
      },
    };
  }

  const scamReports = approved.filter((item) => item.category === "scam").length;
  const successReports = approved.filter((item) => item.category === "successful_transaction").length;
  const delayReports = approved.filter((item) => item.category === "delay").length;
  const badTreatmentReports = approved.filter((item) => item.category === "bad_treatment").length;
  const verifiedReports = approved.filter((item) => item.adminVerified).length;
  const evidenceStrongReports = approved.filter((item) => {
    const tier =
      item.evidenceTier || classifyEvidenceTier((item.evidenceImages || []).length, String(item.description || ""));
    return tier === "strong" || tier === "strong_plus" || (item.evidenceImages || []).length >= 3;
  }).length;
  const lastReportAt = approved.reduce((max, item) => Math.max(max, Number(item.createdAt || 0)), 0);
  const lastScamAt = maxCreatedAt(approved, (r) => r.category === "scam");
  const lastSuccessAt = maxCreatedAt(approved, (r) => r.category === "successful_transaction");
  const successRatio = successReports / approvedReports;

  const scoreDelta = approved.reduce((sum, item) => sum + reportImpact(item), 0);
  const base = 60;
  const normalizedScore = Math.round(Math.max(0, Math.min(100, base + scoreDelta)));
  const status = getRiskStatusFromReportCount(scamReports, normalizedScore >= 70 ? "trusted" : "reviewing");

  return {
    trustScore: normalizedScore,
    status,
    reportCount: approvedReports,
    stats: {
      approvedReports,
      scamReports,
      successReports,
      delayReports,
      badTreatmentReports,
      verifiedReports,
      evidenceStrongReports,
      lastReportAt,
      lastScamAt,
      lastSuccessAt,
      successRatio,
    },
  };
}

export async function syncTargetStats(db: Firestore, targetId: string) {
  const reportsSnap = await getDocs(query(collection(db, "reports"), where("targetId", "==", targetId)));
  const reports = reportsSnap.docs.map((item) => item.data() as ReportForScore);
  const metrics = calculateTrustMetrics(reports);
  const now = Date.now();

  const statsPayload: TargetStatsRecord = {
    targetId,
    ...metrics.stats,
    trustScore: metrics.trustScore,
    status: metrics.status,
    updatedAt: now,
  };

  const targetRef = doc(db, "targets", targetId);
  const existingSnap = await getDoc(targetRef);

  await setDoc(doc(db, "targetStats", targetId), statsPayload, { merge: true });

  const patch: Record<string, unknown> = {
    reportCount: metrics.reportCount,
    trustScore: metrics.trustScore,
    status: metrics.status,
    successRatio: statsPayload.successRatio,
    lastScamAt: statsPayload.lastScamAt,
    lastSuccessAt: statsPayload.lastSuccessAt,
    updatedAt: now,
  };

  if (existingSnap.exists()) {
    await updateDoc(targetRef, patch);
  }
}
