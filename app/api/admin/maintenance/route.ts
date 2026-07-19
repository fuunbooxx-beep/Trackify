import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireServerAdmin } from "@/lib/server-admin-auth";
import { calculateTrustMetrics } from "@/lib/trust-metrics";
import { generateSearchTerms, getTargetLinks, getTargetPhones, type TargetRecord } from "@/lib/target-utils";

async function syncOne(targetId: string) {
  const reports = await adminDb.collection("reports").where("targetId", "==", targetId).where("status", "==", "approved").get();
  const metrics = calculateTrustMetrics(reports.docs.map((doc) => doc.data()));
  const now = Date.now();
  await adminDb.collection("targetStats").doc(targetId).set({ targetId, ...metrics.stats, trustScore: metrics.trustScore, status: metrics.status, updatedAt: now }, { merge: true });
  await adminDb.collection("targets").doc(targetId).set({ reportCount: metrics.reportCount, trustScore: metrics.trustScore, status: metrics.status,
    successRatio: metrics.stats.successRatio, lastScamAt: metrics.stats.lastScamAt, lastSuccessAt: metrics.stats.lastSuccessAt, updatedAt: now }, { merge: true });
}

export async function POST(request: Request) {
  try {
    const admin = await requireServerAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "sync_all") {
      const targets = await adminDb.collection("targets").get();
      for (const target of targets.docs) await syncOne(target.id);
      return NextResponse.json({ ok: true, count: targets.size });
    }
    if (body.action !== "merge") return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
    const canonicalId = String(body.canonicalId || "").trim();
    const duplicateId = String(body.duplicateId || "").trim();
    if (!canonicalId || !duplicateId || canonicalId === duplicateId) return NextResponse.json({ ok: false, error: "invalid_targets" }, { status: 400 });
    const [canonicalSnap, duplicateSnap] = await Promise.all([
      adminDb.collection("targets").doc(canonicalId).get(), adminDb.collection("targets").doc(duplicateId).get(),
    ]);
    if (!canonicalSnap.exists || !duplicateSnap.exists) return NextResponse.json({ ok: false, error: "target_not_found" }, { status: 404 });
    const canonical = { id: canonicalId, ...canonicalSnap.data() } as TargetRecord;
    const duplicate = { id: duplicateId, ...duplicateSnap.data() } as TargetRecord;
    const phones = Array.from(new Set([...getTargetPhones(canonical), ...getTargetPhones(duplicate)]));
    const links = Array.from(new Map([...getTargetLinks(canonical), ...getTargetLinks(duplicate)].map((item) => [item.url, item])).values());
    const reports = await adminDb.collection("reports").where("targetId", "==", duplicateId).get();
    for (let i = 0; i < reports.docs.length; i += 400) {
      const batch = adminDb.batch();
      for (const report of reports.docs.slice(i, i + 400)) batch.update(report.ref, { targetId: canonicalId, mergedFromTargetId: duplicateId, mergeUpdatedAt: Date.now() });
      await batch.commit();
    }
    await adminDb.collection("targets").doc(canonicalId).set({ phones, phone: phones[0] || "", links, link: links[0]?.url || "",
      aliases: Array.from(new Set([...(canonical.aliases || []), String(duplicate.name || "")].filter(Boolean))),
      searchTerms: generateSearchTerms(String(canonical.name || duplicate.name || ""), phones, links), updatedAt: Date.now() }, { merge: true });
    await Promise.all([adminDb.collection("targets").doc(duplicateId).delete(), adminDb.collection("targetStats").doc(duplicateId).delete()]);
    await adminDb.collection("mergeAudit").add({ canonicalId, duplicateId, reportsMoved: reports.size, actorId: admin.id, createdAt: Date.now() });
    await syncOne(canonicalId);
    return NextResponse.json({ ok: true, reportsMoved: reports.size });
  } catch (error) {
    console.error("[admin/maintenance]", error);
    return NextResponse.json({ ok: false, error: "maintenance_failed" }, { status: 500 });
  }
}
