export type EvidenceTier = "weak" | "medium" | "strong" | "strong_plus";

const KEYWORD_PATTERNS: RegExp[] = [
  /\breceipt\b/i,
  /\binvoice\b/i,
  /\btransfer\b/i,
  /\bscreenshot\b/i,
  /\bbank\b/i,
  /\bchat\b/i,
  /\bmessage\b/i,
  /\bpayment\b/i,
  /\bproof\b/i,
  /\bvideo\b/i,
  /\border\b/i,
  /\bwhatsapp\b/i,
  /فاتورة|تحويل|إيصال|تسجيل|محادثة|دليل|صور|نصب|بنك|دفع/,
];

export function countEvidenceKeywords(text: string) {
  if (!text?.trim()) return 0;
  return KEYWORD_PATTERNS.filter((re) => re.test(text)).length;
}

/**
 * Classify evidence strength from image count and description keywords.
 * weak < medium < strong < strong_plus
 */
export function classifyEvidenceTier(imageCount: number, description: string): EvidenceTier {
  const n = Math.max(0, Math.min(10, imageCount));
  const kw = countEvidenceKeywords(description);
  if (n >= 3 && kw >= 2) return "strong_plus";
  if (n >= 3 || (n >= 1 && kw >= 2)) return "strong";
  if (n >= 1 || kw >= 2 || (description?.trim().length ?? 0) >= 120) return "medium";
  return "weak";
}

export function formatEvidenceTierLabel(tier: EvidenceTier | string | undefined, lang: "en" | "ar") {
  const map: Record<string, { en: string; ar: string }> = {
    weak: { en: "Weak", ar: "ضعيف" },
    medium: { en: "Medium", ar: "متوسط" },
    strong: { en: "Strong", ar: "قوي" },
    strong_plus: { en: "Strong+", ar: "قوي+" },
  };
  const entry = map[String(tier || "")] || { en: String(tier || "—"), ar: String(tier || "—") };
  return lang === "ar" ? entry.ar : entry.en;
}

export function evidenceTierMultiplier(tier: EvidenceTier | undefined): number {
  switch (tier) {
    case "strong_plus":
      return 1.3;
    case "strong":
      return 1.15;
    case "medium":
      return 1;
    case "weak":
    default:
      return 0.92;
  }
}
