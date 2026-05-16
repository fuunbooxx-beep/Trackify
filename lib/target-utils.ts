export type TargetLink = {
  platform: string;
  url: string;
};

export type TargetReasonOption = {
  value: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
};

export type TargetCategoryOption = {
  value: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
};

export type TargetRecord = {
  id?: string;
  name?: string;
  /** Also displayed as "Known aliases" */
  aliases?: string[];
  previousNames?: string[];
  linkedIdentities?: string[];
  type?: string;
  phone?: string;
  phones?: string[];
  instapay?: string;
  instapays?: string[];
  link?: string;
  links?: TargetLink[];
  logoUrl?: string | null;
  status?: "trusted" | "warning" | "severe_warning" | "high_risk" | "reviewing" | "no_data" | string;
  trustScore?: number;
  reportCount?: number;
  reasons?: string[];
  category?: string;
  /** 0–1 share of approved reports marked successful_transaction */
  successRatio?: number;
  lastScamAt?: number;
  lastSuccessAt?: number;
  claimedByUserId?: string | null;
  searchTerms?: string[];
  about?: {
    title?: string;
    description?: string;
    evidenceImages?: string[];
    addedBy?: "admins" | "moderators" | string;
    updatedAt?: number;
  };
  createdAt?: number;
  updatedAt?: number;
};

export const TARGET_CATEGORY_OPTIONS: TargetCategoryOption[] = [
  {
    value: "gaming",
    labelEn: "Gaming",
    labelAr: "الألعاب",
    descriptionEn: "Game stores, top-ups, virtual items, and gaming services.",
    descriptionAr: "متاجر الألعاب، الشحن، العناصر الرقمية، وخدمات الجيمنج.",
  },
  {
    value: "social_media",
    labelEn: "Social Media",
    labelAr: "السوشيال ميديا",
    descriptionEn: "Pages focused on social media growth, content, or engagement services.",
    descriptionAr: "صفحات خاصة بالنمو على السوشيال ميديا أو خدمات المحتوى والتفاعل.",
  },
  {
    value: "subscriptions",
    labelEn: "Subscriptions",
    labelAr: "الاشتراكات",
    descriptionEn: "Streaming, software licenses, and recurring digital subscriptions.",
    descriptionAr: "اشتراكات المنصات، البرامج، والخدمات الرقمية المتكررة.",
  },
  {
    value: "models_clothes",
    labelEn: "Models / Clothes",
    labelAr: "موديلز / ملابس",
    descriptionEn: "Fashion pages, clothing sellers, and model-related stores.",
    descriptionAr: "صفحات الموضة، بائعي الملابس، والمتاجر المرتبطة بالموديلز.",
  },
  {
    value: "marketing",
    labelEn: "Marketing",
    labelAr: "ماركتنج",
    descriptionEn: "Marketing agencies, ad services, media buying, and promotional pages.",
    descriptionAr: "وكالات التسويق، خدمات الإعلانات، شراء الميديا، والصفحات الترويجية.",
  },
  {
    value: "food",
    labelEn: "Food",
    labelAr: "أكل",
    descriptionEn: "Food stores, restaurants, delivery pages, and kitchen businesses.",
    descriptionAr: "متاجر الأكل، المطاعم، صفحات الدليفري، ومشاريع المأكولات.",
  },
  {
    value: "furniture",
    labelEn: "Furniture",
    labelAr: "الأثاث",
    descriptionEn: "Furniture stores, home decor sellers, and wood or upholstery businesses.",
    descriptionAr: "متاجر الأثاث، بائعي الديكور المنزلي، ومشاريع الخشب والتنجيد.",
  },
];

export type TargetStatsRecord = {
  targetId: string;
  approvedReports: number;
  scamReports: number;
  successReports: number;
  delayReports: number;
  badTreatmentReports: number;
  verifiedReports: number;
  evidenceStrongReports: number;
  lastReportAt: number;
  /** Max createdAt among approved scam-category reports */
  lastScamAt: number;
  /** Max createdAt among approved successful_transaction reports */
  lastSuccessAt: number;
  /** successReports / approvedReports (0 if none) */
  successRatio: number;
  trustScore: number;
  status: TargetRecord["status"];
  updatedAt: number;
};

