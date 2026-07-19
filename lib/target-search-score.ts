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
  const identityNames = [String(target.name || ""), ...getTargetAliases(target)];
  const queryWords = normalizeTargetName(queryText).split(/\s+/).filter((word) => word.length >= 2);
  for (const identity of identityNames) {
    const identityNormalized = normalizeTargetName(identity);
    const identityWords = identityNormalized.split(/\s+/).filter(Boolean);
    const everyWordMatches = queryWords.length > 1 && queryWords.every((word) =>
      identityWords.some((candidateWord) => candidateWord === word || candidateWord.startsWith(word) || word.startsWith(candidateWord))
    );
    if (everyWordMatches) score = Math.max(score, 94);
    // Fuzzy matching is intentionally limited to the full identity. This
    // prevents generic words such as "store" from returning unrelated pages.
    const identityScore = fuzzyScore(normalizedQuery, identity);
    if ((queryWords.length <= 1 || everyWordMatches) && identityScore >= 76) score = Math.max(score, identityScore);
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

  return score;
}

export function getTargetMatchReasons(queryText: string, target: TargetRecord) {
  const reasons: string[] = [];
  const normalized = normalizeTargetName(queryText);
  const names = [String(target.name || ""), ...getTargetAliases(target)].map(normalizeTargetName);
  if (names.some((name) => name === normalized)) reasons.push("exact_name");
  else if (names.some((name) => {
    const queryWords = normalized.split(/\s+/).filter(Boolean);
    const candidateWords = name.split(/\s+/).filter(Boolean);
    return queryWords.length > 1 && queryWords.every((word) => candidateWords.some((candidate) => candidate === word || candidate.startsWith(word) || word.startsWith(candidate)));
  })) reasons.push("name_words");
  const phone = normalizePhone(queryText);
  if (phone && getTargetPhones(target).some((item) => normalizePhone(item) === phone)) reasons.push("phone");
  const raw = queryText.trim().toLowerCase();
  if (/https?:\/\//i.test(raw) || raw.includes(".")) {
    const url = normalizeUrl(queryText).toLowerCase();
    if (getTargetLinks(target).some((item) => normalizeUrl(item.url).toLowerCase() === url)) reasons.push("link");
  }
  if (!reasons.length) reasons.push("close_name");
  return reasons;
}
