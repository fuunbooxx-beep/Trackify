import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/auth-user";
import { calculateTrustMetrics } from "@/lib/trust-metrics";
import { sanitizeReportText, MAX_DESCRIPTION_LENGTH } from "@/lib/report-safety";

async function sessionUser() {
  const supabase = await createSupabaseServerClient();
  return (await supabase.auth.getUser()).data.user || null;
}

async function resyncTarget(targetId: string) {
  if (!targetId || targetId === "__pending__") return;
  const snapshot = await adminDb.collection("reports").where("targetId", "==", targetId).where("status", "==", "approved").get();
  const metrics = calculateTrustMetrics(snapshot.docs.map((doc) => doc.data()));
  const now = Date.now();
  await adminDb.collection("targetStats").doc(targetId).set({ targetId, ...metrics.stats, trustScore: metrics.trustScore, status: metrics.status, updatedAt: now }, { merge: true });
  await adminDb.collection("targets").doc(targetId).set({ reportCount: metrics.reportCount, trustScore: metrics.trustScore,
    status: metrics.status, successRatio: metrics.stats.successRatio, lastScamAt: metrics.stats.lastScamAt,
    lastSuccessAt: metrics.stats.lastSuccessAt, updatedAt: now }, { merge: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await sessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const ref = adminDb.collection("reports").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const report = snapshot.data() || {};
    const isAdmin = user.email?.trim().toLowerCase() === ADMIN_EMAIL;
    const ownsReport = report.authorId === user.id;
    if (!isAdmin && !ownsReport) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    const canEditBody = isAdmin || report.allowUserEdit === true;
    if (canEditBody && typeof body.description === "string") patch.description = sanitizeReportText(body.description).slice(0, MAX_DESCRIPTION_LENGTH);
    if (canEditBody && typeof body.reporterName === "string") patch.reporterName = sanitizeReportText(body.reporterName).slice(0, 60);
    if (canEditBody && ["scam", "delay", "bad_treatment", "successful_transaction"].includes(String(body.category))) patch.category = body.category;
    if (canEditBody && Array.isArray(body.evidenceImages)) patch.evidenceImages = body.evidenceImages.filter((x): x is string => typeof x === "string").slice(0, 10);
    if (ownsReport && body.editRequestPending === true) patch.editRequestPending = true;
    if (isAdmin) {
      for (const key of ["status", "targetName", "adminComment", "adminVerified", "adminPinned", "allowUserEdit", "editRequestPending"]) {
        if (key in body) patch[key] = body[key];
      }
    }
    patch.updatedAt = Date.now();
    await ref.update(patch);
    if (ownsReport && body.editRequestPending === true) await adminDb.collection("notifications").add({
      userId: "admin_broadcast", audience: "admin", reportId: id, status: "edit_requested",
      title: "Report edit requested", message: "A user requested permission to edit a report.", read: false, createdAt: Date.now(),
    });
    if (isAdmin && body.allowUserEdit === true && report.authorId) await adminDb.collection("notifications").add({
      userId: report.authorId, reportId: id, status: "edit_permission_granted", title: "Edit permission granted",
      message: "Admin approved your request to edit this report.", read: false, createdAt: Date.now(),
    });
    await resyncTarget(String(report.targetId || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reports/patch]", error);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await sessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const ref = adminDb.collection("reports").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const report = snapshot.data() || {};
    const isAdmin = user.email?.trim().toLowerCase() === ADMIN_EMAIL;
    const isOwner = report.authorId === user.id && report.allowUserEdit === true;
    if (!isAdmin && !isOwner) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    await ref.delete();
    await resyncTarget(String(report.targetId || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reports/delete]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
}
