"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Navbar } from "@/components/Navbar";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/lib/i18n/context";
import { extractTargetIdFromSlug, type TargetRecord } from "@/lib/target-utils";
import { ArrowLeft, BadgeInfo, Image as ImageIcon, ShieldCheck } from "lucide-react";

export default function TargetAboutPage() {
  const params = useParams();
  const { lang } = useLanguage();
  const routeToken = String(params.id || "");
  const targetId = extractTargetIdFromSlug(routeToken);

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TargetRecord | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "targets", targetId));
        if (!alive) return;
        if (!snap.exists()) {
          setTarget(null);
          return;
        }
        setTarget({ id: snap.id, ...snap.data() } as TargetRecord);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [targetId]);

  const about = target?.about;
  const evidenceImages = useMemo(() => (Array.isArray(about?.evidenceImages) ? about?.evidenceImages : []), [about]);
  const title =
    about?.title?.trim() ||
    (lang === "ar"
      ? `عن ${String(target?.name || "هذه الصفحة")}`
      : `About ${String(target?.name || "this page")}`);
  const description =
    about?.description?.trim() ||
    (lang === "ar"
      ? "هنا هتلاقي سبب إدراج الصفحة ووصف مختصر، وأي إثباتات تم جمعها وإدراجها بواسطة القائمين على الموقع."
      : "Here you’ll find why this page was added, a short description, and any evidence curated by the site moderators.");

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28">
        <Link
          href={`/target/${encodeURIComponent(targetId)}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-bold"
        >
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
          <span>{lang === "ar" ? "رجوع لصفحة الهدف" : "Back to target"}</span>
        </Link>

        <section className="mt-6 glass-panel rounded-3xl border border-border p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight break-words">{title}</h1>
              {target?.name ? (
                <p className="mt-2 text-sm font-bold text-muted-foreground">
                  {lang === "ar" ? "الهدف:" : "Target:"} <span className="text-foreground">{target.name}</span>
                </p>
              ) : null}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black text-primary dark:text-neon-blue">
              <ShieldCheck className="h-4 w-4" />
              <span>
                {lang === "ar"
                  ? "تم البحث وإدراج هذه الإثباتات من القائمين على الموقع"
                  : "Evidence reviewed and curated by site moderators"}
              </span>
            </div>
          </div>

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

