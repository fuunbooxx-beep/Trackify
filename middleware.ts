import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  "target",
  "trending",
]);

function resolveTargetRewrite(pathname: string) {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("/")) return null;
  if (RESERVED_ROOT_ROUTES.has(clean.toLowerCase())) return null;
  if (clean.includes(".")) return null;
  return `/target/${clean}`;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
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

  await supabase.auth.getUser();

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