export const TARGET_REASON_OPTIONS: TargetReasonOption[] = [
  {
    value: "scam",
    labelEn: "SCAM",
    labelAr: "\u0646\u0635\u0628",
    descriptionEn: "Reports mention scam behavior, unpaid deals, or missing delivery.",
    descriptionAr: "\u0628\u0644\u0627\u063a\u0627\u062a \u0639\u0646 \u0646\u0635\u0628 \u0623\u0648 \u0639\u062f\u0645 \u062a\u0633\u0644\u064a\u0645 \u0623\u0648 \u062a\u0639\u0627\u0645\u0644 \u063a\u064a\u0631 \u0622\u0645\u0646.",
  },
  {
    value: "fake_followers",
    labelEn: "FAKE FOLLOWERS",
    labelAr: "\u0645\u062a\u0627\u0628\u0639\u064a\u0646 \u0648\u0647\u0645\u064a\u064a\u0646",
    descriptionEn: "Audience or engagement may be inflated with fake followers.",
    descriptionAr: "\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u064a\u0646 \u0623\u0648 \u0627\u0644\u062a\u0641\u0627\u0639\u0644 \u0642\u062f \u064a\u0643\u0648\u0646 \u0648\u0647\u0645\u064a\u0627.",
  },
  {
    value: "angry_reacts",
    labelEn: "NEGATIVE FEEDBACK",
    labelAr: "\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0633\u0644\u0628\u064a\u0629",
    descriptionEn: "The page has visible angry reactions or repeated negative reactions.",
    descriptionAr: "\u064a\u0648\u062c\u062f \u062a\u0641\u0627\u0639\u0644 \u063a\u0636\u0628 \u0623\u0648 \u062a\u0641\u0627\u0639\u0644\u0627\u062a \u0633\u0644\u0628\u064a\u0629 \u0645\u062a\u0643\u0631\u0631\u0629.",
  },
  {
    value: "fake_reacts",
    labelEn: "FAKE ENGAGEMENT",
    labelAr: "\u062a\u0641\u0627\u0639\u0644 \u0648\u0647\u0645\u064a",
    descriptionEn: "Engagement appears manipulated with fake likes or reactions to look trustworthy.",
    descriptionAr: "\u0627\u0644\u062a\u0641\u0627\u0639\u0644 \u064a\u0628\u062f\u0648 \u0645\u062a\u0644\u0627\u0639\u0628 \u0628\u0647 \u0639\u0628\u0631 \u0644\u0627\u064a\u0643\u0627\u062a \u0623\u0648 \u0631\u064a\u0627\u0643\u062a\u0627\u062a \u0648\u0647\u0645\u064a\u0629 \u0644\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0635\u0641\u062d\u0629 \u0628\u0634\u0643\u0644 \u0645\u0648\u062b\u0648\u0642.",
  },
  {
    value: "fake_giveaway",
    labelEn: "FAKE GIVEAWAY",
    labelAr: "\u062c\u064a\u0641 \u0623\u0648\u0627\u064a \u0648\u0647\u0645\u064a",
    descriptionEn: "Giveaways, offers, or prizes look misleading.",
    descriptionAr: "\u0639\u0631\u0648\u0636 \u0623\u0648 \u062c\u0648\u0627\u0626\u0632 \u062a\u0628\u062f\u0648 \u0645\u0636\u0644\u0644\u0629.",
  },
  {
    value: "impersonation",
    labelEn: "IMPERSONATION",
    labelAr: "\u0627\u0646\u062a\u062d\u0627\u0644 \u0634\u062e\u0635\u064a\u0629",
    descriptionEn: "The page may be copying another brand, seller, or public identity.",
    descriptionAr: "\u0627\u0644\u0635\u0641\u062d\u0629 \u0642\u062f \u062a\u0646\u062a\u062d\u0644 \u0628\u0631\u0627\u0646\u062f \u0623\u0648 \u0628\u0627\u0626\u0639 \u0623\u0648 \u0647\u0648\u064a\u0629 \u0623\u062e\u0631\u0649.",
  },
  {
    value: "no_delivery",
    labelEn: "NO DELIVERY",
    labelAr: "\u0639\u062f\u0645 \u062a\u0633\u0644\u064a\u0645",
    descriptionEn: "Customers report paying without receiving the agreed item or service.",
    descriptionAr: "\u0639\u0645\u0644\u0627\u0621 \u0628\u0644\u063a\u0648\u0627 \u0639\u0646 \u062f\u0641\u0639 \u0628\u062f\u0648\u0646 \u0627\u0633\u062a\u0644\u0627\u0645.",
  },
  {
    value: "block_after_pay",
    labelEn: "BLOCKED AFTER PAYMENT",
    labelAr: "\u062d\u0638\u0631 \u0628\u0639\u062f \u0627\u0644\u062f\u0641\u0639",
    descriptionEn: "The seller blocks the customer right after receiving payment and stops responding.",
    descriptionAr: "\u0627\u0644\u0628\u0627\u0626\u0639 \u064a\u0642\u0648\u0645 \u0628\u0639\u0645\u0644 \u0628\u0644\u0648\u0643 \u0644\u0644\u0639\u0645\u064a\u0644 \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u0639\u062f \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0641\u0644\u0648\u0633 \u0648\u064a\u062a\u0648\u0642\u0641 \u0639\u0646 \u0627\u0644\u0631\u062f.",
  },
  {
    value: "payment_delay",
    labelEn: "PAYMENT DELAY",
    labelAr: "\u062a\u0623\u062e\u064a\u0631 \u062f\u0641\u0639",
    descriptionEn: "Repeated delays around payments, refunds, or payouts.",
    descriptionAr: "\u062a\u0623\u062e\u064a\u0631 \u0645\u062a\u0643\u0631\u0631 \u0641\u064a \u0627\u0644\u062f\u0641\u0639 \u0623\u0648 \u0627\u0644\u0627\u0633\u062a\u0631\u062f\u0627\u062f.",
  },
  {
    value: "bad_treatment",
    labelEn: "BAD TREATMENT",
    labelAr: "\u0633\u0648\u0621 \u062a\u0639\u0627\u0645\u0644",
    descriptionEn: "Reports mention rude handling, threats, or poor after-sale support.",
    descriptionAr: "\u0628\u0644\u0627\u063a\u0627\u062a \u0639\u0646 \u0633\u0648\u0621 \u062a\u0639\u0627\u0645\u0644 \u0623\u0648 \u062a\u0647\u062f\u064a\u062f \u0623\u0648 \u062f\u0639\u0645 \u0636\u0639\u064a\u0641.",
  },
  {
    value: "chargeback_risk",
    labelEn: "CHARGEBACK RISK",
    labelAr: "\u062e\u0637\u0631 \u0627\u0633\u062a\u0631\u062f\u0627\u062f",
    descriptionEn: "Transactions may carry dispute, refund, or chargeback risk.",
    descriptionAr: "\u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0642\u062f \u064a\u062d\u0645\u0644 \u062e\u0637\u0631 \u0646\u0632\u0627\u0639 \u0623\u0648 \u0627\u0633\u062a\u0631\u062f\u0627\u062f.",
  },
];

