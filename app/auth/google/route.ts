import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const origin = request.nextUrl.origin;
  const next = request.nextUrl.searchParams.get("next") ?? "/profile";
  const safeNext = next.startsWith("/") ? next : "/profile";

  if (!url || !key) {
    return NextResponse.redirect(
      `${origin}/auth?error=auth&reason=${encodeURIComponent("missing_env")}`
    );
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error || !data.url) {
    const reason = error?.message ?? "oauth_start_failed";
    return NextResponse.redirect(
      `${origin}/auth?error=auth&reason=${encodeURIComponent(reason)}`
    );
  }

  const redirectResponse = NextResponse.redirect(data.url);
  const setCookieHeaders = (response.headers as any).getSetCookie?.() as string[] | undefined;
  if (setCookieHeaders && setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((cookieValue) => {
      redirectResponse.headers.append("set-cookie", cookieValue);
    });
  } else {
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
  }
  return redirectResponse;
}

