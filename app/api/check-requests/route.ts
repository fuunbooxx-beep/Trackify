import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/firebase-admin";
import { sanitizeReportText } from "@/lib/report-safety";
import { detectExistingTargetMatch, isAuthoritativeTargetMatch } from "@/lib/target-linking";
import type { TargetRecord } from "@/lib/target-utils";

function clean(value: unknown, maxLength: number) {
  return sanitizeReportText(String(value || "")).slice(0, maxLength);
}

function serializeCheckRequest(id: string, record: Record<string, unknown>) {
  return {
    id,
    pageName: String(record.pageName || ""),
    pageLink: String(record.pageLink || ""),
    phone: String(record.phone || ""),
    customerNote: String(record.customerNote || ""),
    status: String(record.status || "pending"),
    result: String(record.result || ""),
    adminComment: String(record.adminComment || ""),
    linkedTargetId: String(record.linkedTargetId || ""),
    createdAt: Number(record.createdAt || 0),
    reviewedAt: Number(record.reviewedAt || 0),
  };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }
    const snapshot = await adminDb.collection("checkRequests").where("userId", "==", data.user.id).get();
    const requests = snapshot.docs
      .map((item) => serializeCheckRequest(item.id, item.data()))
      .sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    console.error("[check-requests/list]", error);
    return NextResponse.json({ ok: false, error: "check_requests_load_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const pageName = clean(body.pageName, 180);
    const pageLink = clean(body.pageLink, 500);
    const phone = clean(body.phone, 40);
    const customerNote = clean(body.customerNote, 600);

    if (!pageName && !pageLink && !phone) {
      return NextResponse.json(
        { ok: false, error: "identifier_required", fields: ["pageName", "pageLink", "phone"] },
        { status: 400 }
      );
    }

    const [targetsSnapshot, userRequestsSnapshot] = await Promise.all([
      adminDb.collection("targets").get(),
      adminDb.collection("checkRequests").where("userId", "==", data.user.id).get(),
    ]);

    const targets = targetsSnapshot.docs.map(
      (item) => ({ id: item.id, ...item.data() }) as TargetRecord
    );
    const match = detectExistingTargetMatch(
      { targetName: pageName, targetLink: pageLink, targetPhone: phone },
      targets
    );
    if (isAuthoritativeTargetMatch(match)) {
      return NextResponse.json(
        {
          ok: false,
          error: "target_exists",
          targetId: match.target.id,
          targetName: match.target.name,
        },
        { status: 409 }
      );
    }

    const normalizedIdentity = [pageName, pageLink, phone]
      .map((value) => value.trim().toLowerCase())
      .join("|");
    const duplicatePending = userRequestsSnapshot.docs.some((item) => {
      const record = item.data();
      return record.status === "pending" && record.normalizedIdentity === normalizedIdentity;
    });
    if (duplicatePending) {
      return NextResponse.json({ ok: false, error: "request_already_pending" }, { status: 409 });
    }

    const now = Date.now();
    const requestRef = await adminDb.collection("checkRequests").add({
      userId: data.user.id,
      userEmail: data.user.email || "",
      userName: clean(data.user.user_metadata?.full_name || data.user.user_metadata?.name, 100),
      pageName,
      pageLink,
      phone,
      customerNote,
      normalizedIdentity,
      status: "pending",
      result: "",
      adminComment: "",
      linkedTargetId: "",
      createdAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      reviewedAt: 0,
    });

    await Promise.all([
      adminDb.collection("notifications").add({
        userId: data.user.id,
        checkRequestId: requestRef.id,
        kind: "check_request_received",
        status: "pending",
        title: "Check request received",
        titleAr: "تم استلام طلب الفحص",
        message: "We received your request and will show the result in your profile after review.",
        messageAr: "استلمنا طلبك، وهتظهر النتيجة في بروفايلك بعد انتهاء المراجعة.",
        read: false,
        createdAt: now,
      }),
      adminDb.collection("notifications").add({
        userId: "admin_broadcast",
        audience: "admin",
        checkRequestId: requestRef.id,
        kind: "check_request_pending",
        status: "pending",
        title: "New Check it for me request",
        titleAr: "طلب Check it for me جديد",
        message: `A customer requested a review for ${pageName || pageLink || phone}.`,
        messageAr: `عميل طلب مراجعة ${pageName || pageLink || phone}.`,
        targetName: pageName,
        targetLink: pageLink,
        targetPhone: phone,
        read: false,
        createdAt: now,
      }),
    ]);

    return NextResponse.json({ ok: true, id: requestRef.id });
  } catch (error) {
    console.error("[check-requests/create]", error);
    return NextResponse.json({ ok: false, error: "check_request_failed" }, { status: 500 });
  }
}