export const STATUS_LABELS: Record<string, string> = {
  trusted: "Trusted",
  warning: "Warning",
  severe_warning: "Severe warning",
  high_risk: "High risk",
  reviewing: "Under review",
  no_data: "No data",
};

export function getStatusLabel(status: string, lang: "en" | "ar" = "en") {
  const arLabels: Record<string, string> = {
    warning: "\u062a\u062d\u0630\u064a\u0631",
    severe_warning: "\u062a\u062d\u0630\u064a\u0631 \u0634\u062f\u064a\u062f",
    trusted: "موثوق",
    high_risk: "عالي الخطورة",
    reviewing: "قيد المراجعة",
    no_data: "لا بيانات",
  };
  if (lang === "ar") return arLabels[status] || arLabels.reviewing;
  return STATUS_LABELS[status] || STATUS_LABELS.reviewing;
}

export function getRiskStatusFromReportCount(reportCount: number, fallbackStatus = "reviewing") {
  const count = Number(reportCount || 0);
  const reportStatus = count > 2 ? "high_risk" : count === 2 ? "severe_warning" : count === 1 ? "warning" : fallbackStatus || "reviewing";
  const severity: Record<string, number> = {
    trusted: 0,
    reviewing: 0,
    warning: 1,
    severe_warning: 2,
    high_risk: 3,
  };
  return (severity[fallbackStatus] || 0) > (severity[reportStatus] || 0) ? fallbackStatus : reportStatus;
}

