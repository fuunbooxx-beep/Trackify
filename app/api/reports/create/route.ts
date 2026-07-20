import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/auth-user";
import { sanitizeReportText, MAX_DESCRIPTION_LENGTH, normalizeTargetKey, normalizeReportText, simpleHash } from "@/lib/report-safety";
import { calculateTrustMetrics } from "@/lib/trust-metrics";

const ALLOWED_CATEGORIES = new Set(["scam", "delay", "bad_treatment", "suspicious_untrusted", "successful_transaction"]);

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const body = (await request.json()) as Record<string, unknown>;
    const targetName = String(body.targetName || "").trim().slice(0, 180);
    const description = sanitizeReportText(String(body.description || "")).slice(0, MAX_DESCRIPTION_LENGTH);
    const category = String(body.category || "scam");
    const targetNameKey = String(body.targetNameKey || normalizeTargetKey(targetName)).trim().slice(0, 220);
    if (!targetName || description.length < 8 || !ALLOWED_CATEGORIES.has(category) || !targetNameKey) {
      const fields = [
        !targetName ? "targetName" : null,
        description.length < 8 ? "description" : null,
        !ALLOWED_CATEGORIES.has(category) ? "category" : null,
        !targetNameKey ? "targetNameKey" : null,
      ].filter(Boolean);
      return NextResponse.json({ ok: false, error: "invalid_report", fields }, { status: 400 });
    }

    const authorId = data.user?.id || `guest_${crypto.randomUUID()}`;
    const adminDirect = Boolean(body.adminDirect) && data.user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
    const descriptionHash = String(body.descriptionHash || simpleHash(normalizeReportText(description))).slice(0, 128);
    const duplicate = await adminDb.collection("reports")
      .where("targetNameKey", "==", targetNameKey)
      .where("descriptionHash", "==", descriptionHash)
      .limit(1)
      .get();
    if (!duplicate.empty) return NextResponse.json({ ok: false, error: "duplicate_report" }, { status: 409 });

    const report = {
      targetId: String(body.targetId || "__pending__"),
      authorId,
      authorEmail: data.user?.email || "",
      reporterName: sanitizeReportText(String(body.reporterName || "Anonymous participant")).slice(0, 60),
      isAnonymousReporter: Boolean(body.isAnonymousReporter),
      isGuest: !data.user,
      targetName,
      targetNameKey,
      targetPhone: String(body.targetPhone || "").slice(0, 32),
      targetLink: String(body.targetLink || "").slice(0, 500),
      category,
      description,
      descriptionHash,
      evidenceImages: Array.isArray(body.evidenceImages) ? body.evidenceImages.filter((x): x is string => typeof x === "string").slice(0, 10) : [],
      evidenceTier: String(body.evidenceTier || "basic"),
      status: adminDirect ? "approved" : "pending",
      adminVerified: adminDirect,
      adminPinned: adminDirect,
      allowUserEdit: false,
      editRequestPending: false,
      reviewNote: "",
      source: Boolean(body.isAnonymousReporter) ? "user_anonymous" : "user",
      createdAt: Date.now(),
      createdAtServer: FieldValue.serverTimestamp(),
      reviewedAt: adminDirect ? Date.now() : 0,
    };
    const ref = await adminDb.collection("reports").add(report);
    if (data.user) await adminDb.collection("notifications").add({
      userId: data.user.id, reportId: ref.id, status: adminDirect ? "approved" : "pending",
      title: adminDirect ? "Report published" : "Report received for review",
      message: adminDirect ? "The report was published." : "Your report was received and will only affect the score after moderation.",
      read: false, createdAt: Date.now(),
    });
    if (!adminDirect) await adminDb.collection("notifications").add({
      userId: "admin_broadcast", audience: "admin", reportId: ref.id, status: "pending",
      title: "New report needs review", message: `Review the submitted report for ${targetName}.`, read: false, createdAt: Date.now(),
    });
    if (adminDirect && report.targetId !== "__pending__") {
      const targetId = report.targetId;
      const snapshot = await adminDb.collection("reports").where("targetId", "==", targetId).where("status", "==", "approved").get();
      const metrics = calculateTrustMetrics(snapshot.docs.map((doc) => doc.data()));
      await adminDb.collection("targets").doc(targetId).set({
        reportCount: metrics.reportCount, trustScore: metrics.trustScore, status: metrics.status,
        successRatio: metrics.stats.successRatio, lastScamAt: metrics.stats.lastScamAt,
        lastSuccessAt: metrics.stats.lastSuccessAt, updatedAt: Date.now(),
      }, { merge: true });
    }
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    console.error("[reports/create]", error);
    return NextResponse.json({ ok: false, error: "report_create_failed" }, { status: 500 });
  }
}
