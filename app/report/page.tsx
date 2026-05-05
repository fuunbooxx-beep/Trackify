"use client";

import { Suspense, useState, useContext, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthContext } from "@/lib/providers";
import { ShieldAlert, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDocs, setDoc } from "firebase/firestore";
import { motion } from "motion/react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isAdminUser } from "@/lib/auth-user";
import { getAvatarUrl } from "@/lib/avatar";
import { detectPlatform, getRiskStatusFromReportCount, getTargetAliases, getTargetLinks, getTargetPhones, getTargetReasons, normalizePhone, normalizeTargetName, normalizeUrl, targetPayload, type TargetRecord } from "@/lib/target-utils";
import { detectExistingTargetMatch } from "@/lib/target-linking";
import { classifyEvidenceTier } from "@/lib/evidence-classify";
import { syncTargetStats } from "@/lib/trust-score";

function ReportContent() {
  const { user, loading } = useContext(AuthContext);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLanguage();
  
  const [targetName, setTargetName] = useState(searchParams.get("target") || "");
  const [targetPhone, setTargetPhone] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [category, setCategory] = useState("scam");
  const [description, setDescription] = useState("");
  const [reportAsAdmin, setReportAsAdmin] = useState(false);
  
  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createSupabaseBrowserClient();
  const evidenceBucket = "report-evidence";
  const isAdmin = isAdminUser(user);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    const imageOnly = selected.filter((file) => file.type.startsWith("image/"));
    if (!imageOnly.length) {
      setErrorMsg(lang === "ar" ? "اختار صور فقط (JPG/PNG/WebP)." : "Please select image files only (JPG/PNG/WebP).");
      return;
    }

    const maxAllowed = 10;
    const remainingSlots = Math.max(0, maxAllowed - files.length);
    if (remainingSlots <= 0) {
      setErrorMsg(lang === "ar" ? "وصلت للحد الأقصى (10 صور)." : "Maximum reached (10 images).");
      return;
    }

    const accepted = imageOnly.slice(0, remainingSlots);
    const tooLarge = accepted.find((file) => file.size > 5 * 1024 * 1024);
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
    if (!user) return;
    if (!targetName) {
      setErrorMsg(lang === "ar" ? "الرجاء إدخال إسم الصفحة أو البائع." : "Please enter page or seller name.");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const safeName = file.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
        const filePath = `${user.uid}/${Date.now()}_${i}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from(evidenceBucket).upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(evidenceBucket).getPublicUrl(filePath);
        uploadedImageUrls.push(data.publicUrl);
      }

      let resolvedTargetId = "";
      const normalizedTargetName = normalizeTargetName(targetName);

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

      const evidenceTier = classifyEvidenceTier(uploadedImageUrls.length, description);
      const reportRef = await addDoc(collection(db, "reports"), {
        targetId: resolvedTargetId,
        authorId: user.uid,
        authorEmail: user.email || "",
        reporterName: user.displayName || "",
        authorPhotoURL: getAvatarUrl(user.photoURL),
        targetName: targetName.trim(),
        targetPhone: normalizePhone(targetPhone.trim()),
        targetLink: normalizeUrl(targetLink.trim()),
        category: category,
        description: description,
        evidenceImages: uploadedImageUrls,
        evidenceTier,
        status: isAdmin && reportAsAdmin ? "approved" : "pending",
        adminVerified: isAdmin && reportAsAdmin,
        adminPinned: isAdmin && reportAsAdmin,
        allowUserEdit: false,
        editRequestPending: false,
        reviewNote: "",
        source: isAdmin && reportAsAdmin ? "admin_direct" : "user",
        createdAt: Date.now(),
        ...(isAdmin && reportAsAdmin ? { reviewedAt: Date.now() } : {}),
      });

      if (!(isAdmin && reportAsAdmin)) {
        await addDoc(collection(db, "notifications"), {
          userId: user.uid,
          reportId: reportRef.id,
          status: "pending",
          title: lang === "ar" ? "تم استلام البلاغ" : "Report received",
          message: lang === "ar" ? "بلاغك اتسجل وبيراجعه فريقنا الآن." : "Your report was submitted and is now under review.",
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
      setSuccess(true);
      setTimeout(() => {
        router.push("/profile");
      }, 2000);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/row-level security|permission|not allowed|policy/i.test(message)) {
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

      {loading ? (
        <div className="text-center">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
      ) : !user ? (
        <div className="glass-panel p-10 rounded-3xl text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">{lang === "ar" ? "لازم تسجل دخول الأول!" : "You need to sign in first!"}</h2>
          <p className="text-muted-foreground mb-8">{lang === "ar" ? "عشان نتحقق من صحة البلاغات ونمنع السبام، لازم تسجّل دخول بحسابك (Trackify عبر Supabase)." : "To verify reports and prevent spam, please sign in with your account."}</p>
          <Link href={`/auth?next=${encodeURIComponent(`/report${targetName ? `?target=${encodeURIComponent(targetName)}` : ""}`)}`} className="inline-flex bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform">
            {lang === "ar" ? "تسجيل الدخول للاستمرار" : "Sign in to continue"}
          </Link>
        </div>
      ) : success ? (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-10 rounded-3xl text-center border-green-500/30">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{lang === "ar" ? "تم استلام بلاغك بنجاح!" : "Your report was submitted successfully!"}</h2>
          <p className="text-muted-foreground">{lang === "ar" ? "جاري تحويلك لصفحة حسابك لمتابعة الحالة..." : "Redirecting you to your profile to track status..."}</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-10 rounded-3xl space-y-6">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-xl flex items-center gap-3 font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
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
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium"
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
                <option value="bad_treatment">{lang === "ar" ? "سوء معاملة / شتيمة" : "Abusive behavior"}</option>
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
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:focus:ring-neon-blue transition-shadow font-medium text-left dir-ltr placeholder:text-right"
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

          <div className="pt-6 border-t border-border mt-8 flex justify-end">
            <button 
              type="submit" 
              disabled={isSubmitting}
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
