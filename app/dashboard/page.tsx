"use client";

import { Navbar } from "@/components/Navbar";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "@/lib/providers";
import { isAdminUser } from "@/lib/auth-user";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { notFound, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  Eye,
  Facebook,
  Globe2,
  Instagram,
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon,
  Pencil,
  Phone,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  UploadCloud,
  Youtube,
} from "lucide-react";
import {
  detectPlatform,
  generateSearchTerms,
  getRiskStatusFromReportCount,
  getTargetCategoryLabel,
  getTargetHref,
  getTargetAliases,
  getTargetLinks,
  getTargetPhones,
  getTargetReasons,
  hostFromUrl,
  platformLabel,
  TARGET_REASON_OPTIONS,
  TARGET_CATEGORY_OPTIONS,
  targetPayload,
  type TargetLink,
  type TargetRecord,
} from "@/lib/target-utils";
import { detectExistingTargetMatch, type MatchReason } from "@/lib/target-linking";
import { mergeDuplicateTargetIntoCanonical } from "@/lib/merge-targets";
import { findSharedPhoneClusters } from "@/lib/phone-patterns";
import { classifyEvidenceTier } from "@/lib/evidence-classify";
import { syncTargetStats } from "@/lib/trust-score";
import { useLanguage } from "@/lib/i18n/context";

const STATUS_OPTIONS = [
  { value: "warning", labelEn: "Warning", labelAr: "تحذير" },
  { value: "severe_warning", labelEn: "Severe warning", labelAr: "تحذير شديد" },
  { value: "trusted", labelEn: "Trusted", labelAr: "موثوق" },
  { value: "high_risk", labelEn: "High risk", labelAr: "عالي الخطورة" },
  { value: "reviewing", labelEn: "Under review", labelAr: "قيد المراجعة" },
];

const PLATFORM_OPTIONS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
];

const emptyLink: TargetLink = { platform: "facebook", url: "" };