export function normalizePhone(input: string) {
  const digits = String(input || "")
    .replace(/[\s\-()]/g, "")
    .replace(/[^\d+]/g, "");
  if (!digits) return "";
  let normalized = digits;
  if (normalized.startsWith("0020")) normalized = normalized.slice(2);
  if (normalized.startsWith("+20")) normalized = `0${normalized.slice(3)}`;
  if (normalized.startsWith("20") && normalized.length >= 11) normalized = `0${normalized.slice(2)}`;
  return normalized.replace(/[^\d]/g, "");
}

export function normalizeUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) =>
      parsed.searchParams.delete(key)
    );
    if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

export function normalizeTargetName(input: string) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

export function detectPlatform(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("facebook.com") || lower.includes("fb.com")) return "facebook";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("wa.me") || lower.includes("whatsapp.com")) return "whatsapp";
  if (lower.includes("t.me/") || lower.includes("telegram.me/") || lower.includes("telegram.org/")) return "telegram";
  return "website";
}

export function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    website: "Website",
  };
  return labels[platform] || platform || "Website";
}

export function normalizeTargetReasons(reasons: unknown) {
  if (!Array.isArray(reasons)) return [];
  const validValues = new Set(TARGET_REASON_OPTIONS.map((option) => option.value));
  const normalized = reasons
    .map((reason) =>
      String(reason || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
    )
    .filter((reason) => reason && validValues.has(reason));

  return Array.from(new Set(normalized));
}

export function getTargetReasons(target: TargetRecord) {
  return normalizeTargetReasons(target.reasons);
}

export function normalizeTargetCategory(category: unknown) {
  const value = String(category || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const validValues = new Set(TARGET_CATEGORY_OPTIONS.map((option) => option.value));
  return validValues.has(value) ? value : "gaming";
}

export function getTargetCategoryOption(value: string) {
  const normalized = normalizeTargetCategory(value);
  return TARGET_CATEGORY_OPTIONS.find((option) => option.value === normalized) || TARGET_CATEGORY_OPTIONS[0];
}

export function getTargetCategoryLabel(value: string, lang: "en" | "ar" = "en") {
  const option = getTargetCategoryOption(value);
  return lang === "ar" ? option.labelAr : option.labelEn;
}

export function getTargetCategoryDescription(value: string, lang: "en" | "ar" = "en") {
  const option = getTargetCategoryOption(value);
  return lang === "ar" ? option.descriptionAr : option.descriptionEn;
}

/**
 * How well `queryText` matches the page category of `target` (0–100).
 * Use with a fuzzy scorer keyed like search: (normalizedQuery, candidate) => number.
 */
export function evaluateTargetCategoryTextMatch(queryText: string, target: Pick<TargetRecord, "category">, fuzzy: (q: string, candidate: string) => number): number {
  const normalizedQuery = normalizeTargetName(queryText);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  if (!normalizedQuery.trim() || normalizedQuery.length < 2) return 0;

  const slug = normalizeTargetCategory(target.category);
  const slugFlat = slug.replace(/_/g, "");
  const option = TARGET_CATEGORY_OPTIONS.find((item) => item.value === slug) || TARGET_CATEGORY_OPTIONS[0];

  let best = 0;

  best = Math.max(best, fuzzy(normalizedQuery, option.labelEn) - 10);
  best = Math.max(best, fuzzy(normalizedQuery, option.labelAr) - 10);
  best = Math.max(best, fuzzy(normalizedQuery, slug.replace(/_/g, " ")) - 14);
  best = Math.max(best, fuzzy(normalizedQuery, slug.replace(/_/g, "")) - 22);

  if (compactQuery.length >= 4) {
    if (compactQuery === slugFlat || slugFlat.includes(compactQuery) || compactQuery.includes(slugFlat)) best = Math.max(best, 97);
    for (const piece of slug.split("_").filter((p) => p.length >= 4)) {
      const pieceCompact = normalizeTargetName(piece).replace(/\s+/g, "");
      if (!pieceCompact) continue;
      if (compactQuery.includes(pieceCompact) || pieceCompact.includes(compactQuery)) best = Math.max(best, Math.min(95, 80 + compactQuery.length));
      best = Math.max(best, fuzzy(normalizedQuery, piece) - 18);
    }
  }

  return best >= 55 ? Math.min(best, 99) : 0;
}

export function getTargetReasonOption(value: string) {
  return TARGET_REASON_OPTIONS.find((option) => option.value === value);
}

export function getTargetReasonLabel(value: string, lang: "en" | "ar" = "en") {
  const option = getTargetReasonOption(value);
  if (!option) return value.replace(/_/g, " ").toUpperCase();
  return lang === "ar" ? option.labelAr : option.labelEn;
}

export function getTargetReasonDescription(value: string, lang: "en" | "ar" = "en") {
  const option = getTargetReasonOption(value);
  if (!option) return "";
  return lang === "ar" ? option.descriptionAr : option.descriptionEn;
}

export function hostFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}

export function slugifyTargetName(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug || "target";
}

export function extractTargetIdFromSlug(slugOrId: string) {
  const decoded = decodeURIComponent(slugOrId || "");
  const separatorIndex = decoded.lastIndexOf("--");
  const token = separatorIndex >= 0 ? decoded.slice(separatorIndex + 2) : decoded;

  // Backward compatible: support old full ids and new compact tokens.
  if (/^target_\d+$/i.test(token)) return token;
  if (/^t\d+$/i.test(token)) return `target_${token.slice(1)}`;
  if (/^\d+$/.test(token)) return `target_${token}`;
  return token;
}

export function getTargetHref(target: Pick<TargetRecord, "id" | "name">) {
  const slug = slugifyTargetName(String(target.name || ""));
  return `/${encodeURIComponent(slug || "target")}`;
}

export function getTargetPhones(target: TargetRecord) {
  const phones = Array.isArray(target.phones) ? target.phones : [];
  const fallback = target.phone ? [target.phone] : [];
  return Array.from(new Set([...phones, ...fallback].map(normalizePhone).filter(Boolean)));
}

export function getTargetInstapays(target: TargetRecord) {
  const values = Array.isArray(target.instapays) ? target.instapays : [];
  const fallback = target.instapay ? [target.instapay] : [];
  return Array.from(
    new Set(
      [...values, ...fallback]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export function getTargetLinks(target: TargetRecord) {
  const links = Array.isArray(target.links) ? target.links : [];
  const fallback = target.link ? [{ platform: detectPlatform(target.link), url: target.link }] : [];
  const seen = new Set<string>();
  return [...links, ...fallback]
    .map((item) => ({
      platform: item.platform || detectPlatform(item.url || ""),
      url: normalizeUrl(item.url || ""),
    }))
    .filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
}

export function normalizeTargetAliases(aliases: unknown) {
  if (!Array.isArray(aliases)) return [];
  const seen = new Set<string>();
  return aliases
    .map((alias) => String(alias || "").trim())
    .filter((alias) => {
      const normalized = normalizeTargetName(alias);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

/** Dedupe across lists by normalized name; preserves first spelling. */
function mergeUniqueAliasValues(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const t = String(raw || "").trim();
      const key = normalizeTargetName(t);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

export function getTargetKnownAliases(target: TargetRecord) {
  return normalizeTargetAliases(target.aliases);
}

export function getTargetPreviousNames(target: TargetRecord) {
  return normalizeTargetAliases(target.previousNames);
}

export function getTargetLinkedIdentities(target: TargetRecord) {
  return normalizeTargetAliases(target.linkedIdentities);
}

/** All identity tags — for search, reports, and filters. */
export function getTargetAliases(target: TargetRecord) {
  return mergeUniqueAliasValues(
    getTargetKnownAliases(target),
    getTargetPreviousNames(target),
    getTargetLinkedIdentities(target)
  );
}

/** Keep canonical `target.name`; add reporter spelling variants as aliases instead of overwriting. */
export function identityFieldsAfterReportSubmitted(existing: TargetRecord | undefined, submittedName: string) {
  const submitted = String(submittedName || "").trim();
  const stored = String(existing?.name || "").trim();

  if (!existing || !stored) {
    const name = submitted || stored;
    const baseAliases = existing ? getTargetKnownAliases(existing) : [];
    return { name, aliases: normalizeTargetAliases(baseAliases) };
  }

  let extraAliases: string[] = [];

  if (submitted && normalizeTargetName(submitted) !== normalizeTargetName(stored)) {
    const knownNorm = new Set(
      [stored, ...getTargetAliases(existing)].map((s) => normalizeTargetName(String(s))).filter(Boolean)
    );
    if (!knownNorm.has(normalizeTargetName(submitted))) extraAliases.push(submitted);
  }

  const baseAliases = getTargetKnownAliases(existing);
  const aliases = extraAliases.length
    ? normalizeTargetAliases([...baseAliases, ...extraAliases])
    : normalizeTargetAliases(baseAliases);

  return { name: stored, aliases };
}

export function generateSearchTerms(name: string, phones: string[], links: TargetLink[], aliases: string[] = []) {
  const terms = new Set<string>();
  const names = [name, ...aliases];

  for (const item of names) {
    const normalizedName = normalizeTargetName(item);
    if (normalizedName) {
      terms.add(normalizedName);
      normalizedName.split(/\s+/).forEach((part) => part && terms.add(part));
    }
  }

  phones.map(normalizePhone).filter(Boolean).forEach((phone) => terms.add(phone));

  links.forEach((link) => {
    const normalized = normalizeUrl(link.url).toLowerCase();
    if (!normalized) return;
    terms.add(normalized);
    terms.add(hostFromUrl(normalized).toLowerCase());
  });

  return Array.from(terms);
}

export function targetPayload(input: {
  name: string;
  aliases?: string[];
  previousNames?: string[];
  linkedIdentities?: string[];
  type: string;
  phones: string[];
  instapays?: string[];
  links: TargetLink[];
  logoUrl: string;
  status: string;
  trustScore: number;
  reportCount: number;
  claimedByUserId: string;
  reasons?: string[];
  category?: string;
  createdAt?: number;
}) {
  const phones = input.phones.map(normalizePhone).filter(Boolean);
  const instapays = (input.instapays || []).map((item) => String(item || "").trim()).filter(Boolean);
  const links = input.links
    .map((link) => ({
      platform: link.platform || detectPlatform(link.url),
      url: normalizeUrl(link.url),
    }))
    .filter((link) => link.url);
  const now = Date.now();
  const reasons = normalizeTargetReasons(input.reasons);
  const aliases = normalizeTargetAliases(input.aliases);
  const previousNames = normalizeTargetAliases(input.previousNames);
  const linkedIdentities = normalizeTargetAliases(input.linkedIdentities);
  const allIdentityForSearch = mergeUniqueAliasValues(aliases, previousNames, linkedIdentities);
  const category = normalizeTargetCategory(input.category);

  return {
    name: input.name.trim(),
    aliases,
    previousNames,
    linkedIdentities,
    type: input.type.trim().toLowerCase() || "page",
    phone: phones[0] || "",
    phones,
    instapay: instapays[0] || "",
    instapays,
    link: links[0]?.url || "",
    links,
    logoUrl: input.logoUrl.trim() || null,
    status: input.status,
    trustScore: Number(input.trustScore),
    reportCount: Number(input.reportCount),
    reasons,
    category,
    claimedByUserId: input.claimedByUserId.trim() || null,
    searchTerms: [...generateSearchTerms(input.name, phones, links, allIdentityForSearch), ...instapays.map((item) => item.toLowerCase()), category],
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}
