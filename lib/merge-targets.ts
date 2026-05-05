import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  detectPlatform,
  generateSearchTerms,
  getTargetLinks,
  getTargetPhones,
  normalizePhone,
  normalizeUrl,
  type TargetLink,
  type TargetRecord,
} from "@/lib/target-utils";
import { syncTargetStats } from "@/lib/trust-score";

const BATCH_SIZE = 400;

function mergeIdentity(canonical: TargetRecord, duplicate: TargetRecord): Omit<TargetRecord, "id"> {
  const phones = Array.from(new Set([...getTargetPhones(canonical), ...getTargetPhones(duplicate)]));
  const linkList: TargetLink[] = [];
  const seenUrl = new Set<string>();
  for (const item of [...getTargetLinks(canonical), ...getTargetLinks(duplicate)]) {
    const u = normalizeUrl(item.url);
    if (!u || seenUrl.has(u)) continue;
    seenUrl.add(u);
    linkList.push({ platform: item.platform || detectPlatform(u), url: u });
  }
  const nameCanon = String(canonical.name || "").trim();
  const nameDup = String(duplicate.name || "").trim();
  const name = nameCanon.length >= nameDup.length ? nameCanon || nameDup : nameDup || nameCanon;
  const logoUrl = canonical.logoUrl || duplicate.logoUrl || null;
  const type = (canonical.type || duplicate.type || "page").trim().toLowerCase() || "page";
  const claimed =
    canonical.claimedByUserId && String(canonical.claimedByUserId).trim()
      ? canonical.claimedByUserId
      : duplicate.claimedByUserId && String(duplicate.claimedByUserId).trim()
        ? duplicate.claimedByUserId
        : null;
  const createdAt = Math.min(
    Number(canonical.createdAt || Date.now()),
    Number(duplicate.createdAt || Date.now())
  );
  const now = Date.now();
  const phone = phones[0] ? normalizePhone(phones[0]) : "";
  const link = linkList[0]?.url || "";
  return {
    name,
    type,
    phone,
    phones,
    link,
    links: linkList,
    logoUrl,
    claimedByUserId: claimed,
    searchTerms: generateSearchTerms(name, phones, linkList),
    createdAt,
    updatedAt: now,
  };
}

export type MergeTargetsResult = {
  reportsMoved: number;
  canonicalId: string;
  duplicateId: string;
};

/**
 * Moves all reports from duplicate → canonical, merges target identity onto canonical,
 * deletes duplicate target (+ stats), writes audit row, recalculates canonical stats.
 */
export async function mergeDuplicateTargetIntoCanonical(
  db: Firestore,
  canonicalId: string,
  duplicateId: string,
  options?: { actorId?: string }
): Promise<MergeTargetsResult> {
  const cId = canonicalId.trim();
  const dId = duplicateId.trim();
  if (!cId || !dId || cId === dId) {
    throw new Error("merge: canonical and duplicate must be distinct non-empty ids");
  }

  const [canSnap, dupSnap] = await Promise.all([getDoc(doc(db, "targets", cId)), getDoc(doc(db, "targets", dId))]);
  if (!canSnap.exists()) throw new Error("merge: canonical target not found");
  if (!dupSnap.exists()) throw new Error("merge: duplicate target not found");

  const canonical = { id: cId, ...canSnap.data() } as TargetRecord;
  const duplicate = { id: dId, ...dupSnap.data() } as TargetRecord;

  const dupReportsSnap = await getDocs(query(collection(db, "reports"), where("targetId", "==", dId)));
  const reportDocs = dupReportsSnap.docs;
  const reportIds: string[] = [];

  for (let i = 0; i < reportDocs.length; i += BATCH_SIZE) {
    const chunk = reportDocs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const d of chunk) {
      reportIds.push(d.id);
      batch.update(doc(db, "reports", d.id), {
        targetId: cId,
        mergedFromTargetId: dId,
        mergeUpdatedAt: Date.now(),
      });
    }
    await batch.commit();
  }

  const merged = mergeIdentity(canonical, duplicate);
  await setDoc(doc(db, "targets", cId), merged, { merge: true });

  await deleteDoc(doc(db, "targets", dId));
  const dupStatsRef = doc(db, "targetStats", dId);
  const dupStatsSnap = await getDoc(dupStatsRef);
  if (dupStatsSnap.exists()) {
    await deleteDoc(dupStatsRef);
  }

  const auditId = `merge_${cId}_${dId}_${Date.now()}`;
  await setDoc(doc(db, "mergeAudit", auditId), {
    canonicalId: cId,
    duplicateId: dId,
    reportsMoved: reportDocs.length,
    reportIds,
    actorId: options?.actorId || null,
    createdAt: Date.now(),
  });

  await syncTargetStats(db, cId);

  return { reportsMoved: reportDocs.length, canonicalId: cId, duplicateId: dId };
}
