"use client";

import { useParams } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthContext } from "@/lib/providers";
import { isAdminUser } from "@/lib/auth-user";
import {
  AlertCircle,
  AlertTriangle,
  BadgeInfo,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Globe2,
  Image as ImageIcon,
  Instagram,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Reply,
  Send,
  Star,
  Pencil,
  Phone,
  ShieldCheck,
  ShieldQuestion,
  Store,
  Layers,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "motion/react";
import Link from "next/link";
import {
  extractTargetIdFromSlug,
  getTargetHref,
  getTargetAliases,
  getTargetInstapays,
  getTargetLinks,
  getTargetPhones,
  getTargetCategoryLabel,
  getTargetReasonDescription,
  getTargetReasonLabel,
  getTargetReasons,
  getStatusLabel,
  hostFromUrl,
  normalizeTargetCategory,
  platformLabel,
  slugifyTargetName,
  type TargetRecord,
} from "@/lib/target-utils";
import { useLanguage } from "@/lib/i18n/context";
import { getAdminAvatarUrl, getAvatarUrl } from "@/lib/avatar";
import { classifyEvidenceTier, formatEvidenceTierLabel } from "@/lib/evidence-classify";
import { syncTargetStats } from "@/lib/trust-score";

const INSTAPAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/2/20/InstaPay_Logo.png";

export default function TargetDetailsPage() {
  const params = useParams();
  const routeToken = String(params.id || "");
  const targetId = extractTargetIdFromSlug(routeToken);
  const { user } = useContext(AuthContext);
  const isAdmin = isAdminUser(user);
  const [target, setTarget] = useState<TargetRecord | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editReporterName, setEditReporterName] = useState("");
  const [editCategory, setEditCategory] = useState("scam");
  const [editEvidenceImages, setEditEvidenceImages] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [adminCommentReporterName, setAdminCommentReporterName] = useState("");
  const [adminCommentCategory, setAdminCommentCategory] = useState("scam");
  const [adminCommentText, setAdminCommentText] = useState("");
  const [adminCommentFiles, setAdminCommentFiles] = useState<File[]>([]);
  const [adminCommentPreviews, setAdminCommentPreviews] = useState<string[]>([]);
  const [creatingAdminComment, setCreatingAdminComment] = useState(false);
  const [adminReplyDrafts, setAdminReplyDrafts] = useState<Record<string, string>>({});
  const [savingAdminReplyId, setSavingAdminReplyId] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [showManualReportForm, setShowManualReportForm] = useState(false);
  const [manualReporterName, setManualReporterName] = useState("");
  const [manualCategory, setManualCategory] = useState("scam");
  const [manualDescription, setManualDescription] = useState("");
  const [manualTargetPhone, setManualTargetPhone] = useState("");
  const [manualTargetLink, setManualTargetLink] = useState("");
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [manualPreviews, setManualPreviews] = useState<string[]>([]);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number; title: string } | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const adminCommentFileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLanguage();
  const activeTargetId = String(target?.id || targetId);

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
      const details = uploadBody.details ? ` (${uploadBody.details})` : "";
      throw new Error(`image_upload_failed${details}`);
    }
    return uploadBody.urls || [];
  };

  const fetchReports = async (overrideTargetId?: string) => {
    const resolvedTargetId = String(overrideTargetId || target?.id || targetId);
    if (!resolvedTargetId) return;
    const reportsRef = collection(db, "reports");
    const reportsQuery = query(reportsRef, where("targetId", "==", resolvedTargetId));
    const reportsSnap = await getDocs(reportsQuery);
    setReports(
      reportsSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) => {
          const aPinned = a.adminPinned === true ? 1 : 0;
          const bPinned = b.adminPinned === true ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          return Number(b.createdAt || 0) - Number(a.createdAt || 0);
        })
    );
  };

  const refreshTargetAfterReportChange = async () => {
    await syncTargetStats(db, activeTargetId);
    const targetSnap = await getDoc(doc(db, "targets", activeTargetId));
    if (targetSnap.exists()) {
      setTarget({ id: targetSnap.id, ...targetSnap.data() } as TargetRecord);
    }
    await fetchReports(activeTargetId);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const docRef = doc(db, "targets", targetId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setTarget({ id: docSnap.id, ...docSnap.data() } as TargetRecord);
          await fetchReports(docSnap.id);
        } else {
          const slugToken = decodeURIComponent(routeToken || "").trim().toLowerCase();
          const allTargetsSnap = await getDocs(collection(db, "targets"));
          const matchedTarget = allTargetsSnap.docs
            .map((item) => ({ id: item.id, ...item.data() } as TargetRecord))
            .find((item) => slugifyTargetName(String(item.name || "")) === slugToken);

          if (matchedTarget) {
            setTarget(matchedTarget);
            await fetchReports(String(matchedTarget.id || ""));
          } else {
            setTarget(null);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [targetId, routeToken]);

  useEffect(() => {
    if (!lightbox) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight") {
        setLightbox((current) =>
          current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current
        );
      }
      if (event.key === "ArrowLeft") {
        setLightbox((current) => (current ? { ...current, index: Math.max(0, current.index - 1) } : current));
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightbox]);

  useEffect(() => {
    if (!target?.name) return;
    const previousTitle = document.title;
    document.title = `${target.name} | Trackify`;

    const cleanHref = getTargetHref(target);
    if (window.location.pathname !== cleanHref) {
      window.history.replaceState(null, "", cleanHref);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [target?.id, target?.name]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-32 flex flex-col items-center gap-3 text-primary dark:text-neon-blue font-bold">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>{lang === "ar" ? "جاري تحميل بيانات الصفحة..." : "Loading target details..."}</span>
        </div>
      </>
    );
  }

  if (!target) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-32 text-center">
          <h1 className="text-2xl font-bold">{lang === "ar" ? "الصفحة غير موجودة!" : "Target not found!"}</h1>
          <Link href="/" className="text-primary mt-4 inline-block">
            {lang === "ar" ? "العودة للرئيسية" : "Back to home"}
          </Link>
        </div>
      </>
    );
  }

  const phones = getTargetPhones(target);
  const instapays = getTargetInstapays(target);
  const links = getTargetLinks(target);
  const aliases = getTargetAliases(target);
  const categorySlug = normalizeTargetCategory(target.category);
  const categoryLabel = getTargetCategoryLabel(categorySlug, lang);
  const targetReasons = getTargetReasons(target);
  const reportCount = Number(target.reportCount ?? 0);
  const isHeavyReports = reportCount >= 15;
  const missingPhones = phones.length === 0;
  const missingLinks = links.length === 0;
  const isDealNotRecommended = reportCount >= 3;
  const isNoData = target.status === "no_data";
  const isHighRisk = target.status === "high_risk";
  const isTrusted = target.status === "trusted";
  const isWarning = target.status === "warning" || target.status === "severe_warning";
  const statusClass = isNoData
    ? "text-muted-foreground"
    : isHighRisk
      ? "text-destructive"
      : isTrusted
        ? "text-green-500"
        : isWarning
          ? "text-orange-500"
          : "text-yellow-500";
  const statusBg = isNoData
    ? "bg-muted/40 border-border dark:bg-muted/20"
    : isHighRisk
      ? "bg-destructive/10 border-destructive/20 dark:bg-destructive/5 dark:border-destructive/25"
      : isTrusted
        ? "bg-green-500/10 border-green-500/20 dark:bg-green-500/5 dark:border-green-500/25"
        : isWarning
          ? "bg-orange-500/10 border-orange-500/20 dark:bg-orange-500/5 dark:border-orange-500/25"
          : "bg-yellow-500/10 border-yellow-500/20 dark:bg-yellow-500/5 dark:border-yellow-500/25";
  const statusIcon = isNoData ? (
    <ShieldQuestion className="w-5 h-5" />
  ) : isHighRisk || isWarning ? (
    <AlertTriangle className="w-5 h-5" />
  ) : isTrusted ? (
    <ShieldCheck className="w-5 h-5" />
  ) : (
    <ShieldQuestion className="w-5 h-5" />
  );
  const successRatioPct =
    target.successRatio != null && !Number.isNaN(target.successRatio) ? Math.round(target.successRatio * 100) : null;
  const lastScamLabel = target.lastScamAt
    ? new Date(target.lastScamAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")
    : "—";
  const lastSuccessLabel = target.lastSuccessAt
    ? new Date(target.lastSuccessAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")
    : "—";

  const startEdit = (report: any) => {
    setEditingReportId(report.id);
    setEditDescription(String(report.description || ""));
    setEditReporterName(String(report.reporterName || ""));
    setEditCategory(String(report.category || "scam"));
    setEditEvidenceImages(Array.isArray(report.evidenceImages) ? report.evidenceImages : []);
    editNewPreviews.forEach((url) => URL.revokeObjectURL(url));
    setEditNewFiles([]);
    setEditNewPreviews([]);
    setActionMsg("");
  };

  const handleEditFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const imageOnly = selected.filter((file) => file.type.startsWith("image/"));
    const maxAllowed = 10;
    const currentCount = editEvidenceImages.length + editNewFiles.length;
    const remainingSlots = Math.max(0, maxAllowed - currentCount);
    if (remainingSlots <= 0) {
      setActionMsg(lang === "ar" ? "وصلت للحد الأقصى (10 صور)." : "Maximum reached (10 images).");
      event.target.value = "";
      return;
    }
    const accepted = imageOnly.slice(0, remainingSlots);
    setEditNewFiles((prev) => [...prev, ...accepted]);
    setEditNewPreviews((prev) => [...prev, ...accepted.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removeEditExistingImage = (index: number) => {
    setEditEvidenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditNewImage = (index: number) => {
    setEditNewFiles((prev) => prev.filter((_, i) => i !== index));
    setEditNewPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const saveReportEdit = async (report: any) => {
    if (!user) return;
    const isOwner = report.authorId === user.uid;
    const canEdit = isAdmin || (isOwner && report.allowUserEdit === true);
    if (!canEdit) return;

    try {
      setSavingReportId(report.id);
      const uploadedImageUrls = await uploadImagesThroughApi(`${user.uid}_edit_${report.id}`, editNewFiles);

      const combinedImages = [...editEvidenceImages, ...uploadedImageUrls].slice(0, 10);
      const patch: Record<string, unknown> = {
        description: editDescription.trim(),
        reporterName: editReporterName.trim(),
        evidenceImages: combinedImages,
        evidenceTier: classifyEvidenceTier(combinedImages.length, editDescription.trim()),
        updatedAt: Date.now(),
      };
      if (isAdmin) {
        patch.category = editCategory;
        patch.editRequestPending = false;
      } else {
        // Require admin permission every time for user edits.
        patch.allowUserEdit = false;
        patch.editRequestPending = false;
      }
      await updateDoc(doc(db, "reports", report.id), patch);
      await syncTargetStats(db, activeTargetId);
      editNewPreviews.forEach((url) => URL.revokeObjectURL(url));
      setEditNewFiles([]);
      setEditNewPreviews([]);
      setEditingReportId(null);
      const targetSnap = await getDoc(doc(db, "targets", activeTargetId));
      if (targetSnap.exists()) {
        setTarget({ id: targetSnap.id, ...targetSnap.data() } as TargetRecord);
      }
      await fetchReports();
      setActionMsg(lang === "ar" ? "تم تعديل البلاغ بنجاح." : "Report updated successfully.");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      if (/image_upload_failed|cloudinary_not_configured|upload_failed/i.test(message)) {
        setActionMsg(
          lang === "ar"
            ? "تعذر رفع صور التعديل. تأكد من إعدادات Cloudinary."
            : "Failed to upload edit images. Please verify Cloudinary configuration."
        );
      } else {
        setActionMsg(lang === "ar" ? "تعذر تعديل البلاغ." : "Failed to edit report.");
      }
    } finally {
      setSavingReportId(null);
    }
  };

  const requestEditPermission = async (report: any) => {
    if (!user || report.authorId !== user.uid) return;
    try {
      setSavingReportId(report.id);
      await updateDoc(doc(db, "reports", report.id), {
        editRequestPending: true,
        updatedAt: Date.now(),
      });
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        reportId: report.id,
        status: "edit_requested",
        title: lang === "ar" ? "تم إرسال طلب تعديل" : "Edit request sent",
        message: lang === "ar" ? "تم إرسال طلب تعديل البلاغ للإدارة." : "Your report edit request has been sent to admins.",
        read: false,
        createdAt: Date.now(),
      });
      await fetchReports();
      setActionMsg(lang === "ar" ? "تم إرسال طلب التعديل للإدارة." : "Edit request sent to admin.");
    } catch (error) {
      console.error(error);
      setActionMsg(lang === "ar" ? "تعذر إرسال طلب التعديل." : "Failed to send edit request.");
    } finally {
      setSavingReportId(null);
    }
  };

  const grantUserEdit = async (report: any) => {
    if (!isAdmin) return;
    try {
      setSavingReportId(report.id);
      await updateDoc(doc(db, "reports", report.id), {
        allowUserEdit: true,
        editRequestPending: false,
        updatedAt: Date.now(),
      });
      await addDoc(collection(db, "notifications"), {
        userId: report.authorId,
        reportId: report.id,
        status: "edit_permission_granted",
        title: lang === "ar" ? "تم السماح بالتعديل" : "Edit permission granted",
        message: lang === "ar" ? "الإدارة وافقت على تعديل بلاغك." : "Admin approved your request to edit this report.",
        read: false,
        createdAt: Date.now(),
      });
      await fetchReports();
      setActionMsg(lang === "ar" ? "تم منح صلاحية التعديل للعميل." : "Customer edit permission granted.");
    } catch (error) {
      console.error(error);
      setActionMsg(lang === "ar" ? "تعذر منح صلاحية التعديل." : "Failed to grant edit permission.");
    } finally {
      setSavingReportId(null);
    }
  };

  const deleteReport = async (report: any) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      lang === "ar"
        ? "\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0645\u0646\u062a\u061f \u0633\u064a\u062a\u0645 \u0625\u0639\u0627\u062f\u0629 \u062d\u0633\u0627\u0628 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u0646\u0633\u0628 \u0628\u0639\u062f \u0627\u0644\u062d\u0630\u0641."
        : "Are you sure you want to delete this comment? The score and percentages will be recalculated after deletion."
    );
    if (!confirmed) return;

    try {
      setDeletingReportId(report.id);
      setActionMsg("");
      await deleteDoc(doc(db, "reports", report.id));
      await refreshTargetAfterReportChange();
      setActionMsg(lang === "ar" ? "\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0643\u0648\u0645\u0646\u062a \u0648\u0625\u0639\u0627\u062f\u0629 \u062d\u0633\u0627\u0628 \u0627\u0644\u062a\u0642\u064a\u064a\u0645." : "Comment deleted and target score recalculated.");
    } catch (error) {
      console.error(error);
      setActionMsg(lang === "ar" ? "\u062a\u0639\u0630\u0631 \u062d\u0630\u0641 \u0627\u0644\u0643\u0648\u0645\u0646\u062a." : "Failed to delete comment.");
    } finally {
      setDeletingReportId(null);
    }
  };

  const saveAdminReply = async (report: any) => {
    if (!isAdmin || !user) return;
    const replyText = String(adminReplyDrafts[report.id] || "").trim();
    if (!replyText) return;

    try {
      setSavingAdminReplyId(report.id);
      setActionMsg("");
      const currentReplies = Array.isArray(report.adminReplies) ? report.adminReplies : [];
      await updateDoc(doc(db, "reports", report.id), {
        adminReplies: [
          ...currentReplies,
          {
            id: `reply_${Date.now()}`,
            authorName: "Trackify",
            authorRole: "admin",
            text: replyText,
            createdAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });
      setAdminReplyDrafts((prev) => ({ ...prev, [report.id]: "" }));
      await fetchReports();
      setActionMsg(lang === "ar" ? "\u062a\u0645 \u0625\u0636\u0627\u0641\u0629 \u0631\u062f Trackify \u0628\u0646\u062c\u0627\u062d." : "Trackify reply added successfully.");
    } catch (error) {
      console.error(error);
      setActionMsg(lang === "ar" ? "\u062a\u0639\u0630\u0631 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0631\u062f." : "Failed to add reply.");
    } finally {
      setSavingAdminReplyId(null);
    }
  };

  const deleteAdminReply = async (report: any, replyId: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      lang === "ar" ? "\u0647\u0644 \u062a\u0631\u064a\u062f \u062d\u0630\u0641 \u0631\u062f Trackify\u061f" : "Delete this Trackify reply?"
    );
    if (!confirmed) return;

    try {
      setSavingAdminReplyId(report.id);
      setActionMsg("");
      const currentReplies = Array.isArray(report.adminReplies) ? report.adminReplies : [];
      await updateDoc(doc(db, "reports", report.id), {
        adminReplies: currentReplies.filter((reply: any) => String(reply.id || "") !== replyId),
        updatedAt: Date.now(),
      });
      await fetchReports();
      setActionMsg(lang === "ar" ? "\u062a\u0645 \u062d\u0630\u0641 \u0631\u062f Trackify." : "Trackify reply deleted.");
    } catch (error) {
      console.error(error);
      setActionMsg(lang === "ar" ? "\u062a\u0639\u0630\u0631 \u062d\u0630\u0641 \u0627\u0644\u0631\u062f." : "Failed to delete reply.");
    } finally {
      setSavingAdminReplyId(null);
    }
  };

  const handleAdminCommentFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const imageOnly = selected.filter((file) => file.type.startsWith("image/"));
    const maxAllowed = 10;
    const remaining = Math.max(0, maxAllowed - adminCommentFiles.length);
    if (remaining <= 0) {
      setActionMsg(lang === "ar" ? "وصلت للحد الأقصى (10 صور)." : "Maximum reached (10 images).");
      event.target.value = "";
      return;
    }
    const accepted = imageOnly.slice(0, remaining);
    setAdminCommentFiles((prev) => [...prev, ...accepted]);
    setAdminCommentPreviews((prev) => [...prev, ...accepted.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removeAdminCommentImage = (index: number) => {
    setAdminCommentFiles((prev) => prev.filter((_, i) => i !== index));
    setAdminCommentPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const createAdminVerifiedComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user || !target) return;
    if (!adminCommentText.trim()) {
      setActionMsg(lang === "ar" ? "اكتب نص التعليق أولًا." : "Please enter comment text first.");
      return;
    }

    try {
      setCreatingAdminComment(true);
      setActionMsg("");
      const uploadedImageUrls = await uploadImagesThroughApi(
        `${user.uid}_admin_comment_${activeTargetId}`,
        adminCommentFiles
      );

      // Keep only one pinned item by unpinning previous pinned comments first.
      const pinnedSnap = await getDocs(
        query(collection(db, "reports"), where("targetId", "==", activeTargetId), where("status", "==", "approved"), where("adminPinned", "==", true))
      );
      for (const item of pinnedSnap.docs) {
        await updateDoc(doc(db, "reports", item.id), { adminPinned: false, updatedAt: Date.now() });
      }

      const adminEvidenceTier = classifyEvidenceTier(uploadedImageUrls.length, adminCommentText.trim());
      await addDoc(collection(db, "reports"), {
        targetId: activeTargetId,
        authorId: user.uid,
        authorEmail: user.email || "",
        reporterName: "Trackify",
        source: "admin_direct",
        targetName: target.name || "",
        targetPhone: "",
        targetLink: "",
        category: adminCommentCategory,
        description: adminCommentText.trim(),
        evidenceImages: uploadedImageUrls,
        evidenceTier: adminEvidenceTier,
        status: "approved",
        adminVerified: true,
        adminPinned: true,
        allowUserEdit: false,
        editRequestPending: false,
        reviewNote: "",
        createdAt: Date.now(),
        reviewedAt: Date.now(),
      });
      await syncTargetStats(db, activeTargetId);
      const tSnap = await getDoc(doc(db, "targets", activeTargetId));
      if (tSnap.exists()) {
        setTarget({ id: tSnap.id, ...tSnap.data() } as TargetRecord);
      }

      adminCommentPreviews.forEach((url) => URL.revokeObjectURL(url));
      setAdminCommentReporterName("");
      setAdminCommentCategory("scam");
      setAdminCommentText("");
      setAdminCommentFiles([]);
      setAdminCommentPreviews([]);
      await fetchReports();
      setActionMsg(lang === "ar" ? "تمت إضافة التعليق الموثق والمثبت بنجاح." : "Verified pinned comment added successfully.");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      if (/image_upload_failed|cloudinary_not_configured|upload_failed/i.test(message)) {
        setActionMsg(
          lang === "ar"
            ? "تعذر رفع صور التعليق الموثق. تأكد من إعدادات Cloudinary."
            : "Failed to upload verified-comment images. Please verify Cloudinary configuration."
        );
      } else {
        setActionMsg(lang === "ar" ? "تعذر إضافة التعليق الموثق." : "Failed to add verified comment.");
      }
    } finally {
      setCreatingAdminComment(false);
    }
  };

  const handleManualFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const imageOnly = selected.filter((file) => file.type.startsWith("image/"));
    const maxAllowed = 10;
    const remaining = Math.max(0, maxAllowed - manualFiles.length);
    if (remaining <= 0) {
      setActionMsg(lang === "ar" ? "وصلت للحد الأقصى (10 صور)." : "Maximum reached (10 images).");
      event.target.value = "";
      return;
    }
    const accepted = imageOnly.slice(0, remaining);
    setManualFiles((prev) => [...prev, ...accepted]);
    setManualPreviews((prev) => [...prev, ...accepted.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removeManualImage = (index: number) => {
    setManualFiles((prev) => prev.filter((_, i) => i !== index));
    setManualPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const submitManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user || !target) return;
    if (!manualDescription.trim()) {
      setActionMsg(lang === "ar" ? "اكتب وصف البلاغ أولًا." : "Please enter report description first.");
      return;
    }

    try {
      setManualSubmitting(true);
      setActionMsg("");
      const uploadedImageUrls = await uploadImagesThroughApi(`${user.uid}_manual_target_${activeTargetId}`, manualFiles);

      await addDoc(collection(db, "reports"), {
        targetId: activeTargetId,
        authorId: user.uid,
        authorEmail: user.email || "",
        reporterName: manualReporterName.trim() || "Manual Entry",
        source: "admin_manual",
        targetName: String(target.name || ""),
        targetPhone: manualTargetPhone.trim(),
        targetLink: manualTargetLink.trim(),
        category: manualCategory,
        description: manualDescription.trim(),
        evidenceImages: uploadedImageUrls,
        evidenceTier: classifyEvidenceTier(uploadedImageUrls.length, manualDescription.trim()),
        status: "approved",
        adminVerified: false,
        adminPinned: false,
        allowUserEdit: false,
        editRequestPending: false,
        reviewNote: "",
        createdAt: Date.now(),
        reviewedAt: Date.now(),
      });

      await refreshTargetAfterReportChange();
      manualPreviews.forEach((url) => URL.revokeObjectURL(url));
      setManualReporterName("");
      setManualCategory("scam");
      setManualDescription("");
      setManualTargetPhone("");
      setManualTargetLink("");
      setManualFiles([]);
      setManualPreviews([]);
      setShowManualReportForm(false);
      setActionMsg(lang === "ar" ? "تمت إضافة البلاغ اليدوي بنجاح." : "Manual report added successfully.");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      if (/image_upload_failed|cloudinary_not_configured|upload_failed/i.test(message)) {
        setActionMsg(
          lang === "ar"
            ? "تعذر رفع صور البلاغ اليدوي. تأكد من إعدادات Cloudinary."
            : "Failed to upload manual-report images. Please verify Cloudinary configuration."
        );
      } else {
        setActionMsg(lang === "ar" ? "تعذر إضافة البلاغ اليدوي." : "Failed to add manual report.");
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-24 min-h-screen overflow-x-hidden text-slate-900 dark:text-slate-100">
        <section
          className={`glass-panel overflow-hidden rounded-[32px] border shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_26px_90px_rgba(0,0,0,0.55)] ${
            isNoData ? "border-t-border" : isHighRisk ? "border-t-destructive" : isTrusted ? "border-t-green-500" : "border-t-yellow-500"
          }`}
        >
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 p-4 sm:p-5 md:p-8 xl:p-9">
              <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
                <LogoBlock logoUrl={target.logoUrl || ""} name={target.name || ""} />

                <div className="min-w-0 flex-1 text-center sm:text-start">
                  <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start sm:gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-black uppercase tracking-wide">
                      <BadgeInfo className="w-4 h-4" />
                      {target.type || "page"}
                    </span>
                    <Link
                      href={`/target/${encodeURIComponent(activeTargetId)}/about`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-black text-foreground transition hover:bg-secondary/60"
                    >
                      <BadgeInfo className="h-4 w-4" />
                      <span>{lang === "ar" ? "عن الصفحة" : "About"}</span>
                    </Link>
                    <Link
                      href={`/category#${categorySlug}`}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-black text-primary transition hover:bg-primary/15 dark:border-neon-blue/30 dark:bg-neon-blue/10 dark:text-neon-blue"
                    >
                      <Layers className="h-4 w-4 shrink-0" />
                      <span className="max-w-[220px] truncate">{categoryLabel}</span>
                    </Link>
                    {target.claimedByUserId && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary dark:text-neon-blue">
                        <ShieldCheck className="w-4 h-4" />
                        {lang === "ar" ? "بائع موثق" : "Verified seller"}
                      </span>
                    )}
                  </div>

                  <h1 className="mb-3 text-2xl font-black tracking-normal break-words md:text-4xl lg:text-5xl">
                    {target.name}
                  </h1>

                  {aliases.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                        {lang === "ar" ? "\u0645\u0639\u0631\u0648\u0641\u0629 \u0623\u064a\u0636\u0627 \u0628\u0627\u0633\u0645" : "Also known as"}
                      </span>
                      {aliases.map((alias) => (
                        <span key={alias} className="inline-flex max-w-full items-center rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-black text-foreground">
                          <span className="truncate">{alias}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mx-auto max-w-3xl text-sm leading-7 text-muted-foreground md:text-base sm:mx-0">
                    {isNoData
                      ? (lang === "ar"
                          ? "لا توجد بيانات أو بلاغات موثقة كفاية لعرض تقييم واضح لهذه الصفحة حتى الآن."
                          : "There is not enough verified data yet to show a meaningful trust profile for this page.")
                      : (lang === "ar"
                          ? "ملخص سريع لبيانات الصفحة والبلاغات الموثقة المرتبطة بها، مع مؤشرات الثقة وآخر النشاط."
                          : "A quick summary of this page, its verified reports, and recent trust activity signals.")}
                  </p>

                  <div
                    className={`mt-4 rounded-2xl border px-4 py-3 text-sm md:text-[15px] ${
                      isDealNotRecommended
                        ? "border-destructive/30 bg-destructive/10"
                        : "border-border bg-secondary/35"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isDealNotRecommended
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/10 text-primary dark:bg-neon-blue/10 dark:text-neon-blue"
                        }`}
                      >
                        {isDealNotRecommended ? <AlertTriangle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-black ${isDealNotRecommended ? "text-destructive" : "text-foreground"}`}>
                          {isDealNotRecommended
                            ? lang === "ar"
                              ? "\u062a\u062d\u0630\u064a\u0631 \u0645\u0647\u0645 \u0642\u0628\u0644 \u0623\u064a \u062a\u0639\u0627\u0645\u0644"
                              : "Important warning before dealing"
                            : lang === "ar"
                              ? "\u0645\u0644\u062d\u0648\u0638\u0629 \u0645\u0647\u0645\u0629"
                              : "Important note"}
                        </p>
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">
                          {isDealNotRecommended
                            ? lang === "ar"
                              ? "\u0646\u062d\u0646 \u0644\u0627 \u0646\u062a\u0647\u0645 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629 \u0628\u0627\u0644\u0646\u0635\u0628\u060c \u0644\u0643\u0646 \u064a\u0648\u062c\u062f 3 \u0628\u0644\u0627\u063a\u0627\u062a \u0623\u0648 \u0623\u0643\u062b\u0631 \u0645\u0646 \u062a\u062c\u0627\u0631\u0628 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646. \u0644\u0630\u0644\u0643 \u0644\u0627 \u0646\u0646\u0635\u062d \u0628\u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0645\u0639\u0647\u0627 \u062d\u0627\u0644\u064a\u0627 \u0644\u062a\u0642\u0644\u064a\u0644 \u062e\u0637\u0631 \u0623\u064a \u0645\u0634\u0643\u0644\u0629 \u0623\u0648 \u0639\u0645\u0644\u064a\u0629 \u0646\u0635\u0628."
                              : "We are not accusing this page of being a scam. However, it has 3 or more community reports, so we do not recommend dealing with it right now to reduce the risk of disputes or scam attempts."
                            : lang === "ar"
                              ? "\u0646\u062d\u0646 \u0644\u0627 \u0646\u062a\u0647\u0645 \u0623\u064a \u0635\u0641\u062d\u0629 \u0628\u0627\u0644\u0646\u0635\u0628. \u0627\u0644\u0645\u0639\u0631\u0648\u0636 \u0647\u0646\u0627 \u0647\u0648 \u0645\u0644\u062e\u0635 \u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0648\u062a\u062c\u0627\u0631\u0628 \u0627\u0644\u0646\u0627\u0633 \u0641\u0642\u0637\u060c \u0648\u064a\u0641\u0636\u0644 \u062f\u0627\u0626\u0645\u0627 \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0628\u0644\u0627\u063a\u0627\u062a \u0648\u0627\u0644\u0623\u062f\u0644\u0629 \u0642\u0628\u0644 \u0623\u064a \u0642\u0631\u0627\u0631."
                              : "We do not accuse any page of being a scam. What you see here is a summary of community ratings and experiences only, so always review the reports and evidence before making a decision."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {targetReasons.length > 0 && (
                    <div className="mt-5 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4" />
                          {lang === "ar" ? "\u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u062a\u062d\u0630\u064a\u0631" : "Warning reasons"}
                        </span>
                        <span className="text-xs font-semibold leading-5 text-muted-foreground">
                          {lang === "ar"
                            ? "\u0631\u0627\u062c\u0639 \u0647\u0630\u0647 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0642\u0628\u0644 \u0623\u064a \u062a\u0639\u0627\u0645\u0644."
                            : "Review these signals before dealing with this target."}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {targetReasons.map((reason) => (
                          <span
                            key={reason}
                            title={getTargetReasonDescription(reason, lang)}
                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-black text-foreground shadow-sm"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span className="truncate">{getTargetReasonLabel(reason, lang)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                    <div className="min-w-0 rounded-3xl border border-border bg-background/65 p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                          {lang === "ar" ? "بيانات التعريف" : "Identity details"}
                        </h2>
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${statusClass} bg-background`}>
                          {statusIcon}
                          {getStatusLabel(target.status || "reviewing", lang)}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {(missingPhones || missingLinks) && (
                          <div className="space-y-2">
                            {missingLinks && (
                              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                {lang === "ar"
                                  ? "⚠️ لم يتم العثور على رابط رسمي لهذه الصفحة."
                                  : "⚠️ No official page link was found for this target."}
                              </p>
                            )}
                            {missingPhones && (
                              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                {lang === "ar"
                                  ? "⚠️ لم يتم العثور على رقم هاتف موثوق لهذه الصفحة."
                                  : "⚠️ No verified phone number was found for this target."}
                              </p>
                            )}
                            <p className="text-sm leading-7 text-amber-900/90 dark:text-amber-100/90">
                              {lang === "ar"
                                ? "البلاغات مرتبطة بالاسم والأدلة/الصور المتوفرة فقط حاليًا. عند توفير البيانات الناقصة (رقم أو رابط)، سيتم تحديث الصفحة فورًا."
                                : "Reports are currently linked using the target name and available evidence/images only. Once missing data (phone or link) is provided, this page will be updated immediately."}
                            </p>
                          </div>
                        )}

                        {phones.length > 0 && (
                          <InfoGroup title={lang === "ar" ? "أرقام الهاتف" : "Phone numbers"}>
                            {phones.map((phone) => (
                              <a key={phone} href={`tel:${phone}`} dir="ltr" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-bold text-muted-foreground transition hover:-translate-y-0.5 hover:text-foreground">
                                <Phone className="w-4 h-4" />
                                {phone}
                              </a>
                            ))}
                          </InfoGroup>
                        )}

                        {instapays.length > 0 && (
                          <InfoGroup title={lang === "ar" ? "Instapay" : "Instapay"}>
                            {instapays.map((handle) => (
                              <span key={handle} dir="ltr" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-bold text-muted-foreground">
                                <img src={INSTAPAY_ICON_URL} alt="Instapay" className="h-5 w-5 object-contain brightness-0 invert" />
                                {handle}
                              </span>
                            ))}
                          </InfoGroup>
                        )}

                        {links.length > 0 && (
                          <InfoGroup title={lang === "ar" ? "روابط الصفحات" : "Page links"}>
                            {links.map((link) => (
                              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-bold text-muted-foreground transition hover:-translate-y-0.5 hover:text-foreground">
                                <PlatformIcon platform={link.platform} className="w-4 h-4 shrink-0" />
                                <span>{platformLabel(link.platform)}</span>
                                <span dir="ltr" className="truncate max-w-[220px] text-xs font-medium">
                                  {hostFromUrl(link.url)}
                                </span>
                              </a>
                            ))}
                          </InfoGroup>
                        )}

                        {phones.length === 0 && instapays.length === 0 && links.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-border bg-background/70 p-5 text-center">
                            <p className="text-sm font-bold text-muted-foreground">
                              {lang === "ar" ? "لا توجد أرقام أو حسابات Instapay أو روابط مضافة لهذا الهدف بعد." : "No phone numbers, instapay handles, or links have been added for this target yet."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <CompactStatCard
                        label={lang === "ar" ? "البلاغات الموثقة" : "Verified reports"}
                        value={Number(target.reportCount ?? 0)}
                        tone="neutral"
                      />
                      <CompactStatCard
                        label={lang === "ar" ? "نسبة النجاح" : "Success ratio"}
                        value={isNoData ? "—" : successRatioPct != null ? `${successRatioPct}%` : "—"}
                        tone="positive"
                      />
                      <CompactStatCard
                        label={lang === "ar" ? "آخر بلاغ نصب" : "Last scam report"}
                        value={isNoData ? "—" : lastScamLabel}
                        tone="danger"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className={`border-t border-border p-4 md:p-6 xl:border-t-0 xl:border-r ${statusBg}`}>
              <div className="flex h-full flex-col gap-4">
                <div className={`inline-flex w-fit items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs md:text-sm font-black shadow-sm ${statusClass}`}>
                  {statusIcon}
                  {getStatusLabel(target.status || "reviewing", lang)}
                </div>

                {isHeavyReports ? (
                  <div className="rounded-3xl border border-destructive/25 bg-destructive/10 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-destructive">
                      {lang === "ar" ? "تحذير" : "Warning"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">
                      {lang === "ar"
                        ? `على هذه الصفحة عدد كبير من البلاغات الموثقة (${reportCount}).`
                        : `This page has a high number of verified reports (${reportCount}).`}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-border/70 bg-background/70 p-4 shadow-sm dark:bg-slate-950/35 dark:border-slate-800/60">
                  <p className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {lang === "ar" ? "مستوى الأمان" : "Trust Score"}
                  </p>
                  {isNoData ? (
                    <p className={`mt-2 text-2xl md:text-3xl font-black tracking-normal ${statusClass}`}>
                      {lang === "ar" ? "لا بيانات" : "No data"}
                    </p>
                  ) : (
                    <p className={`mt-2 text-4xl md:text-5xl xl:text-6xl font-black tracking-normal ${statusClass}`}>
                      {Number(target.trustScore ?? 0)}%
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StarRating
                      value={toStarRating(Number(target.trustScore ?? 50))}
                      label={lang === "ar" ? "تقييم بالنجوم" : "Star rating"}
                    />
                    {!isNoData && (
                      <span className="text-xs font-bold text-muted-foreground">
                        {formatStarLabel(toStarRating(Number(target.trustScore ?? 50)))} / 5
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {lang === "ar"
                      ? "التقييم الحالي محسوب من البلاغات الموثقة، قوة الأدلة، وحداثة النشاط."
                      : "This score is based on verified reports, evidence quality, and recency."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <Metric label={lang === "ar" ? "بلاغات موثقة" : "Verified reports"} value={Number(target.reportCount ?? 0)} />
                  <Metric
                    label={lang === "ar" ? "نسبة النجاح" : "Success ratio"}
                    value={isNoData ? "—" : successRatioPct != null ? `${successRatioPct}%` : "—"}
                  />
                  <Metric
                    label={lang === "ar" ? "آخر بلاغ نصب" : "Last scam report"}
                    value={isNoData ? "—" : lastScamLabel}
                  />
                  <Metric
                    label={lang === "ar" ? "آخر نجاح" : "Last success"}
                    value={isNoData ? "—" : lastSuccessLabel}
                  />
                  <Metric label={lang === "ar" ? "روابط" : "Links"} value={links.length} />
                  <Metric label={lang === "ar" ? "أرقام" : "Phones"} value={phones.length} />
                  <Metric label={lang === "ar" ? "تحديث" : "Updated"} value={target.updatedAt ? new Date(target.updatedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US") : "-"} />
                </div>

                <div className="mt-auto grid gap-2">
                  {isAdmin && (
                    <Link href={`/dashboard?edit=${target.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90 dark:bg-neon-blue dark:text-black">
                      <Pencil className="w-4 h-4" />
                      {lang === "ar" ? "تعديل البيانات" : "Edit target"}
                    </Link>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowManualReportForm((prev) => !prev)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 hover:bg-background"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {showManualReportForm
                        ? lang === "ar"
                          ? "إخفاء البلاغ اليدوي"
                          : "Hide manual report form"
                        : lang === "ar"
                          ? "إضافة بلاغ يدوي"
                          : "Add manual report"}
                    </button>
                  )}
                  <Link
                    href={`/report?target=${encodeURIComponent(target.name || "")}&link=${encodeURIComponent(links[0]?.url || "")}&lock=1`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-background/80 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 hover:bg-background"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {lang === "ar" ? "أضف تجربتك" : "Share your experience"}
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border bg-background/60 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-primary dark:text-neon-blue" />
              {lang === "ar" ? `البلاغات وتجارب الناس (${reports.length})` : `Reports and user experiences (${reports.length})`}
            </h2>
            <p className="text-sm font-semibold text-muted-foreground">
              {lang === "ar"
                ? "اقرأ التجارب بالتفصيل وشوف الأدلة قبل ما تتعامل."
                : "Read experiences and evidence before you decide."}
            </p>
          </div>

          {isAdmin && showManualReportForm && (
            <form onSubmit={submitManualReport} className="mb-6 rounded-2xl border border-border bg-background/60 p-4 space-y-3">
              <p className="text-sm font-black">
                {lang === "ar" ? "إضافة بلاغ يدوي (نيابة عن عميل)" : "Add manual report (on behalf of customer)"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={target.name || ""}
                  readOnly
                  className="input opacity-85"
                  placeholder={lang === "ar" ? "اسم الصفحة" : "Target name"}
                />
                <input
                  value={manualReporterName}
                  onChange={(e) => setManualReporterName(e.target.value)}
                  className="input"
                  placeholder={lang === "ar" ? "اسم العميل (اختياري)" : "Customer name (optional)"}
                />
                <input
                  value={manualTargetPhone}
                  onChange={(e) => setManualTargetPhone(e.target.value)}
                  className="input"
                  dir="ltr"
                  placeholder={lang === "ar" ? "رقم الهاتف (اختياري)" : "Phone number (optional)"}
                />
                <input
                  value={manualTargetLink}
                  onChange={(e) => setManualTargetLink(e.target.value)}
                  className="input"
                  dir="ltr"
                  placeholder={lang === "ar" ? "رابط الصفحة (اختياري)" : "Page link (optional)"}
                />
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="input md:col-span-2"
                >
                  <option value="scam">{lang === "ar" ? "نصب وسرقة" : "Scam and theft"}</option>
                  <option value="delay">{lang === "ar" ? "تأخير متعمد" : "Intentional delay"}</option>
                  <option value="bad_treatment">{lang === "ar" ? "سوء تعامل / إساءة" : "Poor treatment / abuse"}</option>
                  <option value="suspicious_untrusted">{lang === "ar" ? "مشبوهة / غير موثوق" : "Suspicious / untrusted"}</option>
                  <option value="successful_transaction">{lang === "ar" ? "تجربة ناجحة" : "Successful transaction"}</option>
                </select>
              </div>
              <textarea
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="input min-h-[120px]"
                placeholder={lang === "ar" ? "اكتب وصف البلاغ..." : "Write report description..."}
                required
              />
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "صور مرفقة (حتى 10 صور)" : "Attached images (up to 10)"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {manualPreviews.map((img, i) => (
                    <div key={`manual-img-${i}`} className="relative">
                      <img src={img} alt="Evidence" className="w-16 h-16 rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => removeManualImage(i)}
                        className="absolute -top-1 -right-1 rounded-full bg-black/80 text-white text-[10px] w-4 h-4"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {manualPreviews.length < 10 && (
                    <button
                      type="button"
                      onClick={() => manualFileInputRef.current?.click()}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  ref={manualFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleManualFilesSelected}
                  className="hidden"
                />
              </div>
              <button
                type="submit"
                disabled={manualSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 disabled:opacity-60 dark:bg-neon-blue dark:text-black"
              >
                {manualSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                <span>{lang === "ar" ? "إضافة البلاغ اليدوي" : "Add manual report"}</span>
              </button>
            </form>
          )}

          {isAdmin && (
            <form onSubmit={createAdminVerifiedComment} className="mb-6 rounded-2xl border border-border bg-background/60 p-4 space-y-3">
              <p className="text-sm font-black">
                {lang === "ar" ? "إضافة تعليق موثق ومثبت (للإدارة فقط)" : "Add verified pinned comment (admin only)"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={adminCommentReporterName}
                  onChange={(e) => setAdminCommentReporterName(e.target.value)}
                  className="input"
                  placeholder={lang === "ar" ? "اسم العميل (اختياري)" : "Customer name (optional)"}
                />
                <select
                  value={adminCommentCategory}
                  onChange={(e) => setAdminCommentCategory(e.target.value)}
                  className="input"
                >
                  <option value="scam">{lang === "ar" ? "نصب وسرقة" : "Scam and theft"}</option>
                  <option value="delay">{lang === "ar" ? "تأخير متعمد" : "Intentional delay"}</option>
                  <option value="bad_treatment">{lang === "ar" ? "سوء تعامل / إساءة" : "Poor treatment / abuse"}</option>
                  <option value="suspicious_untrusted">{lang === "ar" ? "مشبوهة / غير موثوق" : "Suspicious / untrusted"}</option>
                  <option value="successful_transaction">{lang === "ar" ? "تجربة ناجحة" : "Successful transaction"}</option>
                </select>
              </div>
              <textarea
                value={adminCommentText}
                onChange={(e) => setAdminCommentText(e.target.value)}
                className="input min-h-[120px]"
                placeholder={lang === "ar" ? "اكتب التعليق الذي سيظهر كتعليق عادي موثق ومثبت..." : "Write comment that will appear as normal verified pinned report..."}
              />
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "صور مرفقة (حتى 10 صور)" : "Attached images (up to 10)"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {adminCommentPreviews.map((img, i) => (
                    <div key={`admin-comment-img-${i}`} className="relative">
                      <img src={img} alt="Evidence" className="w-16 h-16 rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAdminCommentImage(i)}
                        className="absolute -top-1 -right-1 rounded-full bg-black/80 text-white text-[10px] w-4 h-4"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {adminCommentPreviews.length < 10 && (
                    <button
                      type="button"
                      onClick={() => adminCommentFileInputRef.current?.click()}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  ref={adminCommentFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAdminCommentFilesSelected}
                  className="hidden"
                />
              </div>
              <button
                type="submit"
                disabled={creatingAdminComment}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {creatingAdminComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{lang === "ar" ? "إضافة التعليق الموثق المثبت" : "Add verified pinned comment"}</span>
              </button>
            </form>
          )}
          {actionMsg && (
            <div className="mb-4 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground dark:bg-card/80">
              {actionMsg}
            </div>
          )}

          {reports.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-3xl border border-dashed border-border/50">
              <ShieldCheck className="w-16 h-16 text-green-500/60 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">{lang === "ar" ? "مفيش أي بلاغات!" : "No reports yet!"}</h3>
              <p className="text-muted-foreground font-medium">{lang === "ar" ? "يبدو إن الصفحة دي مفيش حد اشتكى منها على منصتنا حتى الآن." : "It looks like no one has reported this page on our platform yet."}</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {reports.map((report, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  key={report.id}
                  className={`group glass-panel rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_26px_80px_rgba(15,23,42,0.10)] md:p-7 ${
                    report.adminPinned
                      ? "border-primary/40 dark:border-neon-blue/40 shadow-[0_0_18px_rgba(37,99,235,0.2)] dark:shadow-[0_0_22px_rgba(0,243,255,0.2)]"
                      : "border-border"
                  } dark:bg-card/85`}
                >
                  {report.adminPinned && (
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-800 bg-cyan-700 px-3 py-1.5 text-xs font-black text-white shadow-md shadow-cyan-900/15 dark:border-cyan-300/40 dark:bg-cyan-500/20 dark:text-cyan-100">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "تعليق إداري موثق ومثبت" : "Pinned verified admin comment"}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${
                            report.category === "scam"
                              ? "border-red-200 bg-red-100 text-red-700 dark:border-red-400/35 dark:bg-red-500/15 dark:text-red-200"
                              : report.category === "delay"
                                ? "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-200"
                                : report.category === "suspicious_untrusted"
                                  ? "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-400/35 dark:bg-violet-500/15 dark:text-violet-200"
                                : report.category === "successful_transaction"
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-200"
                                  : "border-blue-200 bg-blue-100 text-blue-700 dark:border-sky-400/35 dark:bg-sky-500/15 dark:text-sky-200"
                          }`}
                        >
                        {report.category === "scam"
                          ? (lang === "ar" ? "نصب وسرقة" : "Scam and theft")
                          : report.category === "delay"
                            ? (lang === "ar" ? "تأخير متعمد" : "Intentional delay")
                            : report.category === "suspicious_untrusted"
                              ? (lang === "ar" ? "مشبوهة / غير موثوق" : "Suspicious / untrusted")
                            : report.category === "successful_transaction"
                              ? (lang === "ar" ? "تجربة ناجحة" : "Successful transaction")
                              : (lang === "ar" ? "سوء تعامل / إساءة" : "Poor treatment / abuse")}
                        </span>
                        {report.evidenceTier && (
                          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground dark:bg-card/80 dark:text-white">
                            {lang === "ar" ? "الدليل" : "Evidence"}: {formatEvidenceTierLabel(report.evidenceTier, lang)}
                          </span>
                        )}
                      </div>
                      {(report.reporterName || report.authorEmail) && (
                        <div className="mt-3 flex items-start gap-3 text-sm font-semibold text-muted-foreground">
                          <img
                            src={report.source === "admin_direct" ? getAdminAvatarUrl() : getAvatarUrl(report.authorPhotoURL)}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full border border-border bg-secondary object-cover"
                          />
                          <div className="grid min-w-0 gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-foreground">{lang === "ar" ? "اسم العميل" : "Customer"}</span>
                            <span className="text-foreground/90">
                              {report.source === "admin_direct" ? "Trackify" : (report.reporterName || report.authorEmail)}
                            </span>
                            {report.adminVerified && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-800 bg-cyan-700 px-2.5 py-1 text-[11px] font-black text-white shadow-sm shadow-cyan-900/15 dark:border-cyan-300/40 dark:bg-cyan-500/20 dark:text-cyan-100">
                                <ShieldCheck className="w-3 h-3" />
                                {lang === "ar" ? "موثق" : "Verified"}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-foreground">{lang === "ar" ? "تاريخ البلاغ" : "Date"}</span>
                            <span className="text-foreground/90">
                              {formatRelativeDate(report.createdAt, lang)}
                            </span>
                          </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {report.status === "pending" && (
                        <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-600 dark:text-yellow-400">
                          {lang === "ar" ? "قيد المراجعة" : "Under review"}
                        </span>
                      )}
                      {(() => {
                        const isOwner = !!user && report.authorId === user.uid;
                        const canEdit = isAdmin || (isOwner && report.allowUserEdit === true);
                        return (
                          <>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => startEdit(report)}
                                className="rounded-full border border-border bg-background/70 px-4 py-2 text-xs font-black text-foreground transition hover:bg-secondary"
                              >
                                {lang === "ar" ? "تعديل" : "Edit"}
                              </button>
                            )}
                            {isOwner && !canEdit && (
                              <button
                                type="button"
                                disabled={savingReportId === report.id || report.editRequestPending}
                                onClick={() => void requestEditPermission(report)}
                                className="rounded-full border border-border bg-background/70 px-4 py-2 text-xs font-black transition hover:bg-secondary disabled:opacity-60"
                              >
                                {report.editRequestPending
                                  ? (lang === "ar" ? "طلب التعديل قيد المراجعة" : "Edit request pending")
                                  : (lang === "ar" ? "طلب إذن تعديل" : "Request edit permission")}
                              </button>
                            )}
                            {isAdmin && report.editRequestPending && (
                              <button
                                type="button"
                                disabled={savingReportId === report.id}
                                onClick={() => void grantUserEdit(report)}
                                className="rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 dark:bg-neon-blue dark:text-black"
                              >
                                {lang === "ar" ? "السماح للعميل بالتعديل" : "Grant customer edit"}
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                disabled={deletingReportId === report.id}
                                onClick={() => void deleteReport(report)}
                                className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-black text-destructive transition hover:bg-destructive/15 disabled:opacity-60"
                              >
                                {deletingReportId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                {lang === "ar" ? "\u062d\u0630\u0641" : "Delete"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {editingReportId === report.id ? (
                    <div className="space-y-3 mt-4 mb-6">
                      <input
                        value={editReporterName}
                        onChange={(e) => setEditReporterName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400"
                        placeholder={lang === "ar" ? "اسم العميل" : "Customer name"}
                      />
                      {isAdmin && (
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950 dark:text-white"
                        >
                          <option value="scam">{lang === "ar" ? "نصب وسرقة" : "Scam and theft"}</option>
                          <option value="delay">{lang === "ar" ? "تأخير متعمد" : "Intentional delay"}</option>
                          <option value="bad_treatment">{lang === "ar" ? "سوء معاملة" : "Bad treatment"}</option>
                          <option value="successful_transaction">{lang === "ar" ? "تجربة ناجحة" : "Successful transaction"}</option>
                        </select>
                      )}
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-7 text-foreground placeholder:text-muted-foreground dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400"
                      />
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground dark:text-white">
                          {lang === "ar" ? "الصور المرفقة (حد أقصى 10)" : "Attached images (max 10)"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {editEvidenceImages.map((img, i) => (
                            <div key={`existing-${i}`} className="relative">
                              <img src={img} alt="Evidence" className="w-16 h-16 rounded-lg border border-border object-cover" />
                              <button
                                type="button"
                                onClick={() => removeEditExistingImage(i)}
                                className="absolute -top-1 -right-1 rounded-full bg-black/80 text-white text-[10px] w-4 h-4"
                              >
                                x
                              </button>
                            </div>
                          ))}
                          {editNewPreviews.map((img, i) => (
                            <div key={`new-${i}`} className="relative">
                              <img src={img} alt="Evidence" className="w-16 h-16 rounded-lg border border-border object-cover" />
                              <button
                                type="button"
                                onClick={() => removeEditNewImage(i)}
                                className="absolute -top-1 -right-1 rounded-full bg-black/80 text-white text-[10px] w-4 h-4"
                              >
                                x
                              </button>
                            </div>
                          ))}
                          {editEvidenceImages.length + editNewPreviews.length < 10 && (
                            <button
                              type="button"
                              onClick={() => editFileInputRef.current?.click()}
                              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleEditFilesSelected}
                          className="hidden"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={savingReportId === report.id}
                          onClick={() => void saveReportEdit(report)}
                          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
                        >
                          {lang === "ar" ? "حفظ التعديل" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReportId(null)}
                          className="rounded-lg border border-border px-4 py-2 text-xs font-bold hover:bg-secondary"
                        >
                          {lang === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-3xl border border-border/70 bg-background/70 p-5 shadow-sm dark:bg-background/80">
                      <p className="whitespace-pre-wrap text-sm leading-7 font-semibold text-foreground md:text-base">
                        {report.description}
                      </p>
                    </div>
                  )}

                  {(Array.isArray(report.adminReplies) && report.adminReplies.length > 0) || isAdmin ? (
                    <div className="mt-4 space-y-3">
                      {Array.isArray(report.adminReplies) &&
                        report.adminReplies.map((reply: any) => (
                          <div key={reply.id || `${report.id}-${reply.createdAt}`} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <img src={getAdminAvatarUrl()} alt="" className="h-7 w-7 rounded-full border border-cyan-500/25 object-cover" />
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-700 px-2.5 py-1 text-[11px] font-black text-white dark:bg-cyan-500/25 dark:text-cyan-100">
                                <ShieldCheck className="h-3 w-3" />
                                Trackify
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground">
                                {formatRelativeDate(reply.createdAt, lang)}
                              </span>
                              {isAdmin && reply.id && (
                                <button
                                  type="button"
                                  disabled={savingAdminReplyId === report.id}
                                  onClick={() => void deleteAdminReply(report, String(reply.id))}
                                  className="ms-auto inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-[11px] font-black text-destructive transition hover:bg-destructive/15 disabled:opacity-60"
                                >
                                  {savingAdminReplyId === report.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  {lang === "ar" ? "\u062d\u0630\u0641" : "Delete"}
                                </button>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-7 font-semibold text-foreground">{reply.text}</p>
                          </div>
                        ))}

                      {isAdmin && (
                        <div className="rounded-2xl border border-border bg-background/65 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-black text-muted-foreground">
                            <Reply className="h-3.5 w-3.5" />
                            {lang === "ar" ? "\u0631\u062f \u0628\u0627\u0633\u0645 Trackify" : "Reply as Trackify"}
                          </div>
                          <textarea
                            value={adminReplyDrafts[report.id] || ""}
                            onChange={(e) => setAdminReplyDrafts((prev) => ({ ...prev, [report.id]: e.target.value }))}
                            className="input min-h-[84px] text-sm"
                            placeholder={lang === "ar" ? "\u0627\u0643\u062a\u0628 \u0631\u062f \u0627\u0644\u0625\u062f\u0627\u0631\u0629..." : "Write an admin reply..."}
                          />
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              disabled={savingAdminReplyId === report.id || !String(adminReplyDrafts[report.id] || "").trim()}
                              onClick={() => void saveAdminReply(report)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 dark:bg-neon-blue dark:text-black"
                            >
                              {savingAdminReplyId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              {lang === "ar" ? "\u0646\u0634\u0631 \u0627\u0644\u0631\u062f" : "Post reply"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {report.evidenceImages && report.evidenceImages.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                          {lang === "ar" ? "الأدلة المرفقة" : "Attached evidence"}
                        </div>
                        <div className="text-xs font-bold text-muted-foreground">
                          {report.evidenceImages.length} {lang === "ar" ? "صورة" : "images"}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                        {report.evidenceImages.map((img: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              setLightbox({
                                images: report.evidenceImages,
                                index: i,
                                title: `${lang === "ar" ? "دليل البلاغ" : "Report evidence"} ${i + 1}/${report.evidenceImages.length}`,
                              })
                            }
                            className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary shadow-sm transition group focus:outline-none focus:ring-2 focus:ring-primary hover:-translate-y-0.5 hover:shadow-md dark:focus:ring-neon-blue"
                            aria-label={lang === "ar" ? "فتح الصورة كاملة" : "Open evidence image"}
                          >
                            <img src={img} alt={lang === "ar" ? "دليل" : "Evidence"} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                              <ImageIcon className="h-6 w-6 drop-shadow" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
      {lightbox && (
        <EvidenceLightbox
          lightbox={lightbox}
          lang={lang}
          onClose={() => setLightbox(null)}
          onPrevious={() =>
            setLightbox((current) => (current ? { ...current, index: Math.max(0, current.index - 1) } : current))
          }
          onNext={() =>
            setLightbox((current) =>
              current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current
            )
          }
          onSelect={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
        />
      )}
    </>
  );
}

function EvidenceLightbox({
  lightbox,
  lang,
  onClose,
  onPrevious,
  onNext,
  onSelect,
}: {
  lightbox: { images: string[]; index: number; title: string };
  lang: "en" | "ar";
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}) {
  const currentImage = lightbox.images[lightbox.index];
  const isFirst = lightbox.index <= 0;
  const isLast = lightbox.index >= lightbox.images.length - 1;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/92 backdrop-blur-md" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
        onClick={onClose}
        aria-label={lang === "ar" ? "إغلاق الصورة" : "Close image"}
      />

      <div className="relative z-10 flex h-full flex-col px-3 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-white shadow-2xl backdrop-blur-xl sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black sm:text-base">{lightbox.title}</p>
            <p className="text-xs font-bold text-cyan-200">
              {lightbox.index + 1} / {lightbox.images.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mx-auto mt-4 flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onPrevious}
            disabled={isFirst}
            className="absolute left-0 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white shadow-xl backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:-left-2 sm:h-12 sm:w-12"
            aria-label={lang === "ar" ? "الصورة السابقة" : "Previous image"}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="flex max-h-[72dvh] w-full items-center justify-center px-10 sm:px-14">
            <img
              src={currentImage}
              alt={lang === "ar" ? "صورة دليل كاملة" : "Full evidence"}
              className="max-h-[72dvh] max-w-full rounded-2xl border border-white/10 object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            />
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={isLast}
            className="absolute right-0 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white shadow-xl backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:-right-2 sm:h-12 sm:w-12"
            aria-label={lang === "ar" ? "الصورة التالية" : "Next image"}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {lightbox.images.length > 1 && (
          <div className="mx-auto mt-4 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/10 p-2 backdrop-blur-xl sm:max-w-3xl">
            {lightbox.images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition sm:h-20 sm:w-20 ${
                  index === lightbox.index ? "border-cyan-300 ring-2 ring-cyan-300/40" : "border-white/10 opacity-65 hover:opacity-100"
                }`}
                aria-label={`${lang === "ar" ? "فتح صورة" : "Open image"} ${index + 1}`}
              >
                <img src={image} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogoBlock({ logoUrl, name }: { logoUrl: string; name: string }) {
  return (
    <div className="shrink-0 self-center sm:self-start lg:self-auto">
      <div className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 rounded-2xl sm:rounded-3xl border border-border bg-background overflow-hidden flex items-center justify-center shadow-sm">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <Store className="w-9 h-9 sm:w-11 sm:h-11 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function InfoGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function CompactStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "positive" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "danger"
        ? "border-rose-200/70 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        : "border-border bg-background/80 text-foreground";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "facebook") return <Facebook className={className} />;
  if (platform === "instagram") return <Instagram className={className} />;
  if (platform === "youtube") return <Youtube className={className} />;
  if (platform === "telegram") return <Send className={className} />;
  if (platform === "website") return <Globe2 className={className} />;
  return <LinkIcon className={className} />;
}

function formatRelativeDate(value: unknown, lang: "ar" | "en") {
  const timestamp = Number(value || 0);
  if (!timestamp) return "";

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (lang === "ar") {
    if (minutes < 1) return "منذ أقل من دقيقة";
    if (minutes < 60) return `منذ ${formatArabicUnit(minutes, "دقيقة", "دقيقتين", "دقائق", "دقيقة")}`;
    if (hours < 24) return `منذ ${formatArabicUnit(hours, "ساعة", "ساعتين", "ساعات", "ساعة")}`;
    if (days < 30) return `منذ ${formatArabicUnit(days, "يوم", "يومين", "أيام", "يوم")}`;
    if (months < 12) return `منذ ${formatArabicUnit(months, "شهر", "شهرين", "أشهر", "شهر")}`;
    return `منذ ${formatArabicUnit(years, "سنة", "سنتين", "سنوات", "سنة")}`;
  }

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatArabicUnit(count: number, one: string, two: string, few: string, many: string) {
  if (count <= 0) return "";
  if (count === 1) return one;
  if (count === 2) return two;
  if (count <= 10) return `${count} ${few}`;
  return `${count} ${many}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toStarRating(trustScore: number) {
  // Map 0–100 to 0–5 stars, rounded to nearest 0.5.
  const stars = clamp(trustScore, 0, 100) / 20;
  return Math.round(stars * 2) / 2;
}

function formatStarLabel(value: number) {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function StarRating({ value, label }: { value: number; label: string }) {
  const stars = Array.from({ length: 5 }).map((_, index) => {
    const fill = clamp(value - index, 0, 1);
    const fillPct = Math.round(fill * 100);
    return (
      <span key={`star-${index}`} className="relative inline-grid h-5 w-5 place-items-center">
        <Star className="h-5 w-5 text-muted-foreground/45" />
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
        </span>
      </span>
    );
  });

  return (
    <div className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <div className="inline-flex items-center gap-1">{stars}</div>
    </div>
  );
}
