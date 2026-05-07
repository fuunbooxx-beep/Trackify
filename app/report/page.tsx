"use client";

import { Suspense, useState, useContext, useRef, useMemo, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthContext } from "@/lib/providers";
import { ShieldAlert, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { motion } from "motion/react";
import { useLanguage } from "@/lib/i18n/context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isAdminUser } from "@/lib/auth-user";
import { getAvatarUrl } from "@/lib/avatar";
import { detectPlatform, getRiskStatusFromReportCount, getTargetAliases, getTargetLinks, getTargetPhones, getTargetReasons, normalizePhone, normalizeTargetName, normalizeUrl, targetPayload, type TargetRecord } from "@/lib/target-utils";
import { detectExistingTargetMatch } from "@/lib/target-linking";
import { classifyEvidenceTier } from "@/lib/evidence-classify";
import { syncTargetStats } from "@/lib/trust-score";
import {
  isValidEvidenceImage,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  MAX_REPORT_IMAGES,
  normalizeReportText,
  normalizeTargetKey,
  sanitizeReportText,
  simpleHash,
} from "@/lib/report-safety";

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
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current) return;
      const ts = window.turnstile;
      if (!ts?.render) {
        window.setTimeout(renderWidget, 120);
        return;
      }
      if (widgetIdRef.current) ts.remove?.(widgetIdRef.current);
      widgetIdRef.current = ts.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => {
          onTokenRef.current("");
          onErrorRef.current();
        },
      });
    };

    renderWidget();
    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove?.(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div className="mt-1 flex justify-center md:justify-start"><div ref={containerRef} /></div>;
}

