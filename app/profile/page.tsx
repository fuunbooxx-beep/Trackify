"use client";

import { Navbar } from "@/components/Navbar";
import { showRouteLoader } from "@/components/RouteLoadingController";
import { AuthContext } from "@/lib/providers";
import { useContext, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, LayoutDashboard, Link as LinkIcon, Loader2, Save, ShieldCheck, UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "@/lib/i18n/context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAdminUser } from "@/lib/auth-user";
import { collection, doc, DocumentData, getDocs, query, QueryDocumentSnapshot, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAvatarUrl } from "@/lib/avatar";

export default function ProfilePage() {
  const { user, loading } = useContext(AuthContext);
  const { lang, t } = useLanguage();
  const router = useRouter();
  const isAdmin = isAdminUser(user);
  const [reports, setReports] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(user?.photoURL || "");
  }, [user?.photoURL]);

  useEffect(() => {
    if (isAdmin) router.prefetch("/dashboard");
  }, [router, isAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setDataLoading(true);
      try {
        const tasks: Promise<any>[] = [
          getDocs(query(collection(db, "reports"), where("authorId", "==", user.uid))),
          getDocs(query(collection(db, "notifications"), where("userId", "==", user.uid))),
        ];
        if (isAdmin) {
          tasks.push(getDocs(query(collection(db, "notifications"), where("audience", "==", "admin"))));
        }
        const [reportsSnap, notificationsSnap, adminNotificationsSnap] = await Promise.all(tasks);
        setReports(
          reportsSnap.docs
            .map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        );
        setNotifications(
          notificationsSnap.docs
            .map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        );
        if (isAdmin && adminNotificationsSnap) {
          setAdminNotifications(
            adminNotificationsSnap.docs
              .map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }))
              .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
          );
        } else {
          setAdminNotifications([]);
        }
      } finally {
        setDataLoading(false);
      }
    };
    void fetchData();
  }, [user, isAdmin]);

  const saveAvatarUrl = async (nextUrl: string) => {
    if (!user) return;
    const cleanUrl = nextUrl.trim();
    setAvatarSaving(true);
    setProfileMsg("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          avatar_url: cleanUrl || null,
          picture: cleanUrl || null,
        },
      });
      if (authError) throw authError;

      await supabase.from("profiles").upsert(
        {
          id: user.uid,
          email: user.email,
          display_name: user.displayName,
          avatar_url: cleanUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      const reportsSnap = await getDocs(query(collection(db, "reports"), where("authorId", "==", user.uid)));
      const batch = writeBatch(db);
      reportsSnap.docs.forEach((item) => {
        batch.update(doc(db, "reports", item.id), {
          authorPhotoURL: getAvatarUrl(cleanUrl),
          updatedAt: Date.now(),
        });
      });
      await batch.commit();

      setAvatarUrl(cleanUrl);
      setReports((current) => current.map((report) => ({ ...report, authorPhotoURL: getAvatarUrl(cleanUrl) })));
      setProfileMsg(lang === "ar" ? "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064a\u0644 \u0628\u0646\u062c\u0627\u062d." : "Profile photo updated successfully.");
    } catch (error) {
      console.error(error);
      setProfileMsg(lang === "ar" ? "\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064a\u0644." : "Failed to update profile photo.");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleAvatarFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setProfileMsg(lang === "ar" ? "\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0641\u0642\u0637." : "Please upload an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setProfileMsg(lang === "ar" ? "\u062d\u062c\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0627\u0632\u0645 \u064a\u0643\u0648\u0646 \u0623\u0642\u0644 \u0645\u0646 4MB." : "Image must be smaller than 4MB.");
      return;
    }

    setAvatarUploading(true);
    setProfileMsg("");
    try {
      const uploadForm = new FormData();
      uploadForm.set("ownerKey", `${user.uid}_avatar`);
      uploadForm.append("files", file);
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
        const details = uploadBody.details ? ` (${uploadBody.details})` : "";
        throw new Error(`avatar_upload_failed${details}`);
      }
      const firstUrl = uploadBody.urls?.[0];
      if (!firstUrl) throw new Error("Failed to resolve uploaded avatar URL");
      await saveAvatarUrl(firstUrl);
    } catch (error) {
      console.error(error);
      setProfileMsg(
        lang === "ar"
          ? "\u062a\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629. \u062a\u0623\u0643\u062f \u0645\u0646 \u0625\u0639\u062f\u0627\u062f\u0627\u062a Cloudinary."
          : "Failed to upload photo. Please verify Cloudinary configuration."
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen items-center justify-center flex"><Navbar />{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>;
  if (!user) return <div className="min-h-screen items-center justify-center flex"><Navbar />{lang === "ar" ? "لازم تسجل دخول الأول." : "You need to sign in first."}</div>;

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-32 min-h-screen">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-10 rounded-[32px] text-center mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full shadow-lg" />
          <div className="relative mx-auto mb-4 h-24 w-24">
            <img src={getAvatarUrl(avatarUrl)} alt={lang === "ar" ? "الملف الشخصي" : "Profile"} className="h-24 w-24 rounded-full border-4 border-background object-cover shadow-lg" />
            <button
              type="button"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={avatarUploading || avatarSaving}
              className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition hover:bg-secondary disabled:opacity-60"
              aria-label={lang === "ar" ? "\u0631\u0641\u0639 \u0635\u0648\u0631\u0629" : "Upload photo"}
            >
              {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </button>
            <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarFileSelected} className="hidden" />
          </div>
          <h1 className="text-3xl font-black mb-1">{user.displayName}</h1>
          <p className="text-muted-foreground font-medium mb-6">{user.email}</p>
          <div className="mx-auto mb-5 max-w-xl rounded-2xl border border-border bg-background/70 p-3 text-left">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
              {lang === "ar" ? "\u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064a\u0644" : "Profile photo"}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  dir="ltr"
                  className="input pl-10"
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              <button
                type="button"
                disabled={avatarSaving || avatarUploading}
                onClick={() => void saveAvatarUrl(avatarUrl)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 dark:bg-neon-blue dark:text-black"
              >
                {avatarSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {lang === "ar" ? "\u062d\u0641\u0638" : "Save"}
              </button>
              <button
                type="button"
                disabled={avatarSaving || avatarUploading}
                onClick={() => avatarFileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-black transition hover:bg-secondary/70 disabled:opacity-60"
              >
                {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {lang === "ar" ? "\u0631\u0641\u0639" : "Upload"}
              </button>
            </div>
            {profileMsg && <p className="mt-2 text-xs font-bold text-muted-foreground">{profileMsg}</p>}
          </div>
          
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:bg-neon-blue/10 dark:text-neon-blue px-4 py-2 rounded-xl font-bold">
            <ShieldCheck className="w-5 h-5" />
            <span>{lang === "ar" ? "عضو موثوق - مستوى الثقة: متوسط" : "Trusted member - trust level: medium"}</span>
          </div>
        </motion.div>

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="glass-panel mb-6 rounded-3xl border border-primary/25 bg-primary/[0.06] p-6 dark:border-neon-blue/30 dark:bg-neon-blue/[0.06]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-start">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  {lang === "ar" ? "إدارة المنصة" : "Platform administration"}
                </p>
                <p className="mt-1 text-lg font-black">
                  {lang === "ar"
                    ? "لوحة الإضافة والتحكم في الصفحات والبلاغات تظهر هنا فقط."
                    : "Target management and moderation — available from your profile only."}
                </p>
              </div>
              <Link
                href="/dashboard"
                onClick={showRouteLoader}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90 dark:bg-neon-blue dark:text-black"
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>{t("navbar.dashboard", "Dashboard")}</span>
              </Link>
            </div>
          </motion.div>
        )}

        {isAdmin && (
          <div className="glass-panel p-8 rounded-3xl mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold">{lang === "ar" ? "تنبيهات الإدارة" : "Admin alerts"}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-black">
                {adminNotifications.filter((n) => n.read !== true).length} {lang === "ar" ? "غير مقروء" : "unread"}
              </span>
            </div>
            {adminNotifications.length === 0 ? (
              <p className="text-muted-foreground font-medium">
                {lang === "ar" ? "لا توجد تنبيهات إدارة حالياً." : "No admin alerts right now."}
              </p>
            ) : (
              <div className="space-y-3">
                {adminNotifications.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-3 bg-background/60">
                    <p className="font-bold">{item.title || "-"}</p>
                    <p className="text-sm text-muted-foreground">{item.message || "-"}</p>
                    {(item.targetName || item.targetLink) && (
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {item.targetName ? `• ${item.targetName}` : ""} {item.targetLink ? `• ${item.targetLink}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="glass-panel p-8 rounded-3xl">
          <h2 className="text-xl font-bold mb-4">{lang === "ar" ? "نشاطك وبلاغاتك" : "Your activity and reports"}</h2>
          {dataLoading ? (
            <p className="text-muted-foreground font-medium">{lang === "ar" ? "جاري تحميل بياناتك..." : "Loading your data..."}</p>
          ) : reports.length === 0 ? (
            <p className="text-muted-foreground font-medium">{lang === "ar" ? "مفيش أي بلاغات مسجلة باسمك حالياً. لو في صفحة نصبت عليك أو واجهت مشكلة في التعامل، تقدر تقدم بلاغ من القائمة فوق." : "No reports are currently linked to your account. If any page scams you or behaves badly, you can submit a report from the top menu."}</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-border p-3 bg-background/60">
                  <p className="font-bold">{report.targetName || "-"}</p>
                  <p className="text-sm text-muted-foreground">{report.description || "-"}</p>
                  <p className="text-xs mt-1">
                    {lang === "ar" ? "الحالة:" : "Status:"}{" "}
                    <span className="font-semibold">
                      {report.status === "approved"
                        ? lang === "ar"
                          ? "تمت الموافقة"
                          : "Approved"
                        : report.status === "rejected"
                          ? lang === "ar"
                            ? "مرفوض"
                            : "Rejected"
                          : lang === "ar"
                            ? "قيد المراجعة"
                            : "Under review"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel p-8 rounded-3xl mt-6">
          <h2 className="text-xl font-bold mb-4">{lang === "ar" ? "الإشعارات" : "Notifications"}</h2>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground font-medium">{lang === "ar" ? "لا توجد إشعارات حالياً." : "No notifications yet."}</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-3 bg-background/60">
                  <p className="font-bold">{item.title || "-"}</p>
                  <p className="text-sm text-muted-foreground">{item.message || "-"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
