import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServerAdmin } from "@/lib/server-admin-auth";

export async function GET() {
  if (!(await requireServerAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const [logs, blocked] = await Promise.all([
    adminDb.collection("visitorLogs").orderBy("createdAt", "desc").limit(400).get(),
    adminDb.collection("blockedIps").get(),
  ]);
  return NextResponse.json({ ok: true,
    logs: logs.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    blocked: blocked.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const path = String(body.path || "").slice(0, 512);
    if (!path || path.startsWith("/api")) return NextResponse.json({ ok: false, error: "invalid_path" }, { status: 400 });
    const user = (await createSupabaseServerClient()).auth.getUser();
    const session = (await user).data.user;
    const headers = request.headers;
    const forwarded = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "";
    const clientIp = forwarded.split(",")[0]?.trim().slice(0, 64) || null;
    let geo: { city?: string; country?: string; region?: string } = {};
    if (clientIp && !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(clientIp)) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(clientIp)}/json/`, { signal: AbortSignal.timeout(1200), cache: "no-store" });
        if (geoRes.ok) {
          const value = (await geoRes.json()) as { city?: string; country_name?: string; region?: string };
          geo = { city: value.city?.slice(0, 100), country: value.country_name?.slice(0, 100), region: value.region?.slice(0, 100) };
        }
      } catch { /* geo is best effort; do not block visit logging */ }
    }
    await adminDb.collection("visitorLogs").add({ path, email: session?.email || null, userId: session?.id || null,
      clientIp, ...geo, userAgent: String(body.userAgent || "").slice(0, 512) || null, createdAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false, error: "visit_log_failed" }, { status: 500 }); }
}
