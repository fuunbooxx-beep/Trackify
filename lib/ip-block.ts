/** Firestore document id for blockedIps — must match middleware REST lookup. */
export function clientIpToBlockedDocId(ip: string) {
  const t = ip.trim();
  if (!t) return "unknown";
  return t.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 200);
}
