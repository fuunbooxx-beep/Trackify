import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireServerAdmin } from "@/lib/server-admin-auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireServerAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    if (!id || typeof payload.name !== "string" || !payload.name.trim()) {
      return NextResponse.json({ ok: false, error: "invalid_target" }, { status: 400 });
    }
    await adminDb.collection("targets").doc(id).set({ ...payload, updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[admin/targets/put]", error);
    return NextResponse.json({ ok: false, error: "target_save_failed" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireServerAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const { id } = await context.params;
    const batch = adminDb.batch();
    batch.delete(adminDb.collection("targets").doc(id));
    batch.delete(adminDb.collection("targetStats").doc(id));
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/targets/delete]", error);
    return NextResponse.json({ ok: false, error: "target_delete_failed" }, { status: 500 });
  }
}
