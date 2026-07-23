"use client";

import Link from "next/link";
import { FormEvent, useContext, useState } from "react";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  MessageSquareText,
  Phone,
  SearchCheck,
  Store,
} from "lucide-react";
import { motion } from "motion/react";
import { AuthContext } from "@/lib/providers";
import { useLanguage } from "@/lib/i18n/context";

type ExistingTarget = { id: string; name: string };

export function CheckItForMe() {
  const { user, loading } = useContext(AuthContext);
  const { lang } = useLanguage();
  const [pageName, setPageName] = useState("");
  const [pageLink, setPageLink] = useState("");
  const [phone, setPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [existingTarget, setExistingTarget] = useState<ExistingTarget | null>(null);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!pageName.trim() && !pageLink.trim() && !phone.trim()) {
      setSuccess(false);
      setExistingTarget(null);
      setMessage(
        lang === "ar"
          ? "اكتب اسم الصفحة أو الرابط أو رقم الهاتف على الأقل."
          : "Enter at least a page name, link, or phone number."
      );
      return;
    }

    setSubmitting(true);
    setMessage("");
    setExistingTarget(null);
    try {
      const response = await fetch("/api/check-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageName, pageLink, phone, customerNote }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        targetId?: string;
        targetName?: string;
      };

      if (response.status === 409 && body.error === "target_exists" && body.targetId) {
        setSuccess(false);
        setExistingTarget({ id: body.targetId, name: body.targetName || pageName });
        setMessage(
          lang === "ar"
            ? "الصفحة دي موجودة بالفعل عندنا—تقدر تشوف بياناتها وبلاغاتها مباشرة."
            : "This page is already in our database. You can view its details and reports now."
        );
        return;
      }
      if (response.status === 409 && body.error === "request_already_pending") {
        setSuccess(false);
        setMessage(
          lang === "ar"
            ? "عندك طلب فحص لنفس البيانات قيد المراجعة بالفعل."
            : "You already have a pending check for the same details."
        );
        return;
      }
      if (!response.ok) throw new Error(body.error || "check_request_failed");

      setPageName("");
      setPageLink("");
      setPhone("");
      setCustomerNote("");
      setSuccess(true);
      setMessage(
        lang === "ar"
          ? "تم إرسال طلبك. هنراجع البيانات والنتيجة هتظهر في بروفايلك."
          : "Request sent. We will review it and show the result in your profile."
      );
    } catch (error) {
      console.error(error);
      setSuccess(false);
      setMessage(
        lang === "ar"
          ? "تعذر إرسال الطلب حاليًا. جرّب مرة تانية."
          : "We could not send the request right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="check-it-for-me" className="relative scroll-mt-24 overflow-hidden border-y border-border/60 bg-card/40 px-4 py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(250,204,21,.12),transparent_34%),radial-gradient(circle_at_86%_80%,rgba(59,130,246,.10),transparent_30%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        className="relative mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-background/85 shadow-2xl shadow-black/10 backdrop-blur lg:grid-cols-[.85fr_1.15fr]"
      >
        <div className="flex flex-col justify-between border-b border-border bg-primary p-7 text-primary-foreground sm:p-10 lg:border-b-0 lg:border-e">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-black/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em]">
              <SearchCheck className="h-4 w-4" />
              Check it for me
            </span>
            <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
              {lang === "ar" ? "مش لاقي الصفحة عندنا؟ إحنا نفحصها لك" : "Can’t find the page? We’ll check it for you"}
            </h2>
            <p className="mt-4 max-w-md text-base font-semibold leading-7 opacity-80">
              {lang === "ar"
                ? "ابعت اسم الصفحة أو لينك فيسبوك أو رقم الهاتف. هنراجع البيانات ونقولك هل التعامل مطمئن، خطر، أو محتاج أدلة أكتر."
                : "Send the page name, Facebook link, or phone number. We’ll review it and tell you whether it looks safe, risky, or needs more evidence."}
            </p>
          </div>
          <div className="mt-10 grid gap-3 text-sm font-bold">
            <div className="flex items-center gap-3"><BellRing className="h-5 w-5" />{lang === "ar" ? "طلبك يوصل للإدارة فورًا" : "Your request reaches the review team"}</div>
            <div className="flex items-center gap-3"><MessageSquareText className="h-5 w-5" />{lang === "ar" ? "النتيجة والتعليق يظهروا في بروفايلك" : "The result and note appear in your profile"}</div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {lang === "ar" ? "جاري تحميل حسابك..." : "Loading your account..."}
            </div>
          ) : !user ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
                <SearchCheck className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-2xl font-black">{lang === "ar" ? "سجّل دخول عشان نوصلك النتيجة" : "Sign in so we can deliver your result"}</h3>
              <p className="mt-3 max-w-md leading-7 text-muted-foreground">
                {lang === "ar"
                  ? "الطلب بيتربط بحسابك، ولما المراجعة تخلص هتلاقي النتيجة والتعليق محفوظين في البروفايل."
                  : "The request is linked to your account, so the completed review stays available in your profile."}
              </p>
              <Link
                href="/auth?next=%2F%23check-it-for-me"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90 dark:bg-neon-blue dark:text-black"
              >
                {lang === "ar" ? "تسجيل الدخول وبدء الفحص" : "Sign in and start a check"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={submitRequest} className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-primary">{lang === "ar" ? "طلب فحص جديد" : "New review request"}</p>
                <h3 className="mt-2 text-2xl font-black">{lang === "ar" ? "ابعت أي بيانات متاحة" : "Send any details you have"}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {lang === "ar" ? "لازم تدخل حقل واحد على الأقل. كل ما تبعت بيانات أكتر، المراجعة تكون أدق." : "At least one field is required. More details help us review accurately."}
                </p>
              </div>

              <label className="check-request-field relative block">
                <span className="check-request-field-icon">
                  <Store className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <input value={pageName} onChange={(event) => setPageName(event.target.value)} className="input" maxLength={180} placeholder={lang === "ar" ? "اسم الصفحة أو البائع" : "Page or seller name"} />
              </label>
              <label className="check-request-field relative block" dir="ltr">
                <span className="check-request-field-icon">
                  <LinkIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <input value={pageLink} onChange={(event) => setPageLink(event.target.value)} className="input" dir="ltr" maxLength={500} placeholder="https://facebook.com/..." />
              </label>
              <label className="check-request-field relative block" dir="ltr">
                <span className="check-request-field-icon">
                  <Phone className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="input" dir="ltr" maxLength={40} placeholder={lang === "ar" ? "رقم الهاتف أو واتساب" : "Phone or WhatsApp number"} />
              </label>
              <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} className="input min-h-24" maxLength={600} placeholder={lang === "ar" ? "ملاحظة إضافية (اختياري)" : "Additional note (optional)"} />

              {message && (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${success ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}>
                  <div className="flex items-start gap-2">
                    {success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <SearchCheck className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div>
                      <p>{message}</p>
                      {success && <Link href="/profile" className="mt-1 inline-flex items-center gap-1 underline">{lang === "ar" ? "فتح البروفايل" : "Open profile"}<ArrowUpRight className="h-3.5 w-3.5" /></Link>}
                      {existingTarget && <Link href={`/target/${existingTarget.id}`} className="mt-1 inline-flex items-center gap-1 underline">{lang === "ar" ? `عرض ${existingTarget.name || "الصفحة"}` : `View ${existingTarget.name || "page"}`}<ArrowUpRight className="h-3.5 w-3.5" /></Link>}
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3.5 text-sm font-black text-background transition hover:opacity-90 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                {lang === "ar" ? "ابعت طلب الفحص" : "Send check request"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
