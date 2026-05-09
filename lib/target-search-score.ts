import {
  evaluateTargetCategoryTextMatch,
  getTargetAliases,
  getTargetLinks,
  getTargetPhones,
  hostFromUrl,
  normalizePhone,
  normalizeTargetName,
  normalizeUrl,
  type TargetRecord,
} from "@/lib/target-utils";

function compactSearchText(value: string) {
  return normalizeTargetName(value).replace(/\s+/g, "");
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function fuzzyScore(queryText: string, candidateText: string) {
  if (!queryText || !candidateText) return 0;

  const queryCompact = compactSearchText(queryText);
  const candidateCompact = compactSearchText(candidateText);
  const queryWords = normalizeTargetName(queryText).split(/\s+/).filter(Boolean);
  const candidateWords = normalizeTargetName(candidateText).split(/\s+/).filter(Boolean);

  if (!queryCompact || !candidateCompact) return 0;
  if (candidateCompact === queryCompact) return 100;
  if (candidateCompact.startsWith(queryCompact)) return 96;
  if (candidateWords.some((word) => word.startsWith(queryCompact))) return 91;
  if (candidateCompact.includes(queryCompact)) return queryCompact.length === 1 ? 70 : 84;
  if (candidateWords.some((word) => word.includes(queryCompact))) return queryCompact.length === 1 ? 68 : 80;

  if (queryCompact.length < 3) return 0;

  let best = 0;
  const candidates = [candidateCompact, ...candidateWords];
  const queryPieces = [queryCompact, ...queryWords.filter((word) => word.length >= 3)];

  for (const piece of queryPieces) {
    for (const candidate of candidates) {
      if (candidate.length < 3) continue;
      const distance = levenshteinDistance(piece, candidate);
      const maxLength = Math.max(piece.length, candidate.length);
      const similarity = 1 - distance / maxLength;
      if (similarity >= 0.72) {
        best = Math.max(best, Math.round(similarity * 76));
      }
    }
  }

  return best;
}

export function scoreTarget(queryText: string, target: TargetRecord) {
  const normalizedQuery = normalizeTargetName(queryText);
  const compactQuery = compactSearchText(queryText);
  const phoneQuery = normalizePhone(queryText);
  const rawQuery = queryText.trim().toLowerCase();
  const looksLikeLink = /https?:\/\//i.test(rawQuery) || rawQuery.includes(".") || rawQuery.includes("/");
  const linkQuery = looksLikeLink ? normalizeUrl(queryText).toLowerCase() : "";
  const canSearchLinks = looksLikeLink || compactQuery.length >= 3;
  const terms = Array.isArray(target.searchTerms)
    ? target.searchTerms.filter((term) => {
        const value = String(term || "");
        if (canSearchLinks) return true;
        return !value.includes(".") && !/^https?:\/\//i.test(value);
      })
    : [];
  const phones = getTargetPhones(target);
  const links = getTargetLinks(target);

  let score = 0;
  score = Math.max(score, fuzzyScore(normalizedQuery, String(target.name || "")));
  for (const alias of getTargetAliases(target)) {
    score = Math.max(score, fuzzyScore(normalizedQuery, alias) - 2);
  }
  score = Math.max(score, fuzzyScore(normalizedQuery, String(target.type || "")) - 20);

  for (const term of terms) {
    score = Math.max(score, fuzzyScore(normalizedQuery, String(term)) - 4);
  }

  if (phoneQuery) {
    for (const phone of phones) {
      if (phone === phoneQuery) score = Math.max(score, 100);
      else if (phone.includes(phoneQuery)) score = Math.max(score, phoneQuery.length <= 2 ? 68 : 88);
    }
  }

  if (canSearchLinks && linkQuery) {
    for (const link of links) {
      const url = normalizeUrl(link.url).toLowerCase();
      const host = hostFromUrl(url).toLowerCase();
      if (url === linkQuery) score = Math.max(score, 100);
      else if (url.includes(linkQuery) || (compactQuery.length >= 3 && host.includes(normalizedQuery))) score = Math.max(score, 86);
    }
  }

  const categoryBoost = evaluateTargetCategoryTextMatch(queryText, target, fuzzyScore);
  if (categoryBoost > 0) score = Math.max(score, categoryBoost);

  return score;
}