export default function DashboardPage() {
  const { lang } = useLanguage();
  const { user, loading } = useContext(AuthContext);
  const isAdmin = isAdminUser(user);
  const router = useRouter();

  const [targetId, setTargetId] = useState("");
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<string[]>([""]);
  const [type, setType] = useState("page");
  const [category, setCategory] = useState("gaming");
  const [phones, setPhones] = useState<string[]>([""]);
  const [links, setLinks] = useState<TargetLink[]>([{ ...emptyLink }]);
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState("reviewing");
  const [trustScore, setTrustScore] = useState(50);
  const [reportCount, setReportCount] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [claimedByUserId, setClaimedByUserId] = useState("");
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [approvedReports, setApprovedReports] = useState<any[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [reportAdminDrafts, setReportAdminDrafts] = useState<
    Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }>
  >({});
  const [approvedDrafts, setApprovedDrafts] = useState<
    Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }>
  >({});
  const [savingApprovedId, setSavingApprovedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualTargetName, setManualTargetName] = useState("");
  const [manualTargetPhone, setManualTargetPhone] = useState("");
  const [manualTargetLink, setManualTargetLink] = useState("");
  const [manualCategory, setManualCategory] = useState("scam");
  const [manualDescription, setManualDescription] = useState("");
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [manualImagePreviews, setManualImagePreviews] = useState<string[]>([]);
  const [manualSaving, setManualSaving] = useState(false);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [mergeCanonicalInput, setMergeCanonicalInput] = useState("");
  const [mergeDuplicateInput, setMergeDuplicateInput] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetCategoryFilter, setTargetCategoryFilter] = useState("all");

  const cleanPhones = useMemo(() => phones.map((phone) => phone.trim()).filter(Boolean), [phones]);
  const cleanLinks = useMemo(
    () => links.map((link) => ({ ...link, url: link.url.trim() })).filter((link) => link.url),
    [links]
  );
  const previewTerms = useMemo(
    () => generateSearchTerms(name, cleanPhones, cleanLinks, aliases.map((alias) => alias.trim()).filter(Boolean)),
    [name, cleanPhones, cleanLinks, aliases]
  );
  const isEditing = Boolean(targetId);
  const fuzzyThreshold = 0.84;
  const sharedPhoneClusters = useMemo(() => findSharedPhoneClusters(targets), [targets]);
  const filteredTargets = useMemo(() => {
    const query = targetSearch.trim().toLowerCase();
    return targets.filter((target) => {
      const matchesCategory = targetCategoryFilter === "all" || String(target.category || "gaming") === targetCategoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;
      const nameValue = String(target.name || "").toLowerCase();
      const idValue = String(target.id || "").toLowerCase();
      const aliasesValue = getTargetAliases(target).join(" ").toLowerCase();
      const phonesValue = getTargetPhones(target).join(" ");
      return (
        nameValue.includes(query) ||
        idValue.includes(query) ||
        aliasesValue.includes(query) ||
        phonesValue.includes(query)
      );
    });
  }, [targets, targetSearch, targetCategoryFilter]);

  const pendingMatchMap = useMemo(() => {
    const map: Record<string, { target?: TargetRecord; score: number; reason?: MatchReason }> = {};
    for (const report of pendingReports) {
      map[report.id] = detectExistingTargetMatch(report, targets);
    }
    return map;
  }, [pendingReports, targets]);

  const resetForm = () => {
    setTargetId("");
    setCreatedAt(undefined);
    setName("");
    setAliases([""]);
    setType("page");
    setCategory("gaming");
    setPhones([""]);
    setLinks([{ ...emptyLink }]);
    setLogoUrl("");
    setStatus("reviewing");
    setTrustScore(50);
    setReportCount(0);
    setReasons([]);
    setClaimedByUserId("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const applyTarget = (id: string, target: TargetRecord) => {
    const normalizedPhones = getTargetPhones(target);
    const normalizedLinks = getTargetLinks(target);
    setTargetId(id);
    setCreatedAt(target.createdAt);
    setName(target.name || "");
    setAliases(getTargetAliases(target).length ? getTargetAliases(target) : [""]);
    setType(target.type || "page");
    setCategory(String(target.category || "gaming"));
    setPhones(normalizedPhones.length ? normalizedPhones : [""]);
    setLinks(normalizedLinks.length ? normalizedLinks : [{ ...emptyLink }]);
    setLogoUrl(target.logoUrl || "");
    setStatus(target.status || "reviewing");
    setTrustScore(Number(target.trustScore ?? 50));
    setReportCount(Number(target.reportCount ?? 0));
    setReasons(getTargetReasons(target));
    setClaimedByUserId(target.claimedByUserId || "");
    setSuccessMsg("");
    setErrorMsg("");
  };

  const fetchTargets = async () => {
    setListLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "targets"));
      const data = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as TargetRecord))
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
      setTargets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setListLoading(false);
    }
  };

  const fetchPendingReports = async () => {
    setReportsLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "reports"), where("status", "==", "pending")));
      const data: any[] = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setPendingReports(data);
      const drafts: Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }> = {};
      for (const report of data) {
        drafts[report.id] = {
          adminComment: String(report.adminComment || ""),
          adminVerified: Boolean(report.adminVerified),
          adminPinned: Boolean(report.adminPinned),
        };
      }
      setReportAdminDrafts(drafts);
    } catch (error) {
      console.error(error);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchApprovedReportsForTarget = async (id: string) => {
    if (!id) {
      setApprovedReports([]);
      setApprovedDrafts({});
      return;
    }
    setApprovedLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, "reports"), where("targetId", "==", id), where("status", "==", "approved"))
      );
      const data: any[] = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setApprovedReports(data);
      const drafts: Record<string, { adminComment: string; adminVerified: boolean; adminPinned: boolean }> = {};
      for (const report of data) {
        drafts[report.id] = {
          adminComment: String(report.adminComment || ""),
          adminVerified: Boolean(report.adminVerified),
          adminPinned: Boolean(report.adminPinned),
        };
      }
      setApprovedDrafts(drafts);
    } catch (error) {
      console.error(error);
    } finally {
      setApprovedLoading(false);
    }
  };

  const loadTarget = async (id: string) => {
    if (!id.trim()) return;
    setLoadingTarget(true);
    setErrorMsg("");
    try {
      const snap = await getDoc(doc(db, "targets", id.trim()));
      if (!snap.exists()) {
        setErrorMsg(lang === "ar" ? "الـ target ده مش موجود." : "Target does not exist.");
        return;
      }
      applyTarget(snap.id, snap.data() as TargetRecord);
      router.push(`/dashboard?edit=${snap.id}`);
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "حصل خطأ أثناء تحميل بيانات الـ target." : "Failed to load target data.");
    } finally {
      setLoadingTarget(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void fetchTargets();
    void fetchPendingReports();
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (editId) void loadTarget(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !targetId) return;
    void fetchApprovedReportsForTarget(targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, targetId]);

  const approveReport = async (report: any) => {
    try {
      setErrorMsg("");
      const candidateName = String(report.targetName || "").trim();
      if (!candidateName) {
        setErrorMsg(lang === "ar" ? "البلاغ بدون اسم هدف." : "Report is missing target name.");
        return;
      }

      const candidatePool =
        targets.length > 0
          ? targets
          : (await getDocs(collection(db, "targets"))).docs.map(
              (item) => ({ id: item.id, ...item.data() } as TargetRecord)
            );

      const bestMatch = detectExistingTargetMatch(report, candidatePool);
      const resolvedExisting =
        bestMatch.reason === "phone" || bestMatch.reason === "link" || bestMatch.score >= fuzzyThreshold
          ? bestMatch.target
          : undefined;
      const targetId = resolvedExisting?.id || `target_${Date.now()}`;
      const baseData = resolvedExisting;

      const nextReportCount = Number(baseData?.reportCount ?? 0) + 1;
      const payload = targetPayload({
        name: candidateName,
        aliases: baseData ? getTargetAliases(baseData) : [],
        type: String(report.targetType || baseData?.type || "page"),
        category: String(baseData?.category || "gaming"),
        phones: [String(report.targetPhone || ""), ...(baseData ? getTargetPhones(baseData) : [])],
        links: [{ platform: detectPlatform(String(report.targetLink || "")), url: String(report.targetLink || "") }, ...(baseData ? getTargetLinks(baseData) : [])],
        logoUrl: String(baseData?.logoUrl || ""),
        status: getRiskStatusFromReportCount(nextReportCount, String(baseData?.status || "reviewing")),
        trustScore: Number(baseData?.trustScore ?? 45),
        reportCount: nextReportCount,
        reasons: baseData ? getTargetReasons(baseData) : [],
        claimedByUserId: String(baseData?.claimedByUserId || ""),
        createdAt: baseData?.createdAt,
      });

      await setDoc(doc(db, "targets", targetId), payload, { merge: true });
      const evidenceTier = classifyEvidenceTier(
        Array.isArray(report.evidenceImages) ? report.evidenceImages.length : 0,
        String(report.description || "")
      );
      await updateDoc(doc(db, "reports", report.id), {
        status: "approved",
        targetId,
        allowUserEdit: report.allowUserEdit === true,
        editRequestPending: false,
        adminComment: reportAdminDrafts[report.id]?.adminComment || "",
        adminVerified: reportAdminDrafts[report.id]?.adminVerified === true,
        adminPinned: reportAdminDrafts[report.id]?.adminPinned === true,
        evidenceTier,
        reviewedAt: Date.now(),
      });
      await syncTargetStats(db, targetId);
      await addDoc(collection(db, "notifications"), {
        userId: report.authorId,
        reportId: report.id,
        status: "approved",
        title: "Report approved",
        message: "Your report has been approved and added to the target records.",
        read: false,
        createdAt: Date.now(),
      });
      setSuccessMsg(lang === "ar" ? "تم اعتماد البلاغ وإضافته للهدف." : "Report approved and linked to target.");
      await fetchPendingReports();
      await fetchTargets();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر اعتماد البلاغ." : "Failed to approve report.");
    }
  };

  const rejectReport = async (report: any) => {
    try {
      setErrorMsg("");
      await updateDoc(doc(db, "reports", report.id), {
        status: "rejected",
        reviewedAt: Date.now(),
      });
      await addDoc(collection(db, "notifications"), {
        userId: report.authorId,
        reportId: report.id,
        status: "rejected",
        title: "Report rejected",
        message: "Your report was reviewed and rejected.",
        read: false,
        createdAt: Date.now(),
      });
      setSuccessMsg(lang === "ar" ? "تم رفض البلاغ." : "Report rejected.");
      await fetchPendingReports();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر رفض البلاغ." : "Failed to reject report.");
    }
  };

  const saveApprovedDisplayOptions = async (reportId: string) => {
    const draft = approvedDrafts[reportId];
    if (!draft) return;
    try {
      setSavingApprovedId(reportId);
      await updateDoc(doc(db, "reports", reportId), {
        adminComment: draft.adminComment,
        adminVerified: draft.adminVerified,
        adminPinned: draft.adminPinned,
        updatedAt: Date.now(),
      });
      await syncTargetStats(db, targetId);
      setSuccessMsg(lang === "ar" ? "تم تحديث خيارات العرض للبلاغ." : "Report display options updated.");
      await fetchApprovedReportsForTarget(targetId);
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر تحديث خيارات العرض." : "Failed to update display options.");
    } finally {
      setSavingApprovedId(null);
    }
  };

  const handleManualFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const images = selected.filter((file) => file.type.startsWith("image/")).slice(0, 10);
    setManualFiles((prev) => [...prev, ...images].slice(0, 10));
    setManualImagePreviews((prev) => [...prev, ...images.map((file) => URL.createObjectURL(file))].slice(0, 10));
    event.target.value = "";
  };

  const removeManualImage = (index: number) => {
    setManualFiles((prev) => prev.filter((_, i) => i !== index));
    setManualImagePreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  const createManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!manualTargetName.trim() || !manualDescription.trim()) {
      setErrorMsg(lang === "ar" ? "اكتب اسم الهدف ووصف البلاغ على الأقل." : "Target name and report description are required.");
      return;
    }
    setManualSaving(true);
    setErrorMsg("");
    try {
      const uploadedImageUrls: string[] = [];
      if (manualFiles.length > 0) {
        const uploadForm = new FormData();
        uploadForm.set("ownerKey", user.uid);
        manualFiles.forEach((file) => uploadForm.append("files", file));
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
          throw new Error(`manual_upload_failed${details}`);
        }
        uploadedImageUrls.push(...(uploadBody.urls || []));
      }

      const reportPayload = {
        targetName: manualTargetName.trim(),
        targetPhone: manualTargetPhone.trim(),
        targetLink: manualTargetLink.trim(),
      };
      const bestMatch = detectExistingTargetMatch(reportPayload, targets);
      const baseData =
        bestMatch.reason === "phone" || bestMatch.reason === "link" || bestMatch.score >= fuzzyThreshold
          ? bestMatch.target
          : undefined;
      const resolvedTargetId = baseData?.id || `target_${Date.now()}`;
      const nextReportCount = Number(baseData?.reportCount ?? 0) + 1;
      const nextTargetPayload = targetPayload({
        name: manualTargetName.trim(),
        aliases: baseData ? getTargetAliases(baseData) : [],
        type: String(baseData?.type || "page"),
        category: String(baseData?.category || "gaming"),
        phones: [manualTargetPhone.trim(), ...(baseData ? getTargetPhones(baseData) : [])],
        links: [{ platform: detectPlatform(manualTargetLink.trim()), url: manualTargetLink.trim() }, ...(baseData ? getTargetLinks(baseData) : [])],
        logoUrl: String(baseData?.logoUrl || ""),
        status: getRiskStatusFromReportCount(nextReportCount, String(baseData?.status || "reviewing")),
        trustScore: Number(baseData?.trustScore ?? 45),
        reportCount: nextReportCount,
        reasons: baseData ? getTargetReasons(baseData) : [],
        claimedByUserId: String(baseData?.claimedByUserId || ""),
        createdAt: baseData?.createdAt,
      });
      await setDoc(doc(db, "targets", resolvedTargetId), nextTargetPayload, { merge: true });

      const manualEvidenceTier = classifyEvidenceTier(uploadedImageUrls.length, manualDescription.trim());
      await addDoc(collection(db, "reports"), {
        targetId: resolvedTargetId,
        authorId: user.uid,
        authorEmail: user.email || "",
        reporterName: manualCustomerName.trim() || "Manual Entry",
        source: "admin_manual",
        targetName: manualTargetName.trim(),
        targetPhone: manualTargetPhone.trim(),
        targetLink: manualTargetLink.trim(),
        category: manualCategory,
        description: manualDescription.trim(),
        evidenceImages: uploadedImageUrls,
        evidenceTier: manualEvidenceTier,
        status: "approved",
        allowUserEdit: false,
        editRequestPending: false,
        reviewNote: "",
        createdAt: Date.now(),
        reviewedAt: Date.now(),
      });
      await syncTargetStats(db, resolvedTargetId);

      manualImagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setManualCustomerName("");
      setManualTargetName("");
      setManualTargetPhone("");
      setManualTargetLink("");
      setManualCategory("scam");
      setManualDescription("");
      setManualFiles([]);
      setManualImagePreviews([]);
      setSuccessMsg(lang === "ar" ? "تمت إضافة البلاغ اليدوي بنجاح." : "Manual report added successfully.");
      await fetchTargets();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMsg(lang === "ar" ? `فشل إضافة البلاغ اليدوي: ${message}` : `Failed to add manual report: ${message}`);
    } finally {
      setManualSaving(false);
    }
  };

  const handleLogoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!user) {
      setErrorMsg(lang === "ar" ? "سجّل دخولك أولاً لرفع اللوجو." : "Please sign in first to upload logo.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMsg(lang === "ar" ? "ارفع صورة فقط للوجو." : "Please upload an image file for logo.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg(lang === "ar" ? "حجم اللوجو لازم يكون أقل من 4MB." : "Logo image must be smaller than 4MB.");
      return;
    }

    setLogoUploading(true);
    setErrorMsg("");
    try {
      const uploadForm = new FormData();
      uploadForm.set("ownerKey", `${user.uid}_target_logo`);
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
        throw new Error(`logo_upload_failed${details}`);
      }
      const firstUrl = uploadBody.urls?.[0];
      if (!firstUrl) throw new Error("Failed to resolve uploaded logo URL");
      setLogoUrl(firstUrl);
      setSuccessMsg(lang === "ar" ? "تم رفع اللوجو بنجاح." : "Logo uploaded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/logo_upload_failed|manual_upload_failed|cloudinary_not_configured|upload_failed/i.test(message)) {
        setErrorMsg(
          lang === "ar"
            ? "فشل رفع الصورة. تأكد من إعدادات Cloudinary في السيرفر."
            : "Image upload failed. Please verify Cloudinary server configuration."
        );
      } else {
        setErrorMsg(lang === "ar" ? `فشل رفع اللوجو: ${message}` : `Failed to upload logo: ${message}`);
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const updatePhone = (index: number, value: string) => {
    setPhones((current) => current.map((phone, i) => (i === index ? value : phone)));
  };

  const updateAlias = (index: number, value: string) => {
    setAliases((current) => current.map((alias, i) => (i === index ? value : alias)));
  };

  const updateLink = (index: number, patch: Partial<TargetLink>) => {
    setLinks((current) =>
      current.map((link, i) => {
        if (i !== index) return link;
        const next = { ...link, ...patch };
        if (patch.url && !patch.platform) next.platform = detectPlatform(patch.url);
        return next;
      })
    );
  };

  const removePhone = (index: number) => {
    setPhones((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const removeAlias = (index: number) => {
    setAliases((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  const removeLink = (index: number) => {
    setLinks((current) => (current.length === 1 ? [{ ...emptyLink }] : current.filter((_, i) => i !== index)));
  };

  const toggleReason = (reason: string) => {
    setReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    );
  };

  const deleteTarget = async () => {
    if (!user || !isAdmin || !targetId) return;

    const confirmed = window.confirm(
      lang === "ar"
        ? "هل أنت متأكد أنك تريد حذف هذا الـ target؟ سيتم حذف بيانات الصفحة من البحث والقوائم، ولن يتم حذف البلاغات المرتبطة بها."
        : "Are you sure you want to delete this target? The page record will be removed from search and lists. Linked reports will not be deleted."
    );
    if (!confirmed) return;

    setDeletingTarget(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await deleteDoc(doc(db, "targets", targetId));
      await deleteDoc(doc(db, "targetStats", targetId)).catch(() => undefined);
      const deletedId = targetId;
      resetForm();
      setApprovedReports([]);
      setSuccessMsg(
        lang === "ar"
          ? `تم حذف target ${deletedId} بنجاح.`
          : `Target ${deletedId} deleted successfully.`
      );
      router.push("/dashboard");
      await fetchTargets();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "تعذر حذف الـ target. راجع صلاحيات Firestore." : "Failed to delete target. Check Firestore permissions.");
    } finally {
      setDeletingTarget(false);
    }
  };

  const runMergeDuplicates = async () => {
    if (!user) return;
    const canonical = mergeCanonicalInput.trim();
    const duplicate = mergeDuplicateInput.trim();
    if (!canonical || !duplicate || canonical === duplicate) {
      setErrorMsg(lang === "ar" ? "أدخل مُعرّفين صالحين ومختلفين." : "Enter two different valid target ids.");
      return;
    }
    const confirmed = window.confirm(
      lang === "ar"
        ? `سيتم دمج ${duplicate} في ${canonical}. كل البلاغات ستُنقل ولن يُحذف أي بلاغ. متابعة؟`
        : `Merge ${duplicate} → ${canonical}? All reports will be reassigned. Continue?`
    );
    if (!confirmed) return;
    setMergeBusy(true);
    setErrorMsg("");
    try {
      const result = await mergeDuplicateTargetIntoCanonical(db, canonical, duplicate, { actorId: user.uid });
      setSuccessMsg(
        lang === "ar"
          ? `تم الدمج: نُقل ${result.reportsMoved} بلاغ إلى ${canonical}.`
          : `Merged: moved ${result.reportsMoved} report(s) into ${canonical}.`
      );
      setMergeDuplicateInput("");
      if (targetId === duplicate) {
        resetForm();
      }
      await fetchTargets();
    } catch (err) {
      console.error(err);
      setErrorMsg(
        lang === "ar"
          ? `فشل الدمج: ${err instanceof Error ? err.message : String(err)}`
          : `Merge failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setMergeBusy(false);
    }
  };

  const syncAllTargetsStats = async () => {
    if (!isAdmin) return;
    setSyncAllBusy(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const snapshot = await getDocs(collection(db, "targets"));
      const ids = snapshot.docs.map((item) => item.id);
      for (const id of ids) {
        await syncTargetStats(db, id);
      }
      await fetchTargets();
      setSuccessMsg(
        lang === "ar"
          ? `تمت مزامنة الإحصائيات لـ ${ids.length} صفحة.`
          : `Synced stats for ${ids.length} targets.`
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(
        lang === "ar"
          ? `فشل مزامنة الإحصائيات: ${err instanceof Error ? err.message : String(err)}`
          : `Failed syncing stats: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSyncAllBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    if (!name.trim()) {
      setErrorMsg(lang === "ar" ? "لازم تكتب اسم الصفحة أو البائع." : "Page or seller name is required.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const id = targetId || "target_" + Date.now();
      const payload = targetPayload({
        name,
        aliases,
        type,
        category,
        phones,
        links,
        logoUrl,
        status: getRiskStatusFromReportCount(reportCount, status),
        trustScore,
        reportCount,
        reasons,
        claimedByUserId,
        createdAt,
      });

      await setDoc(doc(db, "targets", id), payload, { merge: isEditing });
      await syncTargetStats(db, id);
      setTargetId(id);
      setCreatedAt(payload.createdAt);
      setSuccessMsg(isEditing ? (lang === "ar" ? "تم تعديل بيانات الصفحة بنجاح." : "Target updated successfully.") : (lang === "ar" ? "تمت إضافة الصفحة بنجاح." : "Target created successfully."));
      router.push(`/dashboard?edit=${id}`);
      await fetchTargets();
    } catch (error) {
      console.error(error);
      setErrorMsg(lang === "ar" ? "حصل خطأ أثناء حفظ البيانات في Firestore. راجع قواعد Firestore لو التعديل مرفوض." : "Failed to save data to Firestore. Check security rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-28 min-h-screen">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2">{lang === "ar" ? "لوحة إدارة الصفحات" : "Target management"}</h1>
            <p className="text-muted-foreground font-medium">
              {lang === "ar" ? "أضف أو عدل بيانات الصفحة، الأرقام، اللينكات، واللوجو من مكان واحد." : "Create or edit target data, phone numbers, links, and logo from one place."}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-bold hover:bg-secondary/70"
            >
              <Plus className="w-4 h-4" />
              {lang === "ar" ? "Target جديد" : "New target"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{lang === "ar" ? "جاري تحميل الحساب..." : "Loading account..."}</span>
          </div>
        ) : !user || !isAdmin ? (
          <UnauthorizedNotFound />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-5 md:p-8 space-y-6">
              <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-primary dark:text-neon-blue">{isEditing ? (lang === "ar" ? "وضع التعديل" : "Edit mode") : (lang === "ar" ? "إضافة جديدة" : "Create mode")}</p>
                  <h2 className="text-2xl font-black">{isEditing ? targetId : (lang === "ar" ? "Target جديد" : "New target")}</h2>
                </div>
                {isEditing && (
                  <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(getTargetHref({ id: targetId, name }))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary"
                  >
                    <Eye className="w-4 h-4" />
                    {lang === "ar" ? "معاينة الصفحة" : "Preview page"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTarget()}
                    disabled={deletingTarget}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/15 disabled:opacity-60"
                  >
                    {deletingTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {lang === "ar" ? "حذف Target" : "Delete target"}
                  </button>
                  </div>
                )}
              </div>

              {errorMsg && <AlertBox tone="danger" text={errorMsg} />}
              {successMsg && <AlertBox tone="success" text={successMsg} />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={lang === "ar" ? "الاسم *" : "Name *"}>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Store Online Media" />
                </Field>

                <Field label={lang === "ar" ? "النوع / Badge" : "Type / badge"}>
                  <input value={type} onChange={(e) => setType(e.target.value)} className="input" placeholder="page / seller / whatsapp" />
                </Field>

                <Field label={lang === "ar" ? "تصنيف الصفحة" : "Page category"}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                    {TARGET_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {lang === "ar" ? option.labelAr : option.labelEn}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={lang === "ar" ? "الحالة" : "Status"}>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {lang === "ar" ? option.labelAr : option.labelEn}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Trust Score (0-100)">
                  <input type="number" min={0} max={100} value={trustScore} onChange={(e) => setTrustScore(Number(e.target.value))} className="input" />
                </Field>

                <Field label={lang === "ar" ? "عدد البلاغات" : "Reports count"}>
                  <input type="number" min={0} value={reportCount} onChange={(e) => setReportCount(Number(e.target.value))} className="input" />
                </Field>

                <Field label={lang === "ar" ? "لوجو اختياري" : "Optional logo"}>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} dir="ltr" className="input" placeholder="https://.../logo.png" />
                      <button
                        type="button"
                        disabled={logoUploading}
                        onClick={() => logoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-bold hover:bg-secondary/70 disabled:opacity-60"
                      >
                        {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        <span>{lang === "ar" ? "رفع" : "Upload"}</span>
                      </button>
                    </div>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileSelected}
                      className="hidden"
                    />
                  </div>
                </Field>

                <Field label={lang === "ar" ? "claimedByUserId (اختياري)" : "claimedByUserId (optional)"}>
                  <input value={claimedByUserId} onChange={(e) => setClaimedByUserId(e.target.value)} className="input" placeholder={lang === "ar" ? "uid لو عايز يظهر كبائع موثق" : "uid to mark this as verified seller"} />
                </Field>
              </div>

              <DynamicSection title={lang === "ar" ? "أرقام الهاتف" : "Phone numbers"} action={lang === "ar" ? "إضافة رقم" : "Add number"} onAdd={() => setPhones((current) => [...current, ""])}>
                {phones.map((phone, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={phone} onChange={(e) => updatePhone(index, e.target.value)} dir="ltr" className="input pl-10" placeholder="01012345678" />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف الرقم" : "Delete number"} onClick={() => removePhone(index)}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <DynamicSection title={lang === "ar" ? "\u0623\u0633\u0645\u0627\u0621 \u0623\u062e\u0631\u0649 \u0644\u0644\u0635\u0641\u062d\u0629" : "Other page names"} action={lang === "ar" ? "\u0625\u0636\u0627\u0641\u0629 \u0627\u0633\u0645" : "Add name"} onAdd={() => setAliases((current) => [...current, ""])}>
                {aliases.map((alias, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1">
                      <BadgeInfo className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={alias}
                        onChange={(e) => updateAlias(index, e.target.value)}
                        className="input pl-10"
                        placeholder={lang === "ar" ? "\u0627\u0633\u0645 \u0642\u062f\u064a\u0645 \u0623\u0648 \u0627\u0633\u0645 \u0628\u062f\u064a\u0644" : "Old name or alternative page name"}
                      />
                    </div>
                    <IconButton label={lang === "ar" ? "\u062d\u0630\u0641 \u0627\u0644\u0627\u0633\u0645" : "Delete name"} onClick={() => removeAlias(index)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>
              <DynamicSection title={lang === "ar" ? "روابط الصفحات والسوشيال" : "Page and social links"} action={lang === "ar" ? "إضافة لينك" : "Add link"} onAdd={() => setLinks((current) => [...current, { ...emptyLink }])}>
                {links.map((link, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr_auto]">
                    <select value={link.platform} onChange={(e) => updateLink(index, { platform: e.target.value })} className="input">
                      {PLATFORM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <PlatformIcon platform={link.platform} className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={link.url} onChange={(e) => updateLink(index, { url: e.target.value })} dir="ltr" className="input pl-10" placeholder="https://facebook.com/..." />
                    </div>
                    <IconButton label={lang === "ar" ? "حذف اللينك" : "Delete link"} onClick={() => removeLink(index)}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                ))}
              </DynamicSection>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide">
                        {lang === "ar" ? "\u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u062a\u062d\u0630\u064a\u0631" : "REASONS"}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {lang === "ar"
                          ? "\u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u062a\u064a \u0633\u062a\u0638\u0647\u0631 \u0644\u0644\u0639\u0645\u064a\u0644 \u0641\u064a \u0635\u0641\u062d\u0629 \u0627\u0644\u0647\u062f\u0641."
                          : "Pick the warning badges customers will see on the target page."}
                      </p>
                    </div>
                  </div>
                  {reasons.length > 0 && (
                    <span className="w-fit rounded-full bg-background px-3 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
                      {reasons.length} selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TARGET_REASON_OPTIONS.map((option) => {
                    const selected = reasons.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleReason(option.value)}
                        className={`min-h-[92px] rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                          selected
                            ? "border-amber-500 bg-amber-500/15 text-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.25)]"
                            : "border-border bg-background/70 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/10"
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-wide">
                            {lang === "ar" ? option.labelAr : option.labelEn}
                          </span>
                          <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
                        </span>
                        <span className="mt-1 block text-xs leading-5">
                          {lang === "ar" ? option.descriptionAr : option.descriptionEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/40 border border-border p-4">
                <p className="text-sm font-bold mb-2">Preview searchTerms:</p>
                <p className="text-xs text-muted-foreground break-words">
                  {previewTerms.length > 0 ? previewTerms.join(" , ") : (lang === "ar" ? "اكتب اسم/رقم/لينك عشان يتولدوا تلقائيا" : "Enter name/phone/link to generate search terms")}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving || loadingTarget}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary dark:bg-neon-blue text-white dark:text-black font-bold px-6 py-3 rounded-xl disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                <span>{saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : isEditing ? (lang === "ar" ? "حفظ التعديل" : "Save changes") : (lang === "ar" ? "إضافة Target" : "Create target")}</span>
              </button>
            </form>

            <aside className="glass-panel rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">{lang === "ar" ? "الصفحات الحالية" : "Existing targets"}</h2>
                {listLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex gap-2">
                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="target_1777892300416"
                />
                <button
                  type="button"
                  onClick={() => loadTarget(targetId)}
                  disabled={loadingTarget}
                  className="rounded-xl bg-secondary px-4 font-bold hover:bg-secondary/70 disabled:opacity-60"
                >
                  {loadingTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "تحميل" : "Load")}
                </button>
              </div>

              <div className="space-y-2">
                <input
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  className="input"
                  placeholder={lang === "ar" ? "ابحث بالاسم / ID / رقم الهاتف" : "Search by name / ID / phone"}
                />
                <select
                  value={targetCategoryFilter}
                  onChange={(e) => setTargetCategoryFilter(e.target.value)}
                  className="input"
                >
                  <option value="all">{lang === "ar" ? "كل التصنيفات" : "All categories"}</option>
                  {TARGET_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {lang === "ar" ? option.labelAr : option.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {filteredTargets.map((target) => (
                  <div key={target.id} className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{target.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                          {target.id}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary dark:text-neon-blue">
                            {getTargetCategoryLabel(String(target.category || "gaming"), lang)}
                          </span>
                          {getTargetPhones(target).slice(0, 1).map((phone) => (
                            <span key={phone} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground" dir="ltr">
                              {phone}
                            </span>
                          ))}
                          {getTargetLinks(target).slice(0, 1).map((link) => (
                            <span key={link.url} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                              {platformLabel(link.platform)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => target.id && applyTarget(target.id, target)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:bg-secondary"
                        aria-label={lang === "ar" ? "تعديل" : "Edit"}
                      >
                        {lang === "ar" ? "تعديل" : "Edit"}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTargets.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar" ? "لا توجد صفحات مطابقة للفلاتر الحالية." : "No targets match the current filters."}
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}

        {isAdmin && (
          <section className="mt-8 glass-panel rounded-3xl p-5 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black">
                {lang === "ar" ? "التعليق المثبت والتوثيق (بلاغات موثقة)" : "Pinned note & verification (verified reports)"}
              </h2>
              {approvedLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            {!targetId ? (
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "حمّل Target أولاً من القائمة الجانبية." : "Load a target first from the sidebar."}
              </p>
            ) : approvedReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "لا توجد بلاغات موثقة لهذا الهدف بعد." : "No verified reports for this target yet."}
              </p>
            ) : (
              <div className="space-y-4">
                {approvedReports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-border bg-background/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate">{report.reporterName || report.authorEmail || report.id}</p>
                      <span className="text-xs text-muted-foreground" dir="ltr">#{report.id}</span>
                    </div>
                    <textarea
                      value={approvedDrafts[report.id]?.adminComment || ""}
                      onChange={(e) =>
                        setApprovedDrafts((prev) => ({
                          ...prev,
                          [report.id]: {
                            adminComment: e.target.value,
                            adminVerified: prev[report.id]?.adminVerified ?? false,
                            adminPinned: prev[report.id]?.adminPinned ?? false,
                          },
                        }))
                      }
                      className="input min-h-[90px]"
                      placeholder={lang === "ar" ? "تعليق الإدارة المثبت..." : "Pinned admin note..."}
                    />
                    <div className="flex flex-wrap gap-3 text-xs">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-background cursor-pointer">
                        <input
                          type="checkbox"
                          checked={approvedDrafts[report.id]?.adminVerified || false}
                          onChange={(e) =>
                            setApprovedDrafts((prev) => ({
                              ...prev,
                              [report.id]: {
                                adminComment: prev[report.id]?.adminComment ?? "",
                                adminVerified: e.target.checked,
                                adminPinned: prev[report.id]?.adminPinned ?? false,
                              },
                            }))
                          }
                        />
                        <span>{lang === "ar" ? "موثق من الإدارة" : "Verified by admin"}</span>
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-background cursor-pointer">
                        <input
                          type="checkbox"
                          checked={approvedDrafts[report.id]?.adminPinned || false}
                          onChange={(e) =>
                            setApprovedDrafts((prev) => ({
                              ...prev,
                              [report.id]: {
                                adminComment: prev[report.id]?.adminComment ?? "",
                                adminVerified: prev[report.id]?.adminVerified ?? false,
                                adminPinned: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{lang === "ar" ? "تثبيت أولاً" : "Pin first"}</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={savingApprovedId === report.id}
                      onClick={() => void saveApprovedDisplayOptions(report.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
                    >
                      {savingApprovedId === report.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{lang === "ar" ? "حفظ" : "Save"}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="mt-8 glass-panel rounded-3xl p-5 md:p-8">
            <h2 className="text-2xl font-black mb-4">
              {lang === "ar" ? "إضافة بلاغ يدوي (نيابة عن عميل)" : "Add manual report (on behalf of customer)"}
            </h2>
            <form onSubmit={createManualReport} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={lang === "ar" ? "اسم العميل" : "Customer name"}>
                  <input value={manualCustomerName} onChange={(e) => setManualCustomerName(e.target.value)} className="input" placeholder={lang === "ar" ? "اسم العميل كما قاله" : "Customer name"} />
                </Field>
                <Field label={lang === "ar" ? "اسم الصفحة / البائع *" : "Target name *"}>
                  <input required value={manualTargetName} onChange={(e) => setManualTargetName(e.target.value)} className="input" placeholder="Ferrari station" />
                </Field>
                <Field label={lang === "ar" ? "رقم الهاتف" : "Phone number"}>
                  <input value={manualTargetPhone} onChange={(e) => setManualTargetPhone(e.target.value)} className="input" dir="ltr" placeholder="01012345678" />
                </Field>
                <Field label={lang === "ar" ? "رابط الصفحة" : "Page link"}>
                  <input value={manualTargetLink} onChange={(e) => setManualTargetLink(e.target.value)} className="input" dir="ltr" placeholder="https://facebook.com/..." />
                </Field>
                <Field label={lang === "ar" ? "التصنيف" : "Category"}>
                  <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} className="input">
                    <option value="scam">{lang === "ar" ? "نصب / سرقة" : "Scam / theft"}</option>
                    <option value="delay">{lang === "ar" ? "تأخير متعمد" : "Intentional delay"}</option>
                    <option value="bad_treatment">{lang === "ar" ? "سوء تعامل / إساءة" : "Poor treatment / abuse"}</option>
                    <option value="suspicious_untrusted">{lang === "ar" ? "مشبوهة / غير موثوق" : "Suspicious / untrusted"}</option>
                    <option value="successful_transaction">{lang === "ar" ? "تجربة ناجحة" : "Successful transaction"}</option>
                  </select>
                </Field>
              </div>
              <Field label={lang === "ar" ? "وصف البلاغ *" : "Report description *"}>
                <textarea required value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} className="input min-h-[120px]" placeholder={lang === "ar" ? "اكتب تفاصيل الشكوى كاملة..." : "Write full complaint details..."} />
              </Field>

              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground">{lang === "ar" ? "صور الأدلة (حتى 10 صور)" : "Evidence images (up to 10)"}</p>
                <div className="flex flex-wrap gap-2">
                  {manualImagePreviews.map((img, idx) => (
                    <div key={`manual-img-${idx}`} className="relative">
                      <img src={img} alt="Evidence" className="w-20 h-20 rounded-lg border border-border object-cover" />
                      <button type="button" onClick={() => removeManualImage(idx)} className="absolute -top-1 -right-1 rounded-full bg-black/80 text-white text-xs w-5 h-5">
                        x
                      </button>
                    </div>
                  ))}
                  {manualImagePreviews.length < 10 && (
                    <button type="button" onClick={() => manualFileInputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <input ref={manualFileInputRef} type="file" accept="image/*" multiple onChange={handleManualFilesSelected} className="hidden" />
              </div>

              <button type="submit" disabled={manualSaving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {manualSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                <span>{lang === "ar" ? "إضافة البلاغ اليدوي" : "Add manual report"}</span>
              </button>
            </form>
          </section>
        )}

        {isAdmin && (
          <section className="mt-8 glass-panel rounded-3xl p-5 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black">{lang === "ar" ? "بلاغات بانتظار المراجعة" : "Pending reports for review"}</h2>
              {reportsLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <div className="space-y-3">
              {pendingReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد بلاغات معلقة حاليًا." : "No pending reports right now."}</p>
              ) : (
                pendingReports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-border p-5 bg-background/60 space-y-4">
                    {(() => {
                      const match = pendingMatchMap[report.id];
                      const willMerge =
                        !!match?.target &&
                        (match.reason === "phone" || match.reason === "link" || (match.score ?? 0) >= fuzzyThreshold);
                      if (!willMerge) return null;
                      const percent = Math.round((match.score ?? 0) * 100);
                      const reasonLabel =
                        match.reason === "phone"
                          ? (lang === "ar" ? "مطابقة رقم الهاتف" : "Phone match")
                          : match.reason === "link"
                            ? (lang === "ar" ? "مطابقة رابط الصفحة" : "Link match")
                            : (lang === "ar" ? "مطابقة اسم مشابه" : "Fuzzy name match");
                      return (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {lang === "ar" ? "سيتم الدمج مع هدف موجود" : "Will merge with existing target"}:
                          </span>{" "}
                          <span className="font-semibold">{match.target?.name || "-"}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            ({reasonLabel} - {percent}%)
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                            {lang === "ar" ? "بلاغ جديد" : "Pending report"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-background border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {report.category || "-"}
                          </span>
                          <span className="text-xs text-muted-foreground" dir="ltr">
                            #{report.id}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border bg-background/70 p-3">
                            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
                              {lang === "ar" ? "اسم الهدف" : "Target name"}
                            </p>
                            <p className="font-semibold break-words">{report.targetName || "-"}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-background/70 p-3">
                            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
                              {lang === "ar" ? "مقدم البلاغ" : "Reporter"}
                            </p>
                            <p className="font-semibold break-words">{report.authorEmail || report.authorId || "-"}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-background/70 p-3">
                            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
                              {lang === "ar" ? "رقم الهاتف" : "Phone"}
                            </p>
                            <p className="font-semibold break-words" dir="ltr">{report.targetPhone || "-"}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-background/70 p-3">
                            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
                              {lang === "ar" ? "رابط الصفحة" : "Page link"}
                            </p>
                            {report.targetLink ? (
                              <a href={report.targetLink} target="_blank" rel="noreferrer" className="font-semibold text-primary underline break-all" dir="ltr">
                                {report.targetLink}
                              </a>
                            ) : (
                              <p className="font-semibold">-</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-background/70 p-3">
                          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">
                            {lang === "ar" ? "وصف البلاغ (كامل)" : "Full report description"}
                          </p>
                          <p className="text-sm leading-7 whitespace-pre-wrap break-words">{report.description || "-"}</p>
                        </div>

                        {Array.isArray(report.evidenceImages) && report.evidenceImages.length > 0 && (
                          <div className="rounded-xl border border-border bg-background/70 p-3">
                            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">
                              {lang === "ar" ? "الأدلة المرفقة" : "Attached evidence"}
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {report.evidenceImages.map((img: string, idx: number) => (
                                <a key={`${report.id}-img-${idx}`} href={img} target="_blank" rel="noreferrer" className="block shrink-0">
                                  <img src={img} alt="Evidence" className="w-20 h-20 rounded-lg object-cover border border-border" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="rounded-xl border border-border bg-background/70 p-3 space-y-3">
                          <p className="text-[11px] font-bold uppercase text-muted-foreground">
                            {lang === "ar" ? "خيارات عرض البلاغ" : "Report display options"}
                          </p>
                          <textarea
                            value={reportAdminDrafts[report.id]?.adminComment || ""}
                            onChange={(e) =>
                              setReportAdminDrafts((prev) => ({
                                ...prev,
                                [report.id]: {
                                  adminComment: e.target.value,
                                  adminVerified: prev[report.id]?.adminVerified ?? false,
                                  adminPinned: prev[report.id]?.adminPinned ?? false,
                                },
                              }))
                            }
                            className="input min-h-[90px]"
                            placeholder={lang === "ar" ? "تعليق الأدمن الذي سيظهر أعلى البلاغ..." : "Admin comment shown above this report..."}
                          />
                          <div className="flex flex-wrap gap-3 text-xs">
                            <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-background cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reportAdminDrafts[report.id]?.adminVerified || false}
                                onChange={(e) =>
                                  setReportAdminDrafts((prev) => ({
                                    ...prev,
                                    [report.id]: {
                                      adminComment: prev[report.id]?.adminComment ?? "",
                                      adminVerified: e.target.checked,
                                      adminPinned: prev[report.id]?.adminPinned ?? false,
                                    },
                                  }))
                                }
                              />
                              <span>{lang === "ar" ? "إضافة علامة التوثيق" : "Show verification badge"}</span>
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-background cursor-pointer">
                              <input
                                type="checkbox"
                                checked={reportAdminDrafts[report.id]?.adminPinned || false}
                                onChange={(e) =>
                                  setReportAdminDrafts((prev) => ({
                                    ...prev,
                                    [report.id]: {
                                      adminComment: prev[report.id]?.adminComment ?? "",
                                      adminVerified: prev[report.id]?.adminVerified ?? false,
                                      adminPinned: e.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span>{lang === "ar" ? "تثبيت هذا البلاغ أولاً" : "Pin this report first"}</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:min-w-[120px]">
                        <p className="text-xs text-muted-foreground">
                          {lang === "ar" ? "تاريخ الإرسال" : "Submitted"}:{" "}
                          <span className="font-semibold">
                            {report.createdAt ? new Date(report.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "-"}
                          </span>
                        </p>
                        <button type="button" onClick={() => void approveReport(report)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600">
                          {lang === "ar" ? "اعتماد" : "Approve"}
                        </button>
                        <button type="button" onClick={() => void rejectReport(report)} className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-bold hover:opacity-90">
                          {lang === "ar" ? "رفض" : "Reject"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="mt-8 glass-panel rounded-3xl p-5 md:p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-black">{lang === "ar" ? "سلامة البيانات والدمج" : "Data integrity & merge"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar"
                  ? "دمج صفحات مكررة بأمان: نقل كل البلاغات ثم إعادة حساب الإحصائيات."
                  : "Safely merge duplicate pages: reassign all reports, then recompute stats."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={syncAllBusy}
                onClick={() => void syncAllTargetsStats()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {syncAllBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
                {lang === "ar" ? "Sync الإحصائيات لكل الصفحات" : "Sync stats for all targets"}
              </button>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "شغّلها مرة بعد أي تحديثات كبيرة أو ترحيل بيانات."
                  : "Run once after major logic changes or data migration."}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Field label={lang === "ar" ? "المعرّف الأساسي (يبقى)" : "Canonical target id (kept)"}>
                <input
                  value={mergeCanonicalInput}
                  onChange={(e) => setMergeCanonicalInput(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="target_abc"
                />
              </Field>
              <Field label={lang === "ar" ? "المعرّف المكرر (يُحذف)" : "Duplicate target id (removed)"}>
                <input
                  value={mergeDuplicateInput}
                  onChange={(e) => setMergeDuplicateInput(e.target.value)}
                  dir="ltr"
                  className="input"
                  placeholder="target_xyz"
                />
              </Field>
              <button
                type="button"
                disabled={mergeBusy}
                onClick={() => void runMergeDuplicates()}
                className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {mergeBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
                {lang === "ar" ? "دمج الآن" : "Merge now"}
              </button>
            </div>
            <div>
              <h3 className="text-lg font-black mb-2">{lang === "ar" ? "أرقام مشتركة بين عدة صفحات" : "Shared phone numbers (suspicious clusters)"}</h3>
              {sharedPhoneClusters.length === 0 ? (
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد تداخل حالياً." : "No overlapping numbers detected."}</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {sharedPhoneClusters.map((c) => (
                    <li key={c.phone} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <span className="font-mono font-bold" dir="ltr">
                        {c.phone}
                      </span>
                      <span className="text-muted-foreground"> — {c.count} targets</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.targetIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setMergeCanonicalInput((cur) => cur || id);
                              void loadTarget(id);
                            }}
                            className="rounded bg-secondary px-2 py-0.5 text-xs font-mono"
                            dir="ltr"
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 block">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DynamicSection({
  title,
  action,
  onAdd,
  children,
}: {
  title: string;
  action: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">{title}</h3>
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold hover:bg-secondary/70">
          <Plus className="w-4 h-4" />
          {action}
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-xl border border-border px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={label} title={label}>
      {children}
    </button>
  );
}

function AlertBox({ tone, text }: { tone: "danger" | "success"; text: string }) {
  const isSuccess = tone === "success";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${isSuccess ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      <div className="flex items-center gap-2">
        {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        <span>{text}</span>
      </div>
    </div>
  );
}

function AccessMessage({ tone, title, text }: { tone: "warning" | "danger"; title: string; text: string }) {
  const isDanger = tone === "danger";
  return (
    <div className={`glass-panel rounded-2xl p-6 border ${isDanger ? "border-destructive/30" : "border-yellow-500/30"}`}>
      <div className={`flex items-start gap-3 ${isDanger ? "text-destructive" : "text-yellow-500"}`}>
        <AlertCircle className="w-5 h-5 mt-0.5" />
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{text}</p>
        </div>
      </div>
    </div>
  );
}

function UnauthorizedNotFound() {
  notFound();
  return null;
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "facebook") return <Facebook className={className} />;
  if (platform === "instagram") return <Instagram className={className} />;
  if (platform === "youtube") return <Youtube className={className} />;
  if (platform === "website") return <Globe2 className={className} />;
  return <LinkIcon className={className} />;
}
