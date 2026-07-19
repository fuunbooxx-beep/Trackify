import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireServerAdmin } from "@/lib/server-admin-auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireServerAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await context.params;
  const { ip } = (await request.json()) as { ip?: string };
  if (!id || !ip || ip.length > 64) return NextResponse.json({ ok: false, error: "invalid_ip" }, { status: 400 });
  await adminDb.collection("blockedIps").doc(id).set({ ip: ip.trim(), createdAt: Date.now() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireServerAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await context.params;
  await adminDb.collection("blockedIps").doc(id).delete();
  return NextResponse.json({ ok: true });
}
