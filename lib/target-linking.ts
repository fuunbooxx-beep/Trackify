import { getTargetLinks, getTargetPhones, normalizePhone, normalizeTargetName, normalizeUrl, type TargetRecord } from "@/lib/target-utils";

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

function nameSimilarity(a: string, b: string) {
  const x = normalizeTargetName(a);
  const y = normalizeTargetName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const distance = levenshteinDistance(x, y);
  const maxLen = Math.max(x.length, y.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

export type MatchReason = "phone" | "link" | "name";

export function detectExistingTargetMatch(
  report: { targetName?: string; targetPhone?: string; targetLink?: string },
  pool: TargetRecord[]
): { target?: TargetRecord; score: number; reason?: MatchReason } {
  const candidateName = String(report.targetName || "").trim();
  const candidatePhone = normalizePhone(String(report.targetPhone || ""));
  const candidateLink = normalizeUrl(String(report.targetLink || "")).toLowerCase();
  if (!candidateName && !candidatePhone && !candidateLink) return { score: 0 };

  let bestTarget: TargetRecord | undefined;
  let bestScore = 0;
  let reason: MatchReason | undefined;

  for (const item of pool) {
    const targetPhones = getTargetPhones(item).map((phone) => normalizePhone(phone));
    const targetLinks = getTargetLinks(item).map((link) => normalizeUrl(link.url).toLowerCase());

    if (candidatePhone && targetPhones.includes(candidatePhone)) {
      return { target: item, score: 1, reason: "phone" };
    }
    if (candidateLink && targetLinks.includes(candidateLink)) {
      return { target: item, score: 1, reason: "link" };
    }

    const similarity = nameSimilarity(candidateName, String(item.name || ""));
    if (similarity > bestScore) {
      bestScore = similarity;
      bestTarget = item;
      reason = "name";
    }
  }

  return { target: bestTarget, score: bestScore, reason };
}
