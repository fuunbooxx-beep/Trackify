const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_REPORT_IMAGES = 10;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DESCRIPTION_LENGTH = 3000;

export function sanitizeReportText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeReportText(value: string): string {
  return sanitizeReportText(value).toLowerCase();
}

export function normalizeTargetKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function isValidEvidenceImage(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_SIZE_BYTES;
}

export function hasSuspiciousContent(value: string): boolean {
  return /https?:\/\/\S+\s+https?:\/\/\S+|whatsapp\s*group|telegram\s*group|free\s*money|click\s*here/gi.test(value);
}
