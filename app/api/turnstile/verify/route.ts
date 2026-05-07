import { NextResponse } from "next/server";
import { hasSuspiciousContent, normalizeReportText, normalizeTargetKey, simpleHash } from "@/lib/report-safety";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const DUPLICATE_WINDOW_MS = 10 * 60_000;
const abuseWindow = new Map<string, number[]>();
const duplicateWindow = new Map<string, number>();

function getClientIp(req: Request): string {
  const header = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  const first = header.split(",")[0]?.trim();
  return first || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (abuseWindow.get(key) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  abuseWindow.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function isDuplicateSignature(signature: string): boolean {
  const now = Date.now();
  const existing = duplicateWindow.get(signature);
  return Boolean(existing && now - existing < DUPLICATE_WINDOW_MS);
}

function markDuplicateSignature(signature: string) {
  duplicateWindow.set(signature, Date.now());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      targetName?: string;
      description?: string;
      targetLink?: string;
    };
    const token = body.token?.trim();
    const targetName = body.targetName || "";
    const description = body.description || "";
    const targetLink = body.targetLink || "";
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_turnstile_token" }, { status: 400 });
    }
    if (!secret) {
      return NextResponse.json({ ok: false, error: "turnstile_secret_not_configured" }, { status: 500 });
    }

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent") || "unknown";
    const abuseKey = `${ip}:${simpleHash(ua)}`;
    if (isRateLimited(abuseKey)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const normalizedTarget = normalizeTargetKey(targetName);
    const normalizedDescription = normalizeReportText(description);
    const signature = simpleHash(`${normalizedTarget}|${normalizedDescription}|${normalizeReportText(targetLink)}`);
    if (isDuplicateSignature(signature)) {
      return NextResponse.json({ ok: false, error: "duplicate_attempt" }, { status: 409 });
    }

    if (hasSuspiciousContent(`${description} ${targetLink}`)) {
      return NextResponse.json({ ok: false, error: "abusive_content_detected" }, { status: 422 });
    }

    const formData = new URLSearchParams();
    formData.set("secret", secret);
    formData.set("response", token);
    if (ip !== "unknown") formData.set("remoteip", ip);

    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      cache: "no-store",
    });
    const result = (await verify.json()) as TurnstileResponse;
    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "turnstile_failed",
          details: result["error-codes"] || [],
        },
        { status: 403 }
      );
    }

    markDuplicateSignature(signature);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "verification_failed" }, { status: 500 });
  }
}
