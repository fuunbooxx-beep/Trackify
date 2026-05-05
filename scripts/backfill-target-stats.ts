import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { syncTargetStats } from "@/lib/trust-score";

async function main() {
  console.log("[backfill] Loading targets...");
  const snap = await getDocs(collection(db, "targets"));
  const ids = snap.docs.map((doc) => doc.id);
  console.log(`[backfill] Found ${ids.length} targets.`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    try {
      console.log(`[backfill] (${i + 1}/${ids.length}) Sync ${id}`);
      await syncTargetStats(db, id);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.error(`[backfill] Failed ${id}`, e);
    }
  }

  console.log(`[backfill] Done. ok=${ok}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

void main();

