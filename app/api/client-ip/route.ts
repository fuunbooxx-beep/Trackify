import { NextRequest, NextResponse } from "next/server";

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";
  return req.headers.get("x-real-ip")?.trim() ?? "";
}

/** Returns client IP for visit logging (browser writes to Firestore; avoids Node gRPC issues). */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req).slice(0, 64);
  return NextResponse.json({ ip: ip || null });
}
