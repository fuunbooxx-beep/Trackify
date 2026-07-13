import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import firebaseConfig from "./firebase-applet-config.json";
import { clientIpToBlockedDocId } from "./lib/ip-block";

const RESERVED_ROOT_ROUTES = new Set([
  "",
  "about",
  "api",
  "auth",
  "category",
  "dashboard",
  "profile",
  "report",
  "search",
  "signup",
  "target",
  "trending",
]);

function resolveTargetRewrite(pathname: string) {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  if (!clean) return null;
  if (clean.includes(".")) return null;

  const parts = clean.split("/").filter(Boolean);
  if (!parts.length) return null;

  // /<slug>
  if (parts.length === 1) {
    const slug = parts[0];
    if (RESERVED_ROOT_ROUTES.has(slug.toLowerCase())) return null;
    return `/target/${slug}`;
  }

  // /<slug>/about -> /target/<slug>/about
  if (parts.length === 2 && parts[1].toLowerCase() === "about") {
    const slug = parts[0];
    if (RESERVED_ROOT_ROUTES.has(slug.toLowerCase())) return null;
    return `/target/${slug}/about`;
  }

  return null;
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

const BLOCK_CACHE_TTL_MS = 5 * 60 * 1000;
const FIRESTORE_LOOKUP_TIMEOUT_MS = 1_500;
const SUPABASE_AUTH_TIMEOUT_MS = 2_500;
const blockCache = new Map<string, { blocked: boolean; expires: number }>();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isClientIpBlocked(ip: string) {
  if (!ip) return false;

  const now = Date.now();
  const cached = blockCache.get(ip);
  if (cached && cached.expires > now) return cached.blocked;

  const docId = encodeURIComponent(clientIpToBlockedDocId(ip));
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/blockedIps/${docId}?key=${firebaseConfig.apiKey}`;
  try {
    const res = await fetchWithTimeout(url, FIRESTORE_LOOKUP_TIMEOUT_MS);
    const blocked = res.ok;
    blockCache.set(ip, { blocked, expires: now + BLOCK_CACHE_TTL_MS });
    return blocked;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const clientIp = getClientIp(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const blockedPromise = clientIp ? isClientIpBlocked(clientIp) : Promise.resolve(false);

  if (!url || !key) {
    if (await blockedPromise) {
      return new NextResponse("Access denied.", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const [blocked] = await Promise.all([
    blockedPromise,
    withTimeout(supabase.auth.getUser(), SUPABASE_AUTH_TIMEOUT_MS),
  ]);

  if (blocked) {
    return new NextResponse("Access denied.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const rewritePath = resolveTargetRewrite(request.nextUrl.pathname);
  if (!rewritePath) return supabaseResponse;

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = rewritePath;
  const rewrittenResponse = NextResponse.rewrite(rewriteUrl);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    rewrittenResponse.cookies.set(cookie.name, cookie.value);
  });
  return rewrittenResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
