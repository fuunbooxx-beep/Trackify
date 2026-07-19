"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/lib/i18n/context";
import { extractTargetIdFromSlug, getTargetHref, slugifyTargetName, type TargetRecord } from "@/lib/target-utils";
import { AuthContext } from "@/lib/providers";
import { isAdminUser } from "@/lib/auth-user";
import { ArrowLeft, BadgeInfo, Image as ImageIcon, Loader2, ShieldCheck, UploadCloud, X } from "lucide-react";

export default function TargetAboutPage() {
  const params = useParams();
  const { lang } = useLanguage();
  const routeToken = String(params.id || "");
  const tokenCandidateId = extractTargetIdFromSlug(routeToken);
  const { user } = useContext(AuthContext);
  const isAdmin = isAdminUser(user);

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TargetRecord | null>(null);
  const [resolvedTargetId, setResolvedTargetId] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  const [aboutFiles, setAboutFiles] = useState<File[]>([]);
  const [aboutPreviews, setAboutPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const directSnap = await getDoc(doc(db, "targets", tokenCandidateId));
        if (!alive) return;

        if (directSnap.exists()) {
          const next = { id: directSnap.id, ...directSnap.data() } as TargetRecord;
          setTarget(next);
          setResolvedTargetId(String(next.id || ""));
          setAboutTitle(String(next.about?.title || ""));
          setAboutDescription(String(next.about?.description || ""));
          return;
        }

        const slugToken = decodeURIComponent(routeToken || "").trim().toLowerCase();
        const allTargetsSnap = await getDocs(collection(db, "targets"));
        if (!alive) return;
        const matchedTarget = allTargetsSnap.docs
          .map((item) => ({ id: item.id, ...item.data() } as TargetRecord))
          .find((item) => slugifyTargetName(String(item.name || "")) === slugToken);

        if (matchedTarget) {
          setTarget(matchedTarget);
          setResolvedTargetId(String(matchedTarget.id || ""));
          setAboutTitle(String(matchedTarget.about?.title || ""));
          setAboutDescription(String(matchedTarget.about?.description || ""));
        } else {
          setTarget(null);
          setResolvedTargetId("");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [tokenCandidateId, routeToken]);

  const about = target?.about;
  const evidenceImages = useMemo(() => (Array.isArray(about?.evidenceImages) ? about?.evidenceImages : []), [about]);
  const resolvedName = String(target?.name || "").trim();
  const title = about?.title?.trim()
    ? about.title.trim()
    : lang === "ar"
      ? `عن ${resolvedName || "هذه الصفحة"}`
      : `ABOUT ${resolvedName || "this page"}`;
  const description =
    about?.description?.trim() ||
    (lang === "ar"
      ? "هنا هتلاقي سبب إدراج الصفحة ووصف مختصر، وأي إثباتات تم جمعها وإدراجها بواسطة القائمين على الموقع."
      : "Here you’ll find why this page was added, a short description, and any evidence curated by the site moderators.");

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const imageOnly = selected.filter((file) => file.type.startsWith("image/"));
    const maxAllowed = 10;
    const remaining = Math.max(0, maxAllowed - aboutFiles.length);
    const accepted = imageOnly.slice(0, remaining);
    setAboutFiles((prev) => [...prev, ...accepted]);
    setAboutPreviews((prev) => [...prev, ...accepted.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removePreview = (index: number) => {
    setAboutFiles((prev) => prev.filter((_, i) => i !== index));
    setAboutPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const uploadImagesThroughApi = async (ownerKey: string, files: File[]) => {
    if (!files.length) return [] as string[];
    const uploadForm = new FormData();
    uploadForm.set("ownerKey", ownerKey);
    files.forEach((file) => uploadForm.append("files", file));
    const uploadRes = await fetch("/api/report/upload-evidence", {
      method: "POST",
      body: uploadForm,
    });
    const uploadBody = (await uploadRes.json().catch(() => ({}))) as {
      error?: string;
      details?: string;
      urls?: string[];
    };
    if (!uploadRes.ok) {
      throw new Error(uploadBody.error || uploadBody.details || "upload_failed");
    }
    return Array.isArray(uploadBody.urls) ? uploadBody.urls : [];
  };

  const saveAbout = async () => {
    if (!isAdmin || !user) return;
    if (!resolvedTargetId) return;
    try {
      setSaving(true);
      setActionMsg("");

      const uploaded = await uploadImagesThroughApi(`${user.uid}_target_about_${resolvedTargetId}`, aboutFiles);
      const mergedEvidence = Array.from(new Set([...(evidenceImages || []), ...uploaded])).slice(0, 10);

      const saveResponse = await fetch(`/api/admin/targets/${encodeURIComponent(resolvedTargetId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, name: target?.name || resolvedTargetId, about: {
          title: aboutTitle.trim(),
          description: aboutDescription.trim(),
          evidenceImages: mergedEvidence,
          addedBy: "admins",
          updatedAt: Date.now(),
        } }),
      });
      if (!saveResponse.ok) throw new Error("target_save_failed");

      const snap = await getDoc(doc(db, "targets", resolvedTargetId));
      if (snap.exists()) setTarget({ id: snap.id, ...snap.data() } as TargetRecord);

      aboutPreviews.forEach((url) => URL.revokeObjectURL(url));
      setAboutFiles([]);
      setAboutPreviews([]);
      setEditing(false);
      setActionMsg(lang === "ar" ? "تم حفظ بيانات About بنجاح." : "About data saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMsg(lang === "ar" ? `تعذر حفظ بيانات About: ${message}` : `Failed to save About: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28">
        <Link
          href={target?.name ? getTargetHref({ id: String(target.id || ""), name: target.name }) : `/${encodeURIComponent(routeToken)}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-bold"
        >
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
          <span>{lang === "ar" ? "رجوع لصفحة الهدف" : "Back to target"}</span>
        </Link>

        <section className="mt-6 glass-panel rounded-3xl border border-border p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight break-words">{title}</h1>
              {resolvedName ? (
                <p className="mt-2 text-sm font-bold text-muted-foreground">
                  {lang === "ar" ? "الهدف:" : "Target:"} <span className="text-foreground">{resolvedName}</span>
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>
                {lang === "ar"
                  ? "تم البحث وإدراج هذه الإثباتات من القائمين على الموقع"
                  : "Evidence reviewed and curated by site moderators"}
              </span>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setActionMsg("");
                  setEditing((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-4 py-2.5 text-sm font-black transition hover:bg-secondary/60"
              >
                <BadgeInfo className="h-4 w-4" />
                {editing ? (lang === "ar" ? "إخفاء التعديل" : "Hide editor") : lang === "ar" ? "إضافة / تعديل بيانات About" : "Add / edit About data"}
              </button>
              {actionMsg ? (
                <span className="text-sm font-bold text-muted-foreground">{actionMsg}</span>
              ) : (
                <span className="text-sm font-bold text-muted-foreground">
                  {lang === "ar" ? "الأدلة هنا خاصة بإدارة الموقع." : "This evidence is managed by site admins."}
                </span>
              )}
            </div>
          ) : actionMsg ? (
            <p className="mt-4 text-sm font-bold text-muted-foreground">{actionMsg}</p>
          ) : null}

          {isAdmin && editing ? (
            <div className="mt-5 rounded-3xl border border-border bg-background/60 p-5">
              <div className="grid gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "العنوان (اختياري)" : "Title (optional)"}</p>
                  <input value={aboutTitle} onChange={(e) => setAboutTitle(e.target.value)} className="input mt-2" placeholder={lang === "ar" ? `ABOUT ${resolvedName}` : `ABOUT ${resolvedName}`} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "الوصف / السبب" : "Description / Why added"}</p>
                  <textarea
                    value={aboutDescription}
                    onChange={(e) => setAboutDescription(e.target.value)}
                    className="input mt-2 min-h-[120px]"
                    placeholder={lang === "ar" ? "اكتب سبب إدراج الصفحة ووصف مختصر + الدلائل..." : "Write why it was added, summary, and evidence context..."}
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                      {lang === "ar" ? "صور الإثبات (حتى 10)" : "Evidence images (up to 10)"}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2 text-xs font-black transition hover:bg-secondary/70"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {lang === "ar" ? "رفع صور" : "Upload images"}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />

                  {aboutPreviews.length ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {aboutPreviews.map((img, idx) => (
                        <div key={`${img}-${idx}`} className="group relative overflow-hidden rounded-2xl border border-border bg-background/60">
                          <button
                            type="button"
                            onClick={() => removePreview(idx)}
                            className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm transition hover:bg-secondary"
                            aria-label={lang === "ar" ? "حذف" : "Remove"}
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <img src={img} alt={lang === "ar" ? "معاينة" : "Preview"} className="h-28 w-full object-cover sm:h-32 md:h-36" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveAbout()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 dark:bg-neon-blue dark:text-black"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {lang === "ar" ? "حفظ About" : "Save About"}
                  </button>
                  <p className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "هيتم دمج الصور الجديدة مع الصور الموجودة." : "New images will be merged with existing ones."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-8 rounded-2xl border border-border bg-background/70 p-6 text-sm font-bold text-muted-foreground">
              {lang === "ar" ? "جاري تحميل البيانات..." : "Loading..."}
            </div>
          ) : !target ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-background/60 p-6 text-center">
              <p className="text-sm font-bold text-muted-foreground">
                {lang === "ar" ? "الهدف غير موجود." : "Target not found."}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-2xl border border-border bg-background/70 p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-neon-blue/10 dark:text-neon-blue">
                    <BadgeInfo className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm md:text-base font-bold text-foreground whitespace-pre-wrap leading-7">{description}</p>
                    {about?.updatedAt ? (
                      <p className="mt-2 text-xs font-bold text-muted-foreground">
                        {lang === "ar" ? "آخر تحديث:" : "Last updated:"}{" "}
                        {new Date(about.updatedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-black uppercase tracking-wide text-muted-foreground">
                    {lang === "ar" ? "صور وإثباتات" : "Images & Evidence"}
                  </h2>
                </div>

                {evidenceImages.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {evidenceImages.map((img, idx) => (
                      <a
                        key={`${img}-${idx}`}
                        href={img}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative overflow-hidden rounded-2xl border border-border bg-background/60"
                        aria-label={lang === "ar" ? "فتح صورة الإثبات" : "Open evidence image"}
                      >
                        <img
                          src={img}
                          alt={lang === "ar" ? "صورة إثبات" : "Evidence image"}
                          className="h-28 w-full object-cover transition-transform group-hover:scale-105 sm:h-32 md:h-36"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-center">
                    <p className="text-sm font-bold text-muted-foreground">
                      {lang === "ar" ? "لا توجد صور إثبات مضافة حتى الآن." : "No evidence images have been added yet."}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
