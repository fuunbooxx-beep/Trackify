import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/auth-user";
import { calculateTrustMetrics } from "@/lib/trust-metrics";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.trim().toLowerCase() === ADMIN_EMAIL ? data.user : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    const reportRef = adminDb.collection("reports").doc(id);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) return NextResponse.json({ ok: false, error: "report_not_found" }, { status: 404 });
    const report = reportSnap.data() || {};
    const now = Date.now();

    if (action === "reject") {
      await reportRef.update({ status: "rejected", reviewedAt: now });
      if (report.authorId) await adminDb.collection("notifications").add({
        userId: report.authorId, reportId: id, status: "rejected", title: "Report rejected",
        message: "Your report was reviewed and rejected.", read: false, createdAt: now,
      });
      return NextResponse.json({ ok: true });
    }

    if (action !== "approve") return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
    const targetId = String(body.targetId || "").trim();
    const targetPayload = body.targetPayload;
    if (!targetId || !targetPayload || typeof targetPayload !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_target" }, { status: 400 });
    }

    await adminDb.collection("targets").doc(targetId).set(targetPayload as Record<string, unknown>, { merge: true });
    await reportRef.update({
      status: "approved", targetId, allowUserEdit: Boolean(body.allowUserEdit), editRequestPending: false,
      adminComment: String(body.adminComment || "").slice(0, 1000), adminVerified: Boolean(body.adminVerified),
      adminPinned: Boolean(body.adminPinned), evidenceTier: String(body.evidenceTier || "basic"), reviewedAt: now,
    });

    const approvedSnap = await adminDb.collection("reports").where("targetId", "==", targetId).where("status", "==", "approved").get();
    const metrics = calculateTrustMetrics(approvedSnap.docs.map((doc) => doc.data()));
    await adminDb.collection("targetStats").doc(targetId).set({ targetId, ...metrics.stats, trustScore: metrics.trustScore, status: metrics.status, updatedAt: now }, { merge: true });
    await adminDb.collection("targets").doc(targetId).update({
      reportCount: metrics.reportCount, trustScore: metrics.trustScore, status: metrics.status,
      successRatio: metrics.stats.successRatio, lastScamAt: metrics.stats.lastScamAt,
      lastSuccessAt: metrics.stats.lastSuccessAt, updatedAt: now,
    });
    if (report.authorId) await adminDb.collection("notifications").add({
      userId: report.authorId, reportId: id, status: "approved", title: "Report approved",
      message: "Your report has been approved and added to the target records.", read: false, createdAt: now,
    });
    return NextResponse.json({ ok: true, targetId });
  } catch (error) {
    console.error("[admin/reports/review]", error);
    return NextResponse.json({ ok: false, error: "review_failed" }, { status: 500 });
  }
}
