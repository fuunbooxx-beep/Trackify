import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/firebase-admin";
import { ADMIN_EMAIL } from "@/lib/auth-user";
import { sanitizeReportText } from "@/lib/report-safety";

const ALLOWED_RESULTS = new Set(["safe", "scam", "insufficient"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const isAdmin = data.user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
    if (!data.user || !isAdmin) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = String(body.result || "");
    const adminComment = sanitizeReportText(String(body.adminComment || "")).slice(0, 800);
    const linkedTargetId = sanitizeReportText(String(body.linkedTargetId || "")).slice(0, 160);
    if (!ALLOWED_RESULTS.has(result) || adminComment.length < 3) {
      return NextResponse.json(
        { ok: false, error: "invalid_review", fields: ["result", "adminComment"] },
        { status: 400 }
      );
    }

    const requestRef = adminDb.collection("checkRequests").doc(id);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      return NextResponse.json({ ok: false, error: "request_not_found" }, { status: 404 });
    }
    const checkRequest = requestSnapshot.data() || {};
    if (checkRequest.status === "completed") {
      return NextResponse.json({ ok: false, error: "request_already_reviewed" }, { status: 409 });
    }

    const now = Date.now();
    await requestRef.update({
      status: "completed",
      result,
      adminComment,
      linkedTargetId,
      reviewedBy: data.user.id,
      reviewedAt: now,
      updatedAt: now,
    });

    if (checkRequest.userId) {
      const resultLabel =
        result === "safe" ? "appears safe" : result === "scam" ? "is high risk" : "needs more evidence";
      await adminDb.collection("notifications").add({
        userId: checkRequest.userId,
        checkRequestId: id,
        kind: "check_request_reviewed",
        status: "completed",
        title: "Your check result is ready",
        titleAr: "نتيجة الفحص جاهزة",
        message: `${checkRequest.pageName || checkRequest.pageLink || checkRequest.phone || "The requested page"} ${resultLabel}. Open your profile to see the review note.`,
        messageAr: `تمت مراجعة ${checkRequest.pageName || checkRequest.pageLink || checkRequest.phone || "الصفحة المطلوبة"}. افتح بروفايلك لمشاهدة النتيجة وتعليق المراجعة.`,
        read: false,
        createdAt: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/check-requests/review]", error);
    return NextResponse.json({ ok: false, error: "review_failed" }, { status: 500 });
  }
}
