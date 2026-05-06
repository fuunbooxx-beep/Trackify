"use client";

import { Navbar } from "@/components/Navbar";
import { useContext, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { AuthContext } from "@/lib/providers";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { assignWithRouteLoader, hideRouteLoader, showRouteLoader } from "@/components/RouteLoadingController";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          action?: string;
          cData?: string;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId?: string) => void;
    };
  }
}

function TurnstileCaptcha({
  onToken,
  onError,
}: {
  onToken: (token: string) => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="1"]');
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "1";
    document.head.appendChild(script);
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) return;
    if (!containerRef.current) return;

    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (!containerRef.current) return;

      const ts = window.turnstile;
      if (!ts?.render) {
        window.setTimeout(tryRender, 150);
        return;
      }

      if (widgetIdRef.current) {
        ts.remove?.(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      const id = ts.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => {
          onToken("");
          onError();
        },
      });
      widgetIdRef.current = id;
    };

    tryRender();
    return () => {
      cancelled = true;
      const ts = window.turnstile;
      if (widgetIdRef.current) ts?.remove?.(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey, onToken, onError]);

  if (!siteKey) return null;

  return (
    <div className="mt-2">
      <div ref={containerRef} />
    </div>
  );
}

function AuthForm() {
  const { user, loading } = useContext(AuthContext);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlReason = searchParams.get("reason");
  const nextPath = searchParams.get("next");
  const { lang } = useLanguage();
  const safeNextPath = nextPath && nextPath.startsWith("/") ? nextPath : "/profile";

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaBroken, setCaptchaBroken] = useState(false);

  const captchaEnabled = useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    []
  );
  const needCaptcha = captchaEnabled;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg(lang === "ar" ? "اكتب الإيميل والباسورد." : "Enter email and password.");
      return;
    }
    if (isRegister && !name.trim()) {
      setErrorMsg(lang === "ar" ? "اكتب اسمك الأول." : "Enter your name.");
      return;
    }

    if (needCaptcha && !captchaToken) {
      setErrorMsg(lang === "ar" ? "كمّل اختبار التحقق (CAPTCHA) الأول." : "Please complete the CAPTCHA first.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              display_name: name.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            captchaToken: needCaptcha ? captchaToken : undefined,
          },
        });
        if (error) throw error;
        if (data.session) {
          assignWithRouteLoader(safeNextPath);
        } else {
          setErrorMsg(lang === "ar" ? "تم إنشاء الحساب. لو طلب منك تأكيد الإيميل، افتح بريدك ثم سجّل دخول." : "Account created. If email confirmation is required, check your inbox then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: {
            captchaToken: needCaptcha ? captchaToken : undefined,
          },
        });
        if (error) throw error;
        assignWithRouteLoader(safeNextPath);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Keep a visible (but non-sensitive) message to debug production auth failures.
      // Supabase returns many helpful 4xx messages that we can safely surface.
      if (/invalid login credentials|invalid_credentials/i.test(message)) {
        setErrorMsg(lang === "ar" ? "الإيميل أو الباسورد غير صحيح." : "Invalid email or password.");
      } else if (/email not confirmed|not_confirmed/i.test(message)) {
        setErrorMsg(lang === "ar" ? "لازم تأكد الإيميل الأول. افتح رسالة التأكيد ثم جرّب تسجيل الدخول." : "Please confirm your email first, then sign in.");
      } else if (/user already registered|already been registered/i.test(message)) {
        setErrorMsg(lang === "ar" ? "الإيميل مستخدم بالفعل." : "Email is already registered.");
      } else if (/password|weak/i.test(message)) {
        setErrorMsg(lang === "ar" ? "الباسورد ضعيف جدًا. جرّب 8 أحرف أو أكثر." : "Password is too weak. Try 8+ characters.");
      } else if (/captcha|turnstile|hcaptcha/i.test(message)) {
        setErrorMsg(
          lang === "ar"
            ? "Supabase طالب CAPTCHA للإيميل/باسورد. لو لسه شغال، كمل التحقق وجرب تاني. لو مش ظاهر، اتأكد إن NEXT_PUBLIC_TURNSTILE_SITE_KEY مضبوط."
            : "Supabase requires CAPTCHA for email/password. Complete the challenge and try again. If it doesn't show, ensure NEXT_PUBLIC_TURNSTILE_SITE_KEY is set."
        );
      } else {
        setErrorMsg(
          lang === "ar"
            ? `فشل تسجيل الدخول/إنشاء الحساب: ${message}`
            : `Auth failed: ${message}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      showRouteLoader();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath)}`,
        },
      });
      if (error) throw error;
    } catch {
      hideRouteLoader();
      setErrorMsg(lang === "ar" ? "تعذر تسجيل الدخول بجوجل. تأكد أن Google مفعّل في Supabase Auth." : "Google login failed. Ensure Google provider is enabled in Supabase Auth.");
    } finally {
      setSubmitting(false);
    }
  };

  const oauthBanner =
    urlError === "auth"
      ? urlReason === "missing_env"
        ? lang === "ar" ? "متغيرات Supabase مش متاحة على السيرفر. أعد تشغيل npm run dev بعد .env.local" : "Supabase env variables are missing on server. Restart after configuring .env.local"
        : urlReason && /redirect|Redirect/i.test(urlReason)
          ? lang === "ar" ? "رابط الإرجاع غير مسموح: في Supabase → Authentication → URL configuration أضف في Redirect URLs العنوان بالظبط: http://localhost:3000/auth/callback (نفس البورت اللي بتفتح منه الموقع). واحفظ، ثم جرّب تاني." : "Redirect URL is not allowed. Add http://localhost:3000/auth/callback in Supabase Authentication URL configuration."
          : urlReason
            ? urlReason.startsWith("no_code")
              ? urlReason
              : (lang === "ar" ? `فشلت المصادقة: ${urlReason}` : `Authentication failed: ${urlReason}`)
            : lang === "ar" ? "فشلت المصادقة بعد جوجل. تحقق من Redirect URLs في Supabase وGoogle." : "Authentication failed after Google. Verify Redirect URLs in Supabase and Google."
      : "";

  return (
    <div className="max-w-xl mx-auto px-4 py-28 min-h-screen">
      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <h1 className="text-3xl font-black mb-2">{isRegister ? (lang === "ar" ? "إنشاء حساب جديد" : "Create account") : (lang === "ar" ? "تسجيل الدخول" : "Sign in")}</h1>
        <p className="text-muted-foreground mb-6 font-medium">
          {isRegister
            ? (lang === "ar" ? "اعمل حساب عبر Supabase وابدأ استخدام المنصة." : "Create an account via Supabase and start using the platform.")
            : (lang === "ar" ? "سجّل دخولك (إيميل أو Google) للوصول للوحة التحكم." : "Sign in with email or Google to access your dashboard.")}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{lang === "ar" ? "جاري التحقق من الجلسة..." : "Checking session..."}</span>
          </div>
        ) : user ? (
          <div className="space-y-3">
            <p className="font-semibold">{lang === "ar" ? "أنت مسجل دخول بالفعل:" : "You are already signed in:"} {user.email}</p>
            <button
              type="button"
              onClick={() => {
                assignWithRouteLoader("/dashboard");
              }}
              className="bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-5 py-3 rounded-xl"
            >
              {lang === "ar" ? "المتابعة" : "Continue"}
            </button>
          </div>
        ) : (
          <>
            {(oauthBanner || errorMsg) && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-semibold">
                {errorMsg || oauthBanner}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isRegister && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === "ar" ? "الاسم" : "Name"}
                  className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                dir="ltr"
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
              />

              {needCaptcha && (
                <>
                  <TurnstileCaptcha
                    onToken={(token) => {
                      setCaptchaBroken(false);
                      setCaptchaToken(token);
                    }}
                    onError={() => setCaptchaBroken(true)}
                  />
                  {captchaBroken && (
                    <div className="text-xs font-semibold text-destructive">
                      {lang === "ar"
                        ? "تعذر تحميل CAPTCHA. جرّب تحديث الصفحة أو اتأكد من مفتاح Turnstile."
                        : "Failed to load CAPTCHA. Refresh the page or verify your Turnstile site key."}
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-5 py-3 rounded-xl disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === "ar" ? "جاري التنفيذ..." : "Processing..."}</span>
                  </>
                ) : isRegister ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{lang === "ar" ? "إنشاء حساب" : "Create account"}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{lang === "ar" ? "تسجيل الدخول" : "Sign in"}</span>
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="mt-3 w-full border border-border bg-secondary/40 font-bold px-5 py-3 rounded-xl disabled:opacity-60"
            >
              {lang === "ar" ? "تسجيل الدخول باستخدام Google" : "Continue with Google"}
            </button>

            <button
              type="button"
              onClick={() => setIsRegister((v) => !v)}
              className="mt-4 text-sm font-bold text-primary dark:text-neon-blue"
            >
              {isRegister ? (lang === "ar" ? "عندي حساب بالفعل" : "I already have an account") : (lang === "ar" ? "ما عنديش حساب - إنشاء حساب جديد" : "No account? Create one")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center pt-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        }
      >
        <AuthForm />
      </Suspense>
    </>
  );
}
