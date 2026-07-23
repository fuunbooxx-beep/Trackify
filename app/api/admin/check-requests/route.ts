import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/firebase-admin";
import { ADMIN_EMAIL } from "@/lib/auth-user";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const isAdmin = data.user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
    if (!data.user || !isAdmin) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const snapshot = await adminDb.collection("checkRequests").get();
    const requests = snapshot.docs
      .map((item) => {
        const record = item.data();
        return {
          id: item.id,
          userEmail: String(record.userEmail || ""),
          userName: String(record.userName || ""),
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
      })
      .sort((a, b) => {
        const pendingDifference = Number(a.status !== "pending") - Number(b.status !== "pending");
        return pendingDifference || b.createdAt - a.createdAt;
      });

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    console.error("[admin/check-requests/list]", error);
    return NextResponse.json({ ok: false, error: "check_requests_load_failed" }, { status: 500 });
  }
}
