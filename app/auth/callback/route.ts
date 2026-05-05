import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.redirect(`${origin}/auth?error=auth&reason=${encodeURIComponent("missing_env")}`);
  }

  const oauthErr = searchParams.get("error");
  const oauthDesc = searchParams.get("error_description");
  if (oauthErr) {
    const detail = oauthDesc
      ? decodeURIComponent(oauthDesc.replace(/\+/g, " "))
      : "";
    const msg = detail ? `${oauthErr}: ${detail}` : oauthErr;
    return NextResponse.redirect(`${origin}/auth?error=auth&reason=${encodeURIComponent(msg)}`);
  }

  if (!code) {
    const hint =
      "no_code — Google رجّعك بدون ?code. غالبًا Redirect URI في Google مش فيه https://PROJECT.supabase.co/auth/v1/callback أو Client ID/Secret في Supabase مش من نفس OAuth client.";
    return NextResponse.redirect(`${origin}/auth?error=auth&reason=${encodeURIComponent(hint)}`);
  }

  const redirectTarget = `${origin}${next.startsWith("/") ? next : `/${next}`}`;
  let response = NextResponse.redirect(redirectTarget);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(redirectTarget);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?error=auth&reason=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
