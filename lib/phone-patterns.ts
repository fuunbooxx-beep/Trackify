import { getTargetPhones, normalizePhone, type TargetRecord } from "@/lib/target-utils";

export type PhoneCluster = {
  phone: string;
  targetIds: string[];
  count: number;
};

/**
 * Find phone numbers that appear on more than one target (possible duplicates / sock puppets).
 */
export function findSharedPhoneClusters(targets: (TargetRecord & { id?: string })[]): PhoneCluster[] {
  const phoneToIds = new Map<string, Set<string>>();
  for (const t of targets) {
    const id = String(t.id || "").trim();
    if (!id) continue;
    for (const raw of getTargetPhones(t)) {
      const p = normalizePhone(raw);
      if (!p || p.length < 6) continue;
      if (!phoneToIds.has(p)) phoneToIds.set(p, new Set());
      phoneToIds.get(p)!.add(id);
    }
  }
  const out: PhoneCluster[] = [];
  for (const [phone, idSet] of phoneToIds) {
    if (idSet.size <= 1) continue;
    const targetIds = Array.from(idSet);
    out.push({ phone, targetIds, count: targetIds.length });
  }
  return out.sort((a, b) => b.count - a.count || b.targetIds.length - a.targetIds.length);
}
