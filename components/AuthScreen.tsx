"use client";

import { Navbar } from "@/components/Navbar";
import { AuthContext } from "@/lib/providers";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { assignWithRouteLoader, hideRouteLoader, showRouteLoader } from "@/components/RouteLoadingController";
import { useLanguage } from "@/lib/i18n/context";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Info, Loader2, LogIn, TriangleAlert, UserPlus } from "lucide-react";
import { Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => {
          onTokenRef.current("");
          onErrorRef.current();
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
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div className="mt-2 flex justify-center">
      <div ref={containerRef} />
    </div>
  );
}

type BannerKind = "error" | "success" | "info";

function Banner({ kind, message }: { kind: BannerKind; message: string }) {
  const styles =
    kind === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : kind === "info"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : "border-destructive/30 bg-destructive/10 text-destructive";
  const Icon = kind === "success" ? BadgeCheck : kind === "info" ? Info : TriangleAlert;
  return (
    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${styles}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">{message}</div>
      </div>
    </div>
  );
}

function AuthForm({ initialMode }: { initialMode: "signin" | "signup" }) {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlReason = searchParams.get("reason");
  const nextPath = searchParams.get("next");
  const { lang } = useLanguage();
  const safeNextPath = nextPath && nextPath.startsWith("/") ? nextPath : "/profile";
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [isRegister, setIsRegister] = useState(initialMode === "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ kind: BannerKind; message: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaBroken, setCaptchaBroken] = useState(false);

  const captchaEnabled = useMemo(() => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), []);
  const needCaptcha = captchaEnabled;

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const logoSrc = useMemo(() => {
    // Always show something (avoid "not visible" on first paint).
    const isDark = mounted ? resolvedTheme === "dark" : true;
    return isDark
      ? "https://res.cloudinary.com/dv4qomvdt/image/upload/v1778000404/ChatGPT_Image_May_5_2026_07_58_44_PM_2_-Photoroom_grak0v.png"
      : "https://res.cloudinary.com/dv4qomvdt/image/upload/v1778000404/ChatGPT_Image_May_5_2026_07_58_44_PM_1_-Photoroom_p33maf.png";
  }, [mounted, resolvedTheme]);

  const setMode = (mode: "signin" | "signup") => {
    setBanner(null);
    setCaptchaToken("");
    setCaptchaBroken(false);
    setIsRegister(mode === "signup");

    const next = safeNextPath !== "/profile" ? `?next=${encodeURIComponent(safeNextPath)}` : "";
    router.replace(mode === "signup" ? `/signup${next}` : `/auth${next}`);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!email.trim() || !password.trim()) {
      setBanner({ kind: "error", message: lang === "ar" ? "اكتب الإيميل والباسورد." : "Enter email and password." });
      return;
    }
    if (isRegister && !name.trim()) {
      setBanner({ kind: "error", message: lang === "ar" ? "اكتب اسمك الأول." : "Enter your name." });
      return;
    }

    if (needCaptcha && !captchaToken) {
      setBanner({ kind: "error", message: lang === "ar" ? "كمّل اختبار التحقق (CAPTCHA) الأول." : "Please complete the CAPTCHA first." });
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
          setBanner({ kind: "success", message: lang === "ar" ? "تم إنشاء الحساب وتسجيل الدخول بنجاح." : "Account created and signed in successfully." });
          assignWithRouteLoader(safeNextPath);
        } else {
          setBanner({
            kind: "info",
            message:
              lang === "ar"
                ? "تم إنشاء الحساب. لو مطلوب تأكيد الإيميل، افتح رسالة التأكيد ثم ارجع وسجّل دخول."
                : "Account created. If email confirmation is required, check your inbox then sign in.",
          });
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
        setBanner({ kind: "success", message: lang === "ar" ? "تم تسجيل الدخول بنجاح." : "Signed in successfully." });
        assignWithRouteLoader(safeNextPath);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/invalid login credentials|invalid_credentials/i.test(message)) {
        setBanner({ kind: "error", message: lang === "ar" ? "الإيميل أو الباسورد غير صحيح." : "Invalid email or password." });
      } else if (/email not confirmed|not_confirmed/i.test(message)) {
        setBanner({
          kind: "error",
          message:
            lang === "ar"
              ? "لازم تأكد الإيميل الأول. افتح رسالة التأكيد ثم جرّب تسجيل الدخول."
              : "Please confirm your email first, then sign in.",
        });
      } else if (/user already registered|already been registered/i.test(message)) {
        setBanner({ kind: "error", message: lang === "ar" ? "الإيميل مستخدم بالفعل." : "Email is already registered." });
      } else if (/password|weak/i.test(message)) {
        setBanner({ kind: "error", message: lang === "ar" ? "الباسورد ضعيف جدًا. جرّب 8 أحرف أو أكثر." : "Password is too weak. Try 8+ characters." });
      } else if (/captcha|turnstile|hcaptcha/i.test(message)) {
        setBanner({
          kind: "error",
          message:
            lang === "ar"
              ? "Supabase طالب CAPTCHA للإيميل/باسورد. كمل التحقق وجرب تاني. لو مش ظاهر، اتأكد إن NEXT_PUBLIC_TURNSTILE_SITE_KEY مضبوط واعمل Restart للسيرفر."
              : "Supabase requires CAPTCHA for email/password. Complete the challenge and try again. If it doesn't show, ensure NEXT_PUBLIC_TURNSTILE_SITE_KEY is set and restart the dev server.",
        });
      } else {
        setBanner({ kind: "error", message: lang === "ar" ? `فشل تسجيل الدخول/إنشاء الحساب: ${message}` : `Auth failed: ${message}` });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setBanner(null);
    setSubmitting(true);
    try {
      showRouteLoader();
      const nextParam =
        safeNextPath !== "/profile" ? `?next=${encodeURIComponent(safeNextPath)}` : "";
      window.location.assign(`/auth/google${nextParam}`);
    } catch {
      hideRouteLoader();
      setBanner({
        kind: "error",
        message:
          lang === "ar"
            ? "تعذر تسجيل الدخول بجوجل. تأكد أن Google مفعّل في Supabase Auth."
            : "Google login failed. Ensure Google provider is enabled in Supabase Auth.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const oauthBanner =
    urlError === "auth"
      ? urlReason === "missing_env"
        ? lang === "ar"
          ? "متغيرات Supabase مش متاحة على السيرفر. أعد تشغيل npm run dev بعد .env.local"
          : "Supabase env variables are missing on server. Restart after configuring .env.local"
        : urlReason && /redirect|Redirect/i.test(urlReason)
          ? lang === "ar"
            ? "رابط الإرجاع غير مسموح: في Supabase → Authentication → URL configuration أضف في Redirect URLs العنوان بالظبط: http://localhost:3000/auth/callback (نفس البورت اللي بتفتح منه الموقع). واحفظ، ثم جرّب تاني."
            : "Redirect URL is not allowed. Add http://localhost:3000/auth/callback in Supabase Authentication URL configuration."
          : urlReason
            ? urlReason.startsWith("no_code")
              ? urlReason
              : lang === "ar"
                ? `فشلت المصادقة: ${urlReason}`
                : `Authentication failed: ${urlReason}`
            : lang === "ar"
              ? "فشلت المصادقة بعد جوجل. تحقق من Redirect URLs في Supabase وGoogle."
              : "Authentication failed after Google. Verify Redirect URLs in Supabase and Google."
      : "";

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-xl mx-auto px-4 py-24 min-h-screen flex items-start">
      <div className="glass-panel rounded-3xl p-6 md:p-8 w-full">
        <div className="mb-6">
          <div className="flex items-center justify-center">
            <img
              src={logoSrc}
              alt="Trackify"
              className="h-20 md:h-24 w-auto object-contain drop-shadow-sm"
            />
          </div>

          <div className="mt-4 text-center">
            <h1 className="text-3xl md:text-4xl font-black leading-tight">
              {isRegister ? (lang === "ar" ? "إنشاء حساب" : "Create account") : (lang === "ar" ? "تسجيل الدخول" : "Sign in")}
            </h1>
            <p className="mt-1 text-sm md:text-base text-muted-foreground font-medium">
              {isRegister
                ? lang === "ar"
                  ? "ابدأ في ثواني — أنشئ حسابك وكمل."
                  : "Get started in seconds — create your account and continue."
                : lang === "ar"
                  ? "سجّل دخولك (إيميل أو Google) للوصول لحسابك."
                  : "Sign in with email or Google to access your account."}
            </p>
          </div>

          <div className="mt-4 flex justify-center">
            <div className="rounded-2xl border border-border bg-secondary/30 p-1 w-full max-w-[340px]">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`py-2.5 text-xs font-black rounded-xl transition-colors ${
                    !isRegister ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang === "ar" ? "دخول" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`py-2.5 text-xs font-black rounded-xl transition-colors ${
                    isRegister ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang === "ar" ? "حساب جديد" : "Sign up"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{lang === "ar" ? "جاري التحقق من الجلسة..." : "Checking session..."}</span>
          </div>
        ) : user ? (
          <div className="space-y-3">
            <p className="font-semibold">
              {lang === "ar" ? "أنت مسجل دخول بالفعل:" : "You are already signed in:"} {user.email}
            </p>
            <button
              type="button"
              onClick={() => assignWithRouteLoader("/dashboard")}
              className="bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-5 py-3 rounded-xl"
            >
              {lang === "ar" ? "المتابعة" : "Continue"}
            </button>
          </div>
        ) : (
          <>
            {oauthBanner && <Banner kind="error" message={oauthBanner} />}
            {banner && <Banner kind={banner.kind} message={banner.message} />}

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
              {isRegister && (
                <div className="text-xs font-semibold text-muted-foreground">
                  {lang === "ar"
                    ? "ملحوظة: قد تحتاج لتأكيد الإيميل قبل تسجيل الدخول."
                    : "Note: you may need to confirm your email before signing in."}
                </div>
              )}

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
                    <div className="text-xs font-semibold text-destructive text-center">
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
          </>
        )}
      </div>
    </div>
  );
}

export function AuthScreen({ initialMode }: { initialMode: "signin" | "signup" }) {
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
        <AuthForm initialMode={initialMode} />
      </Suspense>
    </>
  );
}