function ReportContent() {
  const { user, loading } = useContext(AuthContext);
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  
  const presetTargetName = searchParams.get("target") || "";
  const presetTargetLink = searchParams.get("link") || "";
  const lockPreset = searchParams.get("lock") === "1";

  const [targetName, setTargetName] = useState(presetTargetName);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetLink, setTargetLink] = useState(presetTargetLink);
  const [category, setCategory] = useState("scam");
  const [description, setDescription] = useState("");
  const [reporterNameInput, setReporterNameInput] = useState("");
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [reportAsAdmin, setReportAsAdmin] = useState(false);
  
  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaBroken, setCaptchaBroken] = useState(false);
  const turnstileEnabled = useMemo(() => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), []);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const supabaseUnavailable = supabase === null;
  const evidenceBucket = "report-evidence";
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    if (!reporterNameInput.trim() && user?.displayName) {
      setReporterNameInput(user.displayName);
    }
  }, [reporterNameInput, user?.displayName]);

  const generateAnonymousName = () => {
    const code = Math.floor(100 + Math.random() * 900);
    setReporterNameInput(`Anonymous participant ${code}`);
    setAnonymousMode(true);
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    const imageOnly = selected.filter((file) => isValidEvidenceImage(file));
    if (!imageOnly.length) {
      setErrorMsg(lang === "ar" ? "اختار صور فقط (JPG/PNG/WebP)." : "Please select image files only (JPG/PNG/WebP).");
      return;
    }

    const maxAllowed = MAX_REPORT_IMAGES;
    const remainingSlots = Math.max(0, maxAllowed - files.length);
    if (remainingSlots <= 0) {
      setErrorMsg(lang === "ar" ? "وصلت للحد الأقصى (10 صور)." : "Maximum reached (10 images).");
      return;
    }

    const accepted = imageOnly.slice(0, remainingSlots);
    const tooLarge = accepted.find((file) => file.size > MAX_IMAGE_SIZE_BYTES);
    if (tooLarge) {
      setErrorMsg(lang === "ar" ? "حجم كل صورة لازم يكون أقل من 5MB." : "Each image must be smaller than 5MB.");
      return;
    }

    setErrorMsg("");
    setFiles((prev) => [...prev, ...accepted]);
    setImagePreviews((prev) => [...prev, ...accepted.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName) {
      setErrorMsg(lang === "ar" ? "الرجاء إدخال إسم الصفحة أو البائع." : "Please enter page or seller name.");
      return;
    }
    if (!reporterNameInput.trim()) {
      setErrorMsg(lang === "ar" ? "لازم تكتب اسم يظهر في البلاغ (اسمك أو اسم عشوائي)." : "Please enter a display name for the report (real or random).");
      return;
    }
    if (turnstileEnabled && !captchaToken) {
      setErrorMsg(lang === "ar" ? "يرجى إكمال اختبار التحقق أولاً." : "Please complete the Turnstile verification first.");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const sanitizedDescription = sanitizeReportText(description).slice(0, MAX_DESCRIPTION_LENGTH);
      const sanitizedReporterName = sanitizeReportText(reporterNameInput).slice(0, 60);
      const normalizedTargetName = normalizeTargetName(targetName);
      const duplicateCheckKey = normalizeTargetKey(targetName);
      const descriptionHash = simpleHash(normalizeReportText(sanitizedDescription));

      if (turnstileEnabled) {
        const verifyRes = await fetch("/api/turnstile/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: captchaToken,
            targetName,
            targetLink,
            description: sanitizedDescription,
          }),
        });
        if (!verifyRes.ok) {
          const body = (await verifyRes.json().catch(() => ({}))) as { error?: string; details?: string[] };
          const reason = body.error || "verification_failed";
          if (reason === "rate_limited") {
            throw new Error(lang === "ar" ? "محاولات كثيرة جدًا. جرّب بعد دقيقة." : "Too many attempts. Please try again in a minute.");
          }
          if (reason === "duplicate_attempt") {
            throw new Error(lang === "ar" ? "تم رصد محاولة مكررة لنفس البلاغ خلال وقت قصير." : "A duplicate submission was detected recently.");
          }
          if (reason === "abusive_content_detected") {
            throw new Error(lang === "ar" ? "تم رفض البلاغ لأن المحتوى يبدو مخالفًا." : "Submission rejected because content appears abusive.");
          }
          if (reason === "turnstile_secret_not_configured") {
            throw new Error(
              lang === "ar"
                ? "إعدادات الأمان غير مكتملة على السيرفر: TURNSTILE_SECRET_KEY غير مضبوط."
                : "Server security setup is incomplete: TURNSTILE_SECRET_KEY is not configured."
            );
          }
          if (reason === "missing_turnstile_token") {
            throw new Error(lang === "ar" ? "أكمل اختبار Turnstile ثم أعد المحاولة." : "Complete the Turnstile challenge and try again.");
          }
          if (reason === "turnstile_failed") {
            const details = (body.details || []).join(", ");
            const base =
              lang === "ar"
                ? "فشل التحقق الأمني من Turnstile. أعد تحميل التحدي وحاول مرة أخرى."
                : "Turnstile verification failed. Refresh the challenge and try again.";
            throw new Error(details ? `${base} (${details})` : base);
          }
          throw new Error(lang === "ar" ? "فشل التحقق الأمني. أعد المحاولة." : "Security verification failed. Please try again.");
        }
      }

      const duplicateQuery = query(
        collection(db, "reports"),
        where("targetNameKey", "==", duplicateCheckKey),
        limit(20)
      );
      const duplicateSnap = await getDocs(duplicateQuery);
      const hasDuplicate = duplicateSnap.docs.some((item) => String(item.data().descriptionHash || "") === descriptionHash);
      if (hasDuplicate) {
        throw new Error(lang === "ar" ? "هذا البلاغ مكرر بالفعل." : "This report already exists.");
      }

      const uploadedImageUrls: string[] = [];
      if (files.length > 0) {
        if (!supabase) {
          throw new Error("SUPABASE_STORAGE_UNAVAILABLE");
        }
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          const safeName = file.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
          const ownerKey = user?.uid || `guest_${Date.now()}`;
          const filePath = `${ownerKey}/${Date.now()}_${i}_${safeName}`;
          const { error: uploadError } = await supabase.storage.from(evidenceBucket).upload(filePath, file, {
            upsert: false,
            contentType: file.type,
          });
          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from(evidenceBucket).getPublicUrl(filePath);
          uploadedImageUrls.push(data.publicUrl);
        }
      }

      let resolvedTargetId = "";

      if (isAdmin && reportAsAdmin) {
        const targetPool = (await getDocs(collection(db, "targets"))).docs.map(
          (item) => ({ id: item.id, ...item.data() } as TargetRecord)
        );
        const bestMatch = detectExistingTargetMatch(
          { targetName: normalizedTargetName, targetPhone: targetPhone, targetLink: targetLink },
          targetPool
        );
        const existingDoc = bestMatch.target;
        const baseData = existingDoc as TargetRecord | undefined;
        resolvedTargetId = existingDoc?.id || `target_${Date.now()}`;

        const nextReportCount = Number(baseData?.reportCount ?? 0) + 1;
        const mergedPayload = targetPayload({
          name: targetName.trim(),
          aliases: baseData ? getTargetAliases(baseData) : [],
          type: String(baseData?.type || "page"),
          phones: [targetPhone.trim(), ...(baseData ? getTargetPhones(baseData) : [])],
          links: [{ platform: detectPlatform(targetLink.trim()), url: targetLink.trim() }, ...(baseData ? getTargetLinks(baseData) : [])],
          logoUrl: String(baseData?.logoUrl || ""),
          status: getRiskStatusFromReportCount(nextReportCount, String(baseData?.status || "reviewing")),
          trustScore: Number(baseData?.trustScore ?? 45),
          reportCount: nextReportCount,
          reasons: baseData ? getTargetReasons(baseData) : [],
          claimedByUserId: String(baseData?.claimedByUserId || ""),
          createdAt: baseData?.createdAt,
        });
        await setDoc(doc(db, "targets", resolvedTargetId), mergedPayload, { merge: true });
      }

      const evidenceTier = classifyEvidenceTier(uploadedImageUrls.length, sanitizedDescription);
      const reportRef = await addDoc(collection(db, "reports"), {
        targetId: resolvedTargetId,
        authorId: user?.uid || "",
        authorEmail: user?.email || "",
        reporterName: sanitizedReporterName,
        isAnonymousReporter: anonymousMode,
        authorPhotoURL: anonymousMode ? getAvatarUrl(null) : getAvatarUrl(user?.photoURL),
        isGuest: !user,
        targetName: targetName.trim(),
        targetNameKey: duplicateCheckKey,
        targetPhone: normalizePhone(targetPhone.trim()),
        targetLink: normalizeUrl(targetLink.trim()),
        category: category,
        description: sanitizedDescription,
        descriptionHash,
        evidenceImages: uploadedImageUrls,
        evidenceTier,
        status: isAdmin && reportAsAdmin ? "approved" : "pending",
        adminVerified: isAdmin && reportAsAdmin,
        adminPinned: isAdmin && reportAsAdmin,
        allowUserEdit: false,
        editRequestPending: false,
        reviewNote: "",
        source: isAdmin && reportAsAdmin ? "admin_direct" : anonymousMode ? "user_anonymous" : "user",
        createdAt: Date.now(),
        ...(isAdmin && reportAsAdmin ? { reviewedAt: Date.now() } : {}),
      });

      if (!(isAdmin && reportAsAdmin) && user) {
        await addDoc(collection(db, "notifications"), {
          userId: user.uid,
          reportId: reportRef.id,
          status: "pending",
          title: lang === "ar" ? "تم استلام البلاغ" : "Report received",
          message: lang === "ar" ? "بلاغك اتسجل وبيراجعه فريقنا الآن." : "Your report was submitted and is now under review.",
          read: false,
          createdAt: Date.now(),
        });

        await addDoc(collection(db, "notifications"), {
          audience: "admin",
          reportId: reportRef.id,
          status: "pending_review",
          title: lang === "ar" ? "بلاغ جديد بانتظار المراجعة" : "New report awaiting review",
          message:
            lang === "ar"
              ? `عميل أرسل بلاغ جديد عن: ${targetName.trim() || "-"}.`
              : `A customer submitted a new report for: ${targetName.trim() || "-"}.`,
          targetName: targetName.trim(),
          targetLink: normalizeUrl(targetLink.trim()),
          authorId: user.uid,
          authorEmail: user.email || "",
          read: false,
          createdAt: Date.now(),
        });
      }
      if (resolvedTargetId) {
        await syncTargetStats(db, resolvedTargetId);
      }

      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setFiles([]);
      setImagePreviews([]);
      setDescription("");
      setReporterNameInput("");
      setAnonymousMode(false);
      setTargetPhone("");
      if (!lockPreset) {
        setTargetName("");
        setTargetLink("");
      }
      setCaptchaToken("");
      setSuccess(true);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/SUPABASE_STORAGE_UNAVAILABLE/i.test(message)) {
        setErrorMsg(
          lang === "ar"
            ? "رفع الصور غير متاح حالياً بسبب إعدادات Supabase على الخادم. تقدر تكمل البلاغ بدون صور أو اضبط متغيرات البيئة."
            : "Image upload is currently unavailable due to Supabase server configuration. You can submit without images or fix environment variables."
        );
      } else if (/row-level security|permission|not allowed|policy/i.test(message)) {
        setErrorMsg(
          lang === "ar"
            ? "فشل رفع الصور بسبب صلاحيات Supabase Storage (RLS). تأكد من Policies الخاصة بالـ bucket report-evidence."
            : "Image upload failed due to Supabase Storage RLS policies. Please verify bucket policies for report-evidence."
        );
      } else {
        setErrorMsg(
          lang === "ar"
            ? `حصلت مشكلة أثناء إرسال البلاغ: ${message}`
            : `Something went wrong while submitting your report: ${message}`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-32 min-h-screen">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-4">{lang === "ar" ? "تقديم بلاغ جديد" : "Submit a new report"}</h1>
        <p className="text-muted-foreground font-medium">{lang === "ar" ? "قدم دليلك وساعدنا نحذر غيرك من النصابين." : "Share your evidence and help protect others from scammers."}</p>
      </div>

      {success ? (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-10 rounded-3xl text-center border-green-500/30">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{lang === "ar" ? "تم إرسال تجربتك بنجاح ✅" : "Your experience was submitted successfully ✅"}</h2>
          <p className="text-muted-foreground">{lang === "ar" ? "يمكنك إنشاء حساب لاحقًا لإدارة بلاغاتك أو تعديلها." : "You can create an account later to manage or edit your reports."}</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-10 rounded-3xl space-y-6">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-xl flex items-center gap-3 font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {supabaseUnavailable && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 p-4 rounded-xl flex items-center gap-3 font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                {lang === "ar"
                  ? "مرفقات الصور متوقفة مؤقتًا بسبب عدم ضبط متغيرات Supabase في Vercel. تقدر تبعت البلاغ بدون صور حاليًا."
                  : "Image attachments are temporarily unavailable because Supabase env vars are missing on Vercel. You can submit the report without images for now."}
              </span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
            <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
              NAME <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                required
                value={reporterNameInput}
                onChange={(e) => {
                  setReporterNameInput(e.target.value);
                  setAnonymousMode(false);
                }}
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium"
                placeholder={lang === "ar" ? "اكتب الاسم اللي هيظهر في البلاغ" : "Enter the name shown in the report"}
              />
              <button
                type="button"
                onClick={generateAnonymousName}
                className="rounded-xl border border-border px-4 py-3 text-sm font-black whitespace-nowrap hover:bg-secondary transition-colors"
              >
                {lang === "ar" ? "اسم عشوائي" : "Random name"}
              </button>
            </div>
          </div>

          {lockPreset && (presetTargetName || presetTargetLink) && (
            <div className="bg-primary/10 border border-primary/25 text-foreground p-4 rounded-xl flex items-start gap-3 font-semibold dark:bg-neon-blue/10 dark:border-neon-blue/25">
              <AlertCircle className="w-5 h-5 shrink-0 text-primary dark:text-neon-blue" />
              <div className="space-y-1">
                <p className="font-black">{lang === "ar" ? "الصفحة محددة تلقائياً" : "Target preselected"}</p>
                <p className="text-sm text-muted-foreground font-medium">
                  {lang === "ar"
                    ? "اسم الصفحة واللينك جايين من صفحة الهدف، ومقفولين لتسهيل كتابة البلاغ."
                    : "The target name and link were filled from the target page and locked to save your time."}
                </p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{lang === "ar" ? "إسم الصفحة / البائع" : "Page / seller name"} <span className="text-destructive">*</span></label>
              <input 
                type="text" 
                required
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                disabled={lockPreset && Boolean(presetTargetName)}
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium disabled:opacity-70"
                placeholder="مثال: Ahmed Store"
              />
            </div>

            <div className="space-y-2">
              <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{lang === "ar" ? "التصنيف" : "Category"} <span className="text-destructive">*</span></label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-background border border-border p-3 items-center rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium h-[50px]"
              >
                <option value="scam">{lang === "ar" ? "نصب / سرقة" : "Scam / account theft"}</option>
                <option value="delay">{lang === "ar" ? "تأخير شديد في التسليم" : "Major delivery delay"}</option>
                <option value="bad_treatment">{lang === "ar" ? "سوء تعامل / إساءة" : "Poor treatment / abuse"}</option>
                <option value="suspicious_untrusted">{lang === "ar" ? "مشبوهة / غير موثوق" : "Suspicious / untrusted"}</option>
                <option value="successful_transaction">{lang === "ar" ? "تجربة ناجحة / معاملة سليمة" : "Successful transaction"}</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{lang === "ar" ? "رقم الهاتف (اختياري)" : "Phone number (optional)"}</label>
              <input 
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium text-left dir-ltr placeholder:text-right"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{lang === "ar" ? "لينك الصفحة (اختياري)" : "Page link (optional)"}</label>
              <input 
                type="url"
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                disabled={lockPreset && Boolean(presetTargetLink)}
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium text-left dir-ltr placeholder:text-right disabled:opacity-70"
                placeholder="https://facebook.com/..."
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{lang === "ar" ? "وصف اللي حصل" : "What happened"} <span className="text-destructive">*</span></label>
            <textarea 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background border border-border p-4 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium min-h-[120px] resize-y"
              placeholder={lang === "ar" ? "احكي بالتفصيل إيه اللي حصل علشان غيرك يستفيد..." : "Describe what happened in detail..."}
            ></textarea>
          </div>

          {isAdmin && (
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportAsAdmin}
                  onChange={(e) => setReportAsAdmin(e.target.checked)}
                />
                <span>{lang === "ar" ? "Report as admin (تعليق موثق ومثبت)" : "Report as admin (verified + pinned comment)"}</span>
              </label>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{lang === "ar" ? "الأدلة الإسكرين شوت (المصداقية)" : "Evidence screenshots"}</label>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">{lang === "ar" ? "حد أقصى 10 صور" : "Max 10 images"}</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {imagePreviews.map((img, i) => (
                <div key={i} className="aspect-square rounded-xl bg-secondary overflow-hidden border border-border relative">
                  <img src={img} alt={lang === "ar" ? "دليل" : "Evidence"} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 rounded-md bg-black/70 text-white text-xs px-1.5 py-0.5"
                    aria-label={lang === "ar" ? "حذف الصورة" : "Remove image"}
                  >
                    ×
                  </button>
                </div>
              ))}
              
              {imagePreviews.length < 10 && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:border-primary dark:hover:border-neon-blue transition-all cursor-pointer">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-sm font-bold">{lang === "ar" ? "رفع صورة" : "Upload image"}</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground font-medium">{lang === "ar" ? "ملاحظة: تأكد من إخفاء معلوماتك الشخصية من الصور قبل رفعها." : "Note: hide your personal information before uploading screenshots."}</p>
          </div>

          {turnstileEnabled ? (
            <div className="space-y-2">
              <label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                {lang === "ar" ? "التحقق الأمني" : "Security verification"}
              </label>
              <TurnstileCaptcha
                onToken={(token) => {
                  setCaptchaBroken(false);
                  setCaptchaToken(token);
                }}
                onError={() => setCaptchaBroken(true)}
              />
              {captchaBroken && (
                <p className="text-xs font-semibold text-destructive">
                  {lang === "ar"
                    ? "تعذر تحميل التحقق. حدّث الصفحة أو تأكد من إعدادات Turnstile."
                    : "Failed to load verification. Refresh or check Turnstile configuration."}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
              {lang === "ar"
                ? "تنبيه: Turnstile غير مفعل في البيئة الحالية."
                : "Notice: Turnstile is not enabled in this environment."}
            </p>
          )}

          <div className="pt-6 border-t border-border mt-8 flex justify-end">
            <button 
              type="submit" 
              disabled={isSubmitting || loading}
              className="bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-8 py-4 rounded-xl hover:scale-[1.02] transition-transform w-full md:w-auto shadow-[0_0_15px_rgba(37,99,235,0.3)] dark:shadow-[0_0_15px_rgba(0,243,255,0.3)] disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSubmitting ? (lang === "ar" ? "جاري الإرسال..." : "Submitting...") : (lang === "ar" ? "شارك تجربتك" : "Share Your Experience")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen items-center justify-center flex">Loading...</div>}>
        <ReportContent />
      </Suspense>
    </>
  );
}
