import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
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

  let error: { message: string } | null = null;

  // Email confirmation / magic-link flow.
  if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    error = result.error ? { message: result.error.message } : null;
  } else if (code) {
    // OAuth / PKCE flow.
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error ? { message: result.error.message } : null;
  } else {
    const hint =
      "missing_auth_params — callback is missing both code and token_hash. Check your Supabase redirect URL settings.";
    return NextResponse.redirect(`${origin}/auth?error=auth&reason=${encodeURIComponent(hint)}`);
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?error=auth&reason=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
